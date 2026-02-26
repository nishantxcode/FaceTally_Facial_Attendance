import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('facetally_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 globally
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('facetally_token');
            localStorage.removeItem('facetally_user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// ---- Auth ----
export const authAPI = {
    login: (username, password) =>
        api.post('/auth/login', { username, password }),
    changePassword: (old_password, new_username, new_password) =>
        api.post('/auth/change-password', { old_password, new_username, new_password }),
};

// ---- Students ----
export const studentsAPI = {
    getAll: (params = {}) => api.get('/students', { params }),
    getOne: (id) => api.get(`/students/${id}`),
    create: (data) => api.post('/students', data),
    update: (id, data) => api.put(`/students/${id}`, data),
    delete: (id) => api.delete(`/students/${id}`),
    savePhotos: (id, images) => api.post(`/students/${id}/capture`, { images }),
    getDepartments: () => api.get('/students/departments'),
};

// ---- Attendance ----
export const attendanceAPI = {
    getAll: (params = {}) => api.get('/attendance', { params }),
    mark: (data) => api.post('/attendance', data),
    edit: (id, data) => api.put(`/attendance/${id}`, data),
    delete: (id) => api.delete(`/attendance/${id}`),
    bulkMark: (data) => api.post('/attendance/bulk', data),
    getToday: () => api.get('/attendance/today'),
};

// ---- Recognition ----
export const recognitionAPI = {
    recognize: (image) => api.post('/recognize', { image }),
    markFromRecognition: (student_id, name) =>
        api.post('/mark-from-recognition', { student_id, name }),
    getModelStatus: () => api.get('/model-status'),
};

// ---- Reports ----
export const reportsAPI = {
    getStats: () => api.get('/reports/stats'),
    getDaily: (date) => api.get('/reports/daily', { params: { date } }),
    getMonthly: (month, year) => api.get('/reports/monthly', { params: { month, year } }),
    getStudent: (id) => api.get(`/reports/student/${id}`),
    exportCSV: (type, params = {}) =>
        api.get('/reports/export', { params: { type, ...params }, responseType: 'blob' }),
};

// ---- Health ----
export const healthAPI = {
    check: () => api.get('/health'),
};

export default api;
