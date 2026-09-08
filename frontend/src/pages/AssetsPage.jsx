const assets = [
    { id: 'AS-101', name: 'Patrol Vehicle 17', category: 'Vehicles', serial: 'VHC-7012', department: 'Traffic', assignedOfficer: 'S. Kumar', location: 'HQ Garage', condition: 'Operational', status: 'Active / In Use' },
    { id: 'AS-201', name: 'Forensic Laptop-02', category: 'Computers', serial: 'LAP-22191', department: 'Forensics', assignedOfficer: 'M. Nair', location: 'Lab 1', condition: 'Good', status: 'Assigned' },
];

export default function AssetsPage() {
    return (
        <div>
            <div className="page-header">
                <h1>Assets</h1>
                <button className="btn btn-primary">Register Asset</button>
            </div>
            <div className="card" style={{ padding: 16 }}>
                <table>
                    <thead>
                        <tr>
                            <th>Asset ID</th>
                            <th>Asset Name</th>
                            <th>Category</th>
                            <th>Serial Number</th>
                            <th>Department</th>
                            <th>Assigned Officer</th>
                            <th>Location</th>
                            <th>Condition</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {assets.map((item) => (
                            <tr key={item.id}>
                                <td>{item.id}</td>
                                <td>{item.name}</td>
                                <td>{item.category}</td>
                                <td>{item.serial}</td>
                                <td>{item.department}</td>
                                <td>{item.assignedOfficer}</td>
                                <td>{item.location}</td>
                                <td>{item.condition}</td>
                                <td>{item.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
