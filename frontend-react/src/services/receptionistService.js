import apiClient from './apiClient';

export const receptionistService = {
  getProfile() {
    return apiClient.get('/receptionist/profile/');
  },

  getPatients(search = '') {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return apiClient.list(`/receptionist/patients/${query}`);
  },

  getPatient(id) {
    return apiClient.get(`/receptionist/patients/${id}/`);
  },

  createPatient(patientData) {
    return apiClient.post('/receptionist/patients/', patientData);
  },

  updatePatient(id, patientData) {
    return apiClient.put(`/receptionist/patients/${id}/`, patientData);
  },

  getDoctors() {
    return apiClient.list('/receptionist/doctors/');
  },

  getDoctorSlots(doctorId, type, date) {
    return apiClient.get(`/receptionist/doctors/${doctorId}/slots/?type=${encodeURIComponent(type)}&date=${encodeURIComponent(date)}`);
  },

  getAppointments(date = null, doctorId = null, status = null) {
    const params = [];
    if (date) params.push(`date=${encodeURIComponent(date)}`);
    if (doctorId) params.push(`doctor=${encodeURIComponent(doctorId)}`);
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    const query = params.length ? `?${params.join('&')}` : '';
    return apiClient.list(`/receptionist/appointments/${query}`);
  },

  bookAppointment(data) {
    return apiClient.post('/receptionist/appointments/', data);
  },

  checkInAppointment(id) {
    return apiClient.post(`/receptionist/appointments/${id}/check_in/`);
  },

  cancelAppointment(id) {
    return apiClient.post(`/receptionist/appointments/${id}/cancel/`);
  },

  getTokens(date = null, status = null) {
    const params = [];
    if (date) params.push(`date=${encodeURIComponent(date)}`);
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    const query = params.length ? `?${params.join('&')}` : '';
    return apiClient.list(`/receptionist/tokens/${query}`);
  },

  generateToken(tokenData) {
    return apiClient.post('/receptionist/tokens/', tokenData);
  },

  getConsultationInvoices() {
    return apiClient.list('/receptionist/consultation-invoices/');
  },

  createConsultationPayment(paymentData) {
    return apiClient.post('/receptionist/consultation-payments/', paymentData);
  }
};

export default receptionistService;
