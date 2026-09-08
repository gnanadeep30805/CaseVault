import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';

const emptyForm = { caseNumber: '', title: '', type: 'Criminal', description: '', priority: 'Medium', department: '', classification: 'Internal' };

export default function CasesPage() {
    const [cases, setCases] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function loadCases() {
        setLoading(true);
        try {
            const response = await api.get('/cases', { params: { search, status } });
            setCases(response.data.data || []);
            setError('');
        } catch (requestError) {
            setError(requestError?.response?.data?.error?.message || 'Unable to load cases.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { loadCases(); }, [search, status]);

    async function createCase(event) {
        event.preventDefault();
        setSaving(true);
        try {
            await api.post('/cases', form);
            setForm(emptyForm);
            setOpen(false);
            await loadCases();
        } catch (requestError) {
            setError(requestError?.response?.data?.error?.message || 'Unable to create case.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div>
            <div className="page-header"><h1>Cases</h1><button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>Create Case</button></div>
            <div className="card" style={{ padding: 16 }}>
                <div className="form-grid" style={{ marginBottom: 16 }}>
                    <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search case, number, title" />
                    <select className="select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option>Created</option><option>Under Investigation</option><option>Evidence Collection</option><option>Investigation Review</option><option>Legal Review</option><option>Closed</option><option>Archived</option></select>
                </div>
                {error && <p className="error">{error}</p>}
                {loading ? <p className="muted">Loading cases...</p> : cases.length === 0 ? <p className="muted">No cases found.</p> : <div className="table-wrap"><table><thead><tr><th>Case ID</th><th>Case Number</th><th>Title</th><th>Type</th><th>Priority</th><th>Officer</th><th>Status</th><th>Actions</th></tr></thead><tbody>{cases.map((item) => <tr key={item.id}><td>{item.id}</td><td>{item.caseNumber}</td><td>{item.title}</td><td>{item.type}</td><td>{item.priority}</td><td>{item.assignedOfficer}</td><td>{item.status}</td><td><Link className="btn btn-secondary" to={`/cases/${item.id}`}>View</Link></td></tr>)}</tbody></table></div>}
            </div>
            {open && <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="create-case-title"><h2 id="create-case-title">Create Case</h2><form onSubmit={createCase}><div className="form-grid"><label className="field">Case number<input className="input" required value={form.caseNumber} onChange={(event) => setForm({ ...form, caseNumber: event.target.value })} /></label><label className="field">Title<input className="input" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="field">Department<input className="input" required value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label><label className="field">Type<select className="select" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>Criminal</option><option>Financial Crime</option><option>Cyber Crime</option></select></label><label className="field">Priority<select className="select" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option>Low</option><option>Medium</option><option>High</option></select></label><label className="field">Classification<select className="select" value={form.classification} onChange={(event) => setForm({ ...form, classification: event.target.value })}><option>Internal</option><option>Confidential</option><option>Restricted</option><option>Highly Restricted</option></select></label></div><label className="field">Description<textarea className="textarea" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button className="btn btn-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create Case'}</button></div></form></div></div>}
        </div>
    );
}
