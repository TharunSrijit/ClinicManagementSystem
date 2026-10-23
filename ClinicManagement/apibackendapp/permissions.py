from rest_framework.permissions import BasePermission


class IsAdminRole(BasePermission):
    """
    Grants access only to authenticated users whose role is 'ADMIN'.
    """
    message = "Access restricted to Admin users only."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role == 'ADMIN' or getattr(request.user, 'is_superuser', False))
        )


class IsReceptionist(BasePermission):
    """
    Grants access to Receptionists and Admins only.
    """
    message = "Access restricted to Receptionists and Admins only."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role in ('RECEPTIONIST', 'ADMIN') or getattr(request.user, 'is_superuser', False))
        )


class IsDoctor(BasePermission):
    """
    Grants access to Doctors and Admins only.
    """
    message = "Access restricted to Doctors and Admins only."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role in ('DOCTOR', 'ADMIN') or getattr(request.user, 'is_superuser', False))
        )


class IsLabTechnician(BasePermission):
    """
    Grants access to Lab Technicians and Admins only.
    """
    message = "Access restricted to Lab Technicians and Admins only."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role in ('LAB_TECHNICIAN', 'ADMIN') or getattr(request.user, 'is_superuser', False))
        )


class IsPharmacist(BasePermission):
    """
    Grants access to Pharmacists and Admins only.
    """
    message = "Access restricted to Pharmacists and Admins only."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role in ('PHARMACIST', 'ADMIN') or getattr(request.user, 'is_superuser', False))
        )
