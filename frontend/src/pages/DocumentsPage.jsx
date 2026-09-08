import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';

const initialForm = { fileName: '', caseId: '', caseNumber: '', category: 'FIR', classification: 'CONFIDENTIAL', content: '' };

export default function DocumentsPage() {
    const [documents, setDocuments] = useState([]);
    const [form, setForm] = useState(initialForm);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function loadDocuments() {
        setLoading(true);
        try { const response = await api.get('/documents'); setDocuments(response.data.data || []); setError(''); } catch (requestError) { setError(requestError?.response?.data?.error?.message || 'Unable to load documents.'); } finally { setLoading(false); }
    }
    useEffect(() => { loadDocuments(); }, []);

    async function createDocument(event) {
        event.preventDefault();
        setSaving(true);
        try { await api.post('/documents', form); setForm(initialForm); setOpen(false); await loadDocuments(); } catch (requestError) { setError(requestError?.response?.data?.error?.message || 'Unable to create document.'); } finally { setSaving(false); }
    }

    return <div><div className="page-header"><h1>Documents</h1><button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>Upload Document</button></div><div className="card" style={{ padding: 16 }}>{error && <p className="error">{error}</p>}{loading ? <p className="muted">Loading documents...</p> : documents.length === 0 ? <p className="muted">No documents found.</p> : <div className="table-wrap"><table><thead><tr><th>Document ID</th><th>File name</th><th>Case</th><th>Category</th><th>Classification</th><th>Version</th><th>Status</th><th>Actions</th></tr></thead><tbody>{documents.map((item) => <tr key={item.id}><td>{item.id}</td><td>{item.fileName}</td><td>{item.caseNumber || item.caseId}</td><td>{item.category}</td><td>{item.classification}</td><td>{item.version}</td><td>{item.status}</td><td><Link to={`/documents/${item.id}/integrity`} className="btn btn-secondary">Integrity</Link></td></tr>)}</tbody></table></div>}</div>{open && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true"><h2>Upload Document</h2><form onSubmit={createDocument}><label className="field">File name<input className="input" required value={form.fileName} onChange={(event) => setForm({ ...form, fileName: event.target.value })} /></label><div className="form-grid"><label className="field">Case ID<input className="input" required value={form.caseId} onChange={(event) => setForm({ ...form, caseId: event.target.value })} /></label><label className="field">Case number<input className="input" value={form.caseNumber} onChange={(event) => setForm({ ...form, caseNumber: event.target.value })} /></label><label className="field">Category<select className="select" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>FIR</option><option>Statement</option><option>Report</option><option>Other</option></select></label><label className="field">Classification<select className="select" value={form.classification} onChange={(event) => setForm({ ...form, classification: event.target.value })}><option>INTERNAL</option><option>CONFIDENTIAL</option><option>RESTRICTED</option><option>HIGHLY_RESTRICTED</option></select></label></div><label className="field">Development content<textarea className="textarea" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /></label><div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button className="btn btn-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create Document'}</button></div></form></div></div>}</div>;
}
