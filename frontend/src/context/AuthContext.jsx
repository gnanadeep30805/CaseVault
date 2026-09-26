import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, apiErrorMessage, tokenStore, unwrap } from '../lib/apiClient.js';
import { hasPermission } from '../lib/capabilities.js';

const AuthContext = createContext(null);

function storeSession(payload) {
    const tokens = payload?.tokens || {};
    tokenStore.setTokens({
        accessToken: tokens.accessToken || payload?.accessToken || null,
        refreshToken: tokens.refreshToken || payload?.refreshToken || null,
        user: payload?.user || tokenStore.user,
    });
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => tokenStore.user);
    const [status, setStatus] = useState(() => (tokenStore.isAuthenticated ? 'restoring' : 'anonymous'));

    const applySession = useCallback((payload) => {
        storeSession(payload);
        setUser(payload?.user || tokenStore.user);
        setStatus(payload?.user || tokenStore.user ? 'authenticated' : 'anonymous');
        return payload;
    }, []);

    const clearSession = useCallback(() => {
        tokenStore.clear();
        setUser(null);
        setStatus('anonymous');
    }, []);

    useEffect(() => tokenStore.subscribe((state) => {
        if (!state.accessToken && !state.refreshToken && status === 'authenticated') {
            setUser(null);
            setStatus('anonymous');
            return;
        }
        if (state.user && JSON.stringify(state.user) !== JSON.stringify(user)) setUser(state.user);
    }), [status, user]);

    useEffect(() => {
        let cancelled = false;
        async function restore() {
            if (!tokenStore.refreshToken) {
                if (!cancelled) setStatus('anonymous');
                return;
            }
            try {
                const response = await api.post('/auth/refresh', { refreshToken: tokenStore.refreshToken }, { skipAuth: true });
                if (cancelled) return;
                const data = unwrap(response) || {};
                tokenStore.setTokens({
                    accessToken: data.accessToken || tokenStore.accessToken,
                    refreshToken: data.refreshToken || tokenStore.refreshToken,
                    user: data.user || tokenStore.user,
                });
                setUser(data.user || tokenStore.user);
                setStatus('authenticated');
            } catch {
                if (cancelled) return;
                clearSession();
            }
        }
        restore();
        return () => {
            cancelled = true;
        };
    }, [clearSession]);

    const login = useCallback(async (credentials) => {
        const response = await api.post('/auth/login', credentials, { skipAuth: true });
        const data = unwrap(response) || {};
        if (data.requiresMfa || data.mfaRequired) {
            return { requiresMfa: true, challengeId: data.challengeId, expiresAt: data.expiresAt, user: data.user };
        }
        applySession(data);
        return { requiresMfa: false, ...data };
    }, [applySession]);

    const verifyMfa = useCallback(async (payload) => {
        const response = await api.post('/auth/verify-mfa', payload, { skipAuth: true });
        const data = unwrap(response) || {};
        applySession(data);
        return data;
    }, [applySession]);

    const fetchDemoCode = useCallback(async (payload) => {
        const response = await api.post('/auth/demo-code', payload, { skipAuth: true });
        return unwrap(response) || {};
    }, []);

    const register = useCallback(async (payload) => {
        const response = await api.post('/auth/register', payload, { skipAuth: true });
        return unwrap(response) || {};
    }, []);

    const requestPasswordReset = useCallback(async (payload) => {
        const response = await api.post('/auth/forgot-password', payload, { skipAuth: true });
        return unwrap(response) || {};
    }, []);

    const logout = useCallback(async () => {
        const refreshToken = tokenStore.refreshToken;
        try {
            if (refreshToken) await api.post('/auth/logout', { refreshToken }, { skipAuth: true });
        } catch (error) {
            return { ok: false, message: apiErrorMessage(error) };
        } finally {
            clearSession();
        }
        return { ok: true };
    }, [clearSession]);

    const refreshProfile = useCallback(async () => {
        const response = await api.get('/users/me');
        const data = unwrap(response);
        if (data) tokenStore.setUser(data);
        return data;
    }, []);

    const value = useMemo(() => ({
        user,
        status,
        isAuthenticated: status === 'authenticated',
        isRestoring: status === 'restoring',
        can: (permission) => hasPermission(user, permission),
        login,
        verifyMfa,
        fetchDemoCode,
        register,
        requestPasswordReset,
        logout,
        refreshProfile,
        setUser,
    }), [user, status, login, verifyMfa, fetchDemoCode, register, requestPasswordReset, logout, refreshProfile]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used inside AuthProvider');
    return context;
}
