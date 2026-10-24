import apiClient from './apiClient';

export const labService = {
  getProfile() {
    return apiClient.get('/lab/profile/');
  },

  getLabOrders(status = null, patientId = null) {
    const params = [];
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    if (patientId) params.push(`patient=${encodeURIComponent(patientId)}`);
    const query = params.length ? `?${params.join('&')}` : '';
    return apiClient.list(`/lab/lab-orders/${query}`);
  },

  collectSample(id) {
    return apiClient.post(`/lab/lab-orders/${id}/collect_sample/`);
  },

  startProcessing(id) {
    return apiClient.post(`/lab/lab-orders/${id}/start_processing/`);
  },

  completeOrder(id) {
    return apiClient.post(`/lab/lab-orders/${id}/complete/`);
  },

  getLabResults(orderId = null) {
    const query = orderId ? `?order=${encodeURIComponent(orderId)}` : '';
    return apiClient.list(`/lab/lab-results/${query}`);
  },

  createLabResult(resultData) {
    return apiClient.post('/lab/lab-results/', resultData);
  },

  getInvoices() {
    return apiClient.list('/lab/invoices/');
  },

  createPayment(paymentData) {
    return apiClient.post('/lab/payments/', paymentData);
  },

  getTests() {
    return apiClient.list('/lab/tests/');
  },

  getPatients() {
    return apiClient.list('/lab/patients/');
  }
};

export default labService;
