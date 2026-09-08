import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api.js';

export default function DocumentIntegrityPage() {
    const { id } = useParams();
    const [detail, setDetail] = useState(null);
    const [result, setResult] = useState(null);

    useEffect(() => {
        async function load() {
            try {
                const response = await api.get(`/documents/${id}`);
                setDetail(response.data.data);
            } catch (error) {
                console.error(error);
            }
        }
        load();
    }, [id]);

    const handleVerify = async () => {
        try {
            const response = await api.post(`/documents/${id}/verify`);
            setResult(response.data.data);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div>
            <div className="page-header">
                <h1>Document Integrity</h1>
            </div>

            {detail && (
                <div className="card" style={{ padding: 24, maxWidth: 820 }}>
                    <div style={{ display: 'grid', gap: 10 }}>
                        <div><strong>Document:</strong> {detail.fileName}</div>
                        <div><strong>Case:</strong> {detail.caseNumber}</div>
                        <div><strong>Integrity Status:</strong> {detail.integrityStatus}</div>
                        <div><strong>Algorithm:</strong> {detail.algorithm}</div>
                        <div><strong>Registered Hash:</strong> {detail.registeredHash}</div>
                        <div><strong>Current Hash:</strong> {detail.registeredHash}</div>
                        <div><strong>Last Verified:</strong> {detail.lastVerified || 'Not verified yet'}</div>
                    </div>
                    <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={handleVerify}>Verify Integrity</button>
                </div>
            )}

            {result && (
                <div className="card" style={{ marginTop: 20, padding: 24, maxWidth: 820 }}>
                    <div style={{ fontWeight: 700, marginBottom: 10 }}>{result.integrityStatus}</div>
                    <div>{result.message}</div>
                    <div style={{ marginTop: 12 }}><strong>Registered Hash:</strong> {result.registeredHash}</div>
                    <div><strong>Current Hash:</strong> {result.currentHash}</div>
                    <div><strong>Last Verified:</strong> {result.lastVerified}</div>
                </div>
            )}
        </div>
    );
}
