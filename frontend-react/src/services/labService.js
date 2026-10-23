import apiClient from './apiClient';

export const labService = {
  getProfile() {
    return apiClient.get('/lab/profile/');
  },

  getLabOrders() {
    return apiClient.list('/lab/lab-orders/');
  },

  getLabResults() {
    return apiClient.list('/lab/lab-results/');
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
