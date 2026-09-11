from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


# ---------------------------------------------------------------------------
# AUTH SERIALIZERS
# ---------------------------------------------------------------------------

class SignupSerializer(serializers.ModelSerializer):
    """
    Handles new user registration.
    - password is write-only (never returned in responses)
    - role must be one of: ADMIN, RECEPTIONIST, DOCTOR, LAB_TECHNICIAN, PHARMACIST
    """
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model  = User
        fields = ['id', 'username', 'email', 'password', 'role', 'phone',
                  'first_name', 'last_name']

    def create(self, validated_data):
        return User.objects.create_user(
            username   = validated_data['username'],
            email      = validated_data['email'],
            password   = validated_data['password'],
            role       = validated_data.get('role', 'RECEPTIONIST'),
            phone      = validated_data.get('phone', ''),
            first_name = validated_data.get('first_name', ''),
            last_name  = validated_data.get('last_name', ''),
        )


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extends the default JWT login serializer to include
    the user's role and full name in the token payload and response.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role']      = user.role
        token['username']  = user.username
        token['full_name'] = user.get_full_name()
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['role']      = self.user.role
        data['username']  = self.user.username
        data['full_name'] = self.user.get_full_name()
        data['user_id']   = self.user.id
        return data
