export default function SettingsPage() {
    return (
        <div>
            <h1>Settings</h1>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="card" style={{ padding: 20 }}>
                    <h3>Appearance</h3>
                    <div className="field">
                        <label>Theme</label>
                        <select className="select">
                            <option>Light</option>
                            <option>Dark</option>
                            <option>System</option>
                        </select>
                    </div>
                </div>
                <div className="card" style={{ padding: 20 }}>
                    <h3>Security</h3>
                    <p className="muted">MFA enabled</p>
                    <p className="muted">Session window: 15 minutes</p>
                </div>
            </div>
        </div>
    );
}
