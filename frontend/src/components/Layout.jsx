import { NavLink, Outlet } from 'react-router-dom';
import { Activity, Archive, Bell, BriefcaseBusiness, FileText, Gauge, ShieldCheck, Shield, UserCircle2 } from 'lucide-react';

const navItems = [
    { to: '/', label: 'Dashboard', icon: Gauge },
    { to: '/cases', label: 'Cases', icon: BriefcaseBusiness },
    { to: '/documents', label: 'Documents', icon: FileText },
    { to: '/evidence', label: 'Evidence', icon: Shield },
    { to: '/assets', label: 'Assets', icon: Archive },
    { to: '/audit', label: 'Audit Logs', icon: Activity },
    { to: '/settings', label: 'Settings', icon: ShieldCheck },
    { to: '/profile', label: 'Profile', icon: UserCircle2 },
];

export default function Layout({ onLogout, user }) {
    return (
        <div className="app-shell">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: '#2563eb', display: 'grid', placeItems: 'center', fontWeight: 800 }}>C</div>
                    <span>CaseVault</span>
                </div>
                <nav className="sidebar-nav">
                    {navItems.map(({ to, label, icon: Icon }) => (
                        <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <Icon size={18} />
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>
            </aside>

            <div className="main-panel">
                <header className="topbar">
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <input className="search-box" placeholder="Global Search" />
                    </div>
                    <div className="topbar-right">
                        <Bell size={18} />
                        <button className="btn btn-secondary" type="button">Dark</button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e2e8f0', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
                                {user?.name?.charAt(0) || 'A'}
                            </div>
                            <div>
                                <div style={{ fontWeight: 700 }}>{user?.name || 'Analyst'}</div>
                                <div className="muted" style={{ fontSize: 12 }}>{user?.role || 'Administrator'}</div>
                            </div>
                        </div>
                        <button className="btn btn-secondary" type="button" onClick={onLogout}>Logout</button>
                    </div>
                </header>
                <main className="content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
