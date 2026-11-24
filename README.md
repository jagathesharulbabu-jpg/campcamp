# 🚀 PopupLeads Hub - Django Web Application

A full-scale, enterprise-ready Django web application for managing **Country Campaigns, Client Leads, Daily Call Activity, and Cloud Infrastructure Accounts (DigitalOcean & Azure)** with **Role-Based Access Control (Admin vs. Employee)** and **RESTful API endpoints** for external integrations.

---

## 🌟 Key Features

1. **Role-Based Authentication (Admin & Employee)**:
   - **Admins**: Full access to all campaigns, delete actions, system metrics, and the secure **Cloud Accounts Vault** (DigitalOcean tokens, Azure keys, server IPs), plus full access to the Django Admin panel at `/admin/`.
   - **Employees**: Streamlined dashboard to manage assigned campaigns, add popup lead links, and log **Daily Calls & Activities** (call duration, status, client numbers, timings).
2. **Database-Driven Architecture**:
   - Built on Django ORM with pre-configured migrations (`db.sqlite3` for instant local development, easily switchable to `PostgreSQL` in `settings.py`).
3. **Daily Activity & Call Logging Engine** (`/calls/`):
   - Logs phone numbers, call status (*Connected, Follow-up, Busy, Wrong Number, Rejected*), duration in seconds, client association, and conversation remarks.
4. **Cloud Infrastructure Vault** (`/cloud-accounts/` - Admin Only):
   - Secure store for DigitalOcean droplets, Microsoft Azure subscriptions, API secrets, and server IPs.
5. **REST API for Future Integrations (`/api/v1/`)**:
   - Ready-to-connect RESTful endpoints for mobile apps, external CRMs, scrapers, and webhooks:
     - `GET/POST /api/v1/countries/` (with `/api/v1/countries/{id}/toggle_status/`)
     - `GET/POST /api/v1/clients/`
     - `GET/POST /api/v1/links/`
     - `GET/POST /api/v1/calls/`
     - `GET/POST /api/v1/cloud-accounts/` (Admin only)
6. **Live Google Sheets Synchronization (`core/services/google_sheets.py`)**:
   - Python `gspread` service to pull live cell data from Google Sheets directly into your database.

---

## ⚡ Quick Start Guide (3 Simple Commands)

### 1. Install Requirements
```bash
pip install -r requirements.txt
```

### 2. Apply Database Migrations & Seed Default Data
```bash
python manage.py migrate
python manage.py seed_data
```
> The `seed_data` command automatically creates sample country campaigns, clients, popup links, cloud credentials, and **two default test users**.

### 3. Start the Server
```bash
python manage.py runserver
```

Now open your browser and go to:
👉 **`http://127.0.0.1:8000/`**

---

## 🔑 Default Login Credentials

| Role | Username | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` | Full dashboard, Cloud Vault, delete permissions, and `/admin/` access |
| **Employee** | `employee` | `emp123` | Campaign view, Popup Links entry, Daily Call Logging |

---

## 📂 Project Architecture

```
d:\projects\kaira-2\addssss/
├── manage.py                         # Django management script
├── requirements.txt                  # Python dependencies
├── README.md                         # Documentation
├── popupleads/                       # Project configuration
│   ├── settings.py                   # App config, DB settings, CORS, REST Framework
│   ├── urls.py                       # Root URL routes
│   └── wsgi.py
├── core/                             # Main application logic
│   ├── models.py                     # Custom User (Roles), Country, Client, PopupLink, CallLog, CloudAccount
│   ├── views.py                      # Dashboard, Login/Logout, Call Logs, Cloud Vault & API ViewSets
│   ├── urls.py                       # Application & REST API routes (/api/v1/...)
│   ├── admin.py                      # Customized Django Admin panel
│   ├── serializers.py                # Django REST Framework serializers
│   ├── migrations/                   # Database migrations
│   │   └── 0001_initial.py
│   ├── services/
│   │   └── google_sheets.py          # Google Sheets API live sync
│   └── management/commands/
│       └── seed_data.py              # Auto-seeds default users & data
├── templates/                        # Django HTML Templates
│   ├── base.html                     # Base layout with flash messages & Tailwind
│   ├── login.html                    # Admin & Employee sign-in page
│   ├── dashboard.html                # Modern interactive dashboard
│   ├── calls_activity.html           # Daily call & activity log entry
│   └── cloud_accounts.html           # Cloud credentials vault (Admin only)
└── static/                           # Static assets
    ├── css/style.css
    └── js/app.js                     # Django API-driven JavaScript logic
```

---

## 🔌 Connecting External Apps via API

External applications or mobile apps can easily query and post data:

```bash
# Example: Fetch all active country campaigns
curl -X GET http://127.0.0.1:8000/api/v1/countries/ -u "admin:admin123"

# Example: Submit a new call record
curl -X POST http://127.0.0.1:8000/api/v1/calls/ \
     -u "employee:emp123" \
     -H "Content-Type: application/json" \
     -d '{
       "phone_number": "+44 7911 123456",
       "call_status": "CONNECTED",
       "duration_seconds": 180,
       "remarks": "Lead interested in auto loan package"
     }'
```
