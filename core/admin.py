from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from .models import User, Country, Client, PopupLink, CallLog, CloudAccount, DailyActivity, SheetSyncLog


@admin.register(User)
class CustomUserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'full_name', 'role_badge', 'phone', 'is_staff', 'is_active')
    list_filter = ('role', 'is_active', 'is_staff')
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Role & Operations', {'fields': ('role', 'phone', 'department')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Role & Operations', {'fields': ('role', 'phone', 'department')}),
    )

    def full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username
    full_name.short_description = 'Name'

    def role_badge(self, obj):
        color = '#10b981' if obj.role == 'ADMIN' else '#3b82f6'
        return format_html(
            '<span style="background:{}; color:#fff; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:bold;">{}</span>',
            color, obj.get_role_display()
        )
    role_badge.short_description = 'Role'


class ClientInline(admin.TabularInline):
    model = Client
    extra = 1
    show_change_link = True


@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ('flag_emoji', 'name', 'status_badge', 'client_count', 'updated_at')
    list_filter = ('status',)
    search_fields = ('name',)
    inlines = [ClientInline]

    def status_badge(self, obj):
        color = '#10b981' if obj.status == 'ACTIVE' else '#f59e0b'
        return format_html(
            '<span style="background:{}; color:#fff; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:bold;">{}</span>',
            color, obj.status
        )
    status_badge.short_description = 'Status'

    def client_count(self, obj):
        return obj.clients.count()
    client_count.short_description = 'Clients'


class PopupLinkInline(admin.TabularInline):
    model = PopupLink
    extra = 1


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ('name', 'country', 'contact', 'links_count', 'created_at')
    list_filter = ('country__name',)
    search_fields = ('name', 'contact', 'notes')
    inlines = [PopupLinkInline]

    def links_count(self, obj):
        return obj.links.count()
    links_count.short_description = 'Popup Links'


@admin.register(PopupLink)
class PopupLinkAdmin(admin.ModelAdmin):
    list_display = ('client', 'link_type', 'short_url', 'mobile_numbers', 'inserted_at', 'created_by')
    list_filter = ('link_type', 'client__country')
    search_fields = ('url', 'mobile_numbers', 'client__name')

    def short_url(self, obj):
        return format_html('<a href="{}" target="_blank">{}</a>', obj.url, obj.url[:45] + ('...' if len(obj.url) > 45 else ''))
    short_url.short_description = 'URL'


@admin.register(CallLog)
class CallLogAdmin(admin.ModelAdmin):
    list_display = ('phone_number', 'call_status_badge', 'duration_display', 'client', 'user', 'call_time')
    list_filter = ('call_status', 'user', 'call_time')
    search_fields = ('phone_number', 'remarks', 'client__name', 'user__username')

    def call_status_badge(self, obj):
        colors = {
            'CONNECTED': '#10b981',
            'FOLLOW_UP': '#3b82f6',
            'NO_ANSWER': '#f59e0b',
            'BUSY': '#64748b',
            'WRONG_NUMBER': '#ef4444',
            'REJECTED': '#dc2626',
        }
        color = colors.get(obj.call_status, '#64748b')
        return format_html(
            '<span style="background:{}; color:#fff; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:bold;">{}</span>',
            color, obj.get_call_status_display()
        )
    call_status_badge.short_description = 'Call Status'

    def duration_display(self, obj):
        return obj.duration_formatted
    duration_display.short_description = 'Duration'


@admin.register(CloudAccount)
class CloudAccountAdmin(admin.ModelAdmin):
    list_display = ('account_name', 'provider_badge', 'account_email', 'status', 'created_at')
    list_filter = ('provider', 'status')
    search_fields = ('account_name', 'account_email', 'server_ips', 'notes')

    def provider_badge(self, obj):
        color = '#0080ff' if obj.provider == 'DIGITALOCEAN' else '#0078d4'
        return format_html(
            '<span style="background:{}; color:#fff; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:bold;">{}</span>',
            color, obj.get_provider_display()
        )
    provider_badge.short_description = 'Provider'


@admin.register(DailyActivity)
class DailyActivityAdmin(admin.ModelAdmin):
    list_display = ('user', 'date', 'total_calls', 'total_leads_entered', 'shift_start', 'shift_end')
    list_filter = ('date', 'user')
    search_fields = ('user__username', 'summary_notes')


@admin.register(SheetSyncLog)
class SheetSyncLogAdmin(admin.ModelAdmin):
    list_display = ('sheet_title', 'sheet_number', 'synced_at', 'rows_synced', 'status')
    list_filter = ('status', 'sheet_number')
