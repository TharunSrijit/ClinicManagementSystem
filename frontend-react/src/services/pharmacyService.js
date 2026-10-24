import apiClient from './apiClient';

export const pharmacyService = {
  getProfile() {
    return apiClient.get('/pharmacy/profile/');
  },

  getPrescriptions(dispensed = null, patientId = null) {
    const params = [];
    if (dispensed !== null) params.push(`dispensed=${dispensed}`);
    if (patientId) params.push(`patient=${encodeURIComponent(patientId)}`);
    const query = params.length ? `?${params.join('&')}` : '';
    return apiClient.list(`/pharmacy/prescriptions/${query}`);
  },

  getDispenses(status = null, patientId = null) {
    const params = [];
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    if (patientId) params.push(`patient=${encodeURIComponent(patientId)}`);
    const query = params.length ? `?${params.join('&')}` : '';
    return apiClient.list(`/pharmacy/dispenses/${query}`);
  },

  createDispense(dispenseData) {
    return apiClient.post('/pharmacy/dispenses/', dispenseData);
  },

  dispenseOrder(id) {
    return apiClient.post(`/pharmacy/dispenses/${id}/dispense/`);
  },

  cancelDispense(id) {
    return apiClient.post(`/pharmacy/dispenses/${id}/cancel/`);
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
