import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

export default function AuditIntegrityPage() {
    const [result, setResult] = useState(null);
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        async function load() {
            try {
                const [logsRes, verifyRes] = await Promise.all([
                    api.get('/audit'),
                    api.post('/audit/verify-chain'),
                ]);
                setLogs(logsRes.data.data);
                setResult(verifyRes.data.data);
            } catch (error) {
                console.error(error);
            }
        }
        load();
    }, []);

    return (
        <div>
            <div className="page-header">
                <h1>Audit Integrity</h1>
            </div>

            <div className="card" style={{ padding: 24, maxWidth: 900 }}>
                <h3>Audit Chain Status</h3>
                <div style={{ fontWeight: 700, marginBottom: 12 }}>{result?.valid ? 'VALID' : 'TAMPER DETECTED'}</div>
                {!result?.valid && result?.suspiciousEvent && (
                    <div style={{ display: 'grid', gap: 8 }}>
                        <div><strong>Event ID:</strong> {result.suspiciousEvent}</div>
                        <div><strong>Expected Hash:</strong> {result.expectedHash}</div>
                        <div><strong>Calculated Hash:</strong> {result.actualHash}</div>
                    </div>
                )}
            </div>

            <div className="card" style={{ marginTop: 20, padding: 20 }}>
                <table>
                    <thead>
                        <tr>
                            <th>Event</th>
                            <th>Actor</th>
                            <th>Timestamp</th>
                            <th>Action</th>
                            <th>Resource</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((item) => (
                            <tr key={item.eventId}>
                                <td>{item.eventId}</td>
                                <td>{item.actor}</td>
                                <td>{item.timestamp}</td>
                                <td>{item.action}</td>
                                <td>{item.resource}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
