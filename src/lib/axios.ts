import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to automatically attach the JWT token
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

api.interceptors.response.use(
  (response) => {
    if (response.config?.url?.includes('/auth/me') && response.data?.success === false && response.data?.message === 'User not found') {
      localStorage.removeItem('token');
      window.location.href = '/login';
      return Promise.reject(new Error('User not found'));
    }
    return response;
  },
  (error) => {
    if (error.response) {
      const { status, data, config } = error.response;

      if (status === 403 && data?.must_change_password) {
        window.location.href = '/change-password?forced=true';
        return Promise.reject(error);
      }

      if (status === 401 || status === 403) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }

      if (config?.url?.includes('/auth/me') && data?.message === 'User not found') {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
