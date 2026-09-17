import axios from 'axios';
import { getRemoteServerHost } from './firebase';

export const formatBaseUrl = (host) => {
  if (!host || typeof host !== 'string') {
    return 'http://192.168.88.120:8080/api';
  }
  let clean = host.trim();
  if (!clean) return 'http://192.168.88.120:8080/api';

  // If host already contains protocol (http:// or https://)
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    if (clean.endsWith('/api')) {
      return clean;
    }
    return `${clean.replace(/\/+$/, '')}/api`;
  }

  // If host includes port (e.g. 192.168.88.120:8080 or domain.com:8080)
  if (clean.includes(':')) {
    return `http://${clean}/api`;
  }

  // Default port 8080
  return `http://${clean}:8080/api`;
};

// Initial base URL determination
const getInitialBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // Check cached server host from previous Firebase Remote Config fetch
  try {
    const cachedHost = localStorage.getItem('cached_server_host');
    if (cachedHost) {
      return formatBaseUrl(cachedHost);
    }
  } catch (_) {}

  // Fallback based on window location if available
  if (typeof window !== 'undefined' && window.location) {
    const { port, hostname } = window.location;
    // If served via standard HTTP/HTTPS proxy (Nginx port 80/443), use relative /api
    if (!port || port === '80' || port === '443') {
      return '/api';
    }
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:8080/api`;
    }
  }

  return 'http://192.168.88.120:8080/api';
};

let cachedBaseUrl = getInitialBaseUrl();
let initPromise = null;

const api = axios.create({
  baseURL: cachedBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Function update baseURL ពេល App ចាប់ផ្តើម ឬទាញយកពី Firebase
export const initApiConfig = () => {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const host = await getRemoteServerHost();
        if (host) {
          const newBaseUrl = formatBaseUrl(host);
          cachedBaseUrl = newBaseUrl;
          api.defaults.baseURL = newBaseUrl;
          return newBaseUrl;
        }
      } catch (err) {
        console.warn('Could not update API baseURL from Remote Config:', err);
      }
      return cachedBaseUrl;
    })();
  }
  return initPromise;
};

// Start fetching Remote Config early
if (typeof window !== 'undefined') {
  initApiConfig();
}

// Request interceptor to automatically add authorization token and ensure baseURL is updated
api.interceptors.request.use(
  async (config) => {
    // If remote config is still resolving, wait up to 2 seconds so first API calls use the remote host
    if (initPromise) {
      await Promise.race([
        initPromise,
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    }

    if (cachedBaseUrl) {
      config.baseURL = cachedBaseUrl;
    }

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
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
