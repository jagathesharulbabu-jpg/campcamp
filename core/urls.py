from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'countries', views.CountryViewSet, basename='country')
router.register(r'clients', views.ClientViewSet, basename='client')
router.register(r'links', views.PopupLinkViewSet, basename='popuplink')
router.register(r'calls', views.CallLogViewSet, basename='calllog')
router.register(r'cloud-accounts', views.CloudAccountViewSet, basename='cloudaccount')
router.register(r'activities', views.DailyActivityViewSet, basename='dailyactivity')

urlpatterns = [
    # Web Views
    path('', views.home, name='home'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('login/', views.user_login, name='login'),
    path('logout/', views.user_logout, name='logout'),
    path('calls/', views.call_logs_view, name='call_logs'),
    path('cloud-accounts/', views.cloud_accounts_view, name='cloud_accounts'),
    path('api/v1/geo-calls/', views.geo_calls_api, name='geo_calls_api'),
    path('api/v1/sheet-settings/', views.sheet_settings_api, name='sheet_settings_api'),

    # Revocalls Real-Time Webhook & API Routes
    path('api/v1/revocalls/webhook/', views.revocalls_webhook_api, name='revocalls_webhook'),
    path('api/revocalls/webhook/', views.revocalls_webhook_api),  # short alias
    path('api/v1/revocalls/calls/', views.revocalls_calls_api, name='revocalls_calls_api'),
    path('api/v1/revocalls/test-webhook/', views.revocalls_test_webhook_api, name='revocalls_test_webhook_api'),

    # REST API Routes (Ready for external apps, webhooks & ajax)
    path('api/v1/', include(router.urls)),
]
