import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    ArrowRightLeft,
    Fingerprint,
    Link2,
    ShieldCheck,
    Trash2,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import Modal from '../components/ui/Modal.jsx';
import Tabs, { TabPanel } from '../components/ui/Tabs.jsx';
import { Input, Select, Textarea } from '../components/ui/Form.jsx';
import { Card, CardBody, CardHeader, KeyValue, SectionTitle } from '../components/ui/Card.jsx';
import { ErrorState, InlineError, PermissionNotice } from '../components/ui/States.jsx';
import { Skeleton, SkeletonText } from '../components/ui/Skeleton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle, useResource } from '../hooks/useResource.js';
import { api, apiErrorMessage, unwrap } from '../lib/apiClient.js';
import { EVIDENCE_TYPES } from '../lib/capabilities.js';
import { formatDate, formatDateTime, shortHash } from '../lib/format.js';

const TABS = [
    { id: 'overview', label: 'Overview', icon: Fingerprint },
    { id: 'custody', label: 'Chain of custody', icon: Link2 },
    { id: 'integrity', label: 'Integrity', icon: ShieldCheck },
];

export default function EvidenceDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { can } = useAuth();
    const toast = useToast();
    const [tab, setTab] = useState('overview');
    const [busy, setBusy] = useState('');
    const [transferOpen, setTransferOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [verification, setVerification] = useState(null);
    const [custodyCheck, setCustodyCheck] = useState(null);

    const evidence = useResource(() => api.get(`/evidence/${encodeURIComponent(id)}`).then(unwrap), [id]);
    const record = evidence.data;
    useDocumentTitle(record ? `Evidence ${record.id}` : 'Evidence');

    const run = async (key, action, message) => {
        setBusy(key);
        try {
            const result = await action();
            if (message) toast.success(message);
            evidence.reload();
            return result;
        } catch (error) {
            toast.error(apiErrorMessage(error));
            throw error;
        } finally {
            setBusy('');
        }
    };

    const verifyIntegrity = async () => {
        setBusy('integrity');
        setVerification(null);
        try {
            const result = await api.post(`/evidence/${encodeURIComponent(id)}/verify`).then(unwrap);
            setVerification(result);
            setTab('integrity');
            if (result.status === 'VERIFIED') toast.success('Evidence integrity verified.');
            else toast.error('Integrity mismatch detected: the evidence no longer matches its registered hash.');
            evidence.reload();
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Verification failed.'));
        } finally {
            setBusy('');
        }
    };

    const verifyCustody = async () => {
        setBusy('custody');
        setCustodyCheck(null);
        try {
            const result = await api.get(`/evidence/${encodeURIComponent(id)}/verify-custody`).then(unwrap);
            setCustodyCheck(result);
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Custody verification failed.'));
        } finally {
            setBusy('');
        }
    };

    if (evidence.loading && !record) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-64" />
                <div className="grid gap-4 lg:grid-cols-3">
                    <Skeleton className="h-56 lg:col-span-2" />
                    <Skeleton className="h-56" />
                </div>
            </div>
        );
    }

    if (evidence.error) {
        return <ErrorState title="Evidence unavailable" message={apiErrorMessage(evidence.error, 'You may not have access to this record.')} onRetry={evidence.reload} />;
    }

    if (!record) return null;

    const custodyEvents = record.custodyEvents || [];
    const canWrite = can('evidence:write');
    const canDelete = can('evidence:delete');

    return (
        <div className="space-y-5">
            <PageHeader
                breadcrumb={(
                    <span className="inline-flex items-center gap-1.5">
                        <Link to="/evidence" className="cv-link">Evidence</Link>
                        <span aria-hidden="true">/</span>
                        <span>{record.id}</span>
                    </span>
                )}
                title={<span className="font-mono">{record.id}</span>}
                description={(
                    <span className="flex flex-wrap items-center gap-2">
                        <Badge value={record.status} />
                        <Badge value={record.currentVerificationState} />
                        <span className="text-xs">{record.type} · collected {formatDate(record.collectionDate)}</span>
                    </span>
                )}
                actions={(
                    <>
                        <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(-1)}>Back</Button>
                        {canWrite ? <Button variant="secondary" icon={ArrowRightLeft} onClick={() => setTransferOpen(true)}>Transfer custody</Button> : null}
                        <Button variant="blue" icon={ShieldCheck} loading={busy === 'integrity'} onClick={verifyIntegrity}>Verify integrity</Button>
                    </>
                )}
            />

            <Tabs tabs={TABS} active={tab} onChange={setTab} ariaLabel="Evidence sections" />

            <TabPanel id="overview" active={tab}>
                <div className="grid gap-4 lg:grid-cols-3">
                    <div className="space-y-4 lg:col-span-2">
                        <Card>
                            <CardHeader
                                title="Evidence record"
                                icon={Fingerprint}
                                description="Registration details captured at intake."
                                actions={canWrite ? <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>Edit</Button> : null}
                            />
                            <CardBody>
                                <KeyValue
                                    columns={2}
                                    items={[
                                        { label: 'Case', value: record.caseId ? <Link to={`/cases/${record.caseId}`} className="cv-link">{record.caseNumber || record.caseId}</Link> : 'Unlinked' },
                                        { label: 'Type', value: record.type },
                                        { label: 'Description', value: record.description },
                                        { label: 'Collected by', value: record.collectedBy },
                                        { label: 'Collection date', value: formatDate(record.collectionDate) },
                                        { label: 'Current custodian', value: record.currentCustodian || 'Unassigned' },
                                        { label: 'Location', value: record.location },
                                        { label: 'Registered at', value: formatDateTime(record.registeredAt || record.createdAt) },
                                        { label: 'Updated', value: formatDateTime(record.updatedAt) },
                                    ]}
                                />
                            </CardBody>
                        </Card>

                        <Card>
                            <CardHeader
                                title="Danger zone"
                                description="Deleting evidence is restricted to roles with the evidence:delete permission and is permanently audited."
                            />
                            <CardBody>
                                {canDelete ? (
                                    <Button
                                        variant="danger"
                                        icon={Trash2}
                                        loading={busy === 'delete'}
                                        onClick={() => run('delete', () => api.delete(`/evidence/${encodeURIComponent(id)}`).then(unwrap), 'Evidence record deleted.')}
                                    >
                                        Delete evidence record
                                    </Button>
                                ) : (
                                    <PermissionNotice message="Your role cannot delete evidence records. Custody events remain hash-chained after every transfer." />
                                )}
                            </CardBody>
                        </Card>
                    </div>

                    <div className="space-y-4">
                        <Card>
                            <CardHeader title="Integrity" icon={ShieldCheck} />
                            <CardBody className="space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <SectionTitle>Verification</SectionTitle>
                                    <Badge value={record.currentVerificationState} />
                                </div>
                                <div>
                                    <p className="text-[0.62rem] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">Registered hash ({record.hashAlgorithm || 'SHA-256'})</p>
                                    <p className="mt-0.5 break-all font-mono text-[0.65rem] text-ink-700 dark:text-ink-200">{record.evidenceHash}</p>
                                </div>
                                <div>
                                    <p className="text-[0.62rem] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">Signature</p>
                                    <p className="mt-0.5 text-sm font-medium text-ink-800 dark:text-ink-100">{record.signatureAlgorithm || 'Ed25519'} · {record.signatureStatus || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[0.62rem] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">Last verified</p>
                                    <p className="mt-0.5 text-sm font-medium text-ink-800 dark:text-ink-100">{record.lastVerified ? formatDateTime(record.lastVerified) : 'Never'}</p>
                                </div>
                            </CardBody>
                        </Card>

                        <Card>
                            <CardHeader title="Custody chain status" />
                            <CardBody className="space-y-2">
                                {record.custodyChain?.valid ? (
                                    <p className="text-sm font-semibold text-success">Chain verified across {custodyEvents.length} event(s).</p>
                                ) : (
                                    <p className="text-sm font-semibold text-warning">{record.custodyChain?.reason || 'No custody events recorded yet.'}</p>
                                )}
                                <Button variant="secondary" size="sm" icon={ShieldCheck} loading={busy === 'custody'} onClick={verifyCustody}>Re-verify chain</Button>
                            </CardBody>
                        </Card>
                    </div>
                </div>
            </TabPanel>

            <TabPanel id="custody" active={tab}>
                <Card>
                    <CardHeader
                        title="Chain of custody"
                        icon={Link2}
                        description="Each event stores the hash of the previous event, so removal or reordering breaks verification."
                        actions={canWrite ? <Button variant="secondary" size="sm" icon={ArrowRightLeft} onClick={() => setTransferOpen(true)}>Record transfer</Button> : null}
                    />
                    <CardBody>
                        {custodyEvents.length === 0 ? (
                            <p className="py-6 text-center text-sm text-ink-500 dark:text-ink-400">No custody transfers have been recorded for this exhibit.</p>
                        ) : (
                            <ol className="space-y-3">
                                {custodyEvents.map((event, index) => (
                                    <li key={event.eventId} className="relative rounded-lg border cv-divider px-4 py-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-sm font-bold text-ink-900 dark:text-ink-50">
                                                {index === 0 ? 'Registration' : 'Transfer'} · {event.from || '—'} → {event.to}
                                            </p>
                                            <p className="text-xs text-ink-500 dark:text-ink-400">{formatDateTime(event.timestamp)}</p>
                                        </div>
                                        <p className="mt-1 text-xs text-ink-600 dark:text-ink-300">{event.reason}</p>
                                        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Location: {event.location}</p>
                                        <p className="mt-1 break-all font-mono text-[0.62rem] text-ink-400 dark:text-ink-500">
                                            prev {shortHash(event.previousHash, 12)} · hash {shortHash(event.currentHash, 12)}
                                        </p>
                                    </li>
                                ))}
                            </ol>
                        )}
                        {custodyCheck ? (
                            <div className="mt-4 rounded-lg border cv-divider px-3 py-2">
                                <p className={custodyCheck.valid ? 'text-sm font-semibold text-success' : 'text-sm font-semibold text-danger'}>
                                    {custodyCheck.valid ? 'Custody chain verified.' : `Custody chain invalid: ${custodyCheck.reason || 'unknown reason'}`}
                                </p>
                            </div>
                        ) : null}
                    </CardBody>
                </Card>
            </TabPanel>

            <TabPanel id="integrity" active={tab}>
                <Card>
                    <CardHeader title="Integrity verification" icon={ShieldCheck} description="The API recomputes the evidence record hash and compares it with the value signed at registration." />
                    <CardBody className="space-y-3">
                        {verification ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <Badge value={verification.status} />
                                    <span className="text-sm text-ink-600 dark:text-ink-300">{verification.message}</span>
                                </div>
                                <KeyValue
                                    columns={2}
                                    items={[
                                        { label: 'Algorithm', value: verification.algorithm },
                                        { label: 'Verified at', value: formatDateTime(verification.lastVerified) },
                                        { label: 'Registered hash', value: <span className="break-all font-mono text-[0.65rem]">{verification.registeredHash}</span> },
                                        { label: 'Current hash', value: <span className="break-all font-mono text-[0.65rem]">{verification.currentHash}</span> },
                                    ]}
                                />
                            </>
                        ) : (
                            <SkeletonText lines={3} />
                        )}
                        <Button variant="blue" icon={ShieldCheck} loading={busy === 'integrity'} onClick={verifyIntegrity}>Run verification</Button>
                    </CardBody>
                </Card>
            </TabPanel>

            <TransferModal open={transferOpen} onClose={() => setTransferOpen(false)} evidenceId={id} onSaved={() => { setTransferOpen(false); evidence.reload(); }} />
            <EditModal open={editOpen} onClose={() => setEditOpen(false)} evidenceId={id} record={record} onSaved={() => { setEditOpen(false); evidence.reload(); }} />
        </div>
    );
}

