import axios from 'axios';

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  if (typeof window !== 'undefined' && window.location) {
    const { port } = window.location;
    // If served via standard HTTP/HTTPS proxy (Nginx port 80/443), use relative /api (proxied to 100.56.149.110)
    if (!port || port === '80' || port === '443') {
      return '/api';
    }
    // If running frontend dev server locally or custom port
    return 'http://192.168.88.156:8080/api';
  }

  return import.meta.env.DEV ? 'http://192.168.88.156:8080/api' : '/api';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to automatically add authorization token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle session expiration (unauthorized errors)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      // Only redirect to login if we are not already on it
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
