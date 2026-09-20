import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SignupPage({ onSignup }) {
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: '', email: '', username: '', password: '' });
    const [setup, setSetup] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        setLoading(true);
        setError('');
        try {
            const result = await onSignup(form);
            setSetup(result.mfaSetup);
        } catch (err) {
            setError(err?.response?.data?.error?.message || 'Unable to create account.');
        } finally {
            setLoading(false);
        }
    }

    if (setup) {
        return (
            <div className="auth-shell">
                <div className="auth-card">
                    <h2>Authenticator setup</h2>
                    <p className="muted">Add this account to Google Authenticator, Microsoft Authenticator, or another TOTP app.</p>
                    <div className="field"><label>Setup key</label><input className="input" readOnly value={setup.secret} /></div>
                    <div className="field"><label>Authenticator URI</label><textarea className="input" readOnly rows={3} value={setup.otpAuthUrl} /></div>
                    {setup.demoOtp && <div className="notice"><strong>Testing code: {setup.demoOtp}</strong><br />This code changes every 30 seconds. The authenticator app will generate the next codes.</div>}
                    <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={() => navigate('/login')}>Continue to login</button>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-shell">
            <div className="auth-card">
                <h1 style={{ marginTop: 0 }}>Create account</h1>
                <p className="muted">Your account will require an authenticator code at login.</p>
                <form onSubmit={handleSubmit}>
                    {['name', 'email', 'username', 'password'].map((field) => (
                        <div className="field" key={field}>
                            <label>{field[0].toUpperCase() + field.slice(1)}</label>
                            <input className="input" type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'} minLength={field === 'password' ? 8 : undefined} required value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} />
                        </div>
                    ))}
                    {error && <div className="error">{error}</div>}
                    <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>{loading ? 'Creating account...' : 'Sign up'}</button>
                    <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 12 }} onClick={() => navigate('/login')}>Back to login</button>
                </form>
            </div>
        </div>
    );
}