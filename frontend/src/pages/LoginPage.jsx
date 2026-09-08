import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginPage({ onLogin }) {
    const navigate = useNavigate();
    const [form, setForm] = useState({ identifier: 'admin@casevault.local', password: 'password123' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        setLoading(true);
        setError('');
        try {
            const result = await onLogin(form);
            if (result.requiresMfa) {
                localStorage.setItem('casevault_pending_login', JSON.stringify({ identifier: form.identifier, password: form.password }));
                navigate('/verify-mfa');
                return;
            }
            navigate('/');
        } catch (err) {
            setError(err?.response?.data?.error?.message || 'Invalid credentials.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-shell">
            <div className="auth-card">
                <h1 style={{ marginTop: 0 }}>CaseVault</h1>
                <p className="muted">Secure case and evidence management</p>
                <form onSubmit={handleSubmit}>
                    <div className="field">
                        <label>Email or Username</label>
                        <input className="input" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} />
                    </div>
                    <div className="field">
                        <label>Password</label>
                        <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    </div>
                    {error && <div className="error">{error}</div>}
                    <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
                        {loading ? 'Signing in...' : 'Login'}
                    </button>
                    <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 12 }}>Forgot Password</button>
                </form>
            </div>
        </div>
    );
}
