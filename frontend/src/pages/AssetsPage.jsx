import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

const emptyForm = { name: '', category: 'Computers', serial: '', department: '', location: '', condition: 'Good' };

export default function AssetsPage() {
    const [assets, setAssets] = useState([]);
    const [search, setSearch] = useState('');
    const [form, setForm] = useState(emptyForm);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function loadAssets() {
        setLoading(true);
        try { const response = await api.get('/assets', { params: { search } }); setAssets(response.data.data || []); setError(''); } catch (requestError) { setError(requestError?.response?.data?.error?.message || 'Unable to load assets.'); } finally { setLoading(false); }
    }
    useEffect(() => { loadAssets(); }, [search]);
    async function registerAsset(event) {
        event.preventDefault(); setSaving(true);
        try { await api.post('/assets', form); setForm(emptyForm); setOpen(false); await loadAssets(); } catch (requestError) { setError(requestError?.response?.data?.error?.message || 'Unable to register asset.'); } finally { setSaving(false); }
    }
    async function assignAsset(asset) {
        const assignedOfficer = window.prompt('Officer name', asset.assignedOfficer || '');
        if (!assignedOfficer) return;
        try { await api.patch(`/assets/${asset.id}/assign`, { assignedOfficer, location: asset.location }); await loadAssets(); } catch (requestError) { setError(requestError?.response?.data?.error?.message || 'Unable to assign asset.'); }
    }
    async function returnAsset(asset) {
        try { await api.patch(`/assets/${asset.id}/return`, {}); await loadAssets(); } catch (requestError) { setError(requestError?.response?.data?.error?.message || 'Unable to return asset.'); }
    }

    return <div><div className="page-header"><h1>Assets</h1><button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>Register Asset</button></div><div className="card" style={{ padding: 16 }}><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search asset, serial, department" style={{ marginBottom: 16 }} />{error && <p className="error">{error}</p>}{loading ? <p className="muted">Loading assets...</p> : assets.length === 0 ? <p className="muted">No assets found.</p> : <div className="table-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>Category</th><th>Serial</th><th>Department</th><th>Officer</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead><tbody>{assets.map((item) => <tr key={item.id}><td>{item.id}</td><td>{item.name}</td><td>{item.category}</td><td>{item.serial}</td><td>{item.department}</td><td>{item.assignedOfficer || 'Unassigned'}</td><td>{item.location}</td><td>{item.status}</td><td>{item.status === 'Assigned' ? <button className="btn btn-secondary" type="button" onClick={() => returnAsset(item)}>Return</button> : <button className="btn btn-secondary" type="button" onClick={() => assignAsset(item)}>Assign</button>}</td></tr>)}</tbody></table></div>}</div>{open && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true"><h2>Register Asset</h2><form onSubmit={registerAsset}><div className="form-grid"><label className="field">Name<input className="input" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="field">Serial number<input className="input" required value={form.serial} onChange={(event) => setForm({ ...form, serial: event.target.value })} /></label><label className="field">Category<input className="input" required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label><label className="field">Department<input className="input" required value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label><label className="field">Location<input className="input" required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label><label className="field">Condition<select className="select" value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })}><option>Good</option><option>Operational</option><option>Needs service</option></select></label></div><div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button className="btn btn-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Register Asset'}</button></div></form></div></div>}</div>;
}
