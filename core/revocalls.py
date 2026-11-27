import json
import re
import uuid
from datetime import datetime
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.conf import settings
from .models import RevocallsCall


def detect_country_code(phone_number, campaign_name=''):
    """
    Auto-detect ISO country code from international phone format or campaign name.
    """
    clean_phone = re.sub(r'[^0-9+]', '', str(phone_number or '').strip())
    # Strip leading zeros or +
    digits = clean_phone.lstrip('+')

    if digits.startswith('49'):
        return 'DE'
    elif digits.startswith('44'):
        return 'UK'
    elif digits.startswith('39'):
        return 'IT'
    elif digits.startswith('43'):
        return 'AT'
    elif digits.startswith('41'):
        return 'CH'
    elif digits.startswith('32'):
        return 'BE'
    elif digits.startswith('33'):
        return 'FR'
    elif digits.startswith('34'):
        return 'ES'
    elif digits.startswith('1') and (len(digits) == 11 or len(digits) == 10):
        return 'US'
    elif digits.startswith('91'):
        return 'IN'

    # Check campaign name keywords
    camp_upper = (campaign_name or '').upper()
    if 'DE' in camp_upper or 'GERMAN' in camp_upper:
        return 'DE'
    if 'US' in camp_upper or 'AMERICA' in camp_upper:
        return 'US'
    if 'UK' in camp_upper or 'BRITAIN' in camp_upper:
        return 'UK'
    if 'IT' in camp_upper or 'ITAL' in camp_upper:
        return 'IT'
    if 'AT' in camp_upper or 'AUSTRI' in camp_upper:
        return 'AT'
    if 'CH' in camp_upper or 'SWISS' in camp_upper or 'SWITZ' in camp_upper:
        return 'CH'
    if 'BE' in camp_upper or 'BELG' in camp_upper:
        return 'BE'

    return ''


def normalize_call_status(raw_status):
    """
    Normalizes status string into RevocallsCall.CallStatus choice.
    """
    if not raw_status:
        return RevocallsCall.CallStatus.ANSWERED

    s = str(raw_status).strip().lower()
    if any(k in s for k in ['answer', 'complete', 'success', 'connected', 'ended']):
        return RevocallsCall.CallStatus.ANSWERED
    if any(k in s for k in ['ring', 'progress', 'dial', 'queued', 'initiated']):
        return RevocallsCall.CallStatus.RINGING
    if any(k in s for k in ['miss', 'noanswer', 'no-answer', 'unanswered', 'timeout']):
        return RevocallsCall.CallStatus.MISSED
    if any(k in s for k in ['busy']):
        return RevocallsCall.CallStatus.BUSY
    if any(k in s for k in ['fail', 'cancel', 'reject', 'error', 'drop']):
        return RevocallsCall.CallStatus.FAILED

    return RevocallsCall.CallStatus.OTHER


def parse_call_time(raw_time):
    """
    Safely parses call timestamp from string, epoch or ISO format.
    """
    if not raw_time:
        return timezone.now()

    if isinstance(raw_time, (int, float)):
        try:
            # Handle millisecond vs second timestamps
            if raw_time > 1e11:
                raw_time = raw_time / 1000.0
            return datetime.fromtimestamp(raw_time, tz=timezone.get_current_timezone())
        except Exception:
            return timezone.now()

    time_str = str(raw_time).strip()
    try:
        parsed = parse_datetime(time_str)
        if parsed:
            if timezone.is_naive(parsed):
                return timezone.make_aware(parsed, timezone.get_current_timezone())
            return parsed
    except Exception:
        pass

    # Try common date formats
    date_formats = (
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%d %I:%M:%S %p',
        '%Y/%m/%d %H:%M:%S',
        '%d-%m-%Y %H:%M:%S',
        '%Y-%m-%dT%H:%M:%SZ',
        '%b %d, %Y, %I:%M:%S %p',
        '%b %d, %Y, %H:%M:%S',
        '%b %d, %I:%M:%S %p',
        '%b %d, %H:%M:%S',
        '%m/%d/%Y %I:%M:%S %p',
        '%m/%d/%Y %H:%M:%S',
    )
    for fmt in date_formats:
        try:
            dt = datetime.strptime(time_str, fmt)
            # If year parsed as 1900 (because year wasn't in format), use current year
            if dt.year == 1900:
                current_year = timezone.now().year
                dt = dt.replace(year=current_year)
            return timezone.make_aware(dt, timezone.get_current_timezone())
        except Exception:
            continue

    return timezone.now()


