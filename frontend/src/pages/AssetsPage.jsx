import { useMemo, useState } from 'react';
import { ArrowRightLeft, Box, Download, Filter, Plus, Search, Wrench } from 'lucide-react';
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
import { formatDate, formatDateTime, statusTone } from '../lib/format.js';

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

const EMPTY_FORM = { name: '', category: CATEGORIES[0], serial: '', department: '', location: '', condition: 'Operational', purchaseDate: '', vendor: '', purchaseCost: '', warrantyExpiry: '', notes: '' };

const LIFECYCLE_STAGES = ['Purchased', 'Registered', 'Assigned', 'Maintenance', 'Transferred', 'Retired', 'Disposed'];

const ASSET_EVENT_LABELS = {
    ASSET_PURCHASED: 'Purchased',
    ASSET_REGISTERED: 'Registered',
    ASSET_ASSIGNED: 'Assigned to officer',
    ASSET_RETURNED: 'Returned',
    ASSET_TRANSFERRED: 'Transferred',
    ASSET_STATUS_CHANGED: 'Status changed',
    MAINTENANCE_SCHEDULED: 'Maintenance scheduled',
    MAINTENANCE_COMPLETED: 'Maintenance completed',
};

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
    const [selected, setSelected] = useState(null);
    const [transferOpen, setTransferOpen] = useState(false);
    const [transferForm, setTransferForm] = useState({ department: '', location: '', reason: '' });
    const [maintenanceOpen, setMaintenanceOpen] = useState(false);
    const [maintenanceForm, setMaintenanceForm] = useState({ scheduledDate: '', vendor: '', notes: '', estimatedCost: '' });
    const [lifecycleError, setLifecycleError] = useState('');

    const assets = useResource(() => api.get('/assets').then(unwrap), []);
    const assetId = selected?.id || null;
    const history = useResource(() => api.get(`/assets/${encodeURIComponent(assetId)}/history`).then(unwrap), [assetId], { enabled: Boolean(assetId) });
    const maintenance = useResource(() => api.get(`/assets/${encodeURIComponent(assetId)}/maintenance`).then(unwrap), [assetId], { enabled: Boolean(assetId) });

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
                purchaseDate: form.purchaseDate || null,
                vendor: form.vendor.trim() || null,
                purchaseCost: form.purchaseCost === '' ? null : Number(form.purchaseCost),
                warrantyExpiry: form.warrantyExpiry || null,
                notes: form.notes.trim() || null,
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
            const updated = await api.patch(`/assets/${encodeURIComponent(asset.id)}/${path}`, payload);
            toast.success(message);
            assets.reload();
            if (selected?.id === asset.id) {
                setSelected(updated?.data ? { ...asset, ...updated.data } : asset);
                history.reload();
                maintenance.reload();
            }
            return updated;
        } catch (error) {
            toast.error(apiErrorMessage(error));
            return null;
        } finally {
            setBusy('');
        }
    };

    const openDetail = (asset) => {
        setSelected(asset);
        setLifecycleError('');
    };

    const openTransfer = (asset) => {
        setTransferForm({ department: asset.department || '', location: asset.location || '', reason: '' });
        setLifecycleError('');
        setTransferOpen(true);
    };

    const submitTransfer = async (event) => {
        event.preventDefault();
        setLifecycleError('');
        const asset = selected;
        setBusy(asset.id);
        try {
            const updated = await api.patch(`/assets/${encodeURIComponent(asset.id)}/transfer`, {
                department: transferForm.department.trim(),
                location: transferForm.location.trim(),
                reason: transferForm.reason.trim(),
            });
            toast.success(`${asset.name} transferred to ${transferForm.department.trim()}.`);
            setTransferOpen(false);
            assets.reload();
            setSelected({ ...asset, ...(updated.data || {}) });
            history.reload();
        } catch (error) {
            setLifecycleError(apiErrorMessage(error, 'The transfer could not be recorded.'));
        } finally {
            setBusy('');
        }
    };

    const submitMaintenance = async (event) => {
        event.preventDefault();
        setLifecycleError('');
        const asset = selected;
        setBusy(asset.id);
        try {
            await api.post(`/assets/${encodeURIComponent(asset.id)}/maintenance`, {
                scheduledDate: maintenanceForm.scheduledDate,
                vendor: maintenanceForm.vendor.trim(),
                notes: maintenanceForm.notes.trim(),
                estimatedCost: maintenanceForm.estimatedCost === '' ? 0 : Number(maintenanceForm.estimatedCost),
            });
            toast.success('Maintenance scheduled.');
            setMaintenanceOpen(false);
            setMaintenanceForm({ scheduledDate: '', vendor: '', notes: '', estimatedCost: '' });
            assets.reload();
            maintenance.reload();
            history.reload();
        } catch (error) {
            setLifecycleError(apiErrorMessage(error, 'Maintenance could not be scheduled.'));
        } finally {
            setBusy('');
        }
    };

    const completeMaintenance = async (asset) => {
        setBusy(asset.id);
        try {
            await api.patch(`/assets/${encodeURIComponent(asset.id)}/maintenance/complete`, { condition: 'Operational' });
            toast.success('Maintenance completed; the asset is available again.');
            assets.reload();
            maintenance.reload();
            history.reload();
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
                <button type="button" onClick={() => openDetail(row)} className="block min-w-0 w-full text-left">
                    <p className="truncate text-sm font-semibold text-ink-900 dark:text-ink-50">{row.name}</p>
                    <p className="truncate text-xs text-ink-500 dark:text-ink-400">{row.id} · {row.serial}</p>
                </button>
            ),
        },
        { key: 'category', header: 'Category', render: (row) => <span className="text-xs">{row.category}</span> },
        { key: 'department', header: 'Department', render: (row) => <span className="text-xs">{row.department}</span> },
        { key: 'assignedOfficer', header: 'Assigned to', render: (row) => <span className="text-xs">{row.assignedOfficer || 'Unassigned'}</span> },
        { key: 'location', header: 'Location', render: (row) => <span className="text-xs">{row.location}</span> },
        { key: 'condition', header: 'Condition', render: (row) => <Badge value={row.condition} /> },
        { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> },
        {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
                <div className="flex flex-wrap gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => openDetail(row)}>Lifecycle</Button>
                    {canManage ? [
                        ...(row.status === 'Available' ? [
                            <Button key="assign" variant="ghost" size="sm" loading={busy === row.id} onClick={() => act(row, 'assign', { assignedOfficer: user?.name, location: row.location }, `${row.name} assigned to you.`)}>Assign to me</Button>,
                        ] : []),
                        ...(row.status !== 'Disposed' ? [
                            <Button key="transfer" variant="ghost" size="sm" icon={ArrowRightLeft} onClick={() => openTransfer(row)}>Transfer</Button>,
                        ] : []),
                        ...(['Assigned', 'Active / In Use'].includes(row.status) ? [
                            <Button key="return" variant="ghost" size="sm" loading={busy === row.id} onClick={() => act(row, 'return', { location: row.location, condition: row.condition }, `${row.name} returned.`)}>Return</Button>,
                        ] : []),
                        ...(ASSET_TRANSITIONS[row.status] || []).filter((next) => !['Assigned', 'Available', 'Maintenance'].includes(next)).map((next) => (
                            <Button
                                key={next}
                                variant="ghost"
                                size="sm"
                                loading={busy === row.id}
                                onClick={() => act(row, 'status', { status: next, reason: `Moved to ${next} from the assets workspace.` }, `${row.name} is now ${next}.`)}
                            >
                                {next}
                            </Button>
                        )),
                    ] : []}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-5">
            <PageHeader
                title="Assets"
                description="Physical and technical assets with an enforced lifecycle. Status changes require a reason and are recorded in the audit trail."
                actions={(
                    <>
                        <Button variant="secondary" icon={Download} onClick={() => downloadCsv(timestampedName('casevault-assets'), filtered, ['id', 'name', 'category', 'serial', 'department', 'assignedOfficer', 'location', 'condition', 'status', 'purchaseDate', 'vendor', 'purchaseCost', 'warrantyExpiry'])} disabled={!filtered.length}>
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
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">Acquisition</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Purchase date" type="date" value={form.purchaseDate} onChange={(event) => setForm({ ...form, purchaseDate: event.target.value })} />
                        <Input label="Vendor / supplier" value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })} placeholder="Meridian Motors" />
                        <Input label="Purchase cost" type="number" min="0" value={form.purchaseCost} onChange={(event) => setForm({ ...form, purchaseCost: event.target.value })} placeholder="4800000" />
                        <Input label="Warranty expiry" type="date" value={form.warrantyExpiry} onChange={(event) => setForm({ ...form, warrantyExpiry: event.target.value })} />
                    </div>
                    <Textarea label="Notes (optional)" rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
                    <InlineError message={formError} />
                    <p className="text-xs text-ink-500 dark:text-ink-400">Registered {formatDateTime(new Date().toISOString())}.</p>
                </form>
            </Modal>

            <Modal
                open={Boolean(selected)}
                onClose={() => setSelected(null)}
                title={selected ? `${selected.name} · lifecycle` : ''}
                description="Purchase, assignment, maintenance, transfer and disposal history for this asset. Every step is written to the audit trail."
                size="lg"
                footer={(
                    <>
                        <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
                        {canManage && selected && selected.status !== 'Disposed' ? (
                            <>
                                <Button variant="secondary" icon={ArrowRightLeft} onClick={() => openTransfer(selected)}>Transfer</Button>
                                <Button
                                    icon={Wrench}
                                    loading={busy === selected.id}
                                    onClick={() => (selected.status === 'Maintenance' ? completeMaintenance(selected) : (setLifecycleError(''), setMaintenanceOpen(true)))}
                                    title={selected.status === 'Maintenance' ? 'Complete the active maintenance record' : 'Schedule maintenance for this asset'}
                                >
                                    {selected.status === 'Maintenance' ? 'Complete maintenance' : 'Schedule maintenance'}
                                </Button>
                            </>
                        ) : null}
                    </>
                )}
            >
                {selected ? (
                    <div className="space-y-5">
                        <div className="flex flex-wrap gap-1.5">
                            {LIFECYCLE_STAGES.map((stage) => {
                                const reached = (history.data || []).some((item) => ASSET_EVENT_LABELS[item.action] === stage || item.action === `ASSET_${stage.toUpperCase()}`);
                                return (
                                    <span key={stage} className={`rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider ${reached ? 'bg-success/15 text-success' : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400'}`}>
                                        {stage}
                                    </span>
                                );
                            })}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {[
                                ['Asset ID', selected.id],
                                ['Serial', selected.serial],
                                ['Category', selected.category],
                                ['Status', <Badge key="s" value={selected.status} tone={statusTone(selected.status)} />],
                                ['Condition', selected.condition],
                                ['Department', selected.department],
                                ['Location', selected.location],
                                ['Assigned officer', selected.assignedOfficer || 'Unassigned'],
                                ['Purchased', selected.purchaseDate ? formatDate(selected.purchaseDate) : 'Not recorded'],
                                ['Vendor', selected.vendor || 'Not recorded'],
                                ['Purchase cost', selected.purchaseCost == null ? 'Not recorded' : `₹${Number(selected.purchaseCost).toLocaleString('en-IN')}`],
                                ['Warranty expiry', selected.warrantyExpiry ? formatDate(selected.warrantyExpiry) : 'Not recorded'],
                            ].map(([label, value]) => (
                                <div key={label} className="rounded-lg border border-ink-200/70 p-2.5 dark:border-ink-700/70">
                                    <p className="text-[0.62rem] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">{label}</p>
                                    <div className="mt-0.5 text-sm font-medium text-ink-800 dark:text-ink-100">{value}</div>
                                </div>
                            ))}
                        </div>

                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">Maintenance records</p>
                            {(maintenance.data || []).length ? (
                                <ul className="space-y-2">
                                    {maintenance.data.map((record) => (
                                        <li key={record.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-200/70 p-3 dark:border-ink-700/70">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">{record.vendor}</p>
                                                <p className="text-xs text-ink-500 dark:text-ink-400">
                                                    {formatDate(record.scheduledDate)} · est. {record.actualCost ?? record.estimatedCost ?? 0}
                                                    {record.notes ? ` · ${record.notes}` : ''}
                                                </p>
                                            </div>
                                            <Badge value={record.status} />
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="rounded-lg border border-dashed border-ink-300 p-3 text-xs text-ink-500 dark:border-ink-700 dark:text-ink-400">No maintenance has been recorded for this asset.</p>
                            )}
                        </div>

                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">Lifecycle history</p>
                            {history.loading ? <p className="text-xs text-ink-500">Loading history…</p>
                                : history.error ? <InlineError message={history.errorMessage} />
                                    : (history.data || []).length ? (
                                        <ol className="space-y-2">
                                            {(history.data || []).map((event) => (
                                                <li key={event.eventId} className="rounded-lg border border-ink-200/70 p-3 dark:border-ink-700/70">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">{ASSET_EVENT_LABELS[event.action] || event.action}</p>
                                                        <p className="text-xs text-ink-500 dark:text-ink-400">{formatDateTime(event.timestamp)}</p>
                                                    </div>
                                                    <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
                                                        {event.fromStatus !== event.toStatus ? `${event.fromStatus} → ${event.toStatus} · ` : ''}
                                                        {event.metadata?.reason || event.metadata?.assignedOfficer || event.metadata?.vendor || ''}
                                                        {event.metadata?.fromDepartment ? ` · ${event.metadata.fromDepartment} → ${event.metadata.toDepartment}` : ''}
                                                    </p>
                                                </li>
                                            ))}
                                        </ol>
                                    ) : (
                                        <p className="rounded-lg border border-dashed border-ink-300 p-3 text-xs text-ink-500 dark:border-ink-700 dark:text-ink-400">No lifecycle events recorded yet.</p>
                                    )}
                        </div>
                    </div>
                ) : null}
            </Modal>

            <Modal
                open={transferOpen}
                onClose={() => setTransferOpen(false)}
                title="Transfer asset"
                description="Move an asset to another station, unit, or department. The previous and new custodian are both recorded."
                footer={(
                    <>
                        <Button variant="secondary" onClick={() => setTransferOpen(false)}>Cancel</Button>
                        <Button type="submit" form="asset-transfer-form" loading={Boolean(selected) && busy === selected.id}>Record transfer</Button>
                    </>
                )}
            >
                <form id="asset-transfer-form" onSubmit={submitTransfer} className="space-y-4" noValidate>
                    <Input label="New department / station" required value={transferForm.department} onChange={(event) => setTransferForm({ ...transferForm, department: event.target.value })} placeholder="Traffic" />
                    <Input label="New location" required value={transferForm.location} onChange={(event) => setTransferForm({ ...transferForm, location: event.target.value })} placeholder="Highway Patrol Station" />
                    <Textarea label="Reason for transfer" required rows={2} value={transferForm.reason} onChange={(event) => setTransferForm({ ...transferForm, reason: event.target.value })} placeholder="Rebalanced to the highway unit" />
                    <InlineError message={lifecycleError} />
                </form>
            </Modal>

            <Modal
                open={maintenanceOpen}
                onClose={() => setMaintenanceOpen(false)}
                title="Schedule maintenance"
                description="The asset moves into Maintenance and its assigned officer is cleared until the work is completed."
                footer={(
                    <>
                        <Button variant="secondary" onClick={() => setMaintenanceOpen(false)}>Cancel</Button>
                        <Button type="submit" form="asset-maintenance-form" loading={Boolean(selected) && busy === selected.id}>Schedule</Button>
                    </>
                )}
            >
                <form id="asset-maintenance-form" onSubmit={submitMaintenance} className="space-y-4" noValidate>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Scheduled date" type="date" required value={maintenanceForm.scheduledDate} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, scheduledDate: event.target.value })} />
                        <Input label="Vendor" required value={maintenanceForm.vendor} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, vendor: event.target.value })} placeholder="SafeVision Services" />
                    </div>
                    <Input label="Estimated cost" type="number" min="0" value={maintenanceForm.estimatedCost} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, estimatedCost: event.target.value })} placeholder="4200" />
                    <Textarea label="Work description" rows={2} value={maintenanceForm.notes} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, notes: event.target.value })} placeholder="Lens calibration and firmware update" />
                    <InlineError message={lifecycleError} />
                </form>
            </Modal>
        </div>
    );
}
