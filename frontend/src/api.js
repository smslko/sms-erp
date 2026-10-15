import axios from 'axios';
const api = axios.create({ baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api' });
api.interceptors.request.use(c => { const t = localStorage.getItem('tk'); if (t) c.headers.Authorization = 'Bearer ' + t; return c; });
api.interceptors.response.use(r => r, e => {
  if (e.response?.status === 401 && !e.config.url.includes('/auth/login')) { localStorage.removeItem('tk'); location.href = '/'; }
  return Promise.reject(e);
});
export const err = e => e.response?.data?.message || e.message || 'Something went wrong';
export default api;
