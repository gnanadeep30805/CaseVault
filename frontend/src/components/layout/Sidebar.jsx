import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
    BarChart3,
    Building2,
    Fingerprint,
    FolderKanban,
    FileText,
    LayoutDashboard,
    ListChecks,
    ScrollText,
    Settings,
    Share2,
    ShieldCheck,
    Sparkles,
    Users,
    X,
} from 'lucide-react';

export const NAV_GROUPS = [
    {
        label: 'Workspace',
        items: [
            { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { to: '/cases', label: 'Cases', icon: FolderKanban, permission: 'case:read' },
            { to: '/documents', label: 'Documents', icon: FileText, permission: 'document:read' },
            { to: '/evidence', label: 'Evidence', icon: Fingerprint, permission: 'evidence:read' },
            { to: '/tasks', label: 'Tasks', icon: ListChecks, permission: 'task:read' },
            { to: '/shared', label: 'Shared With Me', icon: Share2 },
            { to: '/ai', label: 'AI Assistant', icon: Sparkles, permission: 'ai:analyze' },
        ],
    },
    {
        label: 'Oversight',
        items: [
            { to: '/audit', label: 'Audit Logs', icon: ScrollText, permission: 'audit:read' },
            { to: '/reports', label: 'Reports', icon: BarChart3, permission: 'report:read' },
            { to: '/security', label: 'Security Center', icon: ShieldCheck, permission: 'security:read' },
        ],
    },
    {
        label: 'Administration',
        items: [
            { to: '/users', label: 'Users', icon: Users, permission: 'user:read' },
            { to: '/departments', label: 'Departments', icon: Building2 },
            { to: '/settings', label: 'Settings', icon: Settings },
        ],
    },
];

function NavItem({ item, onNavigate }) {
    const location = useLocation();
    const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
    return (
        <li>
            <NavLink
                to={item.to}
                onClick={onNavigate}
                data-active={isActive ? 'true' : 'false'}
                aria-current={isActive ? 'page' : undefined}
                className="cv-nav-link"
            >
                <item.icon size={17} aria-hidden="true" />
                <span>{item.label}</span>
            </NavLink>
        </li>
    );
}

export default function Sidebar({ open, onClose, can, user }) {
    const groups = NAV_GROUPS
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => !item.permission || can(item.permission)),
        }))
        .filter((group) => group.items.length > 0);

    return (
        <>
            {open ? <div className="fixed inset-0 z-30 bg-ink-950/60 lg:hidden" onClick={onClose} aria-hidden="true" /> : null}
            <aside
                className={clsx(
                    'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r cv-divider bg-ink-900 transition-transform duration-200 lg:static lg:z-auto lg:w-64 lg:translate-x-0',
                    open ? 'translate-x-0' : '-translate-x-full',
                )}
                aria-label="Primary navigation"
            >
                <div className="flex items-center justify-between gap-2 border-b border-ink-800 px-4 py-4">
                    <NavLink to="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white">
                            <ShieldCheck size={18} aria-hidden="true" />
                        </span>
                        <span>
                            <span className="block text-sm font-bold tracking-wide text-white">CaseVault</span>
                            <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-ink-400">Secure Case Management</span>
                        </span>
                    </NavLink>
                    <button type="button" onClick={onClose} className="cv-btn-ghost rounded-md p-1.5 text-ink-300 lg:hidden" aria-label="Close navigation">
                        <X size={16} aria-hidden="true" />
                    </button>
                </div>

                <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 cv-scroll" aria-label="CaseVault sections">
                    {groups.map((group) => (
                        <div key={group.label}>
                            <p className="mb-1.5 px-2.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink-500">{group.label}</p>
                            <ul className="space-y-0.5">
                                {group.items.map((item) => (
                                    <NavItem key={item.to} item={item} onNavigate={onClose} />
                                ))}
                            </ul>
                        </div>
                    ))}
                </nav>

                <div className="border-t border-ink-800 px-4 py-3">
                    <p className="truncate text-xs font-semibold text-ink-200">{user?.name}</p>
                    <p className="truncate text-[0.68rem] text-ink-400">{user?.role} · {user?.department}</p>
                    <p className="mt-1 truncate text-[0.62rem] font-bold uppercase tracking-wider text-brand-200">Clearance {user?.clearance || 'Internal'}</p>
                </div>
            </aside>
        </>
    );
}
