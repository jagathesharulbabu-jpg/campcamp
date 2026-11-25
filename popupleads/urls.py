from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView
from django.http import HttpResponse

def favicon_view(request):
    svg_icon = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#2563eb"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>"""
    return HttpResponse(svg_icon, content_type="image/svg+xml")

urlpatterns = [
    path('favicon.ico', favicon_view),
    # Fallback redirect in case browser requests /style.css at root
    path('style.css', RedirectView.as_view(url='/static/css/style.css', permanent=False)),
    
    path('admin/', admin.site.urls),
    path('', include('core.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0])
