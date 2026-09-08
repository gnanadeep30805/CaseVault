import { Link } from 'react-router-dom';

const documents = [
    { id: 'DOC-001', fileName: 'FIR_0412.pdf', case: 'CV-2025-001', category: 'FIR', classification: 'Confidential', version: '1.0', uploadedBy: 'A. Rahman', uploadedAt: '2025-02-10', status: 'Approved' },
    { id: 'DOC-002', fileName: 'Statement_011.xml', case: 'CV-2025-002', category: 'Statement', classification: 'Restricted', version: '2.0', uploadedBy: 'K. Singh', uploadedAt: '2025-02-11', status: 'Pending' },
];

export default function DocumentsPage() {
    return (
        <div>
            <div className="page-header">
                <h1>Documents</h1>
                <button className="btn btn-primary">Upload Document</button>
            </div>
            <div className="card" style={{ padding: 16 }}>
                <table>
                    <thead>
                        <tr>
                            <th>Document ID</th>
                            <th>File name</th>
                            <th>Case</th>
                            <th>Category</th>
                            <th>Classification</th>
                            <th>Version</th>
                            <th>Uploaded By</th>
                            <th>Uploaded Date</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {documents.map((item) => (
                            <tr key={item.id}>
                                <td>{item.id}</td>
                                <td>{item.fileName}</td>
                                <td>{item.case}</td>
                                <td>{item.category}</td>
                                <td>{item.classification}</td>
                                <td>{item.version}</td>
                                <td>{item.uploadedBy}</td>
                                <td>{item.uploadedAt}</td>
                                <td>{item.status}</td>
                                <td>
                                    <Link to={`/documents/${item.id}/integrity`} className="btn btn-secondary">Integrity</Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
