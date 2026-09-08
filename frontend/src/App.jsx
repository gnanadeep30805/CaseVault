import { Navigate, Route, Routes } from 'react-router-dom';
import { useMemo, useState } from 'react';
import LoginPage from './pages/LoginPage.jsx';
import VerifyMfaPage from './pages/VerifyMfaPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import CasesPage from './pages/CasesPage.jsx';
import CaseDetailPage from './pages/CaseDetailPage.jsx';
import DocumentsPage from './pages/DocumentsPage.jsx';
import EvidencePage from './pages/EvidencePage.jsx';
import AssetsPage from './pages/AssetsPage.jsx';
import AuditPage from './pages/AuditPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import Layout from './components/Layout.jsx';
import { api } from './services/api.js';

function App() {
    const [auth, setAuth] = useState(() => {
        const stored = localStorage.getItem('casevault_auth');
        return stored ? JSON.parse(stored) : { token: null, user: null };
    });

    const isAuthenticated = Boolean(auth.token);

    const value = useMemo(() => ({
        auth,
        setAuth,
        isAuthenticated,
    }), [auth, isAuthenticated]);

    const handleLogin = async (payload) => {
        const response = await api.post('/auth/login', payload);
        const { data } = response.data;
        const nextAuth = { token: data.tokens?.accessToken || null, user: data.user || null, refreshToken: data.tokens?.refreshToken || null };
        localStorage.setItem('casevault_auth', JSON.stringify(nextAuth));
        setAuth(nextAuth);
        return data;
    };

    const handleMfa = async (payload) => {
        const response = await api.post('/auth/verify-mfa', payload);
        const { data } = response.data;
        const nextAuth = { token: data.tokens?.accessToken || null, user: data.user || null, refreshToken: data.tokens?.refreshToken || null };
        localStorage.setItem('casevault_auth', JSON.stringify(nextAuth));
        setAuth(nextAuth);
        return data;
    };

    const handleLogout = () => {
        localStorage.removeItem('casevault_auth');
        setAuth({ token: null, user: null, refreshToken: null });
    };

    return (
        <Routes>
            <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
            <Route path="/verify-mfa" element={<VerifyMfaPage onVerify={handleMfa} />} />
            <Route path="/" element={isAuthenticated ? <Layout onLogout={handleLogout} user={auth.user} /> : <Navigate to="/login" replace />}>
                <Route index element={<DashboardPage />} />
                <Route path="cases" element={<CasesPage />} />
                <Route path="cases/:id" element={<CaseDetailPage />} />
                <Route path="documents" element={<DocumentsPage />} />
                <Route path="evidence" element={<EvidencePage />} />
                <Route path="assets" element={<AssetsPage />} />
                <Route path="audit" element={<AuditPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="profile" element={<ProfilePage user={auth.user} />} />
            </Route>
            <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
        </Routes>
    );
}

export default App;