def process_revocalls_webhook_payload(payload):
    """
    Processes and validates a Revocalls webhook payload dictionary.
    Stores or updates call record in PostgreSQL without duplicate records.
    Returns (call_instance, created: bool, error: str|None).
    """
    if not isinstance(payload, dict):
        return None, False, "Invalid payload: expected JSON object or form dictionary"

    # Lowercase key map for case-insensitive matching
    p_lower = {str(k).strip().lower(): v for k, v in payload.items()}

    # Extract Call ID with priority
    call_id = (
        p_lower.get('call_id') or
        p_lower.get('id') or
        p_lower.get('uuid') or
        p_lower.get('call_sid') or
        p_lower.get('callid') or
        p_lower.get('session_id') or
        p_lower.get('uniqueid')
    )

    # Extract Caller ID / Caller Phone Number
    caller_number = (
        p_lower.get('caller id') or
        p_lower.get('caller_id') or
        p_lower.get('caller') or
        p_lower.get('caller_number') or
        p_lower.get('from') or
        p_lower.get('cli') or
        p_lower.get('phone_number') or
        p_lower.get('customer_number') or
        p_lower.get('phone') or
        p_lower.get('mobile') or
        p_lower.get('number')
    )

    # Dialed Phone Number (Destination / DID)
    destination_number = (
        p_lower.get('dialed') or
        p_lower.get('dialed_number') or
        p_lower.get('destination_number') or
        p_lower.get('destination') or
        p_lower.get('called_number') or
        p_lower.get('to') or
        p_lower.get('did') or
        p_lower.get('virtual_number') or
        ''
    )

    # Campaign Name
    campaign_name = (
        p_lower.get('campaign_name') or
        p_lower.get('campaign') or
        p_lower.get('campaign_id') or
        p_lower.get('queue') or
        p_lower.get('queue_name') or
        p_lower.get('client') or
        ''
    )

    # Call Status
    raw_status = (
        p_lower.get('call_status') or
        p_lower.get('status') or
        p_lower.get('disposition') or
        p_lower.get('event') or
        p_lower.get('call_state') or
        'ANSWERED'
    )
    status_choice = normalize_call_status(raw_status)

    # Duration in seconds
    raw_duration = (
        p_lower.get('duration_seconds') or
        p_lower.get('duration') or
        p_lower.get('billsec') or
        p_lower.get('talk_time') or
        p_lower.get('duration_sec') or
        0
    )
    try:
        duration_seconds = max(0, int(float(raw_duration)))
    except (ValueError, TypeError):
        duration_seconds = 0

    # Call Timestamp / Call Date
    raw_time = (
        p_lower.get('call date') or
        p_lower.get('call_date') or
        p_lower.get('call_time') or
        p_lower.get('call date') or
        p_lower.get('timestamp') or
        p_lower.get('start_time') or
        p_lower.get('datetime') or
        p_lower.get('created_at') or
        p_lower.get('date') or
        p_lower.get('time')
    )
    call_time = parse_call_time(raw_time)

    # Country code
    country_code = (
        p_lower.get('country_code') or
        p_lower.get('country') or
        p_lower.get('geo') or
        detect_country_code(caller_number, campaign_name)
    )

    # Recording URL
    recording_url = (
        p_lower.get('recording_url') or
        p_lower.get('recording') or
        p_lower.get('record_url') or
        None
    )

    # Fallback caller number if completely missing
    if not caller_number:
        caller_number = 'Unknown Caller'

    # Fallback call_id to prevent duplicates when sending only CALL DATE, CALLER ID, DIALED
    if not call_id:
        clean_p = re.sub(r'[^0-9]', '', str(caller_number))
        clean_d = re.sub(r'[^0-9]', '', str(destination_number))
        time_slot = call_time.strftime('%Y%m%d%H%M%S')
        sub = f"{clean_p}_{clean_d}" if (clean_p or clean_d) else uuid.uuid4().hex[:8]
        call_id = f"revo_{sub}_{time_slot}"

    call_id = str(call_id).strip()
    caller_number = str(caller_number).strip()
    destination_number = str(destination_number).strip()
    campaign_name = str(campaign_name).strip()
    country_code = str(country_code).strip()[:10].upper()

    defaults = {
        'caller_number': caller_number,
        'destination_number': destination_number,
        'campaign_name': campaign_name,
        'country_code': country_code,
        'call_status': status_choice,
        'duration_seconds': duration_seconds,
        'call_time': call_time,
        'recording_url': recording_url,
        'raw_data': payload,
    }

    try:
        call_obj, created = RevocallsCall.objects.update_or_create(
            call_id=call_id,
            defaults=defaults
        )
        return call_obj, created, None
    except Exception as e:
        return None, False, str(e)
