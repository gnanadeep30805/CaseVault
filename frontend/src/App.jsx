import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import RequireAuth from './components/layout/RequireAuth.jsx';
import { PermissionNotice } from './components/ui/States.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import CasesPage from './pages/CasesPage.jsx';
import CaseDetailPage from './pages/CaseDetailPage.jsx';
import DocumentsPage from './pages/DocumentsPage.jsx';
import DocumentDetailPage from './pages/DocumentDetailPage.jsx';
import EvidencePage from './pages/EvidencePage.jsx';
import EvidenceDetailPage from './pages/EvidenceDetailPage.jsx';
import TasksPage from './pages/TasksPage.jsx';
import SharedPage from './pages/SharedPage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import AssistantPage from './pages/AssistantPage.jsx';
import CaseAssistantPage from './pages/CaseAssistantPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import AuditPage from './pages/AuditPage.jsx';
import SecurityPage from './pages/SecurityPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import DepartmentsPage from './pages/DepartmentsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import AssetsPage from './pages/AssetsPage.jsx';

function GuestOnly({ children }) {
    const { isAuthenticated } = useAuth();
    const location = useLocation();
    if (isAuthenticated) return <Navigate to="/dashboard" replace state={{ from: location.pathname }} />;
    return children;
}

function RequirePermission({ permission, children }) {
    const { can } = useAuth();
    if (!can(permission)) {
        return (
            <PermissionNotice
                message="Your role does not include permission for this area. Access is enforced server-side as well, so no data is exposed. Contact an administrator if you believe this is an error."
            />
        );
    }
    return children;
}

function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
            <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
            <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />

            <Route
                element={(
                    <RequireAuth>
                        <AppLayout />
                    </RequireAuth>
                )}
            >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/cases" element={<CasesPage />} />
                <Route path="/cases/:id" element={<CaseDetailPage />} />
                <Route path="/documents" element={<DocumentsPage />} />
                <Route path="/documents/:id" element={<DocumentDetailPage />} />
                <Route path="/evidence" element={<EvidencePage />} />
                <Route path="/evidence/:id" element={<EvidenceDetailPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/shared" element={<SharedPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/ai" element={<RequirePermission permission="ai:analyze"><AssistantPage /></RequirePermission>} />
                <Route path="/assistant" element={<Navigate to="/ai" replace />} />
                <Route path="/ai/case/:caseId" element={<RequirePermission permission="ai:analyze"><CaseAssistantPage /></RequirePermission>} />
                <Route path="/reports" element={<RequirePermission permission="report:read"><ReportsPage /></RequirePermission>} />
                <Route path="/audit" element={<RequirePermission permission="audit:read"><AuditPage /></RequirePermission>} />
                <Route path="/security" element={<RequirePermission permission="security:read"><SecurityPage /></RequirePermission>} />
                <Route path="/users" element={<RequirePermission permission="user:read"><UsersPage /></RequirePermission>} />
                <Route path="/departments" element={<DepartmentsPage />} />
                <Route path="/assets" element={<AssetsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
}

export default function App() {
    return (
        <ThemeProvider>
            <ToastProvider>
                <AuthProvider>
                    <AppRoutes />
                </AuthProvider>
            </ToastProvider>
        </ThemeProvider>
    );
}
