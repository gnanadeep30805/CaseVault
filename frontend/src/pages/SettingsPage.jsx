import { useEffect, useState } from 'react';

export default function SettingsPage() {
    const [theme, setTheme] = useState(() => localStorage.getItem('casevault_theme') || 'light');
    useEffect(() => { const nextTheme = theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme; document.documentElement.dataset.theme = nextTheme; localStorage.setItem('casevault_theme', theme); }, [theme]);
    return <div><h1>Settings</h1><div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}><div className="card" style={{ padding: 20 }}><h3>Appearance</h3><div className="field"><label htmlFor="theme">Theme</label><select id="theme" className="select" value={theme} onChange={(event) => setTheme(event.target.value)}><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></div></div><div className="card" style={{ padding: 20 }}><h3>Security</h3><p className="muted">MFA and session security are managed by your account policy.</p><p className="muted">Access tokens expire after 15 minutes.</p></div></div></div>;
}
