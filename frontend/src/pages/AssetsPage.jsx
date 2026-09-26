import { useMemo, useState } from 'react';
import { Box, Download, Filter, Plus, Search, Wrench } from 'lucide-react';
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
import { api, apiErrorMessage, unwrap } from '../lib/apiClient.js';
import { downloadCsv, timestampedName } from '../lib/csv.js';
import { formatDateTime } from '../lib/format.js';

const ASSET_TRANSITIONS = {
    Available: ['Assigned', 'Maintenance', 'Retired'],
    Registered: ['Available', 'Assigned', 'Maintenance', 'Retired'],
    Assigned: ['Available', 'Maintenance', 'Retired'],
    'Active / In Use': ['Available', 'Maintenance', 'Retired'],
    Maintenance: ['Available', 'Assigned', 'Retired'],
    Retired: ['Disposed'],
    Disposed: [],
};

const CATEGORIES = ['Vehicles', 'Computers', 'Weapons', 'Communications', 'Field Equipment', 'Forensic Equipment', 'Other'];

const EMPTY_FORM = { name: '', category: CATEGORIES[0], serial: '', department: '', location: '', condition: 'Operational' };

export default function AssetsPage() {
    const { user } = useAuth();
    const toast = useToast();
    useDocumentTitle('Assets');

    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);
    const [busy, setBusy] = useState('');

    const assets = useResource(() => api.get('/assets').then(unwrap), []);

    const list = assets.data || [];
    const canManage = ['Administrator', 'Supervisor'].includes(user?.role);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return list.filter((item) => {
            const matchesTerm = !term || [item.id, item.name, item.serial, item.department, item.assignedOfficer]
                .some((value) => String(value || '').toLowerCase().includes(term));
            return matchesTerm && (!status || item.status === status);
        });
    }, [list, search, status]);

    const create = async (event) => {
        event.preventDefault();
        setFormError('');
        setSaving(true);
        try {
            await api.post('/assets', {
                name: form.name.trim(),
                category: form.category,
                serial: form.serial.trim(),
                department: form.department.trim(),
                location: form.location.trim(),
                condition: form.condition,
            });
            toast.success('Asset registered.');
            setForm(EMPTY_FORM);
            setCreateOpen(false);
            assets.reload();
        } catch (error) {
            setFormError(apiErrorMessage(error, 'The asset could not be registered.'));
        } finally {
            setSaving(false);
        }
    };

    const act = async (asset, path, payload, message) => {
        setBusy(asset.id);
        try {
            await api.patch(`/assets/${encodeURIComponent(asset.id)}/${path}`, payload);
            toast.success(message);
            assets.reload();
        } catch (error) {
            toast.error(apiErrorMessage(error));
        } finally {
            setBusy('');
        }
    };

    const columns = [
        {
            key: 'name',
            header: 'Asset',
            primary: true,
            render: (row) => (
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900 dark:text-ink-50">{row.name}</p>
                    <p className="truncate text-xs text-ink-500 dark:text-ink-400">{row.id} · {row.serial}</p>
                </div>
            ),
        },
        { key: 'category', header: 'Category', render: (row) => <span className="text-xs">{row.category}</span> },
        { key: 'department', header: 'Department', render: (row) => <span className="text-xs">{row.department}</span> },
        { key: 'assignedOfficer', header: 'Assigned to', render: (row) => <span className="text-xs">{row.assignedOfficer || 'Unassigned'}</span> },
        { key: 'location', header: 'Location', render: (row) => <span className="text-xs">{row.location}</span> },
        { key: 'condition', header: 'Condition', render: (row) => <Badge value={row.condition} /> },
        { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> },
        ...(canManage ? [{
            key: 'actions',
            header: 'Actions',
            render: (row) => (
                <div className="flex flex-wrap gap-1.5">
                    {row.status === 'Available' ? (
                        <Button variant="ghost" size="sm" loading={busy === row.id} onClick={() => act(row, 'assign', { assignedOfficer: user?.name, location: row.location }, `${row.name} assigned to you.`)}>Assign to me</Button>
                    ) : null}
                    {['Assigned', 'Active / In Use'].includes(row.status) ? (
                        <Button variant="ghost" size="sm" loading={busy === row.id} onClick={() => act(row, 'return', { location: row.location, condition: row.condition }, `${row.name} returned.`)}>Return</Button>
                    ) : null}
                    {(ASSET_TRANSITIONS[row.status] || []).filter((next) => !['Assigned', 'Available'].includes(next)).map((next) => (
                        <Button
                            key={next}
                            variant="ghost"
                            size="sm"
                            icon={next === 'Maintenance' ? Wrench : undefined}
                            loading={busy === row.id}
                            onClick={() => act(row, 'status', { status: next, reason: `Moved to ${next} from the assets workspace.` }, `${row.name} is now ${next}.`)}
                        >
                            {next}
                        </Button>
                    ))}
                </div>
            ),
        }] : []),
    ];

    return (
        <div className="space-y-5">
            <PageHeader
                title="Assets"
                description="Physical and technical assets with an enforced lifecycle. Status changes require a reason and are recorded in the audit trail."
                actions={(
                    <>
                        <Button variant="secondary" icon={Download} onClick={() => downloadCsv(timestampedName('casevault-assets'), filtered, ['id', 'name', 'category', 'serial', 'department', 'assignedOfficer', 'location', 'condition', 'status'])} disabled={!filtered.length}>
                            Export CSV
                        </Button>
                        {canManage ? <Button icon={Plus} onClick={() => { setForm(EMPTY_FORM); setFormError(''); setCreateOpen(true); }}>Register asset</Button> : null}
                    </>
                )}
            />

            <Card>
                <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="relative xl:col-span-3">
                        <label htmlFor="asset-search" className="sr-only">Search assets</label>
                        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                        <input
                            id="asset-search"
                            type="search"
                            className="cv-input pl-9"
                            placeholder="Search asset name, serial, department…"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>
                    <Select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)} placeholder="All statuses" options={[...new Set(list.map((item) => item.status).filter(Boolean))]} />
                </CardBody>
            </Card>

            <Card>
                <CardBody className="space-y-2">
                    <p className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
                        <Filter size={12} aria-hidden="true" />
                        {filtered.length} of {list.length} assets
                    </p>
                    <div className="px-0 sm:px-1">
                        {assets.loading && !assets.data ? <SkeletonTable rows={6} columns={5} />
                            : assets.error ? <ErrorState message={apiErrorMessage(assets.error)} onRetry={assets.reload} />
                                : (
                                    <DataTable
                                        columns={columns}
                                        rows={filtered}
                                        mobileTitle="Asset"
                                        emptyIcon={Box}
                                        emptyTitle={list.length ? 'No assets match these filters' : 'No assets registered'}
                                    />
                                )}
                    </div>
                </CardBody>
            </Card>

            <Modal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                title="Register an asset"
                description="Serial numbers must be unique across the deployment."
                footer={(
                    <>
                        <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button type="submit" form="asset-form" loading={saving}>Register asset</Button>
                    </>
                )}
            >
                <form id="asset-form" onSubmit={create} className="space-y-4" noValidate>
                    <Input label="Asset name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Forensic Laptop-03" />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Select label="Category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} options={CATEGORIES} />
                        <Input label="Serial" required value={form.serial} onChange={(event) => setForm({ ...form, serial: event.target.value })} placeholder="LAP-22192" />
                        <Input label="Department" required value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} placeholder="Forensics" />
                        <Input label="Location" required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Lab 1" />
                    </div>
                    <Select label="Condition" value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })} options={['Operational', 'Good', 'Fair', 'Damaged']} />
                    <Textarea label="Notes (optional)" rows={2} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
                    <InlineError message={formError} />
                    <p className="text-xs text-ink-500 dark:text-ink-400">Registered {formatDateTime(new Date().toISOString())}.</p>
                </form>
            </Modal>
        </div>
    );
}
