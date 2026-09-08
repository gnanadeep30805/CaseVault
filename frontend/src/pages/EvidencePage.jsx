import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';

const initialForm = { caseId: '', caseNumber: '', type: 'Digital', description: '', collectionDate: '', collectedBy: '', custodian: '', location: '' };

export default function EvidencePage() {
    const [evidence, setEvidence] = useState([]);
    const [form, setForm] = useState(initialForm);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function loadEvidence() {
        setLoading(true);
        try { const response = await api.get('/evidence'); setEvidence(response.data.data || []); setError(''); } catch (requestError) { setError(requestError?.response?.data?.error?.message || 'Unable to load evidence.'); } finally { setLoading(false); }
    }
    useEffect(() => { loadEvidence(); }, []);

    async function registerEvidence(event) {
        event.preventDefault();
        setSaving(true);
        try { await api.post('/evidence', form); setForm(initialForm); setOpen(false); await loadEvidence(); } catch (requestError) { setError(requestError?.response?.data?.error?.message || 'Unable to register evidence.'); } finally { setSaving(false); }
    }

    return <div><div className="page-header"><h1>Evidence</h1><button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>Register Evidence</button></div><div className="card" style={{ padding: 16 }}>{error && <p className="error">{error}</p>}{loading ? <p className="muted">Loading evidence...</p> : evidence.length === 0 ? <p className="muted">No evidence found.</p> : <div className="table-wrap"><table><thead><tr><th>Evidence ID</th><th>Case</th><th>Type</th><th>Description</th><th>Collected By</th><th>Custodian</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead><tbody>{evidence.map((item) => <tr key={item.id}><td>{item.id}</td><td>{item.caseNumber || item.caseId}</td><td>{item.type}</td><td>{item.description}</td><td>{item.collectedBy}</td><td>{item.currentCustodian}</td><td>{item.location}</td><td>{item.status}</td><td><Link to={`/evidence/${item.id}/integrity`} className="btn btn-secondary">Integrity</Link></td></tr>)}</tbody></table></div>}</div>{open && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true"><h2>Register Evidence</h2><form onSubmit={registerEvidence}><div className="form-grid"><label className="field">Case ID<input className="input" required value={form.caseId} onChange={(event) => setForm({ ...form, caseId: event.target.value })} /></label><label className="field">Case number<input className="input" value={form.caseNumber} onChange={(event) => setForm({ ...form, caseNumber: event.target.value })} /></label><label className="field">Type<select className="select" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>Digital</option><option>Physical</option><option>Biological</option><option>Document</option></select></label><label className="field">Collection date<input className="input" type="date" required value={form.collectionDate} onChange={(event) => setForm({ ...form, collectionDate: event.target.value })} /></label><label className="field">Collected by<input className="input" required value={form.collectedBy} onChange={(event) => setForm({ ...form, collectedBy: event.target.value })} /></label><label className="field">Custodian<input className="input" value={form.custodian} onChange={(event) => setForm({ ...form, custodian: event.target.value })} /></label><label className="field">Location<input className="input" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label></div><label className="field">Description<textarea className="textarea" required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button className="btn btn-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Register Evidence'}</button></div></form></div></div>}</div>;
}
