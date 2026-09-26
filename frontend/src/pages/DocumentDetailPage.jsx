import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    CheckCircle2,
    Copy,
    Download,
    Eye,
    FileText,
    Fingerprint,
    GitBranch,
    Link2,
    PenLine,
    Plus,
    Share2,
    ShieldCheck,
    Sparkles,
    Trash2,
    XCircle,
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
import { useUsers } from '../hooks/useDirectory.js';
import { api, apiErrorMessage, unwrap } from '../lib/apiClient.js';
import { CLASSIFICATIONS, DOCUMENT_CATEGORIES, DOCUMENT_STATUSES } from '../lib/capabilities.js';
import { downloadCsv, timestampedName } from '../lib/csv.js';
import { formatBytes, formatDateTime, formatRelative, shortHash, titleCase } from '../lib/format.js';
import { downloadSecureDocument, openSecurePreview } from '../lib/secureFiles.js';

const TABS = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'versions', label: 'Versions', icon: GitBranch },
    { id: 'sharing', label: 'Sharing', icon: Share2 },
    { id: 'signatures', label: 'Signatures', icon: PenLine },
    { id: 'audit', label: 'Integrity', icon: Fingerprint },
];

function CopyableHash({ value, label }) {
    const toast = useToast();
    if (!value) return <p className="font-mono text-xs text-ink-500">—</p>;
    return (
        <div className="min-w-0">
            {label ? <p className="text-[0.62rem] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">{label}</p> : null}
            <button
                type="button"
                className="group mt-0.5 flex w-full items-center gap-1.5 text-left"
                onClick={() => {
                    navigator.clipboard?.writeText(value).then(
                        () => toast.success('Hash copied to the clipboard.'),
                        () => toast.error('The clipboard is unavailable in this browser context.'),
                    );
                }}
                title="Copy full hash"
            >
                <span className="truncate font-mono text-xs text-ink-800 dark:text-ink-100">{value}</span>
                <Copy size={12} className="shrink-0 text-ink-400 group-hover:text-brand-500" aria-hidden="true" />
            </button>
        </div>
    );
}