function TransferModal({ open, onClose, evidenceId, onSaved }) {
    const toast = useToast();
    const [recipient, setRecipient] = useState('');
    const [location, setLocation] = useState('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        if (!recipient.trim() || !location.trim() || !reason.trim()) {
            setError('Recipient, location and reason are all required.');
            return;
        }
        setSaving(true);
        try {
            await api.post(`/evidence/${encodeURIComponent(evidenceId)}/custody`, { recipient: recipient.trim(), location: location.trim(), reason: reason.trim() });
            toast.success('Custody transfer recorded.');
            setRecipient('');
            setLocation('');
            setReason('');
            onSaved();
        } catch (caught) {
            setError(apiErrorMessage(caught, 'The transfer could not be recorded.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Record a custody transfer"
            description="A new hash-chained event is appended and the record is re-signed."
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" form="evidence-transfer-form" loading={saving}>Record transfer</Button>
                </>
            )}
        >
            <form id="evidence-transfer-form" onSubmit={submit} className="space-y-4" noValidate>
                <Input label="New custodian" required value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Officer name or user ID" />
                <Input label="Location" required value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Evidence room B, shelf 4" />
                <Textarea label="Reason" required value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Why is this exhibit moving?" />
                <InlineError message={error} />
            </form>
        </Modal>
    );
}

