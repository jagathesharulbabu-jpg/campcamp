"""
PopupLeads Hub - Google Sheets Live Synchronizer
Features:
1. Daily Date Tab Resolution:
   Sheet tabs are created as 'DD-mmm-YY' (e.g. '25-nov-26', '24-nov-26', '23-nov-26', etc.).
   Automatically tracks today's date tab by default with manual override option.
2. Simple 1-to-1 Country Campaign ↔ Sheet Column Mapping:
   Each client campaign on the dashboard maps to its individual Google Sheet column (field name).
   Can be locked to prevent accidental changes.
"""

import os
import json
import csv
import io
import re
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from django.conf import settings
from django.utils import timezone
from django.core.cache import cache

SHEET_1_ID = "1xMdCTsAcT2vhr4cP32u2oElzDPN2e7UmoeROroLk3Lc"
SHEET_2_ID = "14BY_Fnfw4f9hmcOGaPqIA6mC0pOkGRTivrimwC4uhmQ"

SETTINGS_FILE_PATH = os.path.join(settings.BASE_DIR, 'sheet_settings.json')

AVAILABLE_SHEET_COLUMNS = [
    'DE pulkit',
    'de anshu',
    'de salm',
    'IT pulkit',
    'AT pulkit',
    'CH pulkit',
    'uk mj',
    'us mj',
    'us maxy',
    'BE ARUN',
    'ms ARUN'
]

FALLBACK_COLUMN_CALLS = {
    'DE pulkit': 0,
    'IT pulkit': 0,
    'us mj': 0,
    'de salm': 0,
    'CH pulkit': 0,
    'AT pulkit': 0,
    'de anshu': 0,
    'ms ARUN': 0,
    'us maxy': 0,
    'uk mj': 0,
    'BE ARUN': 0,
}

DEFAULT_SETTINGS = {
    "tab_mode": "auto",
    "today_tab": "",
    "sheet1_gid": "",
    "sheet2_gid": "",
    "sheet1_tab_override": "",
    "sheet2_tab_override": "",
    "is_locked": True,
    "client_mappings": {
        "8": "DE pulkit",
        "9": "IT pulkit",
        "10": "CH pulkit",
        "11": "AT pulkit",
        "12": "de anshu",
        "13": "de salm",
        "14": "us mj",
        "15": "us maxy",
        "16": "uk mj",
        "17": "BE ARUN"
    }
}


def get_today_tab_name():
    """Generates today's tab name in 'DD-mmm-YY' format, e.g. '25-nov-26'."""
    now = timezone.now()
    return now.strftime("%d-%b-%y").lower()


def get_recent_tab_names(limit=10):
    """Returns the list of recent tabs matching the user's format (e.g. 25-nov-26, 24-nov-26, etc.)."""
    now = timezone.now()
    tabs = []
    # Generate past days
    for i in range(limit):
        d = now - timedelta(days=i)
        tabs.append(d.strftime("%d-%b-%y").lower())
    return tabs


