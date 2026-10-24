import apiClient from './apiClient';

export const doctorService = {
  getProfile() {
    return apiClient.get('/doctor/profile/');
  },

  getAppointments(date = null, status = null, patient = null) {
    const params = [];
    if (typeof date === 'object' && date !== null) {
      if (date.date) params.push(`date=${encodeURIComponent(date.date)}`);
      if (date.status) params.push(`status=${encodeURIComponent(date.status)}`);
      if (date.patient) params.push(`patient=${encodeURIComponent(date.patient)}`);
    } else {
      if (date) params.push(`date=${encodeURIComponent(date)}`);
      if (status) params.push(`status=${encodeURIComponent(status)}`);
      if (patient) params.push(`patient=${encodeURIComponent(patient)}`);
    }
    const query = params.length ? `?${params.join('&')}` : '';
    return apiClient.list(`/doctor/appointments/${query}`);
  },

  completeAppointment(id) {
    return apiClient.post(`/doctor/appointments/${id}/complete/`);
  },

  getPatients(params = '') {
    if (typeof params === 'string') {
      const query = params ? `?search=${encodeURIComponent(params)}` : '';
      return apiClient.list(`/doctor/patients-directory/${query}`);
    }
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.append('search', params.search);
    if (params?.name) searchParams.append('name', params.name);
    if (params?.phone) searchParams.append('phone', params.phone);
    if (params?.patient_id) searchParams.append('patient_id', params.patient_id);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiClient.list(`/doctor/patients-directory/${query}`);
  },

  getPatient(id) {
    return apiClient.get(`/doctor/patients-directory/${id}/`);
  },

  getMedicalHistory(patientId) {
    return apiClient.list(`/doctor/patients-directory/${patientId}/medical_history/`).catch(() => {
      const query = patientId ? `?patient=${encodeURIComponent(patientId)}` : '';
      return apiClient.list(`/doctor/medical-history/${query}`);
    });
  },

  getConsultations(patientId = null) {
    const query = patientId ? `?patient=${encodeURIComponent(patientId)}` : '';
    return apiClient.list(`/doctor/consultations/${query}`);
  },

  getConsultation(id) {
    return apiClient.get(`/doctor/consultations/${id}/`);
  },

  createConsultation(consultationData) {
    return apiClient.post('/doctor/consultations/', consultationData);
  },

  updateConsultation(id, consultationData) {
    return apiClient.patch(`/doctor/consultations/${id}/`, consultationData);
  },

  startUnscheduledConsultation(data) {
    return apiClient.post('/doctor/consultations/start_unscheduled/', data);
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
