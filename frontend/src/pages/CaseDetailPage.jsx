export default function CaseDetailPage() {
    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Case CV-2025-001</h1>
                    <div className="muted">Operation North Ridge</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary">Edit</button>
                    <button className="btn btn-secondary">Assign Member</button>
                    <button className="btn btn-secondary">Change Status</button>
                </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
                <h3>Overview</h3>
                <p>Cross-border smuggling investigation involving suspect network and financial trail analysis.</p>
            </div>
        </div>
    );
}
