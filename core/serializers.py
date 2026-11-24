from rest_framework import serializers
from .models import User, Country, Client, PopupLink, CallLog, CloudAccount, DailyActivity


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone', 'department']


class PopupLinkSerializer(serializers.ModelSerializer):
    mobile_numbers = serializers.CharField(required=False, allow_blank=True, default='')

    class Meta:
        model = PopupLink
        fields = ['id', 'client', 'url', 'link_type', 'mobile_numbers', 'inserted_at', 'created_by', 'created_at']


class ClientSerializer(serializers.ModelSerializer):
    links = PopupLinkSerializer(many=True, read_only=True)
    links_count = serializers.IntegerField(source='links.count', read_only=True)

    class Meta:
        model = Client
        fields = ['id', 'country', 'name', 'contact', 'mobile_number', 'notes', 'links', 'links_count', 'created_at']


class CountrySerializer(serializers.ModelSerializer):
    clients = ClientSerializer(many=True, read_only=True)
    total_clients = serializers.IntegerField(source='clients.count', read_only=True)
    latest_update_time = serializers.SerializerMethodField()
    latest_update_relative = serializers.SerializerMethodField()
    active_mobile_number = serializers.SerializerMethodField()
    primary_client_id = serializers.SerializerMethodField()

    class Meta:
        model = Country
        fields = [
            'id', 'name', 'flag_emoji', 'status', 'clients', 'total_clients',
            'latest_update_time', 'latest_update_relative', 'active_mobile_number',
            'primary_client_id', 'created_at', 'updated_at'
        ]

    def _get_latest_link(self, obj):
        return PopupLink.objects.filter(client__country=obj).order_by('-inserted_at').first()

    def get_latest_update_time(self, obj):
        link = self._get_latest_link(obj)
        if link and link.inserted_at:
            return link.inserted_at.isoformat()
        return obj.updated_at.isoformat() if obj.updated_at else None

    def get_latest_update_relative(self, obj):
        from django.utils import timezone
        link = self._get_latest_link(obj)
        if link and link.inserted_at:
            delta = timezone.now() - link.inserted_at
            secs = max(0, int(delta.total_seconds()))
            mins = secs // 60
            hours = mins // 60
            time_str = link.inserted_at.strftime('%H:%M')
            if mins < 1:
                return f"Just now ({time_str})"
            elif mins < 60:
                return f"{mins}m ago ({time_str})"
            elif hours < 24:
                return f"{hours}h {mins % 60}m ago ({time_str})"
            else:
                return link.inserted_at.strftime('%b %d, %H:%M')
        return "No links yet"

    def get_active_mobile_number(self, obj):
        client = obj.clients.first()
        if client:
            if client.mobile_number:
                return client.mobile_number
            # Check latest link
            latest_link = client.links.first()
            if latest_link and latest_link.mobile_numbers:
                return latest_link.mobile_numbers
            if client.contact:
                return client.contact
        return ""

    def get_primary_client_id(self, obj):
        client = obj.clients.first()
        return client.id if client else None


class CallLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    client_name = serializers.CharField(source='client.name', read_only=True)
    duration_formatted = serializers.CharField(read_only=True)

    class Meta:
        model = CallLog
        fields = [
            'id', 'user', 'user_name', 'client', 'client_name',
            'phone_number', 'call_status', 'duration_seconds',
            'duration_formatted', 'call_time', 'remarks', 'created_at'
        ]


class CloudAccountSerializer(serializers.ModelSerializer):
    domains_list = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()
    provider_display = serializers.CharField(source='get_provider_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = CloudAccount
        fields = [
            'id', 'provider', 'provider_display', 'account_name', 'account_email',
            'account_id', 'api_token', 'server_ips', 'notes', 'status', 'status_display',
            'purchased_at', 'expires_at', 'domains_used', 'domains_list', 'is_expired',
            'created_at', 'updated_at'
        ]

    def get_domains_list(self, obj):
        if not obj.domains_used:
            return []
        import re
        raw = re.split(r'[\r\n,;]+', obj.domains_used)
        return [d.strip() for d in raw if d.strip()]

    def get_is_expired(self, obj):
        if obj.status == CloudAccount.Status.EXPIRED:
            return True
        if obj.expires_at:
            from django.utils import timezone
            return obj.expires_at < timezone.now().date()
        return False


class DailyActivitySerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = DailyActivity
        fields = ['id', 'user', 'user_name', 'date', 'total_calls', 'total_leads_entered', 'shift_start', 'shift_end', 'summary_notes', 'created_at']
