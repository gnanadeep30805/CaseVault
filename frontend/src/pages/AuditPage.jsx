import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';

export default function AuditPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    useEffect(() => { api.get('/audit').then((response) => setLogs(response.data.data || [])).catch((requestError) => setError(requestError?.response?.data?.error?.message || 'Unable to load audit logs.')).finally(() => setLoading(false)); }, []);
    return <div><div className="page-header"><h1>Audit Logs</h1><Link to="/audit/integrity" className="btn btn-primary">Verify Audit Chain</Link></div><div className="card" style={{ padding: 16 }}>{error && <p className="error">{error}</p>}{loading ? <p className="muted">Loading audit logs...</p> : logs.length === 0 ? <p className="muted">No audit events recorded.</p> : <div className="table-wrap"><table><thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Resource</th><th>Resource ID</th><th>Hash</th></tr></thead><tbody>{logs.map((item) => <tr key={item.eventId}><td>{item.timestamp}</td><td>{item.actor}</td><td>{item.action}</td><td>{item.resource}</td><td>{item.resourceId}</td><td><code>{item.currentHash?.slice(0, 16)}...</code></td></tr>)}</tbody></table></div>}</div></div>;
}
