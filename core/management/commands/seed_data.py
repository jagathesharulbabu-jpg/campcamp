from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import User, Country, Client, PopupLink, CloudAccount, CallLog


class Command(BaseCommand):
    help = 'Seeds initial users (Admin & Employee), countries, clients, links, and cloud accounts'

    def handle(self, *args, **options):
        self.stdout.write("Seeding database...")

        # 1. Create Admin User
        admin_user, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@popupleads.com',
                'first_name': 'Super',
                'last_name': 'Admin',
                'role': User.Role.ADMIN,
                'is_staff': True,
                'is_superuser': True,
            }
        )
        if created:
            admin_user.set_password('admin123')
            admin_user.save()
            self.stdout.write(self.style.SUCCESS("✓ Created Admin user: admin / admin123"))
        else:
            self.stdout.write("Admin user already exists.")

        # 2. Create Employee User
        emp_user, created = User.objects.get_or_create(
            username='employee',
            defaults={
                'email': 'agent@popupleads.com',
                'first_name': 'Rahul',
                'last_name': 'Sharma',
                'role': User.Role.EMPLOYEE,
                'phone': '+91 9876543210',
            }
        )
        if created:
            emp_user.set_password('emp123')
            emp_user.save()
            self.stdout.write(self.style.SUCCESS("✓ Created Employee user: employee / emp123"))
        else:
            self.stdout.write("Employee user already exists.")

        # 3. Create Sample Campaigns & Clients
        campaigns_data = [
            {'name': 'DE — Pulkit', 'flag': '🇩🇪', 'status': 'ACTIVE', 'client': 'Pulkit', 'contact': 'pulkit@leads.de', 'url': 'https://leads.de/campaign-1', 'mobile': '+49 152 3456789'},
            {'name': 'DE — Anshu', 'flag': '🇩🇪', 'status': 'ACTIVE', 'client': 'Anshu', 'contact': 'anshu@leads.de', 'url': 'https://leads.de/ecom-v2', 'mobile': '+49 171 9876543'},
            {'name': 'AT — Pulkit', 'flag': '🇦🇹', 'status': 'ACTIVE', 'client': 'Pulkit', 'contact': 'pulkit@leads.at', 'url': 'https://leads.at/austria-quote', 'mobile': '+43 660 1234567'},
            {'name': 'UK — Maxy', 'flag': '🇬🇧', 'status': 'ACTIVE', 'client': 'Maxy', 'contact': 'maxy@leads.uk', 'url': 'https://leads.uk/quotes-v1', 'mobile': '0330-223-2128, +44 7911 123456'},
            {'name': 'UK — MJ', 'flag': '🇬🇧', 'status': 'PAUSED', 'client': 'MJ', 'contact': 'mj@leads.uk', 'url': 'https://leads.uk/fleet-leads', 'mobile': '+44 7700 900077'},
            {'name': 'USA — Maxy', 'flag': '🇺🇸', 'status': 'PAUSED', 'client': 'Maxy', 'contact': 'maxy@leads.us', 'url': 'https://leads.us/biz-loans', 'mobile': '+1 (555) 876-5432'},
        ]

        for item in campaigns_data:
            country, _ = Country.objects.get_or_create(
                name=item['name'],
                defaults={'flag_emoji': item['flag'], 'status': item['status']}
            )
            client, _ = Client.objects.get_or_create(
                country=country,
                name=item['client'],
                defaults={'contact': item['contact']}
            )
            PopupLink.objects.get_or_create(
                client=client,
                url=item['url'],
                defaults={'mobile_numbers': item['mobile'], 'inserted_at': timezone.now(), 'created_by': admin_user}
            )

        self.stdout.write(self.style.SUCCESS("[OK] Seeded Country Campaigns and Popup Links"))

        # 4. Create Sample Cloud Infrastructure Accounts (DigitalOcean & Azure)
        import datetime

        # DigitalOcean Accounts
        CloudAccount.objects.update_or_create(
            account_name='DigitalOcean - Primary Production Droplets',
            defaults={
                'provider': CloudAccount.Provider.DIGITALOCEAN,
                'account_email': 'ops-do1@popupleads.com',
                'account_id': 'do-team-core-2026',
                'api_token': 'dop_v1_98a72b38f801bc490d8102',
                'server_ips': '165.227.102.44, 159.89.230.12',
                'purchased_at': datetime.date(2026, 1, 15),
                'expires_at': datetime.date(2027, 1, 15),
                'domains_used': 'leaddeal-eu.com, offerproxy-de.net, fastleads-de.io',
                'notes': 'High-memory droplet running leads redirect proxies and campaign landing pages.',
                'status': CloudAccount.Status.RUNNING
            }
        )

        CloudAccount.objects.update_or_create(
            account_name='DigitalOcean - UK & Europe Standby',
            defaults={
                'provider': CloudAccount.Provider.DIGITALOCEAN,
                'account_email': 'ops-do2@popupleads.com',
                'account_id': 'do-team-standby-uk',
                'api_token': 'dop_v1_11c490d81028a72b38f80',
                'server_ips': '138.68.80.99',
                'purchased_at': datetime.date(2026, 6, 1),
                'expires_at': datetime.date(2027, 6, 1),
                'domains_used': '',
                'notes': 'Pre-paid available account ready to deploy new droplets for upcoming EU campaigns.',
                'status': CloudAccount.Status.AVAILABLE
            }
        )

        CloudAccount.objects.update_or_create(
            account_name='DigitalOcean - Legacy 2025 Campaign Node',
            defaults={
                'provider': CloudAccount.Provider.DIGITALOCEAN,
                'account_email': 'ops-legacy@popupleads.com',
                'account_id': 'do-team-archive-2025',
                'api_token': 'dop_v1_expired_token_00000',
                'server_ips': '143.110.220.15',
                'purchased_at': datetime.date(2025, 2, 10),
                'expires_at': datetime.date(2026, 2, 10),
                'domains_used': 'old-campaign-leads.org, archive-deals.com',
                'notes': 'Expired subscription. Needs renewal before re-attaching DNS records.',
                'status': CloudAccount.Status.EXPIRED
            }
        )

        # Azure Accounts
        CloudAccount.objects.update_or_create(
            account_name='Microsoft Azure - Cloud VMs & Storage',
            defaults={
                'provider': CloudAccount.Provider.AZURE,
                'account_email': 'azure-admin@popupleads.com',
                'account_id': 'sub-8812-4410-bbaa-1120',
                'api_token': 'azure_client_secret_xxxxxxxxxxxx',
                'server_ips': '20.120.45.18, 51.144.90.32',
                'purchased_at': datetime.date(2026, 3, 20),
                'expires_at': datetime.date(2027, 3, 20),
                'domains_used': 'azure-gateway-uk.com, cloudleads-us.org',
                'notes': 'Production Azure storage blob and backup database gateway for USA & UK leads.',
                'status': CloudAccount.Status.RUNNING
            }
        )

        CloudAccount.objects.update_or_create(
            account_name='Microsoft Azure - Secondary Reserved Instance',
            defaults={
                'provider': CloudAccount.Provider.AZURE,
                'account_email': 'azure-backup@popupleads.com',
                'account_id': 'sub-9901-2230-ccdd-3340',
                'api_token': 'azure_client_secret_standby_yyy',
                'server_ips': '20.50.112.5',
                'purchased_at': datetime.date(2026, 7, 10),
                'expires_at': datetime.date(2027, 7, 10),
                'domains_used': '',
                'notes': 'Available reserved instance. Zero mapped domains currently; ready for scaling.',
                'status': CloudAccount.Status.AVAILABLE
            }
        )

        CloudAccount.objects.update_or_create(
            account_name='Microsoft Azure - Dev / Test 2025',
            defaults={
                'provider': CloudAccount.Provider.AZURE,
                'account_email': 'azure-dev@popupleads.com',
                'account_id': 'sub-1100-3320-eeff-5560',
                'api_token': 'azure_client_secret_expired_zzz',
                'server_ips': '40.89.15.22',
                'purchased_at': datetime.date(2025, 1, 5),
                'expires_at': datetime.date(2026, 1, 5),
                'domains_used': 'devtest-leads-api.net',
                'notes': 'Expired subscription from Q1 2025 testing phase.',
                'status': CloudAccount.Status.EXPIRED
            }
        )
        self.stdout.write(self.style.SUCCESS("[OK] Seeded Cloud Infrastructure Credentials (DO & Azure)"))

        # 5. Create Sample Call Log
        CallLog.objects.get_or_create(
            phone_number='+44 7911 123456',
            defaults={
                'user': emp_user,
                'call_status': CallLog.CallStatus.CONNECTED,
                'duration_seconds': 145,
                'call_time': timezone.now(),
                'remarks': 'Lead confirmed appointment for campaign launch.'
            }
        )
        self.stdout.write(self.style.SUCCESS("[OK] Seeded Sample Call Logs"))
        self.stdout.write(self.style.SUCCESS("\n[SUCCESS] Complete database setup finished!"))
