import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function RequireAuth({ children }) {
    const { isAuthenticated, isRestoring } = useAuth();
    const location = useLocation();

    if (isRestoring) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-ink-50 dark:bg-ink-900" role="status" aria-live="polite">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin text-brand-500" size={26} aria-hidden="true" />
                    <p className="text-sm font-medium text-ink-500 dark:text-ink-400">Restoring secure session…</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
    }

    return children;
}
