import { useState } from 'react';
import { api } from '../services/api.js';

export default function VerificationPage() {
    const [form, setForm] = useState({
        resource: 'Evidence EV-001',
        currentHash: 'Evidence EV-001',
        registeredHash: '4d82e3fd8b4148f53d286c0d7e92f63e04248339fa79d25b3022ae5f71c4c1a8',
    });
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const handleVerify = async () => {
        try {
            const response = await api.post('/security/integrity/verify', {
                resource: form.resource,
                currentHash: form.currentHash,
                registeredHash: form.registeredHash,
            });
            setResult(response.data.data);
            setError('');
        } catch (err) {
            setError(err?.response?.data?.error?.message || 'Verification failed.');
        }
    };

    return (
        <div>
            <div className="page-header">
                <h1>Verification</h1>
            </div>

            <div className="card" style={{ padding: 20, maxWidth: 760 }}>
                <div className="field">
                    <label>Resource</label>
                    <input className="input" value={form.resource} onChange={(e) => setForm({ ...form, resource: e.target.value })} />
                </div>
                <div className="field">
                    <label>Current Value</label>
                    <input className="input" value={form.currentHash} onChange={(e) => setForm({ ...form, currentHash: e.target.value })} />
                </div>
                <div className="field">
                    <label>Registered Hash</label>
                    <input className="input" value={form.registeredHash} onChange={(e) => setForm({ ...form, registeredHash: e.target.value })} />
                </div>
                <button className="btn btn-primary" onClick={handleVerify}>Verify</button>
                {error && <div className="error">{error}</div>}
            </div>

            {result && (
                <div className="card" style={{ marginTop: 20, padding: 24, maxWidth: 760 }}>
                    <div style={{ display: 'grid', gap: 10 }}>
                        <div><strong>Resource:</strong> {result.resource}</div>
                        <div><strong>Hash:</strong> {result.verified ? 'VALID' : 'MISMATCH'}</div>
                        <div><strong>Hash:</strong> {result.checks?.hash ? 'VALID' : 'MISMATCH'}</div>
                        <div><strong>Digital Signature:</strong> {result.checks?.signature ? 'VALID' : 'NOT VERIFIED'}</div>
                        <div><strong>Custody Chain:</strong> {result.checks?.custody ? 'VALID' : 'NOT VERIFIED'}</div>
                        <div><strong>Audit Chain:</strong> {result.checks?.audit ? 'VALID' : 'NOT VERIFIED'}</div>
                        <div><strong>Merkle Proof:</strong> {result.checks?.merkle ? 'VALID' : 'NOT VERIFIED'}</div>
                        <div><strong>Overall Status:</strong> {result.overallStatus}</div>
                    </div>
                </div>
            )}
        </div>
    );
}
