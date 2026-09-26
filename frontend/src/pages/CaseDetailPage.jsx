import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    Bot,
    CheckSquare,
    FileText,
    Fingerprint,
    History,
    Plus,
    ScrollText,
    Send,
    ShieldCheck,
    Sparkles,
    Trash2,
    Upload,
    UserPlus,
    Users,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import DataTable from '../components/ui/DataTable.jsx';
import Tabs from '../components/ui/Tabs.jsx';
import { Card, CardBody, CardHeader, KeyValue, SectionTitle } from '../components/ui/Card.jsx';
import { ErrorState, InlineError } from '../components/ui/States.jsx';
import { SkeletonTable, SkeletonText } from '../components/ui/Skeleton.jsx';
import { Input, Select, Textarea } from '../components/ui/Form.jsx';
import UploadDocumentModal from '../components/documents/UploadDocumentModal.jsx';
import RegisterEvidenceModal from '../components/evidence/RegisterEvidenceModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle, useResource } from '../hooks/useResource.js';
import { useUsers } from '../hooks/useDirectory.js';
import { api, apiErrorMessage, unwrap } from '../lib/apiClient.js';
import { CASE_STATUS_TRANSITIONS, TASK_STATUS_TRANSITIONS, TASK_STATUSES } from '../lib/capabilities.js';
import { formatBytes, formatDateTime, shortHash, titleCase, truncate } from '../lib/format.js';

export default function CaseDetailPage() {
    const { id } = useParams();
    const { can, user } = useAuth();
    const toast = useToast();
    const [tab, setTab] = useState('overview');
    const [uploadOpen, setUploadOpen] = useState(false);
    const [evidenceOpen, setEvidenceOpen] = useState(false);

    const detail = useResource(() => api.get(`/cases/${encodeURIComponent(id)}`).then(unwrap), [id]);
    const record = detail.data;
    useDocumentTitle(record ? `${record.caseNumber} · Case` : 'Case');

    const members = useResource(() => api.get(`/cases/${encodeURIComponent(id)}/members`).then(unwrap), [id]);
    const audit = useResource(() => api.get('/audit?limit=500').then(unwrap), [id], { enabled: tab === 'audit' && can('audit:read') });

    const caseAudit = useMemo(
        () => (audit.data || []).filter((event) => event.resourceId === id || event.metadata?.caseId === id),
        [audit.data, id],
    );

    if (detail.error) {
        const status = detail.error?.response?.status;
        return (
            <ErrorState
                title={status === 404 ? 'Case not found' : 'Unable to load this case'}
                message={status === 404 ? 'The case does not exist or you are not authorized to view it.' : apiErrorMessage(detail.error)}
                onRetry={detail.reload}
            />
        );
    }

    if (detail.loading && !record) {
        return (
            <div className="space-y-4">
                <div className="cv-panel p-5"><SkeletonText lines={4} /></div>
                <div className="cv-panel p-5"><SkeletonTable rows={6} columns={4} /></div>
            </div>
        );
    }

    const tabs = [
        { id: 'overview', label: 'Overview', icon: ShieldCheck },
        { id: 'documents', label: 'Documents', icon: FileText, count: (record.documents || []).length },
        { id: 'evidence', label: 'Evidence', icon: Fingerprint, count: (record.evidence || []).length },
        { id: 'people', label: 'People', icon: Users, count: (members.data || []).length },
        { id: 'timeline', label: 'Timeline', icon: History, count: (record.timeline || []).length },
        { id: 'tasks', label: 'Tasks', icon: CheckSquare, count: (record.tasks || []).length },
        can('ai:analyze') ? { id: 'insights', label: 'AI Insights', icon: Sparkles } : null,
        can('audit:read') ? { id: 'audit', label: 'Audit', icon: ScrollText } : null,
    ];

    return (
        <div className="space-y-5">
            <Link to="/cases" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100">
                <ArrowLeft size={14} aria-hidden="true" />
                Back to cases
            </Link>

            <PageHeader
                title={`${record.caseNumber} · ${record.title}`}
                description={record.description || 'No case summary recorded.'}
                actions={(
                    <>
                        {can('document:write') ? <Button variant="secondary" icon={Upload} onClick={() => setUploadOpen(true)}>Upload document</Button> : null}
                        {can('evidence:write') ? <Button variant="secondary" icon={Fingerprint} onClick={() => setEvidenceOpen(true)}>Register evidence</Button> : null}
                    </>
                )}
            >
                <div className="flex flex-wrap items-center gap-2">
                    <Badge value={record.status} />
                    <Badge value={record.priority} />
                    <Badge value={record.classification} />
                    <span className="text-xs text-ink-500 dark:text-ink-400">
                        {record.type} · {record.department} · Officer: {record.assignedOfficer || 'Unassigned'}
                    </span>
                </div>
            </PageHeader>

            <Tabs tabs={tabs} active={tab} onChange={setTab} ariaLabel="Case sections" />

            <div id={`panel-${tab}`} role="tabpanel">
                {tab === 'overview' ? (
                    <OverviewTab record={record} onChanged={detail.reload} />
                ) : null}
                {tab === 'documents' ? <DocumentsTab record={record} onUpload={() => setUploadOpen(true)} /> : null}
                {tab === 'evidence' ? <EvidenceTab record={record} onRegister={() => setEvidenceOpen(true)} /> : null}
                {tab === 'people' ? <PeopleTab caseId={id} members={members} currentUserId={user?.id} onChanged={() => { members.reload(); detail.reload(); }} /> : null}
                {tab === 'timeline' ? <TimelineTab caseId={id} events={record.timeline} onChanged={detail.reload} /> : null}
                {tab === 'tasks' ? <TasksTab caseId={id} tasks={record.tasks} onChanged={detail.reload} /> : null}
                {tab === 'insights' ? <InsightsTab caseId={id} record={record} /> : null}
                {tab === 'audit' ? <AuditTab events={caseAudit} loading={audit.loading} onRetry={audit.reload} /> : null}
            </div>

            <UploadDocumentModal open={uploadOpen} onClose={() => setUploadOpen(false)} caseId={id} onUploaded={detail.reload} />
            <RegisterEvidenceModal open={evidenceOpen} onClose={() => setEvidenceOpen(false)} caseId={id} onRegistered={detail.reload} />
        </div>
    );
}

