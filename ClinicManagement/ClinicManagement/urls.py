"""
URL configuration for ClinicManagement project.
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView

from apibackendapp.views import LoginView, SignupView, LogoutView

urlpatterns = [
    path('admin/', admin.site.urls),

    # ------------------------------------------------------------------
    # Auth endpoints
    # ------------------------------------------------------------------
    path('api/auth/signup/',         SignupView.as_view(),        name='auth-signup'),
    path('api/auth/login/',          LoginView.as_view(),         name='auth-login'),
    path('api/auth/token/refresh/',  TokenRefreshView.as_view(),  name='auth-token-refresh'),
    path('api/auth/logout/',         LogoutView.as_view(),        name='auth-logout'),

    # ------------------------------------------------------------------
    # Role-based app routes
    # ------------------------------------------------------------------
    path('api/doctor/',  include('doctor.urls')),
]
