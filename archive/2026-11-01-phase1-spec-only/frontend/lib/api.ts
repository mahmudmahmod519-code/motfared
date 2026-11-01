import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach token from localStorage if present
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        const currentPath = window.location.pathname;
        if (!currentPath.startsWith('/auth') && !currentPath.startsWith('/mobile')) {
          window.location.href = '/auth/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: Record<string, unknown>) =>
    api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// Users
export const usersApi = {
  getAll: (params?: Record<string, unknown>) =>
    api.get('/users', { params }),
  getById: (id: string | number) => api.get(`/users/${id}`),
  create: (data: Record<string, unknown>) => api.post('/users', data),
  update: (id: string | number, data: Record<string, unknown>) =>
    api.patch(`/users/${id}`, data),
  delete: (id: string | number) => api.delete(`/users/${id}`),
};

// Companies
export const companiesApi = {
  getAll: (params?: Record<string, unknown>) =>
    api.get('/companies', { params }),
  getById: (id: string | number) => api.get(`/companies/${id}`),
  create: (data: Record<string, unknown>) => api.post('/companies', data),
  update: (id: string | number, data: Record<string, unknown>) =>
    api.patch(`/companies/${id}`, data),
  delete: (id: string | number) => api.delete(`/companies/${id}`),
};

// Lead Sources
export const leadsApi = {
  getAll: (params?: Record<string, unknown>) =>
    api.get('/leads', { params }),
  getById: (id: string | number) => api.get(`/leads/${id}`),
  create: (data: Record<string, unknown>) => api.post('/leads', data),
  update: (id: string | number, data: Record<string, unknown>) =>
    api.patch(`/leads/${id}`, data),
  delete: (id: string | number) => api.delete(`/leads/${id}`),
};

// Lead Contacts
export const contactsApi = {
  getAll: (params?: Record<string, unknown>) =>
    api.get('/lead-contacts', { params }),
  getById: (id: string | number) => api.get(`/lead-contacts/${id}`),
  create: (data: Record<string, unknown>) => api.post('/lead-contacts', data),
  update: (id: string | number, data: Record<string, unknown>) =>
    api.patch(`/lead-contacts/${id}`, data),
  delete: (id: string | number) => api.delete(`/lead-contacts/${id}`),
};

// Plan Sales (Tasks)
export const planSalesApi = {
  getAll: (params?: Record<string, unknown>) =>
    api.get('/plan-sales', { params }),
  getById: (id: string | number) => api.get(`/plan-sales/${id}`),
  create: (data: Record<string, unknown>) => api.post('/plan-sales', data),
  update: (id: string | number, data: Record<string, unknown>) =>
    api.patch(`/plan-sales/${id}`, data),
  delete: (id: string | number) => api.delete(`/plan-sales/${id}`),
};

// Calls
export const callsApi = {
  getAll: (params?: Record<string, unknown>) =>
    api.get('/calls', { params }),
  getById: (id: string | number) => api.get(`/calls/${id}`),
  create: (data: Record<string, unknown>) => api.post('/calls', data),
};

// Subscriptions
export const subscriptionsApi = {
  getAll: (params?: Record<string, unknown>) =>
    api.get('/subscriptions', { params }),
  getById: (id: string | number) => api.get(`/subscriptions/${id}`),
  create: (data: Record<string, unknown>) => api.post('/subscriptions', data),
  update: (id: string | number, data: Record<string, unknown>) =>
    api.patch(`/subscriptions/${id}`, data),
};

// Services
export const servicesApi = {
  getAll: (params?: Record<string, unknown>) =>
    api.get('/services', { params }),
  getById: (id: string | number) => api.get(`/services/${id}`),
};

// Dashboard
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
};
