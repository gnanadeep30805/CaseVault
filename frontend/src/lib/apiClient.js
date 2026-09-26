import axios from 'axios';

const ACCESS_KEY = 'casevault.accessToken';
const REFRESH_KEY = 'casevault.refreshToken';
const USER_KEY = 'casevault.user';

function readSession(key) {
    try {
        return window.sessionStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeSession(key, value) {
    try {
        if (value) window.sessionStorage.setItem(key, value);
        else window.sessionStorage.removeItem(key);
    } catch {
        return null;
    }
    return value;
}

const memory = {
    accessToken: readSession(ACCESS_KEY),
    refreshToken: readSession(REFRESH_KEY),
    user: (() => {
        try {
            return JSON.parse(readSession(USER_KEY) || 'null');
        } catch {
            return null;
        }
    })(),
};

const listeners = new Set();

export const tokenStore = {
    get accessToken() {
        return memory.accessToken;
    },
    get refreshToken() {
        return memory.refreshToken;
    },
    get user() {
        return memory.user;
    },
    get isAuthenticated() {
        return Boolean(memory.accessToken || memory.refreshToken);
    },
    setTokens({ accessToken, refreshToken, user } = {}) {
        if (accessToken !== undefined) {
            memory.accessToken = accessToken || null;
            writeSession(ACCESS_KEY, memory.accessToken);
        }
        if (refreshToken !== undefined) {
            memory.refreshToken = refreshToken || null;
            writeSession(REFRESH_KEY, memory.refreshToken);
        }
        if (user !== undefined) {
            memory.user = user || null;
            writeSession(USER_KEY, memory.user ? JSON.stringify(memory.user) : null);
        }
        listeners.forEach((listener) => listener({ ...memory }));
    },
    setUser(user) {
        tokenStore.setTokens({ user });
    },
    clear() {
        tokenStore.setTokens({ accessToken: null, refreshToken: null, user: null });
    },
    subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
};

export function apiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
    const message = error?.response?.data?.error?.message || error?.response?.data?.message || error?.message;
    return message || fallback;
}

export function apiErrorCode(error) {
    return error?.response?.data?.error?.code || error?.code || 'REQUEST_FAILED';
}

export function apiErrorStatus(error) {
    return error?.response?.status || 0;
}

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';

const api = axios.create({
    baseURL,
    timeout: 30000,
    headers: { Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
    const token = tokenStore.accessToken;
    if (token && !config.skipAuth) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
    }
    return config;
});

let refreshPromise = null;

async function requestRefresh() {
    const refreshToken = tokenStore.refreshToken;
    if (!refreshToken) throw new Error('missing_refresh_token');
    const response = await axios.post(
        `${baseURL}/auth/refresh`,
        { refreshToken },
        { headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, timeout: 20000 },
    );
    const payload = response.data?.data || {};
    tokenStore.setTokens({
        accessToken: payload.accessToken || tokenStore.accessToken,
        refreshToken: payload.refreshToken || refreshToken,
        user: payload.user || tokenStore.user,
    });
    return tokenStore.accessToken;
}

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error?.config;
        const status = error?.response?.status;
        const url = config?.url || '';
        const isAuthCall = url.includes('/auth/login')
            || url.includes('/auth/register')
            || url.includes('/auth/signup')
            || url.includes('/auth/refresh')
            || url.includes('/auth/logout')
            || url.includes('/auth/verify-mfa')
            || url.includes('/auth/demo-code')
            || url.includes('/auth/forgot-password');
        if (status !== 401 || !config || config.__cvRetried || isAuthCall) throw error;
        config.__cvRetried = true;
        if (!tokenStore.refreshToken) {
            tokenStore.clear();
            throw error;
        }
        try {
            refreshPromise = refreshPromise || requestRefresh();
            const accessToken = await refreshPromise;
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${accessToken}`;
            return await api.request(config);
        } catch (refreshError) {
            tokenStore.clear();
            throw error;
        } finally {
            refreshPromise = null;
        }
    },
);

export function unwrap(response) {
    return response?.data?.data;
}

export { api, baseURL };
