"""
Google Sheets Live Sync Service for PopupLeads Hub
Uses gspread and service account credentials to fetch cell data directly.
"""

import os
import json
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from django.utils import timezone
from core.models import Country, Client, PopupLink, SheetSyncLog


def get_gspread_client(credentials_path=None):
    if not credentials_path:
        credentials_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', 'credentials.json')
    
    if not os.path.exists(credentials_path):
        raise FileNotFoundError(f"Google service account file not found at: {credentials_path}")

    scope = [
        'https://spreadsheets.google.com/feeds',
        'https://www.googleapis.com/auth/drive'
    ]
    creds = ServiceAccountCredentials.from_json_keyfile_name(credentials_path, scope)
    client = gspread.authorize(creds)
    return client


def sync_leads_sheet(sheet_id="14BY_Fnfw4f9hmcOGaPqIA6mC0pOkGRTivrimwC4uhmQ", tab_name=None):
    """
    Syncs rows from Google Sheet into PostgreSQL/SQLite database.
    """
    try:
        client = get_gspread_client()
        sheet = client.open_by_key(sheet_id)
        worksheet = sheet.worksheet(tab_name) if tab_name else sheet.get_worksheet(0)
        records = worksheet.get_all_records()

        synced_count = 0
        for row in records:
            # Example mapping: customize according to column headers in your Google Sheet
            country_name = row.get('Country') or row.get('Country Name')
            client_name = row.get('Client') or row.get('Client Name')
            popup_url = row.get('Popup Link') or row.get('URL')
            mobile = row.get('Mobile') or row.get('Phone')

            if country_name and client_name and popup_url:
                country, _ = Country.objects.get_or_create(name=country_name.strip())
                client_obj, _ = Client.objects.get_or_create(country=country, name=client_name.strip())
                PopupLink.objects.get_or_create(
                    client=client_obj,
                    url=popup_url.strip(),
                    defaults={'mobile_numbers': str(mobile or '').strip(), 'inserted_at': timezone.now()}
                )
                synced_count += 1

        SheetSyncLog.objects.create(
            sheet_number=1,
            sheet_title=sheet.title,
            rows_synced=synced_count,
            status='SUCCESS'
        )
        return {"success": True, "rows": synced_count}

    except Exception as e:
        SheetSyncLog.objects.create(
            sheet_number=1,
            sheet_title="Sheet 1 (Leads Data)",
            rows_synced=0,
            status='FAILED',
            error_message=str(e)
        )
        return {"success": False, "error": str(e)}
