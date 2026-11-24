from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'countries', views.CountryViewSet)
router.register(r'clients', views.ClientViewSet)
router.register(r'links', views.PopupLinkViewSet)
router.register(r'calls', views.CallLogViewSet)
router.register(r'cloud-accounts', views.CloudAccountViewSet)
router.register(r'activities', views.DailyActivityViewSet)

urlpatterns = [
    # Web Views
    path('', views.home, name='home'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('login/', views.user_login, name='login'),
    path('logout/', views.user_logout, name='logout'),
    path('calls/', views.call_logs_view, name='call_logs'),
    path('cloud-accounts/', views.cloud_accounts_view, name='cloud_accounts'),
    path('api/v1/geo-calls/', views.geo_calls_api, name='geo_calls_api'),

    # REST API Routes (Ready for external apps, webhooks & ajax)
    path('api/v1/', include(router.urls)),
]
