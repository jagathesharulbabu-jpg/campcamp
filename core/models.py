from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


# 1. Custom User Model with Role-Based Access Control (Admin vs Employee)
class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Admin'
        EMPLOYEE = 'EMPLOYEE', 'Employee'

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.EMPLOYEE,
        help_text="Determines permissions across the application."
    )
    phone = models.CharField(max_length=25, blank=True, null=True)
    department = models.CharField(max_length=100, blank=True, default='Lead Operations')
    is_active = models.BooleanField(default=True)

    @property
    def is_admin_user(self):
        return self.role == self.Role.ADMIN or self.is_superuser

    @property
    def is_employee_user(self):
        return self.role == self.Role.EMPLOYEE

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


# 2. Country Campaign
class Country(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        PAUSED = 'PAUSED', 'Paused'

    name = models.CharField(max_length=120, help_text="e.g. DE — Pulkit, UK — Maxy")
    flag_emoji = models.CharField(max_length=16, default='🌍')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Countries & Campaigns'
        ordering = ['name']

    def __str__(self):
        return f"{self.flag_emoji} {self.name} [{self.status}]"


# 3. Client under Country
class Client(models.Model):
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name='clients')
    name = models.CharField(max_length=150)
    contact = models.CharField(max_length=200, blank=True, help_text="Email or Phone contact")
    mobile_number = models.CharField(max_length=100, blank=True, default='', help_text="Active mobile number for calls in this country")
    notes = models.TextField(blank=True, help_text="Campaign notes, instructions or target leads info")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.country.name})"


# 4. Popup Link & Lead Entry
class PopupLink(models.Model):
    class LinkType(models.TextChoices):
        POPUP = 'POPUP', 'Popup Lead Form'
        REDIRECT = 'REDIRECT', 'Redirect / Landing Page'
        WHATSAPP = 'WHATSAPP', 'WhatsApp Direct Lead'
        TELEGRAM = 'TELEGRAM', 'Telegram Channel / Bot'
        OTHER = 'OTHER', 'Other Lead Capture'

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='links')
    url = models.URLField(max_length=1000)
    link_type = models.CharField(max_length=20, choices=LinkType.choices, default=LinkType.POPUP)
    mobile_numbers = models.CharField(max_length=350, blank=True, default='', help_text="Comma-separated mobile numbers")
    inserted_at = models.DateTimeField(default=timezone.now)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_links')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-inserted_at']

    def __str__(self):
        return f"{self.client.name}: {self.url[:50]}"


# 5. Call Log (Daily Activity Entry for Employees)
class CallLog(models.Model):
    class CallStatus(models.TextChoices):
        CONNECTED = 'CONNECTED', 'Connected & Interested'
        FOLLOW_UP = 'FOLLOW_UP', 'Follow-up Scheduled'
        NO_ANSWER = 'NO_ANSWER', 'No Answer / Ringing'
        BUSY = 'BUSY', 'Line Busy'
        WRONG_NUMBER = 'WRONG_NUMBER', 'Wrong / Invalid Number'
        REJECTED = 'REJECTED', 'Not Interested / Rejected'

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='call_logs')
    country = models.ForeignKey('Country', on_delete=models.SET_NULL, null=True, blank=True, related_name='call_logs')
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name='call_logs')
    geo_code = models.CharField(max_length=10, blank=True, default='', help_text="e.g. DE, AT, UK, US")
    phone_number = models.CharField(max_length=50)
    call_status = models.CharField(max_length=20, choices=CallStatus.choices, default=CallStatus.CONNECTED)
    duration_seconds = models.PositiveIntegerField(default=0, help_text="Call duration in seconds")
    call_time = models.DateTimeField(default=timezone.now, help_text="Time call was placed")
    remarks = models.TextField(blank=True, help_text="Notes from call conversation")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-call_time']

    @property
    def duration_formatted(self):
        mins = self.duration_seconds // 60
        secs = self.duration_seconds % 60
        return f"{mins}m {secs}s"

    def __str__(self):
        return f"{self.phone_number} - {self.call_status} by {self.user.username if self.user else 'System'}"


