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
import SecurityPage from './pages/SecurityPage.jsx';
import VerificationPage from './pages/VerificationPage.jsx';
import DocumentIntegrityPage from './pages/DocumentIntegrityPage.jsx';
import EvidenceIntegrityPage from './pages/EvidenceIntegrityPage.jsx';
import AuditIntegrityPage from './pages/AuditIntegrityPage.jsx';
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

    const handleLogout = async () => {
        try {
            if (auth.refreshToken) await api.post('/auth/logout', { refreshToken: auth.refreshToken });
        } finally {
        localStorage.removeItem('casevault_auth');
        setAuth({ token: null, user: null, refreshToken: null });
        }
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
                <Route path="documents/:id/integrity" element={<DocumentIntegrityPage />} />
                <Route path="evidence" element={<EvidencePage />} />
                <Route path="evidence/:id/integrity" element={<EvidenceIntegrityPage />} />
                <Route path="assets" element={<AssetsPage />} />
                <Route path="audit" element={<AuditPage />} />
                <Route path="audit/integrity" element={<AuditIntegrityPage />} />
                <Route path="security" element={<SecurityPage />} />
                <Route path="verification" element={<VerificationPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="profile" element={<ProfilePage user={auth.user} />} />
            </Route>
            <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
        </Routes>
    );
}

export default App;