function OverviewTab({ record, onChanged }) {
    const { can } = useAuth();
    const toast = useToast();
    const [nextStatus, setNextStatus] = useState('');
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);

    const transitions = CASE_STATUS_TRANSITIONS[record.status] || [];
    const documents = record.documents || [];
    const evidence = record.evidence || [];
    const tasks = record.tasks || [];

    const changeStatus = async () => {
        if (!nextStatus) return;
        setError('');
        setPending(true);
        try {
            await api.patch(`/cases/${encodeURIComponent(record.id)}/status`, { status: nextStatus });
            toast.success(`Case moved to ${nextStatus}.`);
            setNextStatus('');
            onChanged?.();
        } catch (caught) {
            setError(apiErrorMessage(caught, 'The status change was rejected.'));
        } finally {
            setPending(false);
        }
    };

    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="space-y-4">
                <Card>
                    <CardHeader title="Case record" icon={ShieldCheck} />
                    <CardBody>
                        <KeyValue
                            columns={3}
                            items={[
                                { label: 'Case number', value: record.caseNumber },
                                { label: 'Type', value: record.type },
                                { label: 'Status', value: <Badge value={record.status} /> },
                                { label: 'Priority', value: <Badge value={record.priority} /> },
                                { label: 'Department', value: record.department },
                                { label: 'Classification', value: <Badge value={record.classification} /> },
                                { label: 'Assigned officer', value: record.assignedOfficer || 'Unassigned' },
                                { label: 'Created', value: formatDateTime(record.createdAt) },
                                { label: 'Last updated', value: formatDateTime(record.updatedAt) },
                                { label: 'Tags', value: (record.tags || []).length ? (record.tags || []).join(', ') : 'None' },
                            ]}
                        />
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader title="Case inventory" />
                    <CardBody>
                        <div className="grid gap-3 sm:grid-cols-4">
                            <Metric label="Documents" value={documents.length} />
                            <Metric label="Evidence" value={evidence.length} />
                            <Metric label="Open tasks" value={tasks.filter((task) => !['Completed', 'Cancelled'].includes(task.status)).length} />
                            <Metric label="Timeline events" value={(record.timeline || []).length} />
                        </div>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader title="Latest timeline entries" icon={History} />
                    <CardBody className="space-y-3">
                        {(record.timeline || []).length === 0 ? (
                            <p className="py-4 text-center text-xs text-ink-500 dark:text-ink-400">No timeline entries recorded yet.</p>
                        ) : (record.timeline || []).slice(-6).reverse().map((event) => (
                            <div key={event.id} className="flex gap-3">
                                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{event.title}</p>
                                    <p className="text-xs text-ink-600 dark:text-ink-300">{event.detail}</p>
                                    <p className="mt-0.5 text-[0.68rem] text-ink-500 dark:text-ink-400">{formatDateTime(event.createdAt)}</p>
                                </div>
                            </div>
                        ))}
                    </CardBody>
                </Card>
            </div>

            <div className="space-y-4">
                <Card>
                    <CardHeader title="Lifecycle" description="Transitions are validated by the API." />
                    <CardBody className="space-y-3">
                        {can('case:write') && transitions.length > 0 ? (
                            <>
                                <Select label="Move case to" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} placeholder="Select next status" options={transitions} />
                                <InlineError message={error} />
                                <Button onClick={changeStatus} loading={pending} disabled={!nextStatus}>Apply status change</Button>
                            </>
                        ) : (
                            <p className="text-xs text-ink-500 dark:text-ink-400">
                                {transitions.length === 0
                                    ? 'This case is archived; no further transitions are permitted.'
                                    : 'You do not have permission to change the case status.'}
                            </p>
                        )}
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader title="Integrity summary" />
                    <CardBody className="space-y-2 text-xs">
                        <SummaryRow label="Documents verified" value={`${documents.filter((item) => item.integrityStatus === 'VERIFIED').length} / ${documents.length}`} />
                        <SummaryRow label="Documents compromised" value={`${documents.filter((item) => item.integrityStatus === 'COMPROMISED').length}`} tone={documents.some((item) => item.integrityStatus === 'COMPROMISED') ? 'danger' : 'neutral'} />
                        <SummaryRow label="Evidence registered" value={`${evidence.length}`} />
                        <SummaryRow label="Hash algorithm" value="SHA-256" />
                        <SummaryRow label="Signature algorithm" value="Ed25519" />
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}