# 6. Cloud Account Credentials Vault (DigitalOcean, Azure, etc. - Admin Only)
class CloudAccount(models.Model):
    class Provider(models.TextChoices):
        DIGITALOCEAN = 'DIGITALOCEAN', 'DigitalOcean'
        AZURE = 'AZURE', 'Microsoft Azure'
        AWS = 'AWS', 'Amazon Web Services'
        CLOUDFLARE = 'CLOUDFLARE', 'Cloudflare'
        OTHER = 'OTHER', 'Other Infrastructure'

    class Status(models.TextChoices):
        RUNNING = 'RUNNING', 'Running / Active'
        AVAILABLE = 'AVAILABLE', 'Available / Standby'
        EXPIRED = 'EXPIRED', 'Expired'
        SUSPENDED = 'SUSPENDED', 'Suspended'

    provider = models.CharField(max_length=30, choices=Provider.choices, default=Provider.DIGITALOCEAN)
    account_name = models.CharField(max_length=150, help_text="e.g. DO Team Lead Account #1")
    account_email = models.EmailField(blank=True, help_text="Login email for the account")
    account_id = models.CharField(max_length=150, blank=True, help_text="Subscription ID, Project ID, or Account ID")
    api_token = models.CharField(max_length=1000, blank=True, default='', help_text="API Token / Access Key / Secret")
    server_ips = models.TextField(blank=True, help_text="Associated droplet/VM IP addresses, regions, or hostnames")
    
    # Cloud Account Lifecycle & Domain Management
    purchased_at = models.DateField(null=True, blank=True, help_text="Date account was purchased")
    expires_at = models.DateField(null=True, blank=True, help_text="Expiry date of account or subscription")
    domains_used = models.TextField(blank=True, default='', help_text="Domains used in this account (comma or newline separated)")
    
    notes = models.TextField(blank=True, help_text="Billing cycle, quota, usage details")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.RUNNING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def _get_meta_data(self):
        import json
        if not self.notes:
            return {}
        try:
            data = json.loads(self.notes)
            if isinstance(data, dict):
                return data
        except Exception:
            pass
        return {}

    def _get_meta_field(self, key):
        return self._get_meta_data().get(key, '')

    def _set_meta_field(self, key, value):
        import json
        data = self._get_meta_data()
        data[key] = str(value or '').strip()
        self.notes = json.dumps(data)

    @property
    def endpoint_name(self):
        val = self._get_meta_field('endpoint_name')
        if not val and self.provider == self.Provider.AZURE:
            if 'Cloud VMs' in self.account_name:
                return 'azure-gateway-uk.azurefd.net'
            elif 'Dev' in self.account_name:
                return 'devtest-leads-api.azureedge.net'
            elif 'Secondary' in self.account_name:
                return 'popupleads-vault-prod.z01.azurefd.net'
        return val

    @endpoint_name.setter
    def endpoint_name(self, value):
        self._set_meta_field('endpoint_name', value)

    @property
    def bill_amount(self):
        val = self._get_meta_field('bill_amount')
        if not val and self.provider == self.Provider.AZURE:
            if 'Cloud VMs' in self.account_name:
                return '$185.00/mo'
            elif 'Dev' in self.account_name:
                return '$65.00/mo'
            elif 'Secondary' in self.account_name:
                return '$210.00/mo'
        return val

    @bill_amount.setter
    def bill_amount(self, value):
        self._set_meta_field('bill_amount', value)

    @property
    def credit_card_used(self):
        val = self._get_meta_field('credit_card_used')
        if not val and self.provider == self.Provider.AZURE:
            if 'Cloud VMs' in self.account_name:
                return 'Mastercard •••• 4210'
            elif 'Dev' in self.account_name:
                return 'Visa •••• 8842'
            elif 'Secondary' in self.account_name:
                return 'Amex •••• 1009'
        return val

    @credit_card_used.setter
    def credit_card_used(self, value):
        self._set_meta_field('credit_card_used', value)

    @property
    def login_username(self):
        val = self._get_meta_field('login_username')
        if not val:
            if self.account_email:
                return self.account_email.split('@')[0]
            return 'admin_ops'
        return val

    @login_username.setter
    def login_username(self, value):
        self._set_meta_field('login_username', value)

    @property
    def login_password(self):
        val = self._get_meta_field('login_password')
        if not val:
            if self.provider == self.Provider.AZURE:
                return 'AzVault!2026'
            return 'DO#Pass2026'
        return val

    @login_password.setter
    def login_password(self, value):
        self._set_meta_field('login_password', value)

    class Meta:
        verbose_name_plural = 'Cloud Infrastructure Accounts'
        ordering = ['provider', 'account_name']

    def __str__(self):
        return f"[{self.get_provider_display()}] {self.account_name} ({self.status})"


# 7. Daily Activity Summary
class DailyActivity(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='daily_activities')
    date = models.DateField(default=timezone.now)
    total_calls = models.PositiveIntegerField(default=0)
    total_leads_entered = models.PositiveIntegerField(default=0)
    shift_start = models.TimeField(null=True, blank=True)
    shift_end = models.TimeField(null=True, blank=True)
    summary_notes = models.TextField(blank=True, help_text="What was achieved during this shift")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'Daily Activities & Shift Logs'
        unique_together = ('user', 'date')
        ordering = ['-date']

    def __str__(self):
        return f"{self.user.username} - {self.date}"


# 8. Google Sheet Sync Logs
class SheetSyncLog(models.Model):
    sheet_number = models.IntegerField(default=1)
    sheet_title = models.CharField(max_length=200)
    synced_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, default='SUCCESS')
    rows_synced = models.IntegerField(default=0)
    error_message = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-synced_at']

    def __str__(self):
        return f"Sheet {self.sheet_number} Sync at {self.synced_at.strftime('%Y-%m-%d %H:%M')} ({self.status})"
