import { useState } from 'react';
import {
    Activity,
    Bell,
    Fingerprint,
    KeyRound,
    Link2,
    Lock,
    ShieldAlert,
    ShieldCheck,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import DataTable from '../components/ui/DataTable.jsx';
import { Card, CardBody, CardHeader, KeyValue, SectionTitle } from '../components/ui/Card.jsx';
import { ErrorState } from '../components/ui/States.jsx';
import { SkeletonTable, SkeletonText } from '../components/ui/Skeleton.jsx';
import StatCard from '../components/ui/StatCard.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle, useResource } from '../hooks/useResource.js';
import { api, apiErrorMessage, unwrap } from '../lib/apiClient.js';
import { formatDateTime, shortHash } from '../lib/format.js';

export default function SecurityPage() {
    const toast = useToast();
    useDocumentTitle('Security');
    const [busy, setBusy] = useState('');

    const overview = useResource(() => api.get('/security/overview').then(unwrap), []);
    const alerts = useResource(() => api.get('/security/alerts').then(unwrap), []);
    const events = useResource(() => api.get('/security/events', { params: { limit: 100 } }).then(unwrap), []);

    const data = overview.data;

    const verifyAuditChain = async () => {
        setBusy('audit');
        try {
            const result = await api.post('/security/audit/verify-chain', {}).then(unwrap);
            if (result.valid) toast.success('Audit hash chain verified.');
            else toast.error(`Audit chain broken: ${result.reason || 'unknown reason'}`);
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Verification failed.'));
        } finally {
            setBusy('');
        }
    };

    const createChainProbe = async () => {
        setBusy('probe');
        try {
            const result = await api.post('/security/integrity/hash-chain', {}).then(unwrap);
            toast.success(`Hash chain probe appended: ${shortHash(result.currentHash, 16)}`);
            events.reload();
        } catch (error) {
            toast.error(apiErrorMessage(error, 'The integrity probe could not be appended.'));
        } finally {
            setBusy('');
        }
    };

    const eventColumns = [
        { key: 'timestamp', header: 'Timestamp', primary: true, render: (row) => <span className="whitespace-nowrap text-xs">{formatDateTime(row.timestamp)}</span> },
        { key: 'action', header: 'Action', render: (row) => <Badge value={row.action} label={row.action} tone={row.severity === 'warning' ? 'warning' : 'info'} /> },
        { key: 'actor', header: 'Actor', render: (row) => <span className="text-xs">{row.actor}</span> },
        { key: 'resource', header: 'Resource', render: (row) => <span className="text-xs">{row.resource}</span> },
        { key: 'resourceId', header: 'Resource ID', render: (row) => <span className="font-mono text-[0.65rem] text-ink-500 dark:text-ink-400">{row.resourceId || '—'}</span> },
        { key: 'currentHash', header: 'Hash', render: (row) => <span className="font-mono text-[0.65rem] text-ink-500 dark:text-ink-400">{row.currentHash?.slice(0, 12) || '—'}…</span> },
    ];

    return (
        <div className="space-y-5">
            <PageHeader
                title="Security"
                description="Cryptographic and access-control health for the deployment: hash chains, document integrity, session activity and authorization denials."
                actions={(
                    <>
                        <Button variant="secondary" icon={Link2} loading={busy === 'audit'} onClick={verifyAuditChain}>Verify audit chain</Button>
                        <Button variant="ghost" icon={Activity} loading={busy === 'probe'} onClick={createChainProbe}>Append integrity probe</Button>
                    </>
                )}
            />

            {overview.loading && !data ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => <div key={index} className="cv-panel h-24" />)}
                </div>
            ) : overview.error ? (
                <Card><CardBody><ErrorState message={apiErrorMessage(overview.error)} onRetry={overview.reload} /></CardBody></Card>
            ) : data ? (
                <>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <StatCard label="Failed logins" value={data.authentication.failedLogins} hint="Recorded authentication failures" icon={KeyRound} tone={data.authentication.failedLogins ? 'warning' : 'success'} />
                        <StatCard label="Active sessions" value={data.authentication.activeSessions} hint="Live refresh-token sessions" icon={Lock} tone="blue" />
                        <StatCard label="Denied requests" value={data.authorization.deniedRequests} hint="Authorization refusals" icon={ShieldAlert} tone={data.authorization.deniedRequests ? 'warning' : 'success'} />
                        <StatCard label="Documents verified" value={data.integrity.verifiedDocuments} hint={`${data.integrity.failedVerification} failed verification(s)`} icon={Fingerprint} tone={data.integrity.failedVerification ? 'danger' : 'success'} />
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <Card>
                            <CardHeader title="Cryptography" icon={ShieldCheck} description="Algorithms in use across storage, hashing and signing." />
                            <CardBody>
                                <KeyValue
                                    columns={2}
                                    items={[
                                        { label: 'Encryption', value: <Badge value={data.cryptography.encryptionStatus} /> },
                                        { label: 'Hashing', value: data.cryptography.hashAlgorithm },
                                        { label: 'Signatures', value: data.cryptography.signatureAlgorithm },
                                        { label: 'Signature status', value: <Badge value={data.cryptography.signatureStatus} /> },
                                        { label: 'Key management', value: <Badge value={data.cryptography.keyManagementHealth} /> },
                                        { label: 'MFA failures', value: data.authentication.mfaFailures },
                                        { label: 'Locked accounts', value: data.authentication.lockedAccounts },
                                        { label: 'Privilege violations', value: data.authorization.privilegeViolations },
                                    ]}
                                />
                            </CardBody>
                        </Card>

                        <Card>
                            <CardHeader title="Chain integrity" icon={Link2} description="A broken chain means the stored history was altered." />
                            <CardBody className="space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <SectionTitle>Audit chain</SectionTitle>
                                    <Badge value={data.integrity.brokenAuditChains ? 'Broken' : 'Verified'} />
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <SectionTitle>Custody chains</SectionTitle>
                                    <Badge value={data.integrity.brokenCustodyChains ? 'Broken' : 'Verified'} />
                                </div>
                                <p className="text-xs text-ink-500 dark:text-ink-400">
                                    Chains are recomputed on demand. Use “Verify audit chain” above, or open the individual evidence record to verify its custody chain.
                                </p>
                            </CardBody>
                        </Card>
                    </div>
                </>
            ) : null}

            <Card>
                <CardHeader title="Security alerts" icon={Bell} description="Derived from live hash-chain, document integrity and authentication checks." />
                <CardBody className="space-y-2">
                    {alerts.loading && !alerts.data ? <SkeletonText lines={3} /> : (alerts.data || []).map((alert) => (
                        <div
                            key={alert.id}
                            className={`rounded-lg border px-3 py-2 ${alert.severity === 'critical' ? 'border-danger/30 bg-danger/10' : alert.severity === 'warning' ? 'border-warning/30 bg-warning/10' : 'border-success/30 bg-success/10'}`}
                        >
                            <p className="text-sm font-bold text-ink-900 dark:text-ink-50">{alert.title}</p>
                            <p className="mt-0.5 text-xs text-ink-600 dark:text-ink-300">{alert.message}</p>
                        </div>
                    ))}
                </CardBody>
            </Card>

            <Card>
                <CardHeader title="Recent security events" icon={Activity} description="The 100 most recent audited actions, newest first." />
                <CardBody className="px-2 sm:px-3">
                    {events.loading && !events.data ? <SkeletonTable rows={8} columns={5} />
                        : events.error ? <ErrorState message={apiErrorMessage(events.error)} onRetry={events.reload} />
                            : (
                                <DataTable
                                    columns={eventColumns}
                                    rows={events.data || []}
                                    dense
                                    mobileTitle="Security event"
                                    emptyTitle="No security events recorded"
                                />
                            )}
                </CardBody>
            </Card>
        </div>
    );
}
