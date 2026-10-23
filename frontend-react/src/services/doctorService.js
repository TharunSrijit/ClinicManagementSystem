import apiClient from './apiClient';

export const doctorService = {
  getAppointments(date = null, status = null) {
    let query = '';
    const params = [];
    if (date) params.push(`date=${encodeURIComponent(date)}`);
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    if (params.length) query = `?${params.join('&')}`;
    return apiClient.list(`/doctor/appointments/${query}`);
  },

  getPatients(search = '') {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return apiClient.list(`/doctor/patients/${query}`);
  },

  getPatientDetails(id) {
    return apiClient.get(`/doctor/patients/${id}/`);
  },

  createConsultation(consultationData) {
    return apiClient.post('/doctor/consultations/', consultationData);
  },

  createPrescription(prescriptionData) {
    return apiClient.post('/doctor/prescriptions/', prescriptionData);
  },

  createLabOrder(labOrderData) {
    return apiClient.post('/doctor/lab-orders/', labOrderData);
  },

  getMedicines() {
    return apiClient.list('/doctor/medicines/');
  },

  getDosages() {
    return apiClient.list('/doctor/dosages/');
  },

  getLabTests() {
    return apiClient.list('/doctor/lab-tests/');
  }
};

export default doctorService;
