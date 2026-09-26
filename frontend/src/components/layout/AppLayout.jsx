import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api, unwrap } from '../../lib/apiClient.js';

export default function AppLayout() {
    const { user, can } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [security, setSecurity] = useState(null);

    useEffect(() => {
        let cancelled = false;
        api.get('/dashboard')
            .then((response) => {
                if (!cancelled) setSecurity(unwrap(response)?.security || null);
            })
            .catch(() => {
                if (!cancelled) setSecurity(null);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="flex min-h-screen bg-ink-50 dark:bg-ink-900">
            <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-brand-500 focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">
                Skip to main content
            </a>
            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} can={can} user={user} />
            <div className="flex min-w-0 flex-1 flex-col">
                <div className="cv-no-print">
                    <Topbar onOpenSidebar={() => setSidebarOpen(true)} security={security} />
                </div>
                <main id="main-content" className="flex-1 px-3 py-5 sm:px-5 lg:px-7" tabIndex={-1}>
                    <Outlet />
                </main>
                <footer className="border-t cv-divider px-5 py-4 text-[0.7rem] text-ink-500 dark:text-ink-400">
                    <p>CaseVault · Secure case management · All access is logged, hashed and auditable.</p>
                </footer>
            </div>
        </div>
    );
}
