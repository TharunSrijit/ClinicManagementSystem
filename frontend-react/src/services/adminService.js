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

  createStaffProfile(staffData) {
    return apiClient.post('/admin/users/create_staff/', staffData);
  },

  updateStaffProfile(userId, data) {
    return apiClient.patch(`/admin/users/${userId}/staff-profile/`, data);
  },

  deleteStaffProfile(userId) {
    return apiClient.delete(`/admin/users/${userId}/staff-profile/`);
  },

  updateUser(userId, userData) {
    return apiClient.patch(`/admin/users/${userId}/`, userData);
  },

  deleteUser(userId) {
    return apiClient.delete(`/admin/users/${userId}/`);
  },

  setUserActive(userId, active) {
    return apiClient.post(`/admin/users/${userId}/${active ? 'activate' : 'deactivate'}/`);
  },

  activateUser(userId) {
    return apiClient.post(`/admin/users/${userId}/activate/`);
  },

  deactivateUser(userId) {
    return apiClient.post(`/admin/users/${userId}/deactivate/`);
  },

  createStaff(staffData) {
    return apiClient.post('/admin/users/create_staff/', staffData);
  },

  getDoctors() {
    return apiClient.list('/admin/doctors/');
  },

  createDoctor(doctorData) {
    return apiClient.post('/admin/doctors/', doctorData);
  },

  updateDoctor(doctorId, doctorData) {
    return apiClient.patch(`/admin/doctors/${doctorId}/`, doctorData);
  },

  deleteDoctor(doctorId) {
    return apiClient.delete(`/admin/doctors/${doctorId}/`);
  },

  setDoctorActive(userId, active) {
    return apiClient.post(`/admin/users/${userId}/${active ? 'activate' : 'deactivate'}/`);
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

  updateMedicine(medicineId, medicineData) {
    return apiClient.patch(`/admin/medicines/${medicineId}/`, medicineData);
  },

  deleteMedicine(medicineId) {
    return apiClient.delete(`/admin/medicines/${medicineId}/`);
  },

  setMedicineActive(medicineId, active) {
    return apiClient.post(`/admin/medicines/${medicineId}/${active ? 'activate' : 'deactivate'}/`);
  },

  activateMedicine(medicineId) {
    return apiClient.post(`/admin/medicines/${medicineId}/activate/`);
  },

  deactivateMedicine(medicineId) {
    return apiClient.post(`/admin/medicines/${medicineId}/deactivate/`);
  },

  getLabTests() {
    return apiClient.list('/admin/lab-tests/');
  },

  createLabTest(labTestData) {
    return apiClient.post('/admin/lab-tests/', labTestData);
  },

  updateLabTest(labTestId, labTestData) {
    return apiClient.patch(`/admin/lab-tests/${labTestId}/`, labTestData);
  },

  deleteLabTest(labTestId) {
    return apiClient.delete(`/admin/lab-tests/${labTestId}/`);
  },

  setLabTestActive(labTestId, active) {
    return apiClient.post(`/admin/lab-tests/${labTestId}/${active ? 'activate' : 'deactivate'}/`);
  },

  activateLabTest(labTestId) {
    return apiClient.post(`/admin/lab-tests/${labTestId}/activate/`);
  },

  deactivateLabTest(labTestId) {
    return apiClient.post(`/admin/lab-tests/${labTestId}/deactivate/`);
  },

  getPriceList() {
    return apiClient.list('/admin/price-list/');
  },

  getStock() {
    return apiClient.list('/admin/stock/');
  },

  createStock(stockData) {
    return apiClient.post('/admin/stock/', stockData);
  },

  updateStock(stockId, stockData) {
    return apiClient.patch(`/admin/stock/${stockId}/`, stockData);
  },

  deleteStock(stockId) {
    return apiClient.delete(`/admin/stock/${stockId}/`);
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
