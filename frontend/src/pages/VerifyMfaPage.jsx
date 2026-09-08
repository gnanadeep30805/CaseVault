import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function VerifyMfaPage({ onVerify }) {
    const navigate = useNavigate();
    const [otp, setOtp] = useState('123456');
    const [error, setError] = useState('');

    async function handleSubmit(event) {
        event.preventDefault();
        const pending = JSON.parse(localStorage.getItem('casevault_pending_login') || '{}');
        try {
            const result = await onVerify({ ...pending, otp });
            localStorage.removeItem('casevault_pending_login');
            if (result?.tokens?.accessToken) navigate('/');
        } catch (err) {
            setError(err?.response?.data?.error?.message || 'Invalid OTP.');
        }
    }

    return (
        <div className="auth-shell">
            <div className="auth-card">
                <h2>Verify Identity</h2>
                <p className="muted">Enter the six-digit OTP from your authenticator.</p>
                <form onSubmit={handleSubmit}>
                    <div className="field">
                        <label>One-time password</label>
                        <input className="input" value={otp} maxLength={6} onChange={(e) => setOtp(e.target.value)} />
                    </div>
                    {error && <div className="error">{error}</div>}
                    <button className="btn btn-primary" style={{ width: '100%' }} type="submit">Verify</button>
                    <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 12 }} onClick={() => navigate('/login')}>Back</button>
                </form>
            </div>
        </div>
    );
}