function Metric({ label, value }) {
    return (
        <div className="cv-panel-alt p-3">
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">{label}</p>
            <p className="mt-1 text-xl font-bold text-ink-900 dark:text-ink-50">{value}</p>
        </div>
    );
}

function SummaryRow({ label, value, tone = 'neutral' }) {
    return (
        <div className="flex items-center justify-between gap-2 border-b cv-divider pb-1.5 last:border-0">
            <span className="text-ink-500 dark:text-ink-400">{label}</span>
            <span className={tone === 'danger' ? 'font-bold text-danger' : 'font-bold text-ink-800 dark:text-ink-100'}>{value}</span>
        </div>
    );
}

function DocumentsTab({ record, onUpload }) {
    const { can } = useAuth();
    const documents = record.documents || [];
    const columns = [
        { key: 'fileName', header: 'File', primary: true, render: (row) => <Link to={`/documents/${row.id}`} className="cv-link block truncate">{row.fileName}</Link> },
        { key: 'category', header: 'Category', render: (row) => <span className="text-xs">{row.category}</span> },
        { key: 'version', header: 'Version', render: (row) => <span className="text-xs">v{row.version}</span> },
        { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> },
        { key: 'integrityStatus', header: 'Integrity', render: (row) => <Badge value={row.integrityStatus} /> },
        { key: 'size', header: 'Size', render: (row) => <span className="text-xs">{formatBytes(row.size)}</span> },
    ];

    return (
        <Card>
            <CardHeader
                title="Case documents"
                icon={FileText}
                actions={can('document:write') ? <Button size="sm" icon={Upload} onClick={onUpload}>Upload</Button> : null}
            />
            <CardBody className="px-2 sm:px-3">
                <DataTable
                    columns={columns}
                    rows={documents}
                    mobileTitle="Document"
                    emptyIcon={FileText}
                    emptyTitle="No documents in this case"
                    emptyDescription="Uploads are encrypted, hash-registered and versioned automatically."
                />
            </CardBody>
        </Card>
    );
}

