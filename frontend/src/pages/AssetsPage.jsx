import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

const emptyForm = { name: '', category: 'Computers', serial: '', department: '', location: '', condition: 'Good' };
const transitionOptions = ['Available', 'Assigned', 'Maintenance', 'Retired', 'Disposed'];

export default function AssetsPage() {
    const [assets, setAssets] = useState([]);
    const [search, setSearch] = useState('');
    const [form, setForm] = useState(emptyForm);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState(null);
    const [history, setHistory] = useState([]);
    const [maintenance, setMaintenance] = useState([]);

    async function loadAssets() {
        setLoading(true);
        try {
            const response = await api.get('/assets', { params: { search } });
            setAssets(response.data.data || []);
            setError('');
        } catch (requestError) {
            setError(requestError?.response?.data?.error?.message || 'Unable to load assets.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { loadAssets(); }, [search]);

    async function registerAsset(event) {
        event.preventDefault();
        setSaving(true);
        try {
            await api.post('/assets', form);
            setForm(emptyForm);
            setOpen(false);
            await loadAssets();
        } catch (requestError) {
            setError(requestError?.response?.data?.error?.message || 'Unable to register asset.');
        } finally {
            setSaving(false);
        }
    }

    async function inspectAsset(asset) {
        setSelected(asset);
        try {
            const [historyResponse, maintenanceResponse] = await Promise.all([
                api.get(`/assets/${asset.id}/history`),
                api.get(`/assets/${asset.id}/maintenance`),
            ]);
            setHistory(historyResponse.data.data || []);
            setMaintenance(maintenanceResponse.data.data || []);
        } catch (requestError) {
            setError(requestError?.response?.data?.error?.message || 'Unable to load asset history.');
        }
    }

    async function changeStatus(status) {
        const reason = window.prompt('Reason for status change');
        if (!reason) return;
        try {
            await api.patch(`/assets/${selected.id}/status`, { status, reason });
            await loadAssets();
            await inspectAsset({ ...selected, status });
        } catch (requestError) {
            setError(requestError?.response?.data?.error?.message || 'Unable to change asset status.');
        }
    }

    async function scheduleMaintenance() {
        const vendor = window.prompt('Maintenance vendor');
        const scheduledDate = window.prompt('Scheduled date (YYYY-MM-DD)');
        if (!vendor || !scheduledDate) return;
        try {
            await api.post(`/assets/${selected.id}/maintenance`, { vendor, scheduledDate });
            await loadAssets();
            await inspectAsset({ ...selected, status: 'Maintenance' });
        } catch (requestError) {
            setError(requestError?.response?.data?.error?.message || 'Unable to schedule maintenance.');
        }
    }

    async function completeMaintenance() {
        try {
            await api.patch(`/assets/${selected.id}/maintenance/complete`, {});
            await loadAssets();
            await inspectAsset({ ...selected, status: 'Available' });
        } catch (requestError) {
            setError(requestError?.response?.data?.error?.message || 'Unable to complete maintenance.');
        }
    }

    return (
        <div>
            <div className="page-header">
                <h1>Assets</h1>
                <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>Register Asset</button>
            </div>
            <div className="card" style={{ padding: 16 }}>
                <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search asset, serial, department" style={{ marginBottom: 16 }} />
                {error && <p className="error">{error}</p>}
                {loading ? <p className="muted">Loading assets...</p> : assets.length === 0 ? <p className="muted">No assets found.</p> : (
                    <div className="table-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>Category</th><th>Serial</th><th>Department</th><th>Officer</th><th>Location</th><th>Condition</th><th>Status</th><th>Actions</th></tr></thead><tbody>
                        {assets.map((item) => <tr key={item.id}><td>{item.id}</td><td>{item.name}</td><td>{item.category}</td><td>{item.serial}</td><td>{item.department}</td><td>{item.assignedOfficer || 'Unassigned'}</td><td>{item.location}</td><td>{item.condition}</td><td>{item.status}</td><td><button className="btn btn-secondary" type="button" onClick={() => inspectAsset(item)}>Manage</button></td></tr>)}
                    </tbody></table></div>
                )}
            </div>
            {selected && <div className="card" style={{ marginTop: 20, padding: 20 }}><div className="page-header"><h2>{selected.name}</h2><button className="btn btn-secondary" type="button" onClick={() => setSelected(null)}>Close</button></div><p className="muted">{selected.id} · {selected.status} · {selected.serial}</p><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{transitionOptions.map((status) => <button key={status} className="btn btn-secondary" type="button" onClick={() => changeStatus(status)}>{status}</button>)}<button className="btn btn-secondary" type="button" onClick={scheduleMaintenance}>Schedule Maintenance</button>{selected.status === 'Maintenance' && <button className="btn btn-primary" type="button" onClick={completeMaintenance}>Complete Maintenance</button>}</div><h3>History</h3>{history.length === 0 ? <p className="muted">No history recorded.</p> : <ul>{history.map((event) => <li key={event.eventId}>{event.action} · {event.fromStatus} to {event.toStatus} · {event.timestamp}</li>)}</ul>}<h3>Maintenance</h3>{maintenance.length === 0 ? <p className="muted">No maintenance records.</p> : <ul>{maintenance.map((item) => <li key={item.id}>{item.vendor} · {item.status} · {item.scheduledDate}</li>)}</ul>}</div>}
            {open && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true"><h2>Register Asset</h2><form onSubmit={registerAsset}><div className="form-grid"><label className="field">Name<input className="input" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="field">Serial number<input className="input" required value={form.serial} onChange={(event) => setForm({ ...form, serial: event.target.value })} /></label><label className="field">Category<input className="input" required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label><label className="field">Department<input className="input" required value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label><label className="field">Location<input className="input" required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label><label className="field">Condition<input className="input" value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })} /></label></div><div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button className="btn btn-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Register'}</button></div></form></div></div>}
        </div>
    );
}
