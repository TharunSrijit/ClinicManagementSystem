import apiClient from './apiClient';

export const pharmacyService = {
  getProfile() {
    return apiClient.get('/pharmacy/profile/');
  },

  getPrescriptions(params = {}) {
    let query = '';
    if (typeof params === 'boolean' || params === null) {
      if (params !== null) query = `?dispensed=${params}`;
    } else if (typeof params === 'object') {
      const searchParams = new URLSearchParams();
      if (params.dispensed !== undefined && params.dispensed !== null) {
        searchParams.append('dispensed', params.dispensed);
      }
      if (params.status) {
        searchParams.append('status', params.status);
      }
      if (params.patient) {
        searchParams.append('patient', params.patient);
      }
      if (params.search) {
        searchParams.append('search', params.search);
      }
      const qs = searchParams.toString();
      if (qs) query = `?${qs}`;
    }
    return apiClient.list(`/pharmacy/prescriptions/${query}`);
  },

  getPrescription(id) {
    return apiClient.get(`/pharmacy/prescriptions/${id}/`);
  },

  createBill(prescriptionId, billData) {
    return apiClient.post(`/pharmacy/prescriptions/${prescriptionId}/create_bill/`, billData);
  },

  getDispenses(status = null, patientId = null) {
    const params = [];
    if (status && status !== 'ALL') params.push(`status=${encodeURIComponent(status)}`);
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

  getInvoices(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.status && params.status !== 'ALL') {
      searchParams.append('status', params.status);
    }
    if (params.patient) {
      searchParams.append('patient', params.patient);
    }
    if (params.search) {
      searchParams.append('search', params.search);
    }
    const qs = searchParams.toString();
    const query = qs ? `?${qs}` : '';
    return apiClient.list(`/pharmacy/invoices/${query}`);
  },

  getInvoice(id) {
    return apiClient.get(`/pharmacy/invoices/${id}/`);
  },

  createPayment(paymentData) {
    return apiClient.post('/pharmacy/payments/', paymentData);
  },

  getStock(medicineId = null) {
    const query = medicineId ? `?medicine=${encodeURIComponent(medicineId)}` : '';
    return apiClient.list(`/pharmacy/stock/${query}`);
  },

  getMedicines(search = '') {
    const query = search ? `?name=${encodeURIComponent(search)}` : '';
    return apiClient.list(`/pharmacy/medicines/${query}`);
  },

  getPatients(search = '') {
    const query = search ? `?name=${encodeURIComponent(search)}` : '';
    return apiClient.list(`/pharmacy/patients/${query}`);
  }
};

export default pharmacyService;