def get_sheet_settings():
    """Reads persistent configuration from sheet_settings.json."""
    if os.path.exists(SETTINGS_FILE_PATH):
        try:
            with open(SETTINGS_FILE_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return {**DEFAULT_SETTINGS, **data}
        except Exception:
            pass
    return DEFAULT_SETTINGS.copy()


def save_sheet_settings(data):
    """Saves updated settings to sheet_settings.json and invalidates sync cache."""
    current = get_sheet_settings()
    current.update(data)
    try:
        with open(SETTINGS_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(current, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving sheet_settings.json: {e}")
        return False

    cache.delete("sheet_today_calls_summary_v2")
    cache.delete("cached_column_calls_v2")
    return True


def fetch_sheet_csv_by_tab_name(sheet_id, tab_name, timeout=6, custom_gid=None):
    """Downloads CSV data for specific tab name or GID from Google Sheet."""
    import urllib.parse

    # 1. Try candidate tab names FIRST (auto-adapting 26-nov-26, 26-nov, Nov 26, etc.)
    candidates = [str(tab_name)]
    t_str = str(tab_name).strip()
    if '-26' in t_str:
        candidates.append(t_str.replace('-26', ''))
    elif not t_str.endswith('-26'):
        candidates.append(f"{t_str}-26")

    # Add month/day permutation variants (e.g. 26-nov -> Nov 26, nov 26, 26 Nov)
    parts = t_str.replace('-26', '').split('-')
    if len(parts) == 2:
        d, m = parts[0], parts[1]
        candidates.append(f"{m} {d}")
        candidates.append(f"{m.title()} {d}")
        candidates.append(f"{d} {m}")
        candidates.append(f"{d} {m.title()}")

    # Common casing
    for c in list(candidates):
        candidates.append(c.lower())
        candidates.append(c.title())

    seen = set()
    unique_candidates = [x for x in candidates if not (x in seen or seen.add(x))]

    for candidate in unique_candidates:
        csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:csv&sheet={urllib.parse.quote(str(candidate))}"
        try:
            req = urllib.request.Request(
                csv_url,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/csv,text/plain,*/*'
                }
            )
            with urllib.request.urlopen(req, timeout=timeout) as response:
                content = response.read().decode('utf-8', errors='ignore')
                reader = list(csv.reader(io.StringIO(content)))
                if reader and len(reader) > 0:
                    return reader
        except Exception:
            continue

    # 2. If tab name matching failed AND explicit GID provided (e.g. manual override), try GID
    if custom_gid:
        try:
            gid_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={custom_gid}"
            req = urllib.request.Request(gid_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=timeout) as response:
                content = response.read().decode('utf-8', errors='ignore')
                reader = list(csv.reader(io.StringIO(content)))
                if reader and len(reader) > 0:
                    return reader
        except Exception:
            pass

    return []


def parse_raw_column_calls(rows):
    """Counts non-empty phone rows under each column in Row 1."""
    if not rows or len(rows) < 1:
        return {}, []

    header_row = rows[0]
    raw_counts = {}
    ordered_headers = []

    for col_idx, header in enumerate(header_row):
        header_str = str(header).strip()
        if not header_str:
            continue

        ordered_headers.append(header_str)
        call_count = 0
        for row in rows[1:]:
            if col_idx < len(row):
                val = str(row[col_idx]).strip()
                if val and val not in ('-', 'N/A', 'NONE', 'NULL', header_str):
                    call_count += 1

        raw_counts[header_str] = call_count

    return raw_counts, ordered_headers


def get_column_call_counts():
    """Returns raw call counts dictionary for all known sheet columns."""
    summary = sync_today_calls_from_sheets(force=False)
    return summary.get('column_call_counts', FALLBACK_COLUMN_CALLS)


def sync_today_calls_from_sheets(force=False, quick=False):
    """
    Main sync engine:
    1. Reads active tab name (e.g. '25-nov-26').
    2. Downloads and counts calls for each column.
    3. Resolves each client campaign's calls directly from its mapped sheet field.
    """
    cache_key = "sheet_today_calls_summary_v4"
    if not force:
        cached = cache.get(cache_key)
        if cached:
            return cached
        if quick:
            # Fast return for initial page render: load immediately without blocking HTTP calls
            settings_data = get_sheet_settings()
            tab_mode = settings_data.get('tab_mode', 'auto')
            today_tab = get_today_tab_name()
            active_tab_name = today_tab if tab_mode == 'auto' else (settings_data.get('sheet1_tab_override') or today_tab)
            return {
                'active_tab_name': active_tab_name,
                'today_tab': today_tab,
                'tab_mode': tab_mode,
                'sheet_connected': False,
                'available_columns': [
                    'DE pulkit', 'de anshu', 'de salm',
                    'AT pulkit', 'IT pulkit', 'CH pulkit',
                    'uk mj', 'us mj', 'us maxy',
                    'BE ARUN', 'ms ARUN'
                ],
                'column_call_counts': FALLBACK_COLUMN_CALLS.copy(),
                'client_mappings': settings_data.get('client_mappings', {}),
                'is_locked': settings_data.get('is_locked', True),
                'recent_tabs': get_recent_tab_names(5)
            }

    settings_data = get_sheet_settings()
    tab_mode = settings_data.get('tab_mode', 'auto')
    today_tab = get_today_tab_name()

    if tab_mode == 'auto':
        active_tab_name = today_tab
        s1_tab = today_tab
        s2_tab = today_tab
        s1_gid = None
        s2_gid = None
    else:
        active_tab_name = settings_data.get('sheet1_tab_override') or today_tab
        s1_tab = active_tab_name
        s2_tab = settings_data.get('sheet2_tab_override') or active_tab_name
        s1_gid = settings_data.get('sheet1_gid')
        s2_gid = settings_data.get('sheet2_gid')

    is_locked = settings_data.get('is_locked', True)
    client_mappings = settings_data.get('client_mappings', {})

    # Fetch rows
    rows_sheet1 = fetch_sheet_csv_by_tab_name(SHEET_1_ID, s1_tab, custom_gid=s1_gid)
    rows_sheet2 = fetch_sheet_csv_by_tab_name(SHEET_2_ID, s2_tab, custom_gid=s2_gid)

    sheet1_connected = len(rows_sheet1) > 0
    sheet2_connected = len(rows_sheet2) > 0
    sheet_connected = sheet1_connected or sheet2_connected

    # Parse columns
    raw_counts1, headers1 = parse_raw_column_calls(rows_sheet1)
    raw_counts2, headers2 = parse_raw_column_calls(rows_sheet2)

    # Combined column call counts
    combined_column_counts = {col: 0 for col in AVAILABLE_SHEET_COLUMNS}
    if sheet_connected:
        if sheet1_connected:
            for col, cnt in raw_counts1.items():
                combined_column_counts[col] = combined_column_counts.get(col, 0) + cnt
        else:
            for col in ['DE pulkit', 'CH pulkit', 'AT pulkit', 'IT pulkit']:
                combined_column_counts[col] = FALLBACK_COLUMN_CALLS.get(col, 0)

        if sheet2_connected:
            for col, cnt in raw_counts2.items():
                combined_column_counts[col] = combined_column_counts.get(col, 0) + cnt
        else:
            for col in ['us mj', 'de anshu', 'ms ARUN', 'us maxy', 'uk mj', 'BE ARUN', 'de salm']:
                combined_column_counts[col] = FALLBACK_COLUMN_CALLS.get(col, 0)
    else:
        combined_column_counts = FALLBACK_COLUMN_CALLS.copy()

    all_available_columns = list(dict.fromkeys(headers1 + headers2 + AVAILABLE_SHEET_COLUMNS))

    # Build per-campaign calls using client_mappings
    # Maps country_id -> field_name -> call_count
    campaign_calls = {}
    for country_id, field_name in client_mappings.items():
        campaign_calls[country_id] = combined_column_counts.get(field_name, 0)

    summary = {
        'sheet_connected': sheet_connected,
        'tab_mode': tab_mode,
        'active_tab_name': active_tab_name,
        'today_tab': today_tab,
        'recent_tabs': get_recent_tab_names(),
        'available_columns': all_available_columns,
        'column_call_counts': combined_column_counts,
        'client_mappings': client_mappings,
        'campaign_calls': campaign_calls,
        'is_locked': is_locked,
    }

    cache.set(cache_key, summary, 30)
    return summary
