import { Link } from 'react-router-dom';
import { ShieldCheck, TriangleAlert } from 'lucide-react';
import Badge from '../ui/Badge.jsx';

export default function SecurityStatusPill({ security, canViewSecurity }) {
    if (!security) {
        return (
            <span className="cv-badge border border-ink-200 bg-ink-100 text-ink-600 dark:border-ink-600 dark:bg-ink-700/50 dark:text-ink-300">
                Security status unavailable
            </span>
        );
    }

    const integrity = security.integrity || {};
    const cryptography = security.cryptography || {};
    const failures = Number(integrity.failedVerification) || 0;
    const brokenChains = (Number(integrity.brokenAuditChains) || 0) + (Number(integrity.brokenCustodyChains) || 0);

    if (failures > 0 || brokenChains > 0) {
        return (
            <Link to={canViewSecurity ? '/security' : '/documents'} className="inline-flex" title={`${failures} failed verification(s), ${brokenChains} broken chain(s)`}>
                <Badge tone="danger" icon={TriangleAlert} label={`Security: ${failures + brokenChains} alert${failures + brokenChains === 1 ? '' : 's'}`} />
            </Link>
        );
    }

    return (
        <Link to={canViewSecurity ? '/security' : '/documents'} className="inline-flex" title={`${integrity.verifiedDocuments || 0} documents verified · ${cryptography.hashAlgorithm || 'SHA-256'} · ${cryptography.signatureAlgorithm || 'Ed25519'}`}>
            <Badge tone="success" icon={ShieldCheck} label="Integrity healthy" />
        </Link>
    );
}
