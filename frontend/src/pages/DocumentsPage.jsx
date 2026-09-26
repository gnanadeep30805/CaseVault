import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileText, Filter, Search, ShieldCheck, Upload } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import DataTable from '../components/ui/DataTable.jsx';
import { Select } from '../components/ui/Form.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { ErrorState } from '../components/ui/States.jsx';
import { SkeletonTable } from '../components/ui/Skeleton.jsx';
import UploadDocumentModal from '../components/documents/UploadDocumentModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle, useResource } from '../hooks/useResource.js';
import { api, apiErrorMessage, unwrap } from '../lib/apiClient.js';
import { CLASSIFICATIONS, DOCUMENT_CATEGORIES, DOCUMENT_STATUSES } from '../lib/capabilities.js';
import { downloadCsv, timestampedName } from '../lib/csv.js';
import { formatBytes, formatRelative, shortHash } from '../lib/format.js';

export default function DocumentsPage() {
    const { can } = useAuth();
    useDocumentTitle('Documents');

    const [search, setSearch] = useState('');
    const [caseId, setCaseId] = useState('');
    const [category, setCategory] = useState('');
    const [classification, setClassification] = useState('');
    const [status, setStatus] = useState('');
    const [uploadOpen, setUploadOpen] = useState(false);

    const documents = useResource(() => api.get('/documents').then(unwrap), []);
    const cases = useResource(() => api.get('/cases').then(unwrap), []);

    const list = documents.data || [];
    const caseOptions = useMemo(
        () => [...new Set(list.map((item) => item.caseNumber).filter(Boolean))].sort(),
        [list],
    );
    const caseById = useMemo(() => new Map((cases.data || []).map((item) => [item.id, item])), [cases.data]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return list.filter((item) => {
            const matchesTerm = !term || [item.id, item.fileName, item.caseNumber, item.category]
                .some((value) => String(value || '').toLowerCase().includes(term));
            return matchesTerm
                && (!caseId || item.caseId === caseId)
                && (!category || item.category === category)
                && (!classification || item.classification === classification)
                && (!status || item.status === status);
        });
    }, [list, search, caseId, category, classification, status]);

    const exportCsv = () => {
        downloadCsv(timestampedName('casevault-documents'), filtered, [
            'id', 'fileName', 'caseNumber', 'category', 'classification', 'version', 'status', 'integrityStatus', 'size', 'uploadedAt',
        ]);
    };

    const columns = [
        {
            key: 'fileName',
            header: 'Document',
            primary: true,
            render: (row) => (
                <div className="min-w-0">
                    <Link to={`/documents/${row.id}`} className="cv-link block truncate">{row.fileName}</Link>
                    <p className="truncate text-xs text-ink-500 dark:text-ink-400">
                        {row.caseNumber || caseById.get(row.caseId)?.title || 'Unlinked'} · v{row.version}
                    </p>
                </div>
            ),
        },
        { key: 'category', header: 'Category', render: (row) => <span className="text-xs">{row.category}</span> },
        { key: 'classification', header: 'Classification', render: (row) => <Badge value={row.classification} /> },
        { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> },
        {
            key: 'integrityStatus',
            header: 'Integrity',
            render: (row) => (
                <span className="inline-flex items-center gap-1.5" title={row.registeredHash || ''}>
                    <Badge value={row.integrityStatus} />
                    <span className="font-mono text-[0.65rem] text-ink-500 dark:text-ink-400">{shortHash(row.registeredHash, 8)}</span>
                </span>
            ),
        },
        { key: 'size', header: 'Size', render: (row) => <span className="text-xs">{formatBytes(row.size)}</span> },
        { key: 'uploadedAt', header: 'Uploaded', render: (row) => <span className="text-xs">{formatRelative(row.uploadedAt || row.createdAt)}</span> },
    ];

    return (
        <div className="space-y-5">
            <PageHeader
                title="Documents"
                description="Encrypted, hash-registered case files you are authorized to read. Every download and verification is written to the audit trail."
                actions={(
                    <>
                        <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!filtered.length}>Export CSV</Button>
                        {can('document:write') ? <Button icon={Upload} onClick={() => setUploadOpen(true)}>Upload document</Button> : null}
                    </>
                )}
            />

            <Card>
                <CardBody className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <div className="relative xl:col-span-2">
                            <label htmlFor="doc-search" className="sr-only">Search documents</label>
                            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                            <input
                                id="doc-search"
                                type="search"
                                className="cv-input pl-9"
                                placeholder="Search file name, case number, category…"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </div>
                        <Select aria-label="Filter by case" value={caseId} onChange={(event) => setCaseId(event.target.value)} placeholder="All cases" options={(cases.data || []).map((item) => ({ value: item.id, label: `${item.caseNumber} — ${item.title}` }))} />
                        <Select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="All categories" options={DOCUMENT_CATEGORIES} />
                        <div className="grid grid-cols-2 gap-3">
                            <Select aria-label="Filter by classification" value={classification} onChange={(event) => setClassification(event.target.value)} placeholder="All levels" options={CLASSIFICATIONS} />
                            <Select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)} placeholder="All statuses" options={DOCUMENT_STATUSES} />
                        </div>
                    </div>
                    <p className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
                        <Filter size={12} aria-hidden="true" />
                        {filtered.length} of {list.length} documents{caseOptions.length ? ` across ${caseOptions.length} case(s)` : ''}
                    </p>
                </CardBody>
            </Card>

            <Card>
                <CardBody className="px-2 sm:px-3">
                    {documents.loading && !documents.data ? <SkeletonTable rows={8} columns={5} />
                        : documents.error ? <ErrorState message={apiErrorMessage(documents.error)} onRetry={documents.reload} />
                            : (
                                <DataTable
                                    columns={columns}
                                    rows={filtered}
                                    mobileTitle="Document"
                                    emptyIcon={FileText}
                                    emptyTitle={list.length ? 'No documents match these filters' : 'No documents available'}
                                    emptyDescription={list.length ? 'Adjust or clear the filters to see more results.' : 'Upload a document to a case you can access and it will appear here.'}
                                />
                            )}
                </CardBody>
            </Card>

            <Card>
                <CardBody className="flex items-start gap-3 text-xs text-ink-600 dark:text-ink-300">
                    <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" />
                    <p>
                        Stored content is encrypted at rest with AES-256-GCM. Integrity hashes are recomputed server-side on verification, and a mismatch permanently
                        marks the document <span className="font-semibold">COMPROMISED</span> in the audit trail.
                    </p>
                </CardBody>
            </Card>

            <UploadDocumentModal open={uploadOpen} onClose={() => setUploadOpen(false)} onUploaded={documents.reload} />
        </div>
    );
}
