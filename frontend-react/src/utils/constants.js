export const ROLES = {
  ADMIN: 'ADMIN',
  DOCTOR: 'DOCTOR',
  RECEPTIONIST: 'RECEPTIONIST',
  LAB_TECHNICIAN: 'LAB_TECHNICIAN',
  PHARMACIST: 'PHARMACIST'
};

export const ROLE_DASHBOARDS = {
  [ROLES.ADMIN]: '/admin',
  [ROLES.DOCTOR]: '/doctor',
  [ROLES.RECEPTIONIST]: '/receptionist',
  [ROLES.LAB_TECHNICIAN]: '/lab',
  [ROLES.PHARMACIST]: '/pharmacy'
};

export const APPOINTMENT_STATUSES = {
  BOOKED: 'Booked',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show'
};

export const TOKEN_STATUSES = {
  WAITING: 'Waiting',
  IN_CONSULTATION: 'In Consultation',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
};
