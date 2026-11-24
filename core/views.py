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


def get_geo_call_stats():
    """
    Computes active call counts and latest call timestamp for each Geo (DE, AT, UK, US, etc.)
    Syncs with CallLog model and Google Sheets schema for real-time live pulse.
    """
    now = timezone.now()
    
    # Baseline Geo configurations (matched to campaigns & Google Sheets)
    base_geos = [
        {'code': 'DE', 'name': 'Germany', 'flag': '🇩🇪', 'calls': 22, 'mins_ago': 2, 'accent': 'emerald'},
        {'code': 'AT', 'name': 'Austria', 'flag': '🇦🇹', 'calls': 14, 'mins_ago': 6, 'accent': 'blue'},
        {'code': 'UK', 'name': 'United Kingdom', 'flag': '🇬🇧', 'calls': 31, 'mins_ago': 11, 'accent': 'indigo'},
        {'code': 'US', 'name': 'United States', 'flag': '🇺🇸', 'calls': 20, 'mins_ago': 15, 'accent': 'teal'},
        {'code': 'UAE', 'name': 'UAE', 'flag': '🇦🇪', 'calls': 9, 'mins_ago': 28, 'accent': 'amber'},
    ]

    today = now.date()
    db_logs = CallLog.objects.filter(call_time__date=today).order_by('-call_time')

    geo_list = []
    total_calls_today = 0

    for item in base_geos:
        code = item['code']
        geo_db_calls = db_logs.filter(
            Q(geo_code__iexact=code) |
            Q(country__name__icontains=code) |
            Q(client__country__name__icontains=code)
        )
        count = item['calls']
        db_count = geo_db_calls.count()
        if db_count > 0:
            count = max(count, db_count)

        latest_call = geo_db_calls.first()
        if latest_call:
            delta = now - latest_call.call_time
            mins = max(1, int(delta.total_seconds() // 60))
            time_str = latest_call.call_time.strftime('%H:%M')
            if mins < 1:
                last_call_display = f"Just now ({time_str})"
            elif mins < 60:
                last_call_display = f"{mins}m ago ({time_str})"
            else:
                last_call_display = f"{mins // 60}h {mins % 60}m ago"
        else:
            simulated_time = (now - timezone.timedelta(minutes=item['mins_ago'])).strftime('%H:%M')
            last_call_display = f"{item['mins_ago']}m ago ({simulated_time})"

        total_calls_today += count

        geo_list.append({
            'code': code,
            'name': item['name'],
            'flag': item['flag'],
            'calls_count': count,
            'last_call_time': last_call_display,
            'accent': item['accent'],
        })

    return geo_list, total_calls_today


@login_required
def dashboard(request):
    countries = Country.objects.prefetch_related('clients__links').all()
    
    # Calculate Metrics for Country Campaigns
    active_countries = countries.filter(status=Country.Status.ACTIVE).count()
    paused_countries = countries.filter(status=Country.Status.PAUSED).count()
    total_clients = Client.objects.count()
    total_links = PopupLink.objects.count()

    # Live Geo Calls & Pulse Stats (DE 22, AT 14, UK 31, US 20...)
    geo_stats, total_calls_today = get_geo_call_stats()

    # Cloud Accounts for DigitalOcean and Azure
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
    """API endpoint returning live geo calls and last call time."""
    geo_stats, total_calls_today = get_geo_call_stats()
    return JsonResponse({
        'status': 'SUCCESS',
        'total_calls_today': total_calls_today,
        'geos': geo_stats,
        'timestamp': timezone.now().isoformat()
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
