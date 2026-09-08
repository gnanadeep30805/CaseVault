import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:4000/api/v1',
    timeout: 10000,
});

api.interceptors.request.use((config) => {
    const stored = localStorage.getItem('casevault_auth');
    const auth = stored ? JSON.parse(stored) : null;
    if (auth?.token) {
        config.headers.Authorization = `Bearer ${auth.token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error?.response?.status === 401) {
            localStorage.removeItem('casevault_auth');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    },
);

export { api };
