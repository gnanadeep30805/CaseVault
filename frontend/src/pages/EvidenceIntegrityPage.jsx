import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api.js';

export default function EvidenceIntegrityPage() {
    const { id } = useParams();
    const [detail, setDetail] = useState(null);
    const [verification, setVerification] = useState(null);
    const [custody, setCustody] = useState(null);

    useEffect(() => {
        async function load() {
            try {
                const [detailRes, verifyRes, custodyRes] = await Promise.all([
                    api.get(`/evidence/${id}`),
                    api.post(`/evidence/${id}/verify`),
                    api.post(`/evidence/${id}/verify-custody`),
                ]);
                setDetail(detailRes.data.data);
                setVerification(verifyRes.data.data);
                setCustody(custodyRes.data.data);
            } catch (error) {
                console.error(error);
            }
        }
        load();
    }, [id]);

    return (
        <div>
            <div className="page-header">
                <h1>Evidence Integrity</h1>
            </div>

            {detail && (
                <div className="card" style={{ padding: 24, maxWidth: 900 }}>
                    <div style={{ display: 'grid', gap: 10 }}>
                        <div><strong>Evidence:</strong> {detail.id}</div>
                        <div><strong>Description:</strong> {detail.description}</div>
                        <div><strong>Hash Algorithm:</strong> {detail.hashAlgorithm}</div>
                        <div><strong>Evidence Hash:</strong> {detail.evidenceHash}</div>
                        <div><strong>Current Verification State:</strong> {detail.currentVerificationState}</div>
                    </div>
                </div>
            )}

            {verification && (
                <div className="card" style={{ marginTop: 20, padding: 24, maxWidth: 900 }}>
                    <h3>Verification</h3>
                    <div style={{ display: 'grid', gap: 8 }}>
                        <div><strong>Status:</strong> {verification.status}</div>
                        <div><strong>Registered Hash:</strong> {verification.registeredHash}</div>
                        <div><strong>Current Hash:</strong> {verification.currentHash}</div>
                        <div><strong>Signature Status:</strong> {verification.signatureStatus}</div>
                        <div>{verification.message}</div>
                    </div>
                </div>
            )}

            {custody && (
                <div className="card" style={{ marginTop: 20, padding: 24, maxWidth: 900 }}>
                    <h3>Custody Chain</h3>
                    <div><strong>Status:</strong> {custody.valid ? 'CHAIN VALID' : 'CHAIN COMPROMISED'}</div>
                    {!custody.valid && custody.suspiciousEvent && (
                        <div style={{ marginTop: 8 }}><strong>Suspicious Event:</strong> {custody.suspiciousEvent}</div>
                    )}
                </div>
            )}
        </div>
    );
}
