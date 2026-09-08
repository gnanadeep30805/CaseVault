export default function ProfilePage({ user }) {
    return (
        <div>
            <h1>Profile</h1>
            <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
                    <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#dbeafe', display: 'grid', placeItems: 'center', fontWeight: 700 }}>{user?.name?.charAt(0) || 'A'}</div>
                    <div>
                        <h3 style={{ margin: 0 }}>{user?.name || 'System Admin'}</h3>
                        <div className="muted">{user?.email || 'admin@casevault.local'}</div>
                    </div>
                </div>

                <div className="form-grid">
                    <div><strong>Role</strong><div className="muted">{user?.role || 'Administrator'}</div></div>
                    <div><strong>Department</strong><div className="muted">{user?.department || 'Administration'}</div></div>
                    <div><strong>Account status</strong><div className="muted">Active</div></div>
                    <div><strong>MFA status</strong><div className="muted">Enabled</div></div>
                </div>
            </div>
        </div>
    );
}
