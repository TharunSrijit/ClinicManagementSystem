import apiClient from './apiClient';

const buildQuery = (filters = {}) => {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  return query ? `?${query}` : '';
};

const orderAction = (id, action, data = {}) =>
  apiClient.post(`/lab/lab-orders/${id}/${action}/`, data);

export const labService = {
  getProfile() {
    return apiClient.get('/lab/profile/');
  },

  getLabOrders(status = null, patientId = null, search = '') {
    const filters = typeof status === 'object' && status !== null
      ? { ...status }
      : { status, patient: patientId, search };

    if (filters.patientId && !filters.patient) {
      filters.patient = filters.patientId;
      delete filters.patientId;
    }

    return apiClient.list(`/lab/lab-orders/${buildQuery(filters)}`);
  },

  getLabOrder(id) {
    return apiClient.get(`/lab/lab-orders/${id}/`);
  },

  getSummary() {
    return apiClient.get('/lab/lab-orders/summary/');
  },

  generateBill(id, discount = '0') {
    return orderAction(id, 'generate_bill', { discount });
  },

  recordPayment(id, paymentData) {
    return orderAction(id, 'record_payment', paymentData);
  },

  collectSample(id) {
    return orderAction(id, 'collect_sample');
  },

  startProcessing(id) {
    return orderAction(id, 'start_processing');
  },

  submitResult(id, resultData) {
    return orderAction(id, 'submit_result', resultData);
  },

  cancelOrder(id) {
    return orderAction(id, 'cancel');
  },

  getLabResults(orderId = null) {
    return apiClient.list(`/lab/lab-results/${buildQuery({ order: orderId })}`);
  },

  getInvoices(filters = {}) {
    return apiClient.list(`/lab/invoices/${buildQuery(filters)}`);
  },

  getPayments(invoiceId = null) {
    return apiClient.list(`/lab/payments/${buildQuery({ invoice: invoiceId })}`);
  },

  getTests(name = '') {
    return apiClient.list(`/lab/tests/${buildQuery({ name })}`);
  },

  getPatients(name = '') {
    return apiClient.list(`/lab/patients/${buildQuery({ name })}`);
  }
};

export default labService;