export default function DocumentDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, can } = useAuth();
    const toast = useToast();
    const [tab, setTab] = useState('overview');
    const [busy, setBusy] = useState('');
    const [versionOpen, setVersionOpen] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [signatureOpen, setSignatureOpen] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [analysis, setAnalysis] = useState(null);

    const document = useResource(() => api.get(`/documents/${encodeURIComponent(id)}`).then(unwrap), [id]);
    const versions = useResource(() => api.get(`/documents/${encodeURIComponent(id)}/versions`).then(unwrap), [id]);
    const shares = useResource(() => api.get(`/documents/${encodeURIComponent(id)}/shares`).then(unwrap), [id]);
    const signatures = useResource(() => api.get(`/documents/${encodeURIComponent(id)}/signature-requests`).then(unwrap), [id]);
    const { users } = useUsers(true);

    const record = document.data;
    useDocumentTitle(record ? record.fileName : 'Document');

    const relatedCase = useResource(
        () => (record?.caseId ? api.get(`/cases/${encodeURIComponent(record.caseId)}`).then(unwrap) : Promise.resolve(null)),
        [record?.caseId],
        { enabled: Boolean(record?.caseId) },
    );

    const activeShares = (shares.data || []).filter((share) => !share.revokedAt && !(share.expiresAt && new Date(share.expiresAt) < new Date()));
    const versionList = versions.data || [];
    const currentVersion = versionList.find((item) => item.id === record?.id) || record;

    const run = async (key, action, successMessage) => {
        setBusy(key);
        try {
            const result = await action();
            if (successMessage) toast.success(successMessage);
            document.reload();
            shares.reload();
            signatures.reload();
            versions.reload();
            return result;
        } catch (error) {
            toast.error(apiErrorMessage(error));
            throw error;
        } finally {
            setBusy('');
        }
    };

    const verify = async () => {
        setBusy('verify');
        try {
            const result = await api.post(`/documents/${encodeURIComponent(id)}/verify`).then(unwrap);
            if (result?.integrityStatus === 'COMPROMISED') {
                toast.error(result.message || 'Integrity check failed: the stored document was modified after registration.');
            } else {
                toast.success('Integrity re-verified against the stored ciphertext.');
            }
            await document.reload();
            return result;
        } catch (error) {
            toast.error(apiErrorMessage(error));
            throw error;
        } finally {
            setBusy('');
        }
    };

    const download = async () => {
        setBusy('download');
        try {
            await downloadSecureDocument(id, record?.fileName);
        } catch (error) {
            toast.error(apiErrorMessage(error, 'The document could not be downloaded.'));
        } finally {
            setBusy('');
        }
    };

    const preview = async () => {
        setBusy('preview');
        try {
            await openSecurePreview(id, record?.fileName);
        } catch (error) {
            toast.error(apiErrorMessage(error, 'The document could not be previewed.'));
        } finally {
            setBusy('');
        }
    };

    const analyze = async () => {
        setBusy('analyze');
        setAnalysis(null);
        try {
            const result = await api.post(`/ai/documents/${encodeURIComponent(id)}/analyze`, {}).then(unwrap);
            setAnalysis(result);
            setTab('overview');
        } catch (error) {
            toast.error(apiErrorMessage(error, 'AI analysis is unavailable.'));
        } finally {
            setBusy('');
        }
    };

    if (document.loading && !record) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-72" />
                <div className="grid gap-4 lg:grid-cols-3">
                    <Skeleton className="h-64 lg:col-span-2" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        );
    }

    if (document.error) {
        return <ErrorState title="Document unavailable" message={apiErrorMessage(document.error, 'You may not have access to this document.')} onRetry={document.reload} />;
    }

    if (!record) return null;

    const canWrite = can('document:write') && record.status !== 'Archived';
    const canShare = can('document:share');
    const canApprove = can('document:approve');

    return (
        <div className="space-y-5">
            <PageHeader
                breadcrumb={(
                    <span className="inline-flex items-center gap-1.5">
                        <Link to="/documents" className="cv-link">Documents</Link>
                        <span aria-hidden="true">/</span>
                        <span>{record.fileName}</span>
                    </span>
                )}
                title={record.fileName}
                description={(
                    <span className="flex flex-wrap items-center gap-2">
                        <Badge value={record.status} />
                        <Badge value={record.integrityStatus} />
                        <Badge value={record.classification} />
                        <span className="text-xs">v{record.version} · {formatBytes(record.size)} · {record.mimeType || record.extension?.toUpperCase()}</span>
                    </span>
                )}
                actions={(
                    <>
                        <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(-1)}>Back</Button>
                        <Button variant="secondary" icon={Eye} loading={busy === 'preview'} onClick={preview}>Preview</Button>
                        <Button variant="secondary" icon={Download} loading={busy === 'download'} onClick={download}>Download</Button>
                        {can('document:verify') ? (
                            <Button variant="blue" icon={ShieldCheck} loading={busy === 'verify'} onClick={verify}>Verify integrity</Button>
                        ) : null}
                    </>
                )}
            />

            <Tabs tabs={TABS} active={tab} onChange={setTab} ariaLabel="Document sections" />

            <TabPanel id="overview" active={tab}>
                <div className="grid gap-4 lg:grid-cols-3">
                    <div className="space-y-4 lg:col-span-2">
                        <Card>
                            <CardHeader title="Document record" icon={FileText} description="Metadata registered at upload time. Values are immutable once verified." />
                            <CardBody>
                                <KeyValue
                                    columns={3}
                                    items={[
                                        { label: 'Document ID', value: <span className="font-mono text-xs">{record.id}</span> },
                                        { label: 'Case', value: record.caseId ? <Link to={`/cases/${record.caseId}`} className="cv-link">{record.caseNumber || relatedCase.data?.title || record.caseId}</Link> : 'Unlinked' },
                                        { label: 'Category', value: record.category },
                                        { label: 'Classification', value: record.classification },
                                        { label: 'Version', value: `v${record.version}` },
                                        { label: 'Version of', value: record.versionOf || 'Root document' },
                                        { label: 'Uploaded by', value: record.uploadedBy },
                                        { label: 'Uploaded at', value: formatDateTime(record.uploadedAt) },
                                        { label: 'Updated', value: formatRelative(record.updatedAt) },
                                        ...(record.approvedBy ? [{ label: 'Approved by', value: record.approvedBy }] : []),
                                        ...(record.approvedAt ? [{ label: 'Approved at', value: formatDateTime(record.approvedAt) }] : []),
                                    ]}
                                />
                                {record.rejectionReason ? (
                                    <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
                                        Rejected: {record.rejectionReason}
                                    </p>
                                ) : null}
                            </CardBody>
                        </Card>

                        {can('ai:analyze') ? (
                            <Card>
                                <CardHeader
                                    title="Deterministic document analysis"
                                    icon={Sparkles}
                                    description="Generated from authorized records only. Always verify against the source document."
                                    actions={<Button variant="secondary" size="sm" icon={Sparkles} loading={busy === 'analyze'} onClick={analyze}>Analyze</Button>}
                                />
                                <CardBody>
                                    {analysis ? <AnalysisResult result={analysis} /> : (
                                        <SkeletonText lines={3} />
                                    )}
                                </CardBody>
                            </Card>
                        ) : null}

                        <Card>
                            <CardHeader title="Workflow actions" description="Every action is authorized server-side and recorded in the audit trail." />
                            <CardBody className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    {canWrite ? <Button variant="secondary" icon={Plus} onClick={() => setVersionOpen(true)}>Upload new version</Button> : null}
                                    {canShare ? <Button variant="secondary" icon={Share2} onClick={() => setShareOpen(true)}>Share document</Button> : null}
                                    {canShare ? <Button variant="secondary" icon={PenLine} onClick={() => setSignatureOpen(true)}>Request signature</Button> : null}
                                    {canApprove && record.status !== 'Approved' ? (
                                        <Button
                                            variant="primary"
                                            icon={CheckCircle2}
                                            loading={busy === 'approve'}
                                            disabled={record.integrityStatus !== 'VERIFIED'}
                                            title={record.integrityStatus !== 'VERIFIED' ? 'Verify integrity before approval' : undefined}
                                            onClick={() => run('approve', () => api.post(`/documents/${encodeURIComponent(id)}/approve`).then(unwrap), 'Document approved.')}
                                        >
                                            Approve
                                        </Button>
                                    ) : null}
                                    {canApprove && record.status !== 'Approved' ? (
                                        <Button variant="danger" icon={XCircle} onClick={() => setRejectOpen(true)}>Reject</Button>
                                    ) : null}
                                </div>
                                {canApprove && record.integrityStatus !== 'VERIFIED' ? (
                                    <PermissionNotice message="Approval is blocked until the document integrity hash has been verified. Run “Verify integrity” first." />
                                ) : null}
                                {!canWrite && !canShare && !canApprove ? (
                                    <p className="text-xs text-ink-500 dark:text-ink-400">Your role has read-only access to this document.</p>
                                ) : null}
                            </CardBody>
                        </Card>
                    </div>

                    <div className="space-y-4">
                        <Card>
                            <CardHeader title="Integrity" icon={Fingerprint} />
                            <CardBody className="space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <SectionTitle>Status</SectionTitle>
                                    <Badge value={record.integrityStatus} />
                                </div>
                                <CopyableHash label={`Registered ${record.algorithm || 'SHA-256'} hash`} value={record.registeredHash} />
                                <CopyableHash label="Signature (Ed25519)" value={record.signature} />
                                <div>
                                    <p className="text-[0.62rem] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">Signature status</p>
                                    <p className="mt-0.5 text-sm font-medium text-ink-800 dark:text-ink-100">{record.signatureStatus || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[0.62rem] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">Last verified</p>
                                    <p className="mt-0.5 text-sm font-medium text-ink-800 dark:text-ink-100">{record.lastVerified ? formatDateTime(record.lastVerified) : 'Never'}</p>
                                </div>
                            </CardBody>
                        </Card>

                        <Card>
                            <CardHeader title="Version history" icon={GitBranch} description={`${versionList.length} version(s) on file.`} />
                            <CardBody className="space-y-2">
                                {versions.loading ? <SkeletonText lines={3} /> : versionList.map((item) => (
                                    <div key={item.id} className="flex items-start justify-between gap-2 rounded-lg border cv-divider px-3 py-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-xs font-bold text-ink-800 dark:text-ink-100">v{item.version} · {item.fileName}</p>
                                            <p className="text-[0.65rem] text-ink-500 dark:text-ink-400">{formatDateTime(item.uploadedAt)}</p>
                                        </div>
                                        <Badge value={item.id === record.id ? 'Current' : item.status} />
                                    </div>
                                ))}
                                {canWrite && relatedCase.data && !['Closed', 'Archived'].includes(relatedCase.data.status) ? (
                                    <Button variant="ghost" size="sm" icon={Plus} onClick={() => setVersionOpen(true)} className="w-full">Add version</Button>
                                ) : null}
                            </CardBody>
                        </Card>
                    </div>
                </div>
            </TabPanel>

            <TabPanel id="versions" active={tab}>
                <Card>
                    <CardHeader
                        title="Version chain"
                        icon={GitBranch}
                        description="Versions are appended, never overwritten. Each version carries its own hash and signature."
                        actions={<Button variant="secondary" size="sm" icon={Download} onClick={() => downloadCsv(timestampedName(`casevault-doc-${record.id}-versions`), versionList, ['id', 'version', 'fileName', 'status', 'integrityStatus', 'registeredHash', 'uploadedAt'])}>Export</Button>}
                    />
                    <CardBody className="px-2 sm:px-3">
                        <div className="overflow-x-auto cv-scroll">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead>
                                    <tr className="border-b cv-divider">
                                        {['Version', 'File', 'Status', 'Integrity', 'Hash', 'Uploaded'].map((header) => (
                                            <th key={header} scope="col" className="whitespace-nowrap px-3 py-2.5 text-[0.68rem] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {versionList.map((item) => (
                                        <tr key={item.id} className="border-b cv-divider last:border-0">
                                            <td className="px-3 py-3">
                                                <span className="font-semibold text-ink-900 dark:text-ink-50">v{item.version}</span>
                                                {item.id === record.id ? <span className="ml-2"><Badge value="Current" tone="brand" /></span> : null}
                                            </td>
                                            <td className="px-3 py-3 text-xs text-ink-700 dark:text-ink-200">
                                                <Link to={`/documents/${item.id}`} className="cv-link">{item.fileName}</Link>
                                            </td>
                                            <td className="px-3 py-3"><Badge value={item.status} /></td>
                                            <td className="px-3 py-3"><Badge value={item.integrityStatus} /></td>
                                            <td className="px-3 py-3 font-mono text-[0.65rem] text-ink-500 dark:text-ink-400">{shortHash(item.registeredHash, 10)}</td>
                                            <td className="px-3 py-3 text-xs text-ink-500 dark:text-ink-400">{formatDateTime(item.uploadedAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardBody>
                </Card>
            </TabPanel>

            <TabPanel id="sharing" active={tab}>
                <Card>
                    <CardHeader
                        title="Document sharing"
                        icon={Share2}
                        description="Shares grant explicit access to an individual user, optionally with an expiry date."
                        actions={canShare ? <Button variant="secondary" size="sm" icon={Link2} onClick={() => setShareOpen(true)}>Share</Button> : null}
                    />
                    <CardBody className="px-2 sm:px-3">
                        {shares.loading ? <SkeletonText lines={3} /> : (shares.data || []).length === 0 ? (
                            <p className="px-3 py-6 text-center text-sm text-ink-500 dark:text-ink-400">This document has not been shared with anyone.</p>
                        ) : (
                            <div className="space-y-2">
                                {(shares.data || []).map((share) => {
                                    const expired = share.expiresAt && new Date(share.expiresAt) < new Date();
                                    const state = share.revokedAt ? 'Revoked' : (expired ? 'Expired' : 'Active');
                                    return (
                                        <div key={share.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border cv-divider px-3 py-2">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-ink-900 dark:text-ink-50">{share.sharedWithEmail || share.sharedWithId}</p>
                                                <p className="text-xs text-ink-500 dark:text-ink-400">
                                                    {titleCase(share.permission)} access · created {formatDateTime(share.createdAt)}
                                                    {share.expiresAt ? ` · expires ${formatDateTime(share.expiresAt)}` : ' · no expiry'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge value={state} />
                                                {canShare && state === 'Active' ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        icon={Trash2}
                                                        loading={busy === `revoke-${share.id}`}
                                                        onClick={() => run(`revoke-${share.id}`, () => api.delete(`/documents/${encodeURIComponent(id)}/shares/${encodeURIComponent(share.id)}`).then(unwrap), 'Share revoked.')}
                                                    >
                                                        Revoke
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardBody>
                </Card>
            </TabPanel>

            <TabPanel id="signatures" active={tab}>
                <Card>
                    <CardHeader
                        title="Signature requests"
                        icon={PenLine}
                        description="A request lets an authorized reviewer confirm or reject this document version."
                        actions={canShare ? <Button variant="secondary" size="sm" icon={PenLine} onClick={() => setSignatureOpen(true)}>Request</Button> : null}
                    />
                    <CardBody className="space-y-2">
                        {signatures.loading ? <SkeletonText lines={3} /> : (signatures.data || []).length === 0 ? (
                            <p className="py-6 text-center text-sm text-ink-500 dark:text-ink-400">No signature requests have been raised for this document.</p>
                        ) : (signatures.data || []).map((request) => (
                            <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border cv-divider px-3 py-2">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-ink-900 dark:text-ink-50">{request.signerEmail || request.signerId}</p>
                                    <p className="text-xs text-ink-500 dark:text-ink-400">
                                        Requested {formatDateTime(request.createdAt)}
                                        {request.message ? ` · “${request.message}”` : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge value={request.status} />
                                    {request.status === 'Pending' && (request.signerId === user?.id || user?.role === 'Administrator') ? (
                                        <>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                icon={CheckCircle2}
                                                loading={busy === `sig-ok-${request.id}`}
                                                onClick={() => run(`sig-ok-${request.id}`, () => api.post(`/documents/${encodeURIComponent(id)}/signature-requests/${encodeURIComponent(request.id)}/confirm`).then(unwrap), 'Signature confirmed.')}
                                            >
                                                Confirm
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                icon={XCircle}
                                                loading={busy === `sig-no-${request.id}`}
                                                onClick={() => run(`sig-no-${request.id}`, () => api.post(`/documents/${encodeURIComponent(id)}/signature-requests/${encodeURIComponent(request.id)}/reject`).then(unwrap), 'Signature rejected.')}
                                            >
                                                Reject
                                            </Button>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </CardBody>
                </Card>
            </TabPanel>

            <TabPanel id="audit" active={tab}>
                <Card>
                    <CardHeader title="Integrity verification" icon={Fingerprint} description="Verification recomputes the SHA-256 hash of the decrypted bytes and compares them to the value registered at upload." />
                    <CardBody className="space-y-3">
                        <KeyValue
                            columns={2}
                            items={[
                                { label: 'Algorithm', value: record.algorithm || record.hashAlgorithm || 'SHA-256' },
                                { label: 'Registered hash', value: <span className="font-mono text-xs">{record.registeredHash}</span> },
                                { label: 'Signature algorithm', value: record.signatureAlgorithm || 'Ed25519' },
                                { label: 'Signature status', value: <Badge value={record.signatureStatus} /> },
                                { label: 'Last verified', value: record.lastVerified ? formatDateTime(record.lastVerified) : 'Never verified' },
                                { label: 'Storage', value: 'AES-256-GCM at rest' },
                            ]}
                        />
                        {can('document:verify') ? (
                            <Button variant="blue" icon={ShieldCheck} loading={busy === 'verify'} onClick={verify}>Run verification now</Button>
                        ) : (
                            <PermissionNotice message="Verification requires the document:verify permission." />
                        )}
                    </CardBody>
                </Card>
            </TabPanel>

            <NewVersionModal open={versionOpen} onClose={() => setVersionOpen(false)} documentId={id} record={record} onSaved={() => { setVersionOpen(false); document.reload(); versions.reload(); }} />
            <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} documentId={id} users={users} onSaved={() => { setShareOpen(false); shares.reload(); }} />
            <SignatureModal open={signatureOpen} onClose={() => setSignatureOpen(false)} documentId={id} users={users} onSaved={() => { setSignatureOpen(false); signatures.reload(); }} />
            <RejectModal open={rejectOpen} onClose={() => setRejectOpen(false)} documentId={id} onSaved={() => { setRejectOpen(false); document.reload(); }} />
        </div>
    );
}

function AnalysisResult({ result }) {
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge value="info" label="AI-GENERATED" />
                <span className="text-ink-500 dark:text-ink-400">{result.analysisId} · {result.provider} · {result.authorizedSourceCount} authorized source(s)</span>
            </div>
            <p className="text-sm text-ink-800 dark:text-ink-100">{result.summary}</p>
            {Array.isArray(result.findings) && result.findings.length ? (
                <ul className="list-disc space-y-1 pl-5 text-xs text-ink-700 dark:text-ink-200">
                    {result.findings.map((finding) => <li key={finding}>{finding}</li>)}
                </ul>
            ) : null}
            {Array.isArray(result.citations) && result.citations.length ? (
                <div>
                    <SectionTitle>Sources</SectionTitle>
                    <ul className="mt-1 space-y-1 text-xs text-ink-500 dark:text-ink-400">
                        {result.citations.map((citation) => (
                            <li key={citation.id}><span className="font-semibold text-ink-700 dark:text-ink-200">{citation.type}</span> · {citation.title}</li>
                        ))}
                    </ul>
                </div>
            ) : null}
            <p className="text-[0.7rem] italic text-ink-500 dark:text-ink-400">{result.disclaimer}</p>
        </div>
    );
}

function NewVersionModal({ open, onClose, documentId, record, onSaved }) {
    const toast = useToast();
    const [file, setFile] = useState(null);
    const [category, setCategory] = useState(record?.category || DOCUMENT_CATEGORIES[0]);
    const [classification, setClassification] = useState(record?.classification || 'CONFIDENTIAL');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        if (!file) {
            setError('Select the replacement file.');
            return;
        }
        const form = new FormData();
        form.append('file', file);
        form.append('category', category);
        form.append('classification', classification);
        setSaving(true);
        try {
            await api.post(`/documents/${encodeURIComponent(documentId)}/versions`, form);
            toast.success('New version uploaded and hash-registered.');
            setFile(null);
            onSaved();
        } catch (caught) {
            setError(apiErrorMessage(caught, 'The version could not be uploaded.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Upload a new version"
            description="The existing version is preserved. The new file receives a fresh hash, signature and version number."
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" form="document-version-form" loading={saving}>Upload version</Button>
                </>
            )}
        >
            <form id="document-version-form" onSubmit={submit} className="space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Select label="Category" value={category} onChange={(event) => setCategory(event.target.value)} options={DOCUMENT_CATEGORIES} />
                    <Select label="Classification" value={classification} onChange={(event) => setClassification(event.target.value)} options={CLASSIFICATIONS} />
                </div>
                <Input label="Replacement file" type="file" required onChange={(event) => setFile(event.target.files?.[0] || null)} />
                {file ? <p className="text-xs font-semibold text-ink-600 dark:text-ink-300">Selected: {file.name} ({formatBytes(file.size)})</p> : null}
                <InlineError message={error} />
            </form>
        </Modal>
    );
}

function ShareModal({ open, onClose, documentId, users, onSaved }) {
    const toast = useToast();
    const [target, setTarget] = useState('');
    const [permission, setPermission] = useState('view');
    const [expiresAt, setExpiresAt] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        if (!target) {
            setError('Choose a user to share with.');
            return;
        }
        setSaving(true);
        try {
            const payload = { userId: target, permission };
            if (expiresAt) payload.expiresAt = new Date(`${expiresAt}T23:59:59`).toISOString();
            await api.post(`/documents/${encodeURIComponent(documentId)}/shares`, payload);
            toast.success('Document shared. The recipient has been notified.');
            setTarget('');
            setExpiresAt('');
            onSaved();
        } catch (caught) {
            setError(apiErrorMessage(caught, 'The document could not be shared.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Share this document"
            description="The recipient must be an active user with sufficient clearance for the document classification."
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" form="document-share-form" loading={saving}>Share</Button>
                </>
            )}
        >
            <form id="document-share-form" onSubmit={submit} className="space-y-4" noValidate>
                <Select
                    label="Recipient"
                    required
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                    placeholder="Select a user"
                    options={users.filter((item) => item.status === 'active').map((item) => ({ value: item.id, label: `${item.name} — ${item.role}` }))}
                />
                <Select
                    label="Permission"
                    value={permission}
                    onChange={(event) => setPermission(event.target.value)}
                    options={[
                        { value: 'view', label: 'View only' },
                        { value: 'download', label: 'View and download' },
                    ]}
                />
                <Input label="Expires (optional)" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} hint="Leave blank for an indefinite share." />
                <InlineError message={error} />
            </form>
        </Modal>
    );
}

function SignatureModal({ open, onClose, documentId, users, onSaved }) {
    const toast = useToast();
    const [signer, setSigner] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        if (!signer) {
            setError('Choose a signer.');
            return;
        }
        setSaving(true);
        try {
            await api.post(`/documents/${encodeURIComponent(documentId)}/signature-requests`, { signerId: signer, message: message.trim() });
            toast.success('Signature request sent.');
            setSigner('');
            setMessage('');
            onSaved();
        } catch (caught) {
            setError(apiErrorMessage(caught, 'The signature request could not be created.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Request a signature"
            description="The signer must already be authorized to read this document."
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" form="document-signature-form" loading={saving}>Send request</Button>
                </>
            )}
        >
            <form id="document-signature-form" onSubmit={submit} className="space-y-4" noValidate>
                <Select
                    label="Signer"
                    required
                    value={signer}
                    onChange={(event) => setSigner(event.target.value)}
                    placeholder="Select a signer"
                    options={users.filter((item) => item.status === 'active').map((item) => ({ value: item.id, label: `${item.name} — ${item.role}` }))}
                />
                <Textarea label="Message (optional)" value={message} onChange={(event) => setMessage(event.target.value)} rows={3} placeholder="Context for the reviewer." />
                <InlineError message={error} />
            </form>
        </Modal>
    );
}

function RejectModal({ open, onClose, documentId, onSaved }) {
    const toast = useToast();
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        setSaving(true);
        try {
            await api.post(`/documents/${encodeURIComponent(documentId)}/reject`, { reason: reason.trim() });
            toast.success('Document rejected.');
            setReason('');
            onSaved();
        } catch (caught) {
            setError(apiErrorMessage(caught, 'The document could not be rejected.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Reject this document"
            description="A reason is stored on the record and in the audit trail."
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button variant="danger" type="submit" form="document-reject-form" loading={saving}>Reject document</Button>
                </>
            )}
        >
            <form id="document-reject-form" onSubmit={submit} className="space-y-4" noValidate>
                <Textarea label="Reason" required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this version cannot be accepted." />
                <InlineError message={error} />
            </form>
        </Modal>
    );
}
