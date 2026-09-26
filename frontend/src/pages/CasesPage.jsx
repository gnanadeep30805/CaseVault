import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Filter, FolderKanban, Plus, Search } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import DataTable from '../components/ui/DataTable.jsx';
import Modal from '../components/ui/Modal.jsx';
import { Input, Select, Textarea } from '../components/ui/Form.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { ErrorState, InlineError } from '../components/ui/States.jsx';
import { SkeletonTable } from '../components/ui/Skeleton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle, useResource } from '../hooks/useResource.js';
import { useDepartments, useUsers } from '../hooks/useDirectory.js';
import { api, apiErrorMessage, unwrap } from '../lib/apiClient.js';
import { CASE_PRIORITIES, CASE_STATUSES, CASE_TYPES, CLASSIFICATIONS } from '../lib/capabilities.js';
import { downloadCsv, timestampedName } from '../lib/csv.js';
import { formatRelative } from '../lib/format.js';

const EMPTY_FORM = {
    caseNumber: '',
    title: '',
    type: CASE_TYPES[0],
    description: '',
    priority: 'Medium',
    department: '',
    classification: 'INTERNAL',
    assignedOfficerId: '',
    assignedOfficer: '',
    tags: '',
};

export default function CasesPage() {
    const { user, can } = useAuth();
    const toast = useToast();
    useDocumentTitle('Cases');

    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [department, setDepartment] = useState('');
    const [type, setType] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);

    const cases = useResource(() => api.get('/cases').then(unwrap), []);
    const { departments } = useDepartments();
    const { users, restricted: usersRestricted } = useUsers(can('user:read') || ['Administrator', 'Supervisor', 'Legal Officer'].includes(user?.role));

    const list = cases.data || [];

    const filtered = useMemo(() => list.filter((item) => {
        const term = search.trim().toLowerCase();
        const matchesTerm = !term || [item.caseNumber, item.title, item.description, item.assignedOfficer, item.type]
            .some((value) => String(value || '').toLowerCase().includes(term));
        return matchesTerm
            && (!status || item.status === status)
            && (!department || item.department === department)
            && (!type || item.type === type);
    }), [list, search, status, department, type]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const openModal = () => {
        setForm({ ...EMPTY_FORM, department: user?.department || departments[0]?.name || '' });
        setFormError('');
        setModalOpen(true);
    };

    const submit = async (event) => {
        event.preventDefault();
        setFormError('');
        setSaving(true);
        try {
            const payload = {
                title: form.title.trim(),
                type: form.type,
                description: form.description.trim(),
                priority: form.priority,
                department: form.department || user?.department,
                classification: form.classification,
                tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
            };
            if (form.caseNumber.trim()) payload.caseNumber = form.caseNumber.trim().toUpperCase();
            if (form.assignedOfficerId) payload.assignedOfficerId = form.assignedOfficerId;
            else if (form.assignedOfficer.trim()) payload.assignedOfficer = form.assignedOfficer.trim();
            const created = await api.post('/cases', payload).then(unwrap);
            toast.success(`Case ${created?.caseNumber || ''} created.`);
            setModalOpen(false);
            cases.reload();
        } catch (error) {
            setFormError(apiErrorMessage(error, 'Unable to create the case.'));
        } finally {
            setSaving(false);
        }
    };

    const exportCsv = () => {
        downloadCsv(timestampedName('casevault-cases'), filtered, [
            'caseNumber', 'title', 'type', 'status', 'priority', 'department', 'classification', 'assignedOfficer', 'createdAt', 'updatedAt',
        ]);
    };

    const columns = [
        {
            key: 'caseNumber',
            header: 'Case',
            primary: true,
            render: (row) => (
                <div className="min-w-0">
                    <Link to={`/cases/${row.id}`} className="cv-link block truncate">{row.caseNumber}</Link>
                    <p className="truncate text-xs text-ink-500 dark:text-ink-400">{row.title}</p>
                </div>
            ),
        },
        { key: 'type', header: 'Type', render: (row) => <span className="text-xs">{row.type}</span> },
        { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> },
        { key: 'priority', header: 'Priority', render: (row) => <Badge value={row.priority} /> },
        { key: 'classification', header: 'Classification', render: (row) => <Badge value={row.classification} /> },
        { key: 'department', header: 'Department', render: (row) => <span className="text-xs">{row.department}</span> },
        { key: 'assignedOfficer', header: 'Officer', render: (row) => <span className="text-xs">{row.assignedOfficer || 'Unassigned'}</span> },
        { key: 'updatedAt', header: 'Updated', render: (row) => <span className="text-xs">{formatRelative(row.updatedAt)}</span> },
    ];

    return (
        <div className="space-y-5">
            <PageHeader
                title="Cases"
                description="Every case you are authorized to view, with filters, export and registration."
                actions={(
                    <>
                        <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!filtered.length}>Export CSV</Button>
                        {can('case:write') ? <Button icon={Plus} onClick={openModal}>New case</Button> : null}
                    </>
                )}
            />

            <Card>
                <CardBody className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <div className="relative xl:col-span-2">
                            <label htmlFor="case-search" className="sr-only">Search cases</label>
                            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                            <input
                                id="case-search"
                                type="search"
                                className="cv-input pl-9"
                                placeholder="Search by number, title, officer…"
                                value={search}
                                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                            />
                        </div>
                        <Select aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} placeholder="All statuses" options={CASE_STATUSES} />
                        <Select aria-label="Filter by type" value={type} onChange={(event) => { setType(event.target.value); setPage(1); }} placeholder="All types" options={[...new Set(list.map((item) => item.type).filter(Boolean))].sort()} />
                        <Select aria-label="Filter by department" value={department} onChange={(event) => { setDepartment(event.target.value); setPage(1); }} placeholder="All departments" options={[...new Set(list.map((item) => item.department).filter(Boolean))].sort()} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500 dark:text-ink-400">
                        <span className="inline-flex items-center gap-1.5">
                            <Filter size={12} aria-hidden="true" />
                            {filtered.length} of {list.length} cases
                        </span>
                        <div className="flex items-center gap-2">
                            <label htmlFor="page-size" className="text-xs">Rows</label>
                            <select id="page-size" className="cv-input w-20 py-1" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                            </select>
                        </div>
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardBody className="px-2 sm:px-3">
                    {cases.loading && !cases.data ? <SkeletonTable rows={pageSize} columns={5} />
                        : cases.error ? <ErrorState message={apiErrorMessage(cases.error)} onRetry={cases.reload} />
                            : (
                                <DataTable
                                    columns={columns}
                                    rows={visible}
                                    mobileTitle="Case"
                                    emptyIcon={FolderKanban}
                                    emptyTitle={list.length ? 'No cases match these filters' : 'No cases available'}
                                    emptyDescription={list.length ? 'Adjust or clear the filters to see more results.' : 'Cases you create or are assigned to will appear here.'}
                                />
                            )}
                </CardBody>
            </Card>

            {filtered.length > pageSize ? (
                <nav className="flex items-center justify-between text-xs" aria-label="Case list pagination">
                    <button type="button" className="cv-btn cv-btn-secondary cv-btn-sm" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
                    <span className="text-ink-500 dark:text-ink-400">Page {currentPage} of {totalPages}</span>
                    <button type="button" className="cv-btn cv-btn-secondary cv-btn-sm" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
                </nav>
            ) : null}

            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title="Register a new case"
                description="The API assigns the case owner and records the creation in the audit trail."
                size="lg"
                footer={(
                    <>
                        <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
                        <Button form="create-case-form" type="submit" loading={saving}>Create case</Button>
                    </>
                )}
            >
                <form id="create-case-form" onSubmit={submit} className="space-y-4" noValidate>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Case title" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Payment redirection investigation" />
                        <Input
                            label="Case number"
                            value={form.caseNumber}
                            onChange={(event) => setForm({ ...form, caseNumber: event.target.value })}
                            placeholder="Auto-generated"
                            hint="Optional. 3–32 characters, letters, digits and hyphens."
                        />
                        <Select label="Case type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} options={CASE_TYPES} />
                        <Select label="Priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} options={CASE_PRIORITIES} />
                        <Select
                            label="Department"
                            value={form.department}
                            onChange={(event) => setForm({ ...form, department: event.target.value })}
                            options={departments.map((item) => item.name)}
                            hint={user?.role === 'Administrator' || user?.role === 'Supervisor' ? undefined : 'Officers can only create cases inside their own department.'}
                        />
                        <Select label="Classification" value={form.classification} onChange={(event) => setForm({ ...form, classification: event.target.value })} options={CLASSIFICATIONS} hint="Your clearance must cover the selected classification." />
                    </div>

                    {usersRestricted || !users.length ? (
                        <Input
                            label="Assigned officer"
                            value={form.assignedOfficer}
                            onChange={(event) => setForm({ ...form, assignedOfficer: event.target.value })}
                            placeholder="Officer name"
                            hint={usersRestricted ? 'The user directory is restricted to your role, so assign by name.' : 'Optional.'}
                        />
                    ) : (
                        <Select
                            label="Assigned officer"
                            value={form.assignedOfficerId}
                            onChange={(event) => {
                                const selected = users.find((item) => item.id === event.target.value);
                                setForm({ ...form, assignedOfficerId: event.target.value, assignedOfficer: selected?.name || '' });
                            }}
                            placeholder="Unassigned"
                            options={users.filter((item) => item.status === 'active').map((item) => ({ value: item.id, label: `${item.name} — ${item.role}` }))}
                        />
                    )}

                    <Textarea label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} placeholder="Summary of the allegations, scope and reporting origin." />
                    <Input label="Tags" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="fraud, priority, bank" hint="Comma separated, up to 20 tags." />

                    <InlineError message={formError} />
                    {form.department && user?.role !== 'Administrator' && user?.role !== 'Supervisor' && form.department !== user?.department ? (
                        <p className="text-xs font-semibold text-warning">The API will reject a department outside your own ({user?.department}).</p>
                    ) : null}
                </form>
            </Modal>
        </div>
    );
}
