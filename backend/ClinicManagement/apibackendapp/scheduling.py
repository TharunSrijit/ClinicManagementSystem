import datetime
from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import ValidationError


class SchedulingValidationError(ValidationError):
    pass


def now_local():
    """
    Returns current datetime in local timezone.
    Can be frozen or mocked in tests.
    """
    return timezone.localtime(timezone.now())


def get_doctor_hours(doctor):
    """
    Returns (start_time, end_time, slot_minutes) for a doctor.
    Defaults to 09:00 - 17:00 with 15-minute slots if not configured.
    """
    start = getattr(doctor, 'available_from', None)
    end = getattr(doctor, 'available_to', None)
    if not start or not end:
        start = datetime.time(9, 0)
        end = datetime.time(17, 0)
    slot_len = getattr(doctor, 'slot_minutes', 15) or 15
    return start, end, slot_len


def generate_doctor_slots(doctor):
    """
    Generates a list of valid slot start times (datetime.time) for the doctor.
    """
    start, end, slot_len = get_doctor_hours(doctor)
    start_min = start.hour * 60 + start.minute
    end_min = end.hour * 60 + end.minute

    slots = []
    curr = start_min
    while curr + slot_len <= end_min:
        slots.append(datetime.time(curr // 60, curr % 60))
        curr += slot_len
    return slots


def validate_appointment_booking(
    doctor,
    patient,
    appointment_type,
    appointment_date,
    appointment_time,
    appointment_id=None,
):
    """
    Validates appointment scheduling rules:
    - WALK_IN: today only, slot must not have already ended.
    - ADVANCE: tomorrow up to APPOINTMENT_BOOKING_ADVANCE_DAYS (default 7).
    - Time: must be a valid generated slot for the doctor.
    - Double booking: no overlapping active appointment for doctor or patient.
    """
    if not doctor:
        raise SchedulingValidationError({"doctor": "Doctor is required."})
    if not patient:
        raise SchedulingValidationError({"patient": "Patient is required."})

    # Normalize 'BOOKED' -> 'ADVANCE' if needed
    if appointment_type == 'BOOKED':
        appointment_type = 'ADVANCE'

    if not appointment_type or appointment_type not in ('WALK_IN', 'ADVANCE'):
        raise SchedulingValidationError({"appointment_type": "Appointment type must be WALK_IN or ADVANCE."})
    if not appointment_date:
        raise SchedulingValidationError({"appointment_date": "Appointment date is required."})
    if not appointment_time:
        raise SchedulingValidationError({"appointment_time": "Appointment time is required."})

    if isinstance(appointment_date, str):
        appointment_date = datetime.date.fromisoformat(appointment_date)

    if isinstance(appointment_time, str):
        parts = [int(p) for p in appointment_time.split(':')]
        if len(parts) == 2:
            appointment_time = datetime.time(parts[0], parts[1])
        elif len(parts) >= 3:
            appointment_time = datetime.time(parts[0], parts[1], parts[2])

    current_now = now_local()
    today = current_now.date()
    advance_days = getattr(settings, 'APPOINTMENT_BOOKING_ADVANCE_DAYS', 7)

    # 1. Date window validation
    if appointment_date < today:
        raise SchedulingValidationError({"appointment_date": "Past dates are not allowed."})

    if appointment_type == 'WALK_IN':
        if appointment_date != today:
            raise SchedulingValidationError({"appointment_date": "Walk-in appointments must be for today only."})
    elif appointment_type == 'ADVANCE':
        if appointment_date == today:
            raise SchedulingValidationError({"appointment_date": "Advance appointments must be made in advance (from tomorrow onwards)."})
        if appointment_date > today + datetime.timedelta(days=advance_days):
            raise SchedulingValidationError({"appointment_date": f"Advance appointments cannot be made more than {advance_days} days in advance."})

    # 2. Slot validation
    start, end, slot_len = get_doctor_hours(doctor)
    valid_slots = generate_doctor_slots(doctor)
    time_normalized = datetime.time(appointment_time.hour, appointment_time.minute)

    if time_normalized not in valid_slots:
        raise SchedulingValidationError({"appointment_time": "Invalid appointment time. Must be a valid generated slot for this doctor."})

    # 3. Walk-in slot expiration check
    if appointment_type == 'WALK_IN' and appointment_date == today:
        slot_end_dt = datetime.datetime.combine(today, time_normalized) + datetime.timedelta(minutes=slot_len)
        if timezone.is_aware(current_now):
            slot_end_dt = timezone.make_aware(slot_end_dt, timezone.get_current_timezone())
        if current_now >= slot_end_dt:
            raise SchedulingValidationError({"appointment_time": "This slot has already ended."})

    # 4. Double booking check - doctor
    from apibackendapp.models import Appointment
    doctor_conflicts = Appointment.objects.filter(
        doctor=doctor,
        appointment_date=appointment_date,
        appointment_time=time_normalized,
    ).exclude(status='CANCELLED')
    if appointment_id:
        doctor_conflicts = doctor_conflicts.exclude(id=appointment_id)
    if doctor_conflicts.exists():
        raise SchedulingValidationError({"appointment_time": "This slot is already booked for this doctor."})

    # 5. Double booking check - patient
    patient_conflicts = Appointment.objects.filter(
        patient=patient,
        appointment_date=appointment_date,
        appointment_time=time_normalized,
    ).exclude(status='CANCELLED')
    if appointment_id:
        patient_conflicts = patient_conflicts.exclude(id=appointment_id)
    if patient_conflicts.exists():
        raise SchedulingValidationError({"appointment_time": "The patient already has an active appointment at this date and time."})

    return True


def get_doctor_slots_availability(doctor, appointment_type, date):
    """
    Returns a list of dicts: [{'time': 'HH:MM', 'available': True/False}, ...]
    Validates date against the booking window.
    """
    if isinstance(date, str):
        date = datetime.date.fromisoformat(date)

    if appointment_type == 'BOOKED':
        appointment_type = 'ADVANCE'

    current_now = now_local()
    today = current_now.date()
    advance_days = getattr(settings, 'APPOINTMENT_BOOKING_ADVANCE_DAYS', 7)

    if date < today:
        raise SchedulingValidationError("Past dates are not allowed.")

    if appointment_type == 'WALK_IN':
        if date != today:
            raise SchedulingValidationError("Walk-in appointments must be for today only.")
    elif appointment_type == 'ADVANCE':
        if date == today:
            raise SchedulingValidationError("Advance appointments must be made in advance (from tomorrow onwards).")
        if date > today + datetime.timedelta(days=advance_days):
            raise SchedulingValidationError(f"Advance appointments cannot be made more than {advance_days} days in advance.")
    else:
        raise SchedulingValidationError("Type must be WALK_IN or ADVANCE.")

    start, end, slot_len = get_doctor_hours(doctor)
    slots = generate_doctor_slots(doctor)

    from apibackendapp.models import Appointment
    booked_times = set(
        Appointment.objects.filter(
            doctor=doctor,
            appointment_date=date,
        ).exclude(status='CANCELLED').values_list('appointment_time', flat=True)
    )

    booked_minutes = {(t.hour, t.minute) for t in booked_times if t}

    result = []
    for slot in slots:
        available = True
        if (slot.hour, slot.minute) in booked_minutes:
            available = False
        elif appointment_type == 'WALK_IN' and date == today:
            slot_end_dt = datetime.datetime.combine(today, slot) + datetime.timedelta(minutes=slot_len)
            if timezone.is_aware(current_now):
                slot_end_dt = timezone.make_aware(slot_end_dt, timezone.get_current_timezone())
            if current_now >= slot_end_dt:
                available = False

        result.append({
            "time": slot.strftime("%H:%M"),
            "available": available,
        })

    return result


def validate_status_transition(current_status, new_status, role):
    """
    Validates appointment status transitions:
    - Receptionist/Admin:
        BOOKED -> CONFIRMED (check-in), CANCELLED, NO_SHOW
        CONFIRMED -> CANCELLED
    - Doctor:
        CONFIRMED -> COMPLETED only
    Invalid moves raise SchedulingValidationError (DRF ValidationError -> 400).
    """
    if current_status == new_status:
        return True

    allowed_transitions = {
        'RECEPTIONIST': {
            'BOOKED': ['CONFIRMED', 'CANCELLED', 'NO_SHOW'],
            'CONFIRMED': ['CANCELLED'],
        },
        'ADMIN': {
            'BOOKED': ['CONFIRMED', 'CANCELLED', 'NO_SHOW'],
            'CONFIRMED': ['CANCELLED'],
        },
        'DOCTOR': {
            'CONFIRMED': ['COMPLETED'],
        }
    }

    role_key = 'ADMIN' if role == 'ADMIN' else ('DOCTOR' if role == 'DOCTOR' else 'RECEPTIONIST')
    role_allowed = allowed_transitions.get(role_key, {})
    valid_targets = role_allowed.get(current_status, [])

    if new_status not in valid_targets:
        raise SchedulingValidationError(
            f"Cannot change appointment status from {current_status} to {new_status} as {role_key}."
        )
    return True
