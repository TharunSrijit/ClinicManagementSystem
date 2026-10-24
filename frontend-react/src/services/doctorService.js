import apiClient from './apiClient';

export const doctorService = {
  getProfile() {
    return apiClient.get('/doctor/profile/');
  },

  getAppointments(date = null, status = null) {
    const params = [];
    if (date) params.push(`date=${encodeURIComponent(date)}`);
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    const query = params.length ? `?${params.join('&')}` : '';
    return apiClient.list(`/doctor/appointments/${query}`);
  },

  completeAppointment(id) {
    return apiClient.post(`/doctor/appointments/${id}/complete/`);
  },

  getPatients(name = '') {
    const query = name ? `?name=${encodeURIComponent(name)}` : '';
    return apiClient.list(`/doctor/patients/${query}`);
  },

  getPatient(id) {
    return apiClient.get(`/doctor/patients/${id}/`);
  },

  getMedicalHistory(patientId) {
    const query = patientId ? `?patient=${encodeURIComponent(patientId)}` : '';
    return apiClient.list(`/doctor/medical-history/${query}`);
  },

  getConsultations(patientId = null) {
    const query = patientId ? `?patient=${encodeURIComponent(patientId)}` : '';
    return apiClient.list(`/doctor/consultations/${query}`);
  },

  createConsultation(consultationData) {
    return apiClient.post('/doctor/consultations/', consultationData);
  },

  getPrescriptions(patientId = null) {
    const query = patientId ? `?patient=${encodeURIComponent(patientId)}` : '';
    return apiClient.list(`/doctor/prescriptions/${query}`);
  },

  createPrescription(prescriptionData) {
    return apiClient.post('/doctor/prescriptions/', prescriptionData);
  },

  createPrescriptionItem(itemData) {
    return apiClient.post('/doctor/prescription-items/', itemData);
  },

  getLabOrders(patientId = null, status = null) {
    const params = [];
    if (patientId) params.push(`patient=${encodeURIComponent(patientId)}`);
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    const query = params.length ? `?${params.join('&')}` : '';
    return apiClient.list(`/doctor/lab-orders/${query}`);
  },

  createLabOrder(labOrderData) {
    return apiClient.post('/doctor/lab-orders/', labOrderData);
  },

  getLabResults(orderId = null) {
    const query = orderId ? `?order=${encodeURIComponent(orderId)}` : '';
    return apiClient.list(`/doctor/lab-results/${query}`);
  },

  getMedicines(name = '', category = '') {
    const params = [];
    if (name) params.push(`name=${encodeURIComponent(name)}`);
    if (category) params.push(`category=${encodeURIComponent(category)}`);
    const query = params.length ? `?${params.join('&')}` : '';
    return apiClient.list(`/doctor/medicines/${query}`);
  },

  getDosages() {
    return apiClient.list('/doctor/dosages/');
  },

  getLabTests() {
    return apiClient.list('/doctor/lab-tests/');
  }
};

export default doctorService;
