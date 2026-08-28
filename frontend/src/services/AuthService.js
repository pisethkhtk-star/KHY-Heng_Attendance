import api from '../utils/api';

/**
 * AuthService
 * Singleton class managing user authentication, token storage, and session validation.
 */
class AuthService {
  /**
   * Log in user with credentials
   * @param {Object} credentials
   * @returns {Promise<any>}
   */
  async login(credentials) {
    const response = await api.post('/auth/login', credentials);
    if (response.data?.token) {
      localStorage.setItem('token', response.data.token);
    }
    return response.data;
  }

  /**
   * Log out user and clear stored token
   */
  logout() {
    localStorage.removeItem('token');
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }

  /**
   * Get currently saved token
   * @returns {string|null}
   */
  getToken() {
    return localStorage.getItem('token');
  }

  /**
   * Check if user session is active
   * @returns {boolean}
   */
  isAuthenticated() {
    return Boolean(this.getToken());
  }

  /**
   * Fetch current user profile
   * @returns {Promise<any>}
   */
  async getCurrentUser() {
    const response = await api.get('/auth/me');
    return response.data;
  }
}

export const authService = new AuthService();
export default authService;
