import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error.response?.data || error);
  }
);

export const authApi = {
  login: (data) => api.post('/auth/login', data)
};

export const exhibitorApi = {
  list: (params) => api.get('/exhibitors', { params }),
  detail: (id) => api.get(`/exhibitors/${id}`),
  create: (data) => api.post('/exhibitors', data),
  update: (id, data) => api.put(`/exhibitors/${id}`, data),
  audit: (id, data) => api.post(`/exhibitors/${id}/audit`, data)
};

export const personnelApi = {
  list: (params) => api.get('/personnel', { params }),
  detail: (id) => api.get(`/personnel/${id}`),
  create: (data) => api.post('/personnel', data),
  update: (id, data) => api.put(`/personnel/${id}`, data),
  delete: (id) => api.delete(`/personnel/${id}`),
  import: (formData) => api.post('/personnel/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadPhoto: (id, formData) => api.post(`/personnel/${id}/photo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  photoAudit: (id, data) => api.post(`/personnel/${id}/photo-audit`, data),
  audit: (id, data) => api.post(`/personnel/${id}/audit`, data),
  lost: (id) => api.post(`/personnel/${id}/lost`),
  issue: (id, data) => api.post(`/personnel/${id}/issue`, data)
};

export const batchApi = {
  list: (params) => api.get('/batches', { params }),
  detail: (id) => api.get(`/batches/${id}`),
  create: (data) => api.post('/batches', data),
  print: (id, data) => api.post(`/batches/${id}/print`, data),
  complete: (id) => api.post(`/batches/${id}/complete`),
  update: (id, data) => api.put(`/batches/${id}`, data)
};

export const verifyApi = {
  scan: (data) => api.post('/verify/scan', data),
  logs: (params) => api.get('/verify/logs', { params }),
  stats: () => api.get('/verify/stats')
};

export default api;