function EvidenceTab({ record, onRegister }) {
    const { can } = useAuth();
    const evidence = record.evidence || [];
    const columns = [
        { key: 'id', header: 'Evidence', primary: true, render: (row) => <Link to={`/evidence/${row.id}`} className="cv-link">{row.id}</Link> },
        { key: 'type', header: 'Type', render: (row) => <span className="text-xs">{row.type}</span> },
        { key: 'description', header: 'Description', render: (row) => <span className="text-xs">{truncate(row.description, 48)}</span> },
        { key: 'currentCustodian', header: 'Custodian', render: (row) => <span className="text-xs">{row.currentCustodian}</span> },
        { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> },
        { key: 'currentVerificationState', header: 'Integrity', render: (row) => <Badge value={row.currentVerificationState} /> },
    ];

    return (
        <Card>
            <CardHeader
                title="Evidence register"
                icon={Fingerprint}
                actions={can('evidence:write') ? <Button size="sm" icon={Plus} onClick={onRegister}>Register</Button> : null}
            />
            <CardBody className="px-2 sm:px-3">
                <DataTable
                    columns={columns}
                    rows={evidence}
                    mobileTitle="Evidence record"
                    emptyIcon={Fingerprint}
                    emptyTitle="No evidence registered"
                    emptyDescription="Register physical or digital exhibits to begin a chain of custody."
                />
            </CardBody>
        </Card>
    );
}

function PeopleTab({ caseId, members, currentUserId, onChanged }) {
    const { can } = useAuth();
    const toast = useToast();
    const { users, restricted } = useUsers();
    const [selection, setSelection] = useState('');
    const [role, setRole] = useState('Member');
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);

    const addMember = async (event) => {
        event.preventDefault();
        if (!selection.trim()) {
            setError('Select a user or enter their email address.');
            return;
        }
        setError('');
        setPending(true);
        try {
            await api.post(`/cases/${encodeURIComponent(caseId)}/members`, { userId: selection.trim(), role });
            toast.success('Case member added.');
            setSelection('');
            onChanged?.();
        } catch (caught) {
            setError(apiErrorMessage(caught, 'Unable to add the member.'));
        } finally {
            setPending(false);
        }
    };

    const removeMember = async (member) => {
        try {
            await api.delete(`/cases/${encodeURIComponent(caseId)}/members/${encodeURIComponent(member.userId)}`);
            toast.success('Case member removed.');
            onChanged?.();
        } catch (caught) {
            toast.error(apiErrorMessage(caught, 'Unable to remove the member.'));
        }
    };

    const rows = members.data || [];
    const columns = [
        {
            key: 'name',
            header: 'Member',
            primary: true,
            render: (row) => (
                <div>
                    <p className="truncate text-sm font-semibold">{row.user?.name || row.userId}</p>
                    <p className="truncate text-xs text-ink-500 dark:text-ink-400">{row.user?.email || 'User record unavailable'}</p>
                </div>
            ),
        },
        { key: 'role', header: 'Case role', render: (row) => <Badge value={row.role} tone="info" label={row.role} /> },
        { key: 'department', header: 'Department', render: (row) => <span className="text-xs">{row.user?.department || '—'}</span> },
        { key: 'addedAt', header: 'Added', render: (row) => <span className="text-xs">{formatDateTime(row.addedAt)}</span> },
        {
            key: 'actions',
            header: 'Actions',
            render: (row) => (can('case:write') && row.userId !== currentUserId ? (
                <button type="button" className="cv-btn cv-btn-ghost cv-btn-sm text-danger" onClick={() => removeMember(row)}>
                    <Trash2 size={12} aria-hidden="true" />
                    Remove
                </button>
            ) : <span className="text-xs text-ink-400">—</span>),
        },
    ];

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader title="Case team" icon={Users} description="Members receive explicit access to this case in addition to department scoping." />
                <CardBody className="px-2 sm:px-3">
                    {members.loading && !members.data ? <SkeletonTable rows={3} columns={3} /> : (
                        <DataTable columns={columns} rows={rows} mobileTitle="Member" emptyTitle="No members listed" emptyDescription="Add investigators, reviewers or supervisors to this case." />
                    )}
                </CardBody>
            </Card>

            {can('case:write') ? (
                <Card>
                    <CardHeader title="Add member" />
                    <CardBody>
                        <form onSubmit={addMember} className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end" noValidate>
                            {restricted || !users.length ? (
                                <Input label="User email, username or id" value={selection} onChange={(event) => setSelection(event.target.value)} placeholder="legal@casevault.local" />
                            ) : (
                                <Select
                                    label="User"
                                    value={selection}
                                    onChange={(event) => setSelection(event.target.value)}
                                    placeholder="Select a user"
                                    options={users.filter((item) => item.status === 'active').map((item) => ({ value: item.id, label: `${item.name} — ${item.role}` }))}
                                />
                            )}
                            <Select label="Case role" value={role} onChange={(event) => setRole(event.target.value)} options={['Owner', 'Supervisor', 'Reviewer', 'Investigator', 'Member']} />
                            <Button type="submit" icon={UserPlus} loading={pending}>Add</Button>
                        </form>
                        <InlineError message={error} />
                    </CardBody>
                </Card>
            ) : null}
        </div>
    );
}

