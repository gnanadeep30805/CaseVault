import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Moon, Search, Settings, Sun, User, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useOnClickOutside } from '../../hooks/useResource.js';
import { initials } from '../../lib/format.js';
import NotificationMenu from './NotificationMenu.jsx';
import SecurityStatusPill from './SecurityStatusPill.jsx';

export default function Topbar({ onOpenSidebar, security }) {
    const { user, logout, can } = useAuth();
    const { isDark, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const menuRef = useRef(null);

    useOnClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

    useEffect(() => {
        if (!menuOpen) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') setMenuOpen(false);
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [menuOpen]);

    const onSearch = (event) => {
        event.preventDefault();
        const trimmed = query.trim();
        if (trimmed.length < 2) return;
        navigate(`/search?q=${encodeURIComponent(trimmed)}`);
        setQuery('');
    };

    const onLogout = async () => {
        setLoggingOut(true);
        await logout();
        setLoggingOut(false);
        setMenuOpen(false);
        navigate('/login', { replace: true });
    };

    return (
        <header className="sticky top-0 z-20 border-b cv-divider bg-white/95 backdrop-blur dark:bg-ink-800/95">
            <div className="flex items-center gap-2 px-3 py-2.5 sm:px-5">
                <button type="button" onClick={onOpenSidebar} className="cv-btn-ghost rounded-lg p-2 lg:hidden" aria-label="Open navigation">
                    <Menu size={18} aria-hidden="true" />
                </button>

                <form onSubmit={onSearch} role="search" className="relative min-w-0 flex-1 sm:max-w-md">
                    <label htmlFor="global-search" className="sr-only">Search cases, documents, evidence and tasks</label>
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                    <input
                        id="global-search"
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search cases, documents, evidence…"
                        className="cv-input pl-9"
                        minLength={2}
                    />
                </form>

                <div className="ml-auto flex items-center gap-1.5">
                    <div className="hidden xl:block">
                        <SecurityStatusPill security={security} canViewSecurity={can('security:read')} />
                    </div>
                    <button type="button" onClick={toggleTheme} className="cv-btn-ghost rounded-lg p-2" aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}>
                        {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
                    </button>
                    <NotificationMenu />

                    <div className="relative" ref={menuRef}>
                        <button
                            type="button"
                            onClick={() => setMenuOpen((value) => !value)}
                            className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-ink-100 dark:hover:bg-ink-700/50"
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                        >
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white" aria-hidden="true">
                                {initials(user?.name)}
                            </span>
                            <span className="hidden text-left sm:block">
                                <span className="block max-w-[10rem] truncate text-xs font-bold text-ink-900 dark:text-ink-50">{user?.name}</span>
                                <span className="block max-w-[10rem] truncate text-[0.65rem] text-ink-500 dark:text-ink-400">{user?.role}</span>
                            </span>
                            <ChevronDown size={14} className="text-ink-400" aria-hidden="true" />
                        </button>

                        {menuOpen ? (
                            <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border cv-divider bg-white shadow-overlay dark:bg-ink-800" role="menu" aria-label="Account">
                                <div className="border-b cv-divider px-4 py-3">
                                    <p className="truncate text-sm font-bold text-ink-900 dark:text-ink-50">{user?.name}</p>
                                    <p className="truncate text-xs text-ink-500 dark:text-ink-400">{user?.email}</p>
                                    <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-wider text-brand-500">
                                        {user?.role} · {user?.department}
                                    </p>
                                    <p className="mt-0.5 text-[0.65rem] text-ink-500 dark:text-ink-400">Clearance: {user?.clearance || 'Internal'}</p>
                                </div>
                                <div className="p-1.5">
                                    <Link to="/settings" role="menuitem" onClick={() => setMenuOpen(false)} className="cv-nav-link text-ink-700 dark:text-ink-200">
                                        <Settings size={15} aria-hidden="true" />
                                        Settings
                                    </Link>
                                    <Link to="/shared" role="menuitem" onClick={() => setMenuOpen(false)} className="cv-nav-link text-ink-700 dark:text-ink-200">
                                        <User size={15} aria-hidden="true" />
                                        Shared with me
                                    </Link>
                                </div>
                                <div className="border-t cv-divider p-1.5">
                                    <button type="button" role="menuitem" onClick={onLogout} disabled={loggingOut} className="cv-btn-ghost w-full justify-start text-danger">
                                        <LogOut size={15} aria-hidden="true" />
                                        {loggingOut ? 'Signing out…' : 'Sign out'}
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
            <div className="px-3 pb-2 xl:hidden sm:px-5">
                <SecurityStatusPill security={security} canViewSecurity={can('security:read')} />
            </div>
        </header>
    );
}
