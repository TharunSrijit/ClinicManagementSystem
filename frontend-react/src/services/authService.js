import apiClient from './apiClient';

export const authService = {
  async login(username, password) {
    const data = await apiClient.post('/auth/login/', { username, password });
    
    // Store tokens
    if (data.access) {
      apiClient.setTokens(data.access, data.refresh);
    }

    const user = {
      id: data.user_id,
      username: data.username,
      role: String(data.role || '').toUpperCase(),
      fullName: data.full_name || data.username
    };

    localStorage.setItem('loggedInUser', JSON.stringify(user));
    return user;
  },

  getCurrentUser() {
    try {
      const stored = localStorage.getItem('loggedInUser');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  isAuthenticated() {
    return Boolean(apiClient.getToken() && this.getCurrentUser());
  },

  logout() {
    apiClient.clearTokens();
  }
};

export default authService;
