import apiClient from './apiClient';

export const adminService = {
  getDashboardStats() {
    return apiClient.get('/adminapp/dashboard/');
  },

  getUsers() {
    return apiClient.list('/adminapp/users/');
  },

  createUser(userData) {
    return apiClient.post('/adminapp/users/', userData);
  },

  getDoctors() {
    return apiClient.list('/adminapp/doctors/');
  },

  createDoctor(doctorData) {
    return apiClient.post('/adminapp/doctors/', doctorData);
  },

  getReceptionists() {
    return apiClient.list('/adminapp/receptionists/');
  },

  createReceptionist(data) {
    return apiClient.post('/adminapp/receptionists/', data);
  },

  getLabTechnicians() {
    return apiClient.list('/adminapp/lab-technicians/');
  },

  createLabTechnician(data) {
    return apiClient.post('/adminapp/lab-technicians/', data);
  },

  getPharmacists() {
    return apiClient.list('/adminapp/pharmacists/');
  },

  createPharmacist(data) {
    return apiClient.post('/adminapp/pharmacists/', data);
  },

  getMedicines() {
    return apiClient.list('/adminapp/medicines/');
  },

  createMedicine(medicineData) {
    return apiClient.post('/adminapp/medicines/', medicineData);
  },

  getLabTests() {
    return apiClient.list('/adminapp/lab-tests/');
  },

  createLabTest(labTestData) {
    return apiClient.post('/adminapp/lab-tests/', labTestData);
  },

  getPriceList() {
    return apiClient.list('/adminapp/price-list/');
  },

  getStock() {
    return apiClient.list('/adminapp/stock/');
  }
};

export default adminService;
