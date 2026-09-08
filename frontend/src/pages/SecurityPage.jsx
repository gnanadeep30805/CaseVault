import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

export default function SecurityPage() {
    const [overview, setOverview] = useState(null);
    const [events, setEvents] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const [overviewRes, eventsRes, alertsRes] = await Promise.all([
                    api.get('/security/overview'),
                    api.get('/security/events'),
                    api.get('/security/alerts'),
                ]);
                setOverview(overviewRes.data.data);
                setEvents(eventsRes.data.data);
                setAlerts(alertsRes.data.data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const sections = overview ? [
        { title: 'Authentication Security', items: [
            ['Login failures', overview.authentication.failedLogins],
            ['MFA failures', overview.authentication.mfaFailures],
            ['Locked accounts', overview.authentication.lockedAccounts],
            ['Active sessions', overview.authentication.activeSessions],
        ] },
        { title: 'Authorization', items: [
            ['Denied requests', overview.authorization.deniedRequests],
            ['Privilege violations', overview.authorization.privilegeViolations],
            ['Suspicious access', overview.authorization.suspiciousAccess],
        ] },
        { title: 'Integrity', items: [
            ['Verified documents', overview.integrity.verifiedDocuments],
            ['Failed verification', overview.integrity.failedVerification],
            ['Broken audit chains', overview.integrity.brokenAuditChains],
            ['Broken custody chains', overview.integrity.brokenCustodyChains],
        ] },
        { title: 'Cryptography', items: [
            ['Encryption status', overview.cryptography.encryptionStatus],
            ['Signature status', overview.cryptography.signatureStatus],
            ['Key management', overview.cryptography.keyManagementHealth],
        ] },
    ] : [];

    return (
        <div>
            <div className="page-header">
                <h1>Security Center</h1>
            </div>

            {loading ? (
                <div className="card" style={{ padding: 20 }}><div className="muted">Loading security overview...</div></div>
            ) : (
                <>
                    <div className="grid grid-4" style={{ marginBottom: 20 }}>
                        {sections.map((section) => (
                            <div className="card stat-card" key={section.title}>
                                <div className="stat-label">{section.title}</div>
                                <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                                    {section.items.map(([label, value]) => (
                                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                            <span className="muted">{label}</span>
                                            <strong>{value}</strong>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid" style={{ gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
                        <div className="card" style={{ padding: 20 }}>
                            <h3>Security timeline</h3>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Time</th>
                                        <th>User</th>
                                        <th>Action</th>
                                        <th>Resource</th>
                                        <th>Severity</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {events.map((event, index) => (
                                        <tr key={`${event.time}-${index}`}>
                                            <td>{event.time}</td>
                                            <td>{event.user}</td>
                                            <td>{event.action}</td>
                                            <td>{event.resource}</td>
                                            <td><span className="badge status">{event.severity}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="card" style={{ padding: 20 }}>
                            <h3>Active alerts</h3>
                            <div style={{ display: 'grid', gap: 12 }}>
                                {alerts.map((alert) => (
                                    <div key={alert.id} style={{ padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #dbe2ea' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                            <strong>{alert.title}</strong>
                                            <span className="badge status">{alert.severity}</span>
                                        </div>
                                        <div className="muted" style={{ marginTop: 6 }}>{alert.message}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
