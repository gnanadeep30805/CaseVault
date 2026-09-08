import { Link } from 'react-router-dom';

const logs = [
    { time: '2025-02-12 09:12', actor: 'admin@casevault.local', action: 'CASE_CREATED', resource: 'Case', resourceId: 'CV-2025-001', status: 'Success' },
    { time: '2025-02-12 10:30', actor: 'A. Rahman', action: 'DOCUMENT_APPROVED', resource: 'Document', resourceId: 'DOC-001', status: 'Success' },
    { time: '2025-02-12 12:04', actor: 'K. Singh', action: 'EVIDENCE_TRANSFERRED', resource: 'Evidence', resourceId: 'EV-001', status: 'Success' },
];

export default function AuditPage() {
    return (
        <div>
            <div className="page-header">
                <h1>Audit Logs</h1>
                <Link to="/audit/integrity" className="btn btn-primary">Verify Audit Chain</Link>
            </div>
            <div className="card" style={{ padding: 16 }}>
                <table>
                    <thead>
                        <tr>
                            <th>Timestamp</th>
                            <th>Actor</th>
                            <th>Action</th>
                            <th>Resource</th>
                            <th>Resource ID</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((item, index) => (
                            <tr key={`${item.time}-${index}`}>
                                <td>{item.time}</td>
                                <td>{item.actor}</td>
                                <td>{item.action}</td>
                                <td>{item.resource}</td>
                                <td>{item.resourceId}</td>
                                <td>{item.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
