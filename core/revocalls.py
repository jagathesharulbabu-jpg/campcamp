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
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y/%m/%d %H:%M:%S', '%d-%m-%Y %H:%M:%S', '%Y-%m-%dT%H:%M:%SZ'):
        try:
            dt = datetime.strptime(time_str, fmt)
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

    # Extract Call ID with priority
    call_id = (
        payload.get('call_id') or
        payload.get('id') or
        payload.get('uuid') or
        payload.get('call_sid') or
        payload.get('callId') or
        payload.get('session_id') or
        payload.get('uniqueid')
    )

    # Extract Caller Phone Number
    caller_number = (
        payload.get('caller_number') or
        payload.get('from') or
        payload.get('caller') or
        payload.get('caller_id') or
        payload.get('cli') or
        payload.get('phone_number') or
        payload.get('customer_number') or
        payload.get('phone') or
        payload.get('mobile') or
        payload.get('number')
    )

    # Destination / DID Number
    destination_number = (
        payload.get('destination_number') or
        payload.get('to') or
        payload.get('did') or
        payload.get('virtual_number') or
        payload.get('called_number') or
        payload.get('destination') or
        ''
    )

    # Campaign Name
    campaign_name = (
        payload.get('campaign_name') or
        payload.get('campaign') or
        payload.get('campaign_id') or
        payload.get('queue') or
        payload.get('queue_name') or
        payload.get('client') or
        ''
    )

    # Call Status
    raw_status = (
        payload.get('call_status') or
        payload.get('status') or
        payload.get('disposition') or
        payload.get('event') or
        payload.get('call_state') or
        'ANSWERED'
    )
    status_choice = normalize_call_status(raw_status)

    # Duration in seconds
    raw_duration = (
        payload.get('duration_seconds') or
        payload.get('duration') or
        payload.get('billsec') or
        payload.get('talk_time') or
        payload.get('duration_sec') or
        0
    )
    try:
        duration_seconds = max(0, int(float(raw_duration)))
    except (ValueError, TypeError):
        duration_seconds = 0

    # Call Timestamp
    raw_time = (
        payload.get('call_time') or
        payload.get('timestamp') or
        payload.get('start_time') or
        payload.get('datetime') or
        payload.get('created_at') or
        payload.get('time')
    )
    call_time = parse_call_time(raw_time)

    # Country code
    country_code = (
        payload.get('country_code') or
        payload.get('country') or
        payload.get('geo') or
        detect_country_code(caller_number, campaign_name)
    )

    # Recording URL
    recording_url = (
        payload.get('recording_url') or
        payload.get('recording') or
        payload.get('record_url') or
        None
    )

    # Fallback caller number if completely missing
    if not caller_number:
        caller_number = 'Unknown Caller'

    # Fallback call_id to prevent duplicates even if Revocalls omits call_id
    if not call_id:
        # Deterministic key per caller + destination + minute
        clean_p = re.sub(r'[^0-9]', '', str(caller_number))
        time_slot = call_time.strftime('%Y%m%d%H%M')
        call_id = f"revo_{clean_p}_{time_slot}"

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