function TimelineTab({ caseId, events, onChanged }) {
    const { can } = useAuth();
    const toast = useToast();
    const [form, setForm] = useState({ title: '', detail: '', type: 'note' });
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        if (!form.title.trim()) {
            setError('A timeline title is required.');
            return;
        }
        setError('');
        setPending(true);
        try {
            await api.post(`/cases/${encodeURIComponent(caseId)}/timeline`, {
                title: form.title.trim(),
                detail: form.detail.trim(),
                type: form.type,
            });
            toast.success('Timeline entry added.');
            setForm({ title: '', detail: '', type: 'note' });
            onChanged?.();
        } catch (caught) {
            setError(apiErrorMessage(caught, 'Unable to append the timeline entry.'));
        } finally {
            setPending(false);
        }
    };

    const list = [...(events || [])].reverse();

    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card>
                <CardHeader title="Case timeline" icon={History} />
                <CardBody>
                    {list.length === 0 ? (
                        <p className="py-8 text-center text-xs text-ink-500 dark:text-ink-400">No timeline entries recorded yet.</p>
                    ) : (
                        <ol className="relative space-y-4 border-l border-ink-200 pl-5 dark:border-ink-600">
                            {list.map((event) => (
                                <li key={event.id} className="relative">
                                    <span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500" aria-hidden="true" />
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-bold text-ink-900 dark:text-ink-50">{event.title}</p>
                                        <Badge value={event.type} tone="info" label={titleCase(event.type)} />
                                    </div>
                                    {event.detail ? <p className="mt-0.5 text-xs text-ink-600 dark:text-ink-300">{event.detail}</p> : null}
                                    <p className="mt-1 text-[0.68rem] text-ink-500 dark:text-ink-400">{formatDateTime(event.createdAt)} · actor {event.actorId}</p>
                                </li>
                            ))}
                        </ol>
                    )}
                </CardBody>
            </Card>

            {can('case:write') ? (
                <Card>
                    <CardHeader title="Append entry" description="Timeline entries are written to the audit trail." />
                    <CardBody>
                        <form onSubmit={submit} className="space-y-3" noValidate>
                            <Input label="Title" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Statement received from finance" />
                            <Select label="Type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} options={['note', 'status', 'document', 'evidence', 'task', 'interview', 'analysis', 'member', 'signature', 'case']} />
                            <Textarea label="Detail" value={form.detail} onChange={(event) => setForm({ ...form, detail: event.target.value })} rows={4} />
                            <InlineError message={error} />
                            <Button type="submit" icon={Send} loading={pending}>Append to timeline</Button>
                        </form>
                    </CardBody>
                </Card>
            ) : null}
        </div>
    );
}

