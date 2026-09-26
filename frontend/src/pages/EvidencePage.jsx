import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Filter, Fingerprint, Search } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import DataTable from '../components/ui/DataTable.jsx';
import { Select } from '../components/ui/Form.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { ErrorState } from '../components/ui/States.jsx';
import { SkeletonTable } from '../components/ui/Skeleton.jsx';
import RegisterEvidenceModal from '../components/evidence/RegisterEvidenceModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle, useResource } from '../hooks/useResource.js';
import { api, apiErrorMessage, unwrap } from '../lib/apiClient.js';
import { EVIDENCE_STATUSES, EVIDENCE_TYPES } from '../lib/capabilities.js';
import { downloadCsv, timestampedName } from '../lib/csv.js';
import { formatDate, formatRelative } from '../lib/format.js';

export default function EvidencePage() {
    const { can } = useAuth();
    useDocumentTitle('Evidence');

    const [search, setSearch] = useState('');
    const [type, setType] = useState('');
    const [status, setStatus] = useState('');
    const [caseId, setCaseId] = useState('');
    const [registerOpen, setRegisterOpen] = useState(false);

    const evidence = useResource(() => api.get('/evidence').then(unwrap), []);
    const cases = useResource(() => api.get('/cases').then(unwrap), []);

    const list = evidence.data || [];

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return list.filter((item) => {
            const matchesTerm = !term || [item.id, item.caseNumber, item.type, item.description, item.currentCustodian, item.location]
                .some((value) => String(value || '').toLowerCase().includes(term));
            return matchesTerm
                && (!type || item.type === type)
                && (!status || item.status === status)
                && (!caseId || item.caseId === caseId);
        });
    }, [list, search, type, status, caseId]);

    const exportCsv = () => {
        downloadCsv(timestampedName('casevault-evidence'), filtered, [
            'id', 'caseNumber', 'type', 'description', 'collectedBy', 'collectionDate', 'currentCustodian', 'location', 'status', 'evidenceHash',
        ]);
    };

    const columns = [
        {
            key: 'id',
            header: 'Evidence',
            primary: true,
            render: (row) => (
                <div className="min-w-0">
                    <Link to={`/evidence/${row.id}`} className="cv-link block truncate font-mono text-xs">{row.id}</Link>
                    <p className="truncate text-xs text-ink-500 dark:text-ink-400">{row.description}</p>
                </div>
            ),
        },
        { key: 'caseNumber', header: 'Case', render: (row) => <span className="text-xs">{row.caseNumber || row.caseId}</span> },
        { key: 'type', header: 'Type', render: (row) => <span className="text-xs">{row.type}</span> },
        { key: 'currentCustodian', header: 'Custodian', render: (row) => <span className="text-xs">{row.currentCustodian || 'Unassigned'}</span> },
        { key: 'location', header: 'Location', render: (row) => <span className="text-xs">{row.location}</span> },
        { key: 'collectionDate', header: 'Collected', render: (row) => <span className="text-xs">{formatDate(row.collectionDate)}</span> },
        { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> },
        { key: 'currentVerificationState', header: 'Integrity', render: (row) => <Badge value={row.currentVerificationState} /> },
        { key: 'custodyEventCount', header: 'Custody events', render: (row) => <span className="text-xs">{row.custodyEventCount ?? 0}</span> },
    ];

    return (
        <div className="space-y-5">
            <PageHeader
                title="Evidence"
                description="Registered exhibits with hash-linked chain of custody. Every transfer is signed and permanently recorded."
                actions={(
                    <>
                        <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!filtered.length}>Export CSV</Button>
                        {can('evidence:write') ? <Button icon={Fingerprint} onClick={() => setRegisterOpen(true)}>Register evidence</Button> : null}
                    </>
                )}
            />

            <Card>
                <CardBody className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <div className="relative xl:col-span-2">
                            <label htmlFor="evidence-search" className="sr-only">Search evidence</label>
                            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                            <input
                                id="evidence-search"
                                type="search"
                                className="cv-input pl-9"
                                placeholder="Search ID, description, custodian, location…"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </div>
                        <Select aria-label="Filter by case" value={caseId} onChange={(event) => setCaseId(event.target.value)} placeholder="All cases" options={(cases.data || []).map((item) => ({ value: item.id, label: `${item.caseNumber} — ${item.title}` }))} />
                        <Select aria-label="Filter by type" value={type} onChange={(event) => setType(event.target.value)} placeholder="All types" options={EVIDENCE_TYPES} />
                        <Select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)} placeholder="All statuses" options={EVIDENCE_STATUSES} />
                    </div>
                    <p className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
                        <Filter size={12} aria-hidden="true" />
                        {filtered.length} of {list.length} evidence items
                    </p>
                </CardBody>
            </Card>

            <Card>
                <CardBody className="px-2 sm:px-3">
                    {evidence.loading && !evidence.data ? <SkeletonTable rows={8} columns={5} />
                        : evidence.error ? <ErrorState message={apiErrorMessage(evidence.error)} onRetry={evidence.reload} />
                            : (
                                <DataTable
                                    columns={columns}
                                    rows={filtered}
                                    mobileTitle="Evidence"
                                    emptyIcon={Fingerprint}
                                    emptyTitle={list.length ? 'No evidence matches these filters' : 'No evidence registered'}
                                    emptyDescription={list.length ? 'Adjust or clear the filters to see more results.' : 'Register an exhibit to open a custody chain for it.'}
                                />
                            )}
                </CardBody>
            </Card>

            <p className="text-xs text-ink-500 dark:text-ink-400">
                Last refreshed {formatRelative(new Date().toISOString())}. Records shown are limited to cases your role and clearance authorize.
            </p>

            <RegisterEvidenceModal open={registerOpen} onClose={() => setRegisterOpen(false)} onRegistered={evidence.reload} />
        </div>
    );
}