function EditModal({ open, onClose, evidenceId, record, onSaved }) {
    const toast = useToast();
    const [type, setType] = useState(record?.type || EVIDENCE_TYPES[0]);
    const [description, setDescription] = useState(record?.description || '');
    const [collectedBy, setCollectedBy] = useState(record?.collectedBy || '');
    const [collectionDate, setCollectionDate] = useState(String(record?.collectionDate || '').slice(0, 10));
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        setSaving(true);
        try {
            await api.patch(`/evidence/${encodeURIComponent(evidenceId)}`, {
                type,
                description: description.trim(),
                collectedBy: collectedBy.trim(),
                collectionDate,
            });
            toast.success('Evidence record updated and re-signed.');
            onSaved();
        } catch (caught) {
            setError(apiErrorMessage(caught, 'The record could not be updated.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Edit evidence record"
            description="Editing re-computes the record hash, invalidates the previous verification and re-signs the record."
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" form="evidence-edit-form" loading={saving}>Save changes</Button>
                </>
            )}
        >
            <form id="evidence-edit-form" onSubmit={submit} className="space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Select label="Type" value={type} onChange={(event) => setType(event.target.value)} options={EVIDENCE_TYPES} />
                    <Input label="Collection date" type="date" required value={collectionDate} onChange={(event) => setCollectionDate(event.target.value)} />
                </div>
                <Input label="Collected by" required value={collectedBy} onChange={(event) => setCollectedBy(event.target.value)} />
                <Textarea label="Description" required value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
                <InlineError message={error} />
            </form>
        </Modal>
    );
}
