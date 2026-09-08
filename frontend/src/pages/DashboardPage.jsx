const stats = [
    { label: 'Active Cases', value: 148 },
    { label: 'Pending Reviews', value: 26 },
    { label: 'Evidence Items', value: 386 },
    { label: 'Documents', value: 1024 },
    { label: 'Assigned Assets', value: 89 },
    { label: 'Security Alerts', value: 7 },
];

const activity = [
    { time: '09:15', user: 'A. Rahman', action: 'Case updated', resource: 'CV-2025-001', status: 'Success' },
    { time: '10:40', user: 'J. Patel', action: 'Document approved', resource: 'FIR-14', status: 'Success' },
    { time: '11:05', user: 'K. Singh', action: 'Evidence transferred', resource: 'EV-003', status: 'In Review' },
    { time: '12:20', user: 'L. Chen', action: 'Asset assigned', resource: 'AS-101', status: 'Success' },
];

export default function DashboardPage() {
    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Dashboard</h1>
                </div>
            </div>

            <div className="grid grid-4" style={{ marginBottom: 20 }}>
                {stats.map((stat) => (
                    <div className="card stat-card" key={stat.label}>
                        <div className="stat-label">{stat.label}</div>
                        <div className="stat-value">{stat.value}</div>
                    </div>
                ))}
            </div>

            <div className="grid" style={{ gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
                <div className="card" style={{ padding: 20 }}>
                    <h3>Recent activity</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>User</th>
                                <th>Action</th>
                                <th>Resource</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activity.map((item) => (
                                <tr key={`${item.time}-${item.resource}`}>
                                    <td>{item.time}</td>
                                    <td>{item.user}</td>
                                    <td>{item.action}</td>
                                    <td>{item.resource}</td>
                                    <td><span className="badge status">{item.status}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="card" style={{ padding: 20 }}>
                    <h3>Security</h3>
                    <div style={{ display: 'grid', gap: 12 }}>
                        <div><strong>Failed login attempts</strong><div className="muted">3 in last 24 hours</div></div>
                        <div><strong>Recent access events</strong><div className="muted">12 verified sessions</div></div>
                        <div><strong>Pending MFA events</strong><div className="muted">2 requiring review</div></div>
                        <div><strong>Integrity status</strong><div className="muted">Nominal, no drift detected</div></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
