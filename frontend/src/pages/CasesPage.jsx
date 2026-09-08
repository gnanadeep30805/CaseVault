const cases = [
    { id: 'case-1001', caseNumber: 'CV-2025-001', title: 'Operation North Ridge', type: 'Criminal', priority: 'High', assignedOfficer: 'Aisha Rahman', status: 'Under Investigation', createdAt: '2025-01-15', updatedAt: '2025-01-18' },
    { id: 'case-1002', caseNumber: 'CV-2025-002', title: 'Forgery Network Review', type: 'Financial Crime', priority: 'Medium', assignedOfficer: 'Arjun Nair', status: 'Evidence Collection', createdAt: '2025-01-20', updatedAt: '2025-01-22' },
];

export default function CasesPage() {
    return (
        <div>
            <div className="page-header">
                <h1>Cases</h1>
                <button className="btn btn-primary">Create Case</button>
            </div>

            <div className="card" style={{ padding: 16 }}>
                <div className="form-grid" style={{ marginBottom: 16 }}>
                    <input className="input" placeholder="Search case, number, title" />
                    <select className="select">
                        <option>All statuses</option>
                        <option>Created</option>
                        <option>Under Investigation</option>
                    </select>
                </div>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Case ID</th>
                                <th>Case Number</th>
                                <th>Title</th>
                                <th>Type</th>
                                <th>Priority</th>
                                <th>Assigned Officer</th>
                                <th>Status</th>
                                <th>Created Date</th>
                                <th>Last Updated</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cases.map((item) => (
                                <tr key={item.id}>
                                    <td>{item.id}</td>
                                    <td>{item.caseNumber}</td>
                                    <td>{item.title}</td>
                                    <td>{item.type}</td>
                                    <td>{item.priority}</td>
                                    <td>{item.assignedOfficer}</td>
                                    <td>{item.status}</td>
                                    <td>{item.createdAt}</td>
                                    <td>{item.updatedAt}</td>
                                    <td>
                                        <button className="btn btn-secondary" style={{ marginRight: 8 }}>View</button>
                                        <button className="btn btn-secondary">Edit</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
