import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api.js';

const statuses = ['Created', 'Under Investigation', 'Evidence Collection', 'Investigation Review', 'Legal Review', 'Closed', 'Archived'];

export default function CaseDetailPage() {
    const { id } = useParams();
    const [item, setItem] = useState(null);
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => { api.get(`/cases/${id}`).then((response) => { setItem(response.data.data); setStatus(response.data.data.status); }).catch((requestError) => setError(requestError?.response?.data?.error?.message || 'Unable to load case.')).finally(() => setLoading(false)); }, [id]);
    async function updateStatus(event) { event.preventDefault(); setSaving(true); try { const response = await api.patch(`/cases/${id}/status`, { status }); setItem(response.data.data); setError(''); } catch (requestError) { setError(requestError?.response?.data?.error?.message || 'Unable to update case status.'); } finally { setSaving(false); } }
    if (loading) return <p className="muted">Loading case...</p>;
    if (error && !item) return <p className="error">{error}</p>;
    return <div><div className="page-header"><div><h1>{item.caseNumber}</h1><div className="muted">{item.title}</div></div><form onSubmit={updateStatus} style={{ display: 'flex', gap: 8 }}><select className="select" value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((value) => <option key={value}>{value}</option>)}</select><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Change Status'}</button></form></div>{error && <p className="error">{error}</p>}<div className="card" style={{ padding: 20 }}><h3>Overview</h3><p>{item.description || 'No description provided.'}</p><div className="form-grid"><div><strong>Department</strong><div className="muted">{item.department}</div></div><div><strong>Priority</strong><div className="muted">{item.priority}</div></div><div><strong>Classification</strong><div className="muted">{item.classification}</div></div><div><strong>Assigned officer</strong><div className="muted">{item.assignedOfficer}</div></div></div></div></div>;
}
