const evidence = [
    { id: 'EV-001', case: 'CV-2025-001', type: 'Digital', description: 'Recovered phone image set', collectedBy: 'M. Rao', collectionDate: '2025-01-16', currentCustodian: 'Forensics Unit', location: 'Evidence Locker 3', status: 'Verified' },
    { id: 'EV-002', case: 'CV-2025-002', type: 'Physical', description: 'Seized ledger book', collectedBy: 'D. Prasad', collectionDate: '2025-01-21', currentCustodian: 'Ops Desk', location: 'Secure Vault', status: 'Stored' },
];

export default function EvidencePage() {
    return (
        <div>
            <div className="page-header">
                <h1>Evidence</h1>
                <button className="btn btn-primary">Register Evidence</button>
            </div>
            <div className="card" style={{ padding: 16 }}>
                <table>
                    <thead>
                        <tr>
                            <th>Evidence ID</th>
                            <th>Case</th>
                            <th>Evidence Type</th>
                            <th>Description</th>
                            <th>Collected By</th>
                            <th>Collection Date</th>
                            <th>Current Custodian</th>
                            <th>Location</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {evidence.map((item) => (
                            <tr key={item.id}>
                                <td>{item.id}</td>
                                <td>{item.case}</td>
                                <td>{item.type}</td>
                                <td>{item.description}</td>
                                <td>{item.collectedBy}</td>
                                <td>{item.collectionDate}</td>
                                <td>{item.currentCustodian}</td>
                                <td>{item.location}</td>
                                <td>{item.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
