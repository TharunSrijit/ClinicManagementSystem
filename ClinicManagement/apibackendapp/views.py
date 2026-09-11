from rest_framework import viewsets, generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .serializers import (
    SignupSerializer,
    CustomTokenObtainPairSerializer,
)


# ============================================================================
# AUTH — LOGIN / SIGNUP / LOGOUT
# ============================================================================

class LoginView(TokenObtainPairView):
    """
    POST /api/auth/login/
    Body: { "username": "...", "password": "..." }
    Returns: access token, refresh token, role, username, full_name, user_id
    """
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]


class SignupView(generics.CreateAPIView):
    """
    POST /api/auth/signup/
    Body: { "username", "email", "password", "role", "phone",
            "first_name", "last_name" }
    Creates a new user. No authentication required.
    """
    serializer_class = SignupSerializer
    permission_classes = [AllowAny]


class LogoutView(generics.GenericAPIView):
    """
    POST /api/auth/logout/
    Body: { "refresh": "<refresh_token>" }
    Blacklists the refresh token, effectively logging the user out.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data['refresh']
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(
                {'detail': 'Successfully logged out.'},
                status=status.HTTP_205_RESET_CONTENT
            )
        except Exception:
            return Response(
                {'detail': 'Invalid or expired token.'},
                status=status.HTTP_400_BAD_REQUEST
            )


# ============================================================================
# NOTE: All other ViewSets (Patient, Appointment, Consultation, etc.) will be
# added here once their serializers are defined in serializers.py.
# ============================================================================
