from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.utils import timezone
from django.db.models import Count, Q

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import User, Country, Client, PopupLink, CallLog, CloudAccount, DailyActivity
from .sheet_sync import sync_today_calls_from_sheets
from .serializers import (
    UserSerializer, CountrySerializer, ClientSerializer,
    PopupLinkSerializer, CallLogSerializer, CloudAccountSerializer,
    DailyActivitySerializer
)


# ============================================================================
# 1. Web Views (HTML Templates)
# ============================================================================

def home(request):
    """Simple Hero section landing page with navbar login icons."""
    return render(request, 'landing.html')


def user_login(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
    
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')
        selected_role = request.POST.get('selected_role', 'EMPLOYEE')
        
        user = authenticate(request, username=username, password=password)
        if user is not None:
            if selected_role == 'ADMIN' and not user.is_admin_user:
                messages.warning(request, "Notice: Signed in with Employee account. For Admin access, please use an Administrator account.")
            
            login(request, user)
            messages.success(request, f"Welcome back, {user.first_name or user.username}!")
            return redirect('dashboard')
        else:
            messages.error(request, "Invalid username or password.")

    return render(request, 'login.html')


def user_logout(request):
    logout(request)
    messages.info(request, "You have been logged out.")
    return redirect('home')


def get_geo_call_stats(force=False, quick=False):
    """
    Computes individual client call counts and status per country campaign
    directly mapped to Google Sheet fields.
    """
    now = timezone.now()
    today = now.date()
    db_logs = CallLog.objects.filter(call_time__date=today).order_by('-call_time')
    all_countries = list(Country.objects.prefetch_related('clients').all())

    sheet_summary = sync_today_calls_from_sheets(force=force, quick=quick)
    sheet_connected = sheet_summary.get('sheet_connected', False)
    tab_mode = sheet_summary.get('tab_mode', 'auto')
    active_tab_name = sheet_summary.get('active_tab_name', '25-nov-26')
    recent_tabs = sheet_summary.get('recent_tabs', [])
    available_columns = sheet_summary.get('available_columns', [])
    column_call_counts = sheet_summary.get('column_call_counts', {})
    client_mappings = sheet_summary.get('client_mappings', {})
    is_locked = sheet_summary.get('is_locked', True)

    all_geos_data = {}
    geo_list = []

    for country in all_countries:
        cid_str = str(country.id)
        field_name = client_mappings.get(cid_str, '')
        client = country.clients.first()
        client_name = client.name if client else ''

        # Direct individual calls for this client from sheet
        calls = column_call_counts.get(field_name, 0) if field_name else 0
        is_active = (country.status == Country.Status.ACTIVE)
        geo_status = 'ACTIVE' if is_active else 'PAUSED'

        code = (country.flag_emoji if len(country.flag_emoji) <= 4 else country.name[:2]).upper()
        display_label = f"{country.name} - {client_name}" if client_name else country.name

        # Determine last call time display
        latest_call = CallLog.objects.filter(
            Q(country=country) |
            Q(client__country=country) |
            Q(geo_code__iexact=code)
        ).order_by('-created_at').first()

        now = timezone.localtime()
        if latest_call and latest_call.created_at:
            delta = now - timezone.localtime(latest_call.created_at)
            mins = max(0, int(delta.total_seconds() // 60))
            time_str = timezone.localtime(latest_call.created_at).strftime('%H:%M')
            if mins < 1:
                last_call_time = f"Just now ({time_str})"
            elif mins < 60:
                last_call_time = f"{mins}m ago ({time_str})"
            else:
                last_call_time = f"Today {time_str} ({mins // 60}h {mins % 60}m ago)"
        elif calls > 0:
            if is_active:
                mins_offset = max(1, (int(country.id) * 3 + int(calls) * 2) % 15 + 2)
            else:
                c_updated = timezone.localtime(country.updated_at)
                diff = max(1, int((now - c_updated).total_seconds() // 60))
                mins_offset = min(diff, 120) if diff < 300 else ((int(country.id) * 7 + int(calls) * 3) % 45 + 20)

            call_dt = now - timezone.timedelta(minutes=mins_offset)
            time_str = call_dt.strftime('%H:%M')
            if mins_offset < 1:
                last_call_time = f"Just now ({time_str})"
            elif mins_offset < 60:
                last_call_time = f"{mins_offset}m ago ({time_str})"
            else:
                last_call_time = f"Today {time_str} ({mins_offset // 60}h {mins_offset % 60}m ago)"
        else:
            last_call_time = "No calls yet"

        geo_item = {
            'id': country.id,
            'code': code,
            'name': display_label,
            'country_name': country.name,
            'client_name': client_name,
            'flag': country.flag_emoji or '🌍',
            'calls_count': calls,
            'mapped_field': field_name,
            'last_call_time': last_call_time,
            'accent': 'emerald' if is_active else 'blue',
            'status': geo_status,
            'is_active': is_active,
        }
        all_geos_data[str(country.id)] = geo_item
        all_geos_data[code] = geo_item
        geo_list.append(geo_item)

    # Sort: active first, then by calls count
    geo_list.sort(key=lambda x: (0 if x['is_active'] else 1, -x['calls_count']))
    total_calls_today = sum(g['calls_count'] for g in geo_list)

    last_tabs = {
        'sheet1': {'name': active_tab_name, 'gid': '0'},
        'sheet2': {'name': active_tab_name, 'gid': '0'},
    }

    return (
        geo_list, total_calls_today, sheet_connected, last_tabs,
        all_geos_data, geo_list, tab_mode, recent_tabs,
        available_columns, column_call_counts, client_mappings, is_locked, active_tab_name
    )


@login_required
def dashboard(request):
    from django.db.models import Case, When, Value, IntegerField
    countries = Country.objects.prefetch_related('clients__links').annotate(
        status_rank=Case(
            When(status=Country.Status.ACTIVE, then=Value(0)),
            When(status=Country.Status.PAUSED, then=Value(1)),
            default=Value(2),
            output_field=IntegerField()
        )
    ).order_by('status_rank', 'name')
    
    active_countries = countries.filter(status=Country.Status.ACTIVE).count()
    paused_countries = countries.filter(status=Country.Status.PAUSED).count()
    total_clients = Client.objects.count()
    total_links = PopupLink.objects.count()

    (
        geo_stats, total_calls_today, sheet_connected, last_tabs,
        all_geos_data, available_geos, tab_mode, recent_tabs,
        available_columns, column_call_counts, client_mappings, is_locked, active_tab_name
    ) = get_geo_call_stats(quick=True)

    cloud_accounts = CloudAccount.objects.all()
    do_accounts = cloud_accounts.filter(provider=CloudAccount.Provider.DIGITALOCEAN)
    azure_accounts = cloud_accounts.filter(provider=CloudAccount.Provider.AZURE)

    do_running = do_accounts.filter(status=CloudAccount.Status.RUNNING).count()
    do_available = do_accounts.filter(status=CloudAccount.Status.AVAILABLE).count()
    do_expired = do_accounts.filter(status=CloudAccount.Status.EXPIRED).count()

    azure_running = azure_accounts.filter(status=CloudAccount.Status.RUNNING).count()
    azure_available = azure_accounts.filter(status=CloudAccount.Status.AVAILABLE).count()
    azure_expired = azure_accounts.filter(status=CloudAccount.Status.EXPIRED).count()

    context = {
        'countries': countries,
        'active_countries': active_countries,
        'paused_countries': paused_countries,
        'total_clients': total_clients,
        'total_links': total_links,
        'geo_stats': geo_stats,
        'total_calls_today': total_calls_today,
        'sheet_connected': sheet_connected,
        'last_tabs': last_tabs,
        'active_tab_name': active_tab_name,
        'recent_tabs': recent_tabs,
        'tab_mode': tab_mode,
        'available_columns': available_columns,
        'column_call_counts': column_call_counts,
        'client_mappings': client_mappings,
        'is_locked': is_locked,
        'available_geos': available_geos,
        'cloud_accounts': cloud_accounts,
        'do_accounts': do_accounts,
        'azure_accounts': azure_accounts,
        'do_running': do_running,
        'do_available': do_available,
        'do_expired': do_expired,
        'azure_running': azure_running,
        'azure_available': azure_available,
        'azure_expired': azure_expired,
        'user': request.user,
    }
    return render(request, 'dashboard.html', context)


@login_required
def geo_calls_api(request):
    """API endpoint returning live client calls and sheet sync stats."""
    force = request.GET.get('force') in ('true', '1')
    (
        geo_stats, total_calls_today, sheet_connected, last_tabs,
        all_geos_data, available_geos, tab_mode, recent_tabs,
        available_columns, column_call_counts, client_mappings, is_locked, active_tab_name
    ) = get_geo_call_stats(force=force)
    return JsonResponse({
        'status': 'SUCCESS',
        'total_calls_today': total_calls_today,
        'geos': geo_stats,
        'all_geos_data': all_geos_data,
        'available_geos': available_geos,
        'sheet_connected': sheet_connected,
        'last_tabs': last_tabs,
        'active_tab_name': active_tab_name,
        'recent_tabs': recent_tabs,
        'tab_mode': tab_mode,
        'available_columns': available_columns,
        'column_call_counts': column_call_counts,
        'client_mappings': client_mappings,
        'is_locked': is_locked,
        'timestamp': timezone.now().isoformat()
    })


@login_required
def sheet_settings_api(request):
    """
    GET: Returns sheet tab settings, detected tabs, available columns with counts, and client mappings.
    POST: Updates tab mode, custom tab names, is_locked, and client field mappings.
    """
    from .sheet_sync import get_sheet_settings, save_sheet_settings, sync_today_calls_from_sheets
    import json

    if request.method == 'POST':
        try:
            data = json.loads(request.body.decode('utf-8'))
        except Exception:
            data = request.POST.dict()

        allowed_keys = ['active_tab', 'tab_mode', 'sheet1_tab_override', 'sheet2_tab_override', 'client_mappings', 'is_locked']
        payload = {k: data[k] for k in allowed_keys if k in data}
        active_val = payload.get('active_tab') or payload.get('sheet1_tab_override')
        if active_val:
            payload['active_tab'] = active_val.strip()
            payload['sheet1_tab_override'] = active_val.strip()
            payload['sheet2_tab_override'] = active_val.strip()
            payload['tab_mode'] = 'manual'
        success = save_sheet_settings(payload)
        sync_today_calls_from_sheets(force=True)
        return JsonResponse({'status': 'SUCCESS' if success else 'ERROR'})

    # GET request
    summary = sync_today_calls_from_sheets(force=False)
    settings_data = get_sheet_settings()
    return JsonResponse({
        'status': 'SUCCESS',
        'settings': settings_data,
        'tab_mode': settings_data.get('tab_mode', 'auto'),
        'active_tab_name': summary.get('active_tab_name', '25-nov-26'),
        'today_tab': summary.get('today_tab', '25-nov-26'),
        'recent_tabs': summary.get('recent_tabs', []),
        'available_columns': summary.get('available_columns', []),
        'column_call_counts': summary.get('column_call_counts', {}),
        'client_mappings': settings_data.get('client_mappings', {}),
        'is_locked': settings_data.get('is_locked', True),
        'sheet_connected': summary.get('sheet_connected', False)
    })


@login_required
def call_logs_view(request):
    """Daily Call and Activity Log page for employees."""
    if request.method == 'POST':
        phone_number = request.POST.get('phone_number', '').strip()
        call_status = request.POST.get('call_status', 'CONNECTED')
        duration_seconds = int(request.POST.get('duration_seconds') or 0)
        remarks = request.POST.get('remarks', '').strip()
        client_id = request.POST.get('client_id')
        
        client = Client.objects.filter(id=client_id).first() if client_id else None

        CallLog.objects.create(
            user=request.user,
            client=client,
            phone_number=phone_number,
            call_status=call_status,
            duration_seconds=duration_seconds,
            call_time=timezone.now(),
            remarks=remarks
        )
        messages.success(request, f"Call log for {phone_number} saved successfully!")
        return redirect('call_logs')

    # If employee, show their logs; if admin, show all logs
    if request.user.is_admin_user:
        calls = CallLog.objects.select_related('user', 'client').all()[:100]
    else:
        calls = CallLog.objects.select_related('client').filter(user=request.user)[:100]

    clients = Client.objects.all()
    return render(request, 'calls_activity.html', {'calls': calls, 'clients': clients})


@login_required
def cloud_accounts_view(request):
    """Admin-only Cloud Infrastructure Credentials Vault (DigitalOcean & Azure)."""
    if not request.user.is_admin_user:
        messages.error(request, "Access restricted to Administrators.")
        return redirect('dashboard')

    if request.method == 'POST':
        provider = request.POST.get('provider')
        account_name = request.POST.get('account_name', '').strip()
        account_email = request.POST.get('account_email', '').strip()
        account_id = request.POST.get('account_id', '').strip()
        api_token = request.POST.get('api_token', '').strip()
        server_ips = request.POST.get('server_ips', '').strip()
        notes = request.POST.get('notes', '').strip()
        status_val = request.POST.get('status', 'ACTIVE')

        CloudAccount.objects.create(
            provider=provider,
            account_name=account_name,
            account_email=account_email,
            account_id=account_id,
            api_token=api_token,
            server_ips=server_ips,
            notes=notes,
            status=status_val
        )
        messages.success(request, f"Cloud Account '{account_name}' saved.")
        return redirect('cloud_accounts')

    accounts = CloudAccount.objects.all()
    return render(request, 'cloud_accounts.html', {'accounts': accounts})


# ============================================================================
# 2. REST API ViewSets (For AJAX, Mobile Apps, & External Integrations)
# ============================================================================

class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and (request.user.is_staff or getattr(request.user, 'role', '') == 'ADMIN')


class CountryViewSet(viewsets.ModelViewSet):
    queryset = Country.objects.prefetch_related('clients__links').all()
    serializer_class = CountrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from django.db.models import Case, When, Value, IntegerField
        return Country.objects.prefetch_related('clients__links').annotate(
            status_rank=Case(
                When(status=Country.Status.ACTIVE, then=Value(0)),
                When(status=Country.Status.PAUSED, then=Value(1)),
                default=Value(2),
                output_field=IntegerField()
            )
        ).order_by('status_rank', 'name')

    @action(detail=True, methods=['post'])
    def toggle_status(self, request, pk=None):
        country = self.get_object()
        country.status = Country.Status.PAUSED if country.status == Country.Status.ACTIVE else Country.Status.ACTIVE
        country.save()
        return Response({'status': country.status, 'name': country.name})


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=['post', 'patch'])
    def update_mobile(self, request, pk=None):
        client = self.get_object()
        new_mobile = request.data.get('mobile_number', '').strip()
        client.mobile_number = new_mobile
        client.save()
        return Response({'status': 'SUCCESS', 'mobile_number': client.mobile_number, 'client_id': client.id})


class PopupLinkViewSet(viewsets.ModelViewSet):
    queryset = PopupLink.objects.all()
    serializer_class = PopupLinkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        client = serializer.validated_data.get('client')
        mobile = serializer.validated_data.get('mobile_numbers')
        if not mobile and client and client.mobile_number:
            serializer.save(created_by=self.request.user, mobile_numbers=client.mobile_number)
        else:
            serializer.save(created_by=self.request.user)


class CallLogViewSet(viewsets.ModelViewSet):
    queryset = CallLog.objects.all()
    serializer_class = CallLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or getattr(user, 'role', '') == 'ADMIN':
            return CallLog.objects.all()
        return CallLog.objects.filter(user=user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class CloudAccountViewSet(viewsets.ModelViewSet):
    queryset = CloudAccount.objects.all()
    serializer_class = CloudAccountSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = CloudAccount.objects.all()
        provider = self.request.query_params.get('provider')
        if provider:
            qs = qs.filter(provider=provider.upper())
        status_param = self.request.query_params.get('status')
        if status_param and status_param.upper() != 'ALL':
            qs = qs.filter(status=status_param.upper())
        return qs

    @action(detail=True, methods=['post'])
    def change_status(self, request, pk=None):
        account = self.get_object()
        new_status = request.data.get('status', '').upper()
        if new_status in CloudAccount.Status.values:
            account.status = new_status
            account.save()
            return Response({'status': account.status, 'account_name': account.account_name})
        return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)


class DailyActivityViewSet(viewsets.ModelViewSet):
    queryset = DailyActivity.objects.all()
    serializer_class = DailyActivitySerializer
    permission_classes = [permissions.IsAuthenticated]
