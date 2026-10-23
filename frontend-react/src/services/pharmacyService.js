import apiClient from './apiClient';

export const pharmacyService = {
  getProfile() {
    return apiClient.get('/pharmacy/profile/');
  },

  getPrescriptions() {
    return apiClient.list('/pharmacy/prescriptions/');
  },

  getDispenses() {
    return apiClient.list('/pharmacy/dispenses/');
  },

  createDispense(dispenseData) {
    return apiClient.post('/pharmacy/dispenses/', dispenseData);
  },

  getInvoices() {
    return apiClient.list('/pharmacy/invoices/');
  },

  createPayment(paymentData) {
    return apiClient.post('/pharmacy/payments/', paymentData);
  },

  getStock() {
    return apiClient.list('/pharmacy/stock/');
  },

  getMedicines() {
    return apiClient.list('/pharmacy/medicines/');
  },

  getPatients() {
    return apiClient.list('/pharmacy/patients/');
  }
};

export default pharmacyService;