function TasksTab({ caseId, tasks, onChanged }) {
    const { can, user } = useAuth();
    const toast = useToast();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('Medium');
    const [dueDate, setDueDate] = useState('');
    const [assigneeId, setAssigneeId] = useState('');
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);
    const { users, restricted } = useUsers(can('user:read') || ['Administrator', 'Supervisor', 'Legal Officer'].includes(user?.role));

    const create = async (event) => {
        event.preventDefault();
        if (!title.trim()) {
            setError('A task title is required.');
            return;
        }
        setError('');
        setPending(true);
        try {
            await api.post(`/tasks/case/${encodeURIComponent(caseId)}`, {
                title: title.trim(),
                description: description.trim(),
                priority,
                dueDate: dueDate || undefined,
                assigneeId: assigneeId || undefined,
            });
            toast.success('Task created.');
            setTitle('');
            setDescription('');
            setDueDate('');
            setAssigneeId('');
            onChanged?.();
        } catch (caught) {
            setError(apiErrorMessage(caught, 'Unable to create the task.'));
        } finally {
            setPending(false);
        }
    };

    const changeStatus = async (task, status) => {
        try {
            await api.patch(`/tasks/${encodeURIComponent(task.id)}/status`, { status });
            toast.success(`${task.title} → ${status}`);
            onChanged?.();
        } catch (caught) {
            toast.error(apiErrorMessage(caught, 'Status change rejected.'));
        }
    };

    const columns = [
        { key: 'title', header: 'Task', primary: true, render: (row) => <span className="text-sm font-semibold">{row.title}</span> },
        { key: 'priority', header: 'Priority', render: (row) => <Badge value={row.priority} /> },
        { key: 'dueDate', header: 'Due', render: (row) => <span className="text-xs">{row.dueDate || '—'}</span> },
        {
            key: 'status',
            header: 'Status',
            render: (row) => (can('task:write') && (TASK_STATUS_TRANSITIONS[row.status] || []).length ? (
                <select
                    className="cv-input py-1 text-xs"
                    value={row.status}
                    aria-label={`Status for ${row.title}`}
                    onChange={(event) => changeStatus(row, event.target.value)}
                >
                    <option value={row.status}>{row.status}</option>
                    {(TASK_STATUS_TRANSITIONS[row.status] || []).map((next) => <option key={next} value={next}>{next}</option>)}
                </select>
            ) : <Badge value={row.status} />),
        },
    ];

    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card>
                <CardHeader title="Case tasks" icon={CheckSquare} />
                <CardBody className="px-2 sm:px-3">
                    <DataTable
                        columns={columns}
                        rows={tasks || []}
                        mobileTitle="Task"
                        emptyIcon={CheckSquare}
                        emptyTitle="No tasks for this case"
                        emptyDescription="Create tasks to track investigative actions and deadlines."
                    />
                </CardBody>
            </Card>

            {can('task:write') ? (
                <Card>
                    <CardHeader title="New task" />
                    <CardBody>
                        <form onSubmit={create} className="space-y-3" noValidate>
                            <Input label="Title" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Reconcile invoice references" />
                            <Textarea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Select label="Priority" value={priority} onChange={(event) => setPriority(event.target.value)} options={['Low', 'Medium', 'High', 'Critical']} />
                                <Input label="Due date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                            </div>
                            {restricted || !users.length ? (
                                <p className="text-[0.7rem] text-ink-500 dark:text-ink-400">Assign tasks from the task board where the user directory is available.</p>
                            ) : (
                                <Select
                                    label="Assignee"
                                    value={assigneeId}
                                    onChange={(event) => setAssigneeId(event.target.value)}
                                    placeholder="Unassigned"
                                    options={users.filter((item) => item.status === 'active').map((item) => ({ value: item.id, label: `${item.name} — ${item.role}` }))}
                                />
                            )}
                            <InlineError message={error} />
                            <Button type="submit" icon={Plus} loading={pending}>Create task</Button>
                        </form>
                    </CardBody>
                </Card>
            ) : null}
        </div>
    );
}

