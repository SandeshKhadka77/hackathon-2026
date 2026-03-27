import axios from 'axios';

const AUTH_TOKEN_KEY = 'avasar_token';
const LEGACY_TOKEN_KEY = 'sajilo_token';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.code === 'ERR_NETWORK' || /ECONNREFUSED|ERR_CONNECTION_REFUSED/i.test(error?.message || '')) {
      error.userMessage = 'Backend server is not reachable. Verify API base URL and deployment health.';
    }

    return Promise.reject(error);
  }
);

export default api;
