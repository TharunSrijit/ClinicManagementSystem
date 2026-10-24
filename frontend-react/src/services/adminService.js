import apiClient from './apiClient';

export const adminService = {
  getDashboardStats() {
    return apiClient.get('/admin/dashboard/');
  },

  getUsers() {
    return apiClient.list('/admin/users/');
  },

  createUser(userData) {
    return apiClient.post('/admin/users/', userData);
  },

  getDoctors() {
    return apiClient.list('/admin/doctors/');
  },

  createDoctor(doctorData) {
    return apiClient.post('/admin/doctors/', doctorData);
  },

  getReceptionists() {
    return apiClient.list('/admin/receptionists/');
  },

  createReceptionist(data) {
    return apiClient.post('/admin/receptionists/', data);
  },

  getLabTechnicians() {
    return apiClient.list('/admin/lab-technicians/');
  },

  createLabTechnician(data) {
    return apiClient.post('/admin/lab-technicians/', data);
  },

  getPharmacists() {
    return apiClient.list('/admin/pharmacists/');
  },

  createPharmacist(data) {
    return apiClient.post('/admin/pharmacists/', data);
  },

  getPatients() {
    return apiClient.list('/admin/patients/');
  },

  getAppointments() {
    return apiClient.list('/admin/appointments/');
  },

  getMedicines() {
    return apiClient.list('/admin/medicines/');
  },

  createMedicine(medicineData) {
    return apiClient.post('/admin/medicines/', medicineData);
  },

  getLabTests() {
    return apiClient.list('/admin/lab-tests/');
  },

  createLabTest(labTestData) {
    return apiClient.post('/admin/lab-tests/', labTestData);
  },

  getPriceList() {
    return apiClient.list('/admin/price-list/');
  },

  getStock() {
    return apiClient.list('/admin/stock/');
  },

  getStockTransactions() {
    return apiClient.list('/admin/stock-transactions/');
  },

  getConsultationInvoices() {
    return apiClient.list('/admin/consultation-invoices/');
  },

  getLabInvoices() {
    return apiClient.list('/admin/lab-invoices/');
  },

  getPharmacyInvoices() {
    return apiClient.list('/admin/pharmacy-invoices/');
  }
};

export default adminService;
