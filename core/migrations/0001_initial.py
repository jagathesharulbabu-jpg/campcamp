from django.conf import settings
import django.contrib.auth.models
import django.contrib.auth.validators
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='User',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('password', models.CharField(max_length=128, verbose_name='password')),
                ('last_login', models.DateTimeField(blank=True, null=True, verbose_name='last login')),
                ('is_superuser', models.BooleanField(default=False, help_text='Designates that this user has all permissions without explicitly assigning them.', verbose_name='superuser status')),
                ('username', models.CharField(error_messages={'unique': 'A user with that username already exists.'}, help_text='Required. 150 characters or fewer. Letters, digits and @/./+/-/_ only.', max_length=150, unique=True, validators=[django.contrib.auth.validators.UnicodeUsernameValidator()], verbose_name='username')),
                ('first_name', models.CharField(blank=True, max_length=150, verbose_name='first name')),
                ('last_name', models.CharField(blank=True, max_length=150, verbose_name='last name')),
                ('email', models.EmailField(blank=True, max_length=254, verbose_name='email address')),
                ('is_staff', models.BooleanField(default=False, help_text='Designates whether the user can log into this admin site.', verbose_name='staff status')),
                ('date_joined', models.DateTimeField(default=django.utils.timezone.now, verbose_name='date joined')),
                ('role', models.CharField(choices=[('ADMIN', 'Admin'), ('EMPLOYEE', 'Employee')], default='EMPLOYEE', help_text='Determines permissions across the application.', max_length=20)),
                ('phone', models.CharField(blank=True, max_length=25, null=True)),
                ('department', models.CharField(blank=True, default='Lead Operations', max_length=100)),
                ('is_active', models.BooleanField(default=True)),
                ('groups', models.ManyToManyField(blank=True, help_text='The groups this user belongs to.', related_name='user_set', related_query_name='user', to='auth.group', verbose_name='groups')),
                ('user_permissions', models.ManyToManyField(blank=True, help_text='Specific permissions for this user.', related_name='user_set', related_query_name='user', to='auth.permission', verbose_name='user permissions')),
            ],
            options={
                'verbose_name': 'user',
                'verbose_name_plural': 'users',
                'abstract': False,
            },
            managers=[
                ('objects', django.contrib.auth.models.UserManager()),
            ],
        ),
        migrations.CreateModel(
            name='Country',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(help_text='e.g. DE — Pulkit, UK — Maxy', max_length=120, unique=True)),
                ('flag_emoji', models.CharField(default='🌍', max_length=16)),
                ('status', models.CharField(choices=[('ACTIVE', 'Active'), ('PAUSED', 'Paused')], default='ACTIVE', max_length=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name_plural': 'Countries & Campaigns',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='CloudAccount',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('provider', models.CharField(choices=[('DIGITALOCEAN', 'DigitalOcean'), ('AZURE', 'Microsoft Azure'), ('AWS', 'Amazon Web Services'), ('CLOUDFLARE', 'Cloudflare'), ('OTHER', 'Other Infrastructure')], default='DIGITALOCEAN', max_length=30)),
                ('account_name', models.CharField(help_text='e.g. DO Team Lead Account #1', max_length=150)),
                ('account_email', models.EmailField(blank=True, help_text='Login email for the account', max_length=254)),
                ('account_id', models.CharField(blank=True, help_text='Subscription ID, Project ID, or Account ID', max_length=150)),
                ('api_token', models.CharField(help_text='API Token / Access Key / Secret', max_length=1000)),
                ('server_ips', models.TextField(blank=True, help_text='Associated droplet/VM IP addresses, regions, or hostnames')),
                ('notes', models.TextField(blank=True, help_text='Billing cycle, quota, usage details')),
                ('status', models.CharField(choices=[('ACTIVE', 'Active / In Use'), ('SUSPENDED', 'Suspended / Review'), ('BACKUP', 'Standby / Backup')], default='ACTIVE', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name_plural': 'Cloud Infrastructure Accounts',
                'ordering': ['provider', 'account_name'],
            },
        ),
        migrations.CreateModel(
            name='SheetSyncLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sheet_number', models.IntegerField(default=1)),
                ('sheet_title', models.CharField(max_length=200)),
                ('synced_at', models.DateTimeField(auto_now_add=True)),
                ('status', models.CharField(default='SUCCESS', max_length=20)),
                ('rows_synced', models.IntegerField(default=0)),
                ('error_message', models.TextField(blank=True, null=True)),
            ],
            options={
                'ordering': ['-synced_at'],
            },
        ),
        migrations.CreateModel(
            name='Client',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=150)),
                ('contact', models.CharField(blank=True, help_text='Email or Phone contact', max_length=200)),
                ('notes', models.TextField(blank=True, help_text='Campaign notes, instructions or target leads info')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('country', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='clients', to='core.country')),
            ],
            options={
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='PopupLink',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('url', models.URLField(max_length=1000)),
                ('link_type', models.CharField(choices=[('POPUP', 'Popup Lead Form'), ('REDIRECT', 'Redirect / Landing Page'), ('WHATSAPP', 'WhatsApp Direct Lead'), ('TELEGRAM', 'Telegram Channel / Bot'), ('OTHER', 'Other Lead Capture')], default='POPUP', max_length=20)),
                ('mobile_numbers', models.CharField(help_text='Comma-separated mobile numbers', max_length=350)),
                ('inserted_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('client', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='links', to='core.client')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_links', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-inserted_at'],
            },
        ),
        migrations.CreateModel(
            name='CallLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('phone_number', models.CharField(max_length=50)),
                ('call_status', models.CharField(choices=[('CONNECTED', 'Connected & Interested'), ('FOLLOW_UP', 'Follow-up Scheduled'), ('NO_ANSWER', 'No Answer / Ringing'), ('BUSY', 'Line Busy'), ('WRONG_NUMBER', 'Wrong / Invalid Number'), ('REJECTED', 'Not Interested / Rejected')], default='CONNECTED', max_length=20)),
                ('duration_seconds', models.PositiveIntegerField(default=0, help_text='Call duration in seconds')),
                ('call_time', models.DateTimeField(default=django.utils.timezone.now, help_text='Time call was placed')),
                ('remarks', models.TextField(blank=True, help_text='Notes from call conversation')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('client', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='call_logs', to='core.client')),
                ('user', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='call_logs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-call_time'],
            },
        ),
        migrations.CreateModel(
            name='DailyActivity',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(default=django.utils.timezone.now)),
                ('total_calls', models.PositiveIntegerField(default=0)),
                ('total_leads_entered', models.PositiveIntegerField(default=0)),
                ('shift_start', models.TimeField(blank=True, null=True)),
                ('shift_end', models.TimeField(blank=True, null=True)),
                ('summary_notes', models.TextField(blank=True, help_text='What was achieved during this shift')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='daily_activities', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name_plural': 'Daily Activities & Shift Logs',
                'ordering': ['-date'],
                'unique_together': {('user', 'date')},
            },
        ),
    ]
