import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Download, Filter, Plus, Search, Trash2 } from 'lucide-react';
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
import { useUsers } from '../hooks/useDirectory.js';
import { api, apiErrorMessage, unwrap } from '../lib/apiClient.js';
import { CASE_PRIORITIES, TASK_STATUS_TRANSITIONS, TASK_STATUSES } from '../lib/capabilities.js';
import { downloadCsv, timestampedName } from '../lib/csv.js';
import { formatDate, formatRelative } from '../lib/format.js';

const EMPTY_FORM = { caseId: '', title: '', description: '', priority: 'Medium', assigneeId: '', dueDate: '' };

export default function TasksPage() {
    const { can, user } = useAuth();
    const toast = useToast();
    useDocumentTitle('Tasks');

    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [caseId, setCaseId] = useState('');
    const [mine, setMine] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);
    const [busy, setBusy] = useState('');

    const tasks = useResource(() => api.get('/tasks').then(unwrap), []);
    const cases = useResource(() => api.get('/cases').then(unwrap), []);
    const { users, restricted: usersRestricted } = useUsers(can('user:read'));

    const list = tasks.data || [];
    const caseById = useMemo(() => new Map((cases.data || []).map((item) => [item.id, item])), [cases.data]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return list.filter((item) => {
            const matchesTerm = !term || [item.title, item.description, item.status, item.priority]
                .some((value) => String(value || '').toLowerCase().includes(term));
            return matchesTerm
                && (!status || item.status === status)
                && (!caseId || item.caseId === caseId)
                && (!mine || item.assigneeId === user?.id);
        });
    }, [list, search, status, caseId, mine, user?.id]);

    const grouped = useMemo(() => TASK_STATUSES.map((column) => ({
        status: column,
        items: filtered.filter((item) => item.status === column),
    })), [filtered]);

    const openModal = () => {
        setForm({ ...EMPTY_FORM, caseId: cases.data?.[0]?.id || '' });
        setFormError('');
        setModalOpen(true);
    };

    const submit = async (event) => {
        event.preventDefault();
        setFormError('');
        if (!form.caseId) {
            setFormError('Select the case this task belongs to.');
            return;
        }
        setSaving(true);
        try {
            const payload = { title: form.title.trim(), description: form.description.trim(), priority: form.priority };
            if (form.assigneeId) payload.assigneeId = form.assigneeId;
            if (form.dueDate) payload.dueDate = form.dueDate;
            await api.post(`/tasks/case/${encodeURIComponent(form.caseId)}`, payload);
            toast.success('Task created.');
            setModalOpen(false);
            tasks.reload();
        } catch (error) {
            setFormError(apiErrorMessage(error, 'The task could not be created.'));
        } finally {
            setSaving(false);
        }
    };

    const changeStatus = async (task, nextStatus) => {
        setBusy(task.id);
        try {
            await api.patch(`/tasks/${encodeURIComponent(task.id)}/status`, { status: nextStatus });
            toast.success(`${task.title} → ${nextStatus}`);
            tasks.reload();
        } catch (error) {
            toast.error(apiErrorMessage(error));
        } finally {
            setBusy('');
        }
    };

    const removeTask = async (task) => {
        setBusy(task.id);
        try {
            await api.delete(`/tasks/${encodeURIComponent(task.id)}`);
            toast.success('Task deleted.');
            tasks.reload();
        } catch (error) {
            toast.error(apiErrorMessage(error));
        } finally {
            setBusy('');
        }
    };

    const exportCsv = () => {
        downloadCsv(timestampedName('casevault-tasks'), filtered, ['id', 'title', 'caseId', 'status', 'priority', 'assigneeId', 'dueDate', 'createdAt', 'updatedAt']);
    };

    const columns = [
        {
            key: 'title',
            header: 'Task',
            primary: true,
            render: (row) => (
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900 dark:text-ink-50">{row.title}</p>
                    {row.description ? <p className="truncate text-xs text-ink-500 dark:text-ink-400">{row.description}</p> : null}
                </div>
            ),
        },
        { key: 'caseId', header: 'Case', render: (row) => <span className="text-xs">{caseById.get(row.caseId)?.caseNumber || row.caseId}</span> },
        { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> },
        { key: 'priority', header: 'Priority', render: (row) => <Badge value={row.priority} /> },
        { key: 'assigneeId', header: 'Assignee', render: (row) => <span className="text-xs">{users.find((item) => item.id === row.assigneeId)?.name || row.assigneeId || 'Unassigned'}</span> },
        { key: 'dueDate', header: 'Due', render: (row) => <span className="text-xs">{row.dueDate ? formatDate(row.dueDate) : '—'}</span> },
        { key: 'updatedAt', header: 'Updated', render: (row) => <span className="text-xs">{formatRelative(row.updatedAt)}</span> },
    ];

    return (
        <div className="space-y-5">
            <PageHeader
                title="Tasks"
                description="Investigation follow-up with enforced status transitions. Every change is written to the case timeline and audit trail."
                actions={(
                    <>
                        <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!filtered.length}>Export CSV</Button>
                        {can('task:write') ? <Button icon={Plus} onClick={openModal}>New task</Button> : null}
                    </>
                )}
            />

            <Card>
                <CardBody className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="relative xl:col-span-2">
                            <label htmlFor="task-search" className="sr-only">Search tasks</label>
                            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                            <input
                                id="task-search"
                                type="search"
                                className="cv-input pl-9"
                                placeholder="Search task title, description, priority…"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </div>
                        <Select aria-label="Filter by case" value={caseId} onChange={(event) => setCaseId(event.target.value)} placeholder="All cases" options={(cases.data || []).map((item) => ({ value: item.id, label: `${item.caseNumber} — ${item.title}` }))} />
                        <Select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)} placeholder="All statuses" options={TASK_STATUSES} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="inline-flex items-center gap-2 text-xs text-ink-600 dark:text-ink-300">
                            <input type="checkbox" className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500" checked={mine} onChange={(event) => setMine(event.target.checked)} />
                            Assigned to me only
                        </label>
                        <p className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
                            <Filter size={12} aria-hidden="true" />
                            {filtered.length} of {list.length} tasks
                        </p>
                    </div>
                </CardBody>
            </Card>

            {tasks.loading && !tasks.data ? (
                <Card><CardBody><SkeletonTable rows={6} columns={4} /></CardBody></Card>
            ) : tasks.error ? (
                <Card><CardBody><ErrorState message={apiErrorMessage(tasks.error)} onRetry={tasks.reload} /></CardBody></Card>
            ) : (
                <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                    {grouped.map((column) => (
                        <Card key={column.status} className="flex flex-col">
                            <CardBody className="flex-1 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <h2 className="text-sm font-bold text-ink-900 dark:text-ink-50">{column.status}</h2>
                                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-bold text-ink-600 dark:bg-ink-700 dark:text-ink-200">{column.items.length}</span>
                                </div>
                                {column.items.length === 0 ? (
                                    <p className="py-4 text-center text-xs text-ink-500 dark:text-ink-400">No tasks</p>
                                ) : column.items.map((task) => (
                                    <article key={task.id} className="rounded-lg border cv-divider p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <Link to={`/cases/${task.caseId}`} className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-ink-900 dark:text-ink-50">{task.title}</p>
                                            </Link>
                                            <Badge value={task.priority} />
                                        </div>
                                        {task.description ? <p className="mt-1 line-clamp-2 text-xs text-ink-600 dark:text-ink-300">{task.description}</p> : null}
                                        <p className="mt-1 text-[0.65rem] text-ink-500 dark:text-ink-400">
                                            {caseById.get(task.caseId)?.caseNumber || task.caseId}
                                            {task.dueDate ? ` · due ${formatDate(task.dueDate)}` : ''}
                                        </p>
                                        {can('task:write') ? (
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {(TASK_STATUS_TRANSITIONS[task.status] || []).map((next) => (
                                                    <Button
                                                        key={next}
                                                        variant="secondary"
                                                        size="sm"
                                                        loading={busy === task.id}
                                                        onClick={() => changeStatus(task, next)}
                                                    >
                                                        {next}
                                                    </Button>
                                                ))}
                                                {can('task:delete') ? (
                                                    <Button variant="ghost" size="sm" icon={Trash2} loading={busy === task.id} onClick={() => removeTask(task)}>Delete</Button>
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </article>
                                ))}
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}

            {list.length === 0 && !tasks.loading ? (
                <Card><CardBody>
                    <p className="py-8 text-center text-sm text-ink-500 dark:text-ink-400">
                        <CheckSquare size={20} className="mx-auto mb-2" aria-hidden="true" />
                        No tasks are visible to your role yet.
                    </p>
                </CardBody></Card>
            ) : null}

            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title="Create a task"
                description="Tasks are always attached to a case and appear on its timeline."
                footer={(
                    <>
                        <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
                        <Button type="submit" form="create-task-form" loading={saving}>Create task</Button>
                    </>
                )}
            >
                <form id="create-task-form" onSubmit={submit} className="space-y-4" noValidate>
                    <Select
                        label="Case"
                        required
                        value={form.caseId}
                        onChange={(event) => setForm({ ...form, caseId: event.target.value })}
                        placeholder="Select a case"
                        options={(cases.data || []).map((item) => ({ value: item.id, label: `${item.caseNumber} — ${item.title}` }))}
                    />
                    <Input label="Title" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Obtain bank statements for Q3" />
                    <Textarea label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Select label="Priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} options={CASE_PRIORITIES} />
                        <Input label="Due date" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
                        {usersRestricted ? (
                            <Input label="Assignee" value={form.assigneeId} onChange={(event) => setForm({ ...form, assigneeId: event.target.value })} placeholder="Optional" />
                        ) : (
                            <Select
                                label="Assignee"
                                value={form.assigneeId}
                                onChange={(event) => setForm({ ...form, assigneeId: event.target.value })}
                                placeholder="Unassigned"
                                options={users.filter((item) => item.status === 'active').map((item) => ({ value: item.id, label: item.name }))}
                            />
                        )}
                    </div>
                    <InlineError message={formError} />
                </form>
            </Modal>
        </div>
    );
}