function InsightsTab({ caseId, record }) {
    const toast = useToast();
    const [prompt, setPrompt] = useState('Summarise the current evidentiary posture and the outstanding work on this case.');
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);

    const analyze = async (event) => {
        event.preventDefault();
        setError('');
        setPending(true);
        try {
            const response = await api.post('/ai/analyze', { caseId, prompt }).then(unwrap);
            setResult(response);
            toast.success('Analysis complete.');
        } catch (caught) {
            setError(apiErrorMessage(caught, 'The analysis could not be completed.'));
        } finally {
            setPending(false);
        }
    };

    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <Card>
                <CardHeader title="Ask about this case" icon={Bot} description="Analysis is restricted to sources you are already authorized to read." />
                <CardBody>
                    <form onSubmit={analyze} className="space-y-3" noValidate>
                        <Textarea label="Question" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} />
                        <InlineError message={error} />
                        <Button type="submit" icon={Sparkles} loading={pending}>Run analysis</Button>
                    </form>
                    <p className="mt-4 text-[0.7rem] text-ink-500 dark:text-ink-400">
                        {record.caseNumber} · {record.title}
                    </p>
                </CardBody>
            </Card>

            <Card>
                <CardHeader title="Analysis output" icon={Sparkles} />
                <CardBody className="space-y-3">
                    {!result ? (
                        <p className="py-8 text-center text-xs text-ink-500 dark:text-ink-400">Run an analysis to see findings and cited sources.</p>
                    ) : (
                        <>
                            {result.outputLabel ? <p className="text-[0.68rem] font-bold uppercase tracking-wider text-warning">{result.outputLabel}</p> : null}
                            <p className="text-sm text-ink-700 dark:text-ink-200">{result.providerSummary || result.summary}</p>
                            {Array.isArray(result.findings) ? (
                                <ul className="space-y-1.5">
                                    {result.findings.map((finding, index) => (
                                        <li key={index} className="flex gap-2 text-xs text-ink-700 dark:text-ink-200">
                                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
                                            {finding}
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                            <div className="grid gap-2 sm:grid-cols-3">
                                <SummaryRow label="Analysis ID" value={result.analysisId} />
                                <SummaryRow label="Sources" value={String(result.authorizedSourceCount ?? (result.citations || []).length)} />
                                <SummaryRow label="Version" value={result.analysisVersion} />
                            </div>
                            <SectionTitle>Cited sources</SectionTitle>
                            <ul className="space-y-2">
                                {(result.citations || []).map((citation, index) => (
                                    <li key={`${citation.type}-${citation.id}-${index}`} className="cv-panel-alt p-2.5">
                                        <p className="text-xs font-bold">
                                            <Badge value={citation.type} tone="info" label={titleCase(citation.type)} />{' '}
                                            {citation.title}
                                        </p>
                                        <p className="mt-1 text-[0.7rem] text-ink-600 dark:text-ink-300">{citation.excerpt}</p>
                                        {citation.type === 'document' ? (
                                            <Link to={`/documents/${citation.id}`} className="cv-link text-[0.7rem]">Open document</Link>
                                        ) : null}
                                        {citation.type === 'evidence' ? (
                                            <Link to={`/evidence/${citation.id}`} className="cv-link text-[0.7rem]">Open evidence</Link>
                                        ) : null}
                                        {citation.type === 'case' ? (
                                            <Link to={`/cases/${citation.id}`} className="cv-link text-[0.7rem]">Open case</Link>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                            {result.disclaimer ? <p className="text-[0.68rem] text-ink-500 dark:text-ink-400">{result.disclaimer}</p> : null}
                        </>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}

function AuditTab({ events, loading, onRetry }) {
    const columns = [
        { key: 'timestamp', header: 'Timestamp', primary: true, render: (row) => <span className="text-xs">{formatDateTime(row.timestamp)}</span> },
        { key: 'action', header: 'Action', render: (row) => <span className="text-xs font-semibold">{titleCase(row.action)}</span> },
        { key: 'resource', header: 'Resource', render: (row) => <span className="text-xs">{row.resource}</span> },
        { key: 'actor', header: 'Actor', render: (row) => <span className="text-xs">{row.actor}</span> },
        { key: 'currentHash', header: 'Hash', render: (row) => <code className="text-[0.65rem]">{shortHash(row.currentHash, 10)}</code> },
    ];

    return (
        <Card>
            <CardHeader title="Audit events for this case" icon={ScrollText} description="Filtered client-side from the case audit chain." actions={<Button size="sm" variant="secondary" onClick={onRetry}>Refresh</Button>} />
            <CardBody className="px-2 sm:px-3">
                {loading ? <SkeletonTable rows={5} columns={4} />
                    : events.length === 0 ? (
                        <p className="py-8 text-center text-xs text-ink-500 dark:text-ink-400">
                            No audit events reference this case in the accessible audit window.
                        </p>
                    ) : (
                        <DataTable columns={columns} rows={events} mobileTitle="Audit event" />
                    )}
            </CardBody>
        </Card>
    );
}
