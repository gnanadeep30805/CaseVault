import { useMemo, useState } from 'react';
import { Search, ShieldCheck, UserPlus, Users } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import DataTable from '../components/ui/DataTable.jsx';
import Modal from '../components/ui/Modal.jsx';
import { Checkbox, Input, Select } from '../components/ui/Form.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { ErrorState, InlineError } from '../components/ui/States.jsx';
import { SkeletonTable } from '../components/ui/Skeleton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle, useResource } from '../hooks/useResource.js';
import { api, apiErrorMessage, unwrap } from '../lib/apiClient.js';
import { CLEARANCE_LEVELS, ROLES } from '../lib/capabilities.js';
import { formatRelative } from '../lib/format.js';

const EMPTY_FORM = { name: '', email: '', username: '', password: '', role: 'Investigation Officer', department: '', clearance: 'CONFIDENTIAL', mfaEnabled: true };

export default function UsersPage() {
    const { user, can } = useAuth();
    const toast = useToast();
    useDocumentTitle('Users');

    const [search, setSearch] = useState('');
    const [role, setRole] = useState('');
    const [department, setDepartment] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);
    const [busy, setBusy] = useState('');

    const users = useResource(() => api.get('/users').then(unwrap), []);
    const departments = useResource(() => api.get('/users/departments').then(unwrap), []);

    const list = users.data || [];
    const isAdmin = user?.role === 'Administrator';

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return list.filter((item) => {
            const matchesTerm = !term || [item.name, item.email, item.username, item.role, item.department]
                .some((value) => String(value || '').toLowerCase().includes(term));
            return matchesTerm && (!role || item.role === role) && (!department || item.department === department);
        });
    }, [list, search, role, department]);

    const openCreate = () => {
        setForm({ ...EMPTY_FORM, department: departments.data?.[0]?.name || '' });
        setFormError('');
        setEditing(null);
        setCreateOpen(true);
    };

    const openEdit = (item) => {
        setForm({ ...EMPTY_FORM, ...item, password: '' });
        setFormError('');
        setEditing(item);
        setCreateOpen(true);
    };

    const submit = async (event) => {
        event.preventDefault();
        setFormError('');
        setSaving(true);
        try {
            if (editing) {
                await api.patch(`/users/${encodeURIComponent(editing.id)}`, {
                    name: form.name.trim(),
                    role: form.role,
                    department: form.department,
                    clearance: form.clearance,
                    status: form.status,
                    mfaEnabled: form.mfaEnabled,
                });
                toast.success('User updated.');
            } else {
                await api.post('/users', {
                    name: form.name.trim(),
                    email: form.email.trim(),
                    username: form.username.trim(),
                    password: form.password,
                    role: form.role,
                    department: form.department,
                    clearance: form.clearance,
                    mfaEnabled: form.mfaEnabled,
                });
                toast.success('User created.');
            }
            setCreateOpen(false);
            users.reload();
        } catch (error) {
            setFormError(apiErrorMessage(error, editing ? 'The user could not be updated.' : 'The user could not be created.'));
        } finally {
            setSaving(false);
        }
    };

    const setStatus = async (item, status) => {
        setBusy(item.id);
        try {
            await api.patch(`/users/${encodeURIComponent(item.id)}/status`, { status });
            toast.success(`${item.name} is now ${status}.`);
            users.reload();
        } catch (error) {
            toast.error(apiErrorMessage(error));
        } finally {
            setBusy('');
        }
    };

    const columns = [
        {
            key: 'name',
            header: 'User',
            primary: true,
            render: (row) => (
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900 dark:text-ink-50">{row.name}</p>
                    <p className="truncate text-xs text-ink-500 dark:text-ink-400">{row.email}</p>
                </div>
            ),
        },
        { key: 'username', header: 'Username', render: (row) => <span className="text-xs">{row.username}</span> },
        { key: 'role', header: 'Role', render: (row) => <Badge value={row.role} tone="info" /> },
        { key: 'department', header: 'Department', render: (row) => <span className="text-xs">{row.department}</span> },
        { key: 'clearance', header: 'Clearance', render: (row) => <Badge value={row.clearance} /> },
        { key: 'mfaEnabled', header: 'MFA', render: (row) => <Badge value={row.mfaEnabled ? 'Enabled' : 'Disabled'} tone={row.mfaEnabled ? 'success' : 'warning'} /> },
        { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> },
        { key: 'lastLogin', header: 'Last login', render: (row) => <span className="text-xs">{row.lastLogin ? formatRelative(row.lastLogin) : 'Never'}</span> },
        ...(isAdmin ? [{
            key: 'actions',
            header: 'Actions',
            render: (row) => (
                <div className="flex flex-wrap gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>Edit</Button>
                    {row.id === user?.id ? null : (
                        <Button
                            variant="ghost"
                            size="sm"
                            loading={busy === row.id}
                            onClick={() => setStatus(row, row.status === 'active' ? 'disabled' : 'active')}
                        >
                            {row.status === 'active' ? 'Disable' : 'Enable'}
                        </Button>
                    )}
                </div>
            ),
        }] : []),
    ];

    return (
        <div className="space-y-5">
            <PageHeader
                title="Users"
                description="Role, department and clearance assignments that determine what each operator can reach. Every change is audited."
                actions={isAdmin ? <Button icon={UserPlus} onClick={openCreate}>Add user</Button> : null}
            />

            <Card>
                <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="relative xl:col-span-2">
                        <label htmlFor="user-search" className="sr-only">Search users</label>
                        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                        <input
                            id="user-search"
                            type="search"
                            className="cv-input pl-9"
                            placeholder="Search name, email, username…"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>
                    <Select aria-label="Filter by role" value={role} onChange={(event) => setRole(event.target.value)} placeholder="All roles" options={ROLES} />
                    <Select aria-label="Filter by department" value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="All departments" options={(departments.data || []).map((item) => item.name)} />
                </CardBody>
            </Card>

            <Card>
                <CardBody className="px-2 sm:px-3">
                    {users.loading && !users.data ? <SkeletonTable rows={8} columns={5} />
                        : users.error ? <ErrorState message={apiErrorMessage(users.error)} onRetry={users.reload} />
                            : (
                                <DataTable
                                    columns={columns}
                                    rows={filtered}
                                    mobileTitle="User"
                                    emptyIcon={Users}
                                    emptyTitle={list.length ? 'No users match these filters' : 'No users available'}
                                />
                            )}
                </CardBody>
            </Card>

            <Card>
                <CardBody className="flex items-start gap-3 text-xs text-ink-600 dark:text-ink-300">
                    <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" />
                    <p>
                        Only Administrators can create or modify accounts. Supervisors and Legal Officers have read-only visibility for assignment purposes.
                        A user’s clearance must cover the classification of any case, document or evidence they need to reach.
                    </p>
                </CardBody>
            </Card>

            <Modal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                title={editing ? 'Edit user' : 'Add a user'}
                description={editing ? 'Role, department, clearance and status changes take effect on the next request.' : 'The account can sign in immediately with the password you set.'}
                footer={(
                    <>
                        <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button type="submit" form="user-form" loading={saving}>{editing ? 'Save changes' : 'Create user'}</Button>
                    </>
                )}
            >
                <form id="user-form" onSubmit={submit} className="space-y-4" noValidate>
                    <Input label="Full name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                    {!editing ? (
                        <>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Input label="Email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                                <Input label="Username" required value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
                            </div>
                            <Input
                                label="Initial password"
                                type="password"
                                required
                                value={form.password}
                                onChange={(event) => setForm({ ...form, password: event.target.value })}
                                hint="At least 10 characters with upper case, lower case and a digit. The user should change it after first sign-in."
                            />
                        </>
                    ) : null}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Select label="Role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} options={ROLES} />
                        <Select label="Department" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} options={(departments.data || []).map((item) => item.name)} />
                        <Select label="Clearance" value={form.clearance} onChange={(event) => setForm({ ...form, clearance: event.target.value })} options={CLEARANCE_LEVELS} />
                        {editing ? (
                            <Select
                                label="Status"
                                value={form.status}
                                onChange={(event) => setForm({ ...form, status: event.target.value })}
                                options={['active', 'disabled', 'suspended']}
                            />
                        ) : null}
                    </div>
                    <Checkbox
                        label="Require multi-factor authentication"
                        checked={Boolean(form.mfaEnabled)}
                        onChange={(event) => setForm({ ...form, mfaEnabled: event.target.checked })}
                    />
                    <InlineError message={formError} />
                </form>
            </Modal>
        </div>
    );
}
