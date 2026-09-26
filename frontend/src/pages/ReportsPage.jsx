import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Download, FileText, Fingerprint, ShieldCheck } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import DataTable from '../components/ui/DataTable.jsx';
import { Card, CardBody, CardHeader, KeyValue, SectionTitle } from '../components/ui/Card.jsx';
import { ErrorState } from '../components/ui/States.jsx';
import { SkeletonChart, SkeletonText } from '../components/ui/Skeleton.jsx';
import { BarList } from '../components/charts/ChartKit.jsx';
import { useDocumentTitle, useResource } from '../hooks/useResource.js';
import { api, apiErrorMessage, unwrap } from '../lib/apiClient.js';
import { downloadCsv, timestampedName } from '../lib/csv.js';
import { formatDateTime, toChartData } from '../lib/format.js';

const REPORT_TYPES = [
    { key: 'summary', label: 'Executive summary', icon: BarChart3 },
    { key: 'cases', label: 'Case portfolio', icon: FileText },
    { key: 'documents', label: 'Document register', icon: FileText },
    { key: 'evidence', label: 'Evidence register', icon: Fingerprint },
    { key: 'tasks', label: 'Task register', icon: BarChart3 },
    { key: 'integrity', label: 'Integrity report', icon: ShieldCheck },
];

export default function ReportsPage() {
    useDocumentTitle('Reports');
    const [type, setType] = useState('summary');
    const report = useResource(() => api.get(`/reports/${type}`).then(unwrap), [type]);
    const data = report.data;

    const exportReport = () => {
        const rows = Array.isArray(data?.items) ? data.items : [];
        if (rows.length) {
            downloadCsv(timestampedName(`casevault-report-${type}`), rows);
            return;
        }
        const flat = Object.fromEntries(
            Object.entries(data || {})
                .filter(([, value]) => value === null || ['string', 'number', 'boolean'].includes(typeof value))
                .map(([key, value]) => [key, value]),
        );
        downloadCsv(timestampedName(`casevault-report-${type}`), [flat]);
    };

    return (
        <div className="space-y-5">
            <PageHeader
                title="Reports"
                description="Operational reporting generated from the records your role is authorized to read. Exports contain the same filtered scope as the report on screen."
                actions={<Button variant="secondary" icon={Download} onClick={exportReport} disabled={!data}>Export CSV</Button>}
            />

            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Report type">
                {REPORT_TYPES.map((item) => {
                    const Icon = item.icon;
                    const active = type === item.key;
                    return (
                        <button
                            key={item.key}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setType(item.key)}
                            className={active
                                ? 'cv-btn cv-btn-primary'
                                : 'cv-btn cv-btn-secondary'}
                        >
                            <Icon size={14} aria-hidden="true" />
                            {item.label}
                        </button>
                    );
                })}
            </div>

            {report.loading && !data ? (
                <Card><CardBody className="space-y-4"><SkeletonChart /><SkeletonText lines={4} /></CardBody></Card>
            ) : report.error ? (
                <Card><CardBody><ErrorState message={apiErrorMessage(report.error)} onRetry={report.reload} /></CardBody></Card>
            ) : data ? (
                <div className="space-y-4">
                    {type === 'summary' ? (
                        <>
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                {[
                                    { label: 'Cases', value: data.totalCases },
                                    { label: 'Documents', value: data.totalDocuments },
                                    { label: 'Evidence', value: data.totalEvidence },
                                    { label: 'Tasks', value: data.totalTasks },
                                ].map((stat) => (
                                    <Card key={stat.label}>
                                        <CardBody>
                                            <p className="text-[0.68rem] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">{stat.label}</p>
                                            <p className="mt-1 text-2xl font-bold text-ink-900 dark:text-ink-50">{stat.value ?? 0}</p>
                                        </CardBody>
                                    </Card>
                                ))}
                            </div>
                            <div className="grid gap-4 lg:grid-cols-2">
                                <Card>
                                    <CardHeader title="Cases by status" icon={BarChart3} />
                                    <CardBody>
                                        <BarList data={toChartData(data.caseStatus)} emptyLabel="No case data available." />
                                    </CardBody>
                                </Card>
                                <Card>
                                    <CardHeader title="Documents by status" icon={FileText} />
                                    <CardBody>
                                        <BarList data={toChartData(data.documentStatus)} emptyLabel="No document data available." />
                                    </CardBody>
                                </Card>
                            </div>
                        </>
                    ) : null}

                    {type === 'integrity' ? (
                        <Card>
                            <CardHeader title="Integrity report" icon={ShieldCheck} description="Hash-chain verification across documents, evidence custody and the audit log." />
                            <CardBody className="space-y-4">
                                <KeyValue
                                    columns={2}
                                    items={[
                                        { label: 'Algorithm', value: data.algorithm },
                                        { label: 'Audit chain', value: <Badge value={data.auditChain?.valid ? 'Verified' : 'Broken'} /> },
                                        { label: 'Custody chain', value: <Badge value={data.custodyChain?.valid ? 'Verified' : 'Broken'} /> },
                                        { label: 'Documents verified', value: data.documents?.verified ?? 0 },
                                        { label: 'Documents compromised', value: <Badge value={String(data.documents?.compromised ?? 0)} tone={data.documents?.compromised ? 'danger' : 'success'} /> },
                                    ]}
                                />
                                {data.auditChain && !data.auditChain.valid ? (
                                    <p className="text-sm font-semibold text-danger">Audit chain failure: {data.auditChain.reason}</p>
                                ) : null}
                                {data.custodyChain && !data.custodyChain.valid ? (
                                    <p className="text-sm font-semibold text-danger">Custody chain failure: {data.custodyChain.reason}</p>
                                ) : null}
                                <p className="text-xs text-ink-500 dark:text-ink-400">Investigate any broken chain in the Security workspace before relying on this report.</p>
                            </CardBody>
                        </Card>
                    ) : null}

                    {type !== 'summary' && type !== 'integrity' ? (
                        <Card>
                            <CardHeader
                                title={`${REPORT_TYPES.find((item) => item.key === type)?.label} (${data.total ?? 0} record(s))`}
                                icon={FileText}
                            />
                            <CardBody className="space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {Object.entries(data)
                                        .filter(([key, value]) => key !== 'items' && value && typeof value === 'object' && !Array.isArray(value))
                                        .map(([key, value]) => (
                                            <div key={key}>
                                                <SectionTitle>{key.replace(/^by/, 'By ')}</SectionTitle>
                                                <div className="mt-1.5">
                                                    <BarList data={toChartData(value)} emptyLabel="No data." />
                                                </div>
                                            </div>
                                        ))}
                                </div>
                                <div className="px-0 sm:px-1">
                                    <DataTable
                                        columns={reportColumns(type)}
                                        rows={data.items || []}
                                        emptyTitle="No records in scope"
                                        emptyDescription="You may not have access to any records in this category."
                                    />
                                </div>
                            </CardBody>
                        </Card>
                    ) : null}

                    <p className="text-xs text-ink-500 dark:text-ink-400">
                        {data.generatedAt ? `Generated ${formatDateTime(data.generatedAt)}` : `Generated ${formatDateTime(new Date().toISOString())}`} · scope limited to your authorization.
                    </p>
                </div>
            ) : null}

            <Card>
                <CardBody className="text-xs text-ink-600 dark:text-ink-300">
                    Reports aggregate live records. For a defensible evidentiary record, export the underlying <Link to="/audit" className="cv-link">audit log</Link> as JSON, which includes the hash chain.
                </CardBody>
            </Card>
        </div>
    );
}

function reportColumns(type) {
    if (type === 'cases') {
        return [
            { key: 'caseNumber', header: 'Case', primary: true, render: (row) => <Link to={`/cases/${row.id}`} className="cv-link">{row.caseNumber}</Link> },
            { key: 'title', header: 'Title' },
            { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> },
            { key: 'priority', header: 'Priority', render: (row) => <Badge value={row.priority} /> },
            { key: 'department', header: 'Department' },
        ];
    }
    if (type === 'documents') {
        return [
            { key: 'fileName', header: 'Document', primary: true, render: (row) => <Link to={`/documents/${row.id}`} className="cv-link">{row.fileName}</Link> },
            { key: 'caseNumber', header: 'Case' },
            { key: 'version', header: 'Version' },
            { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> },
            { key: 'integrityStatus', header: 'Integrity', render: (row) => <Badge value={row.integrityStatus} /> },
        ];
    }
    if (type === 'evidence') {
        return [
            { key: 'id', header: 'Evidence', primary: true, render: (row) => <Link to={`/evidence/${row.id}`} className="cv-link font-mono text-xs">{row.id}</Link> },
            { key: 'caseNumber', header: 'Case' },
            { key: 'type', header: 'Type' },
            { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> },
            { key: 'currentCustodian', header: 'Custodian' },
        ];
    }
    return [
        { key: 'title', header: 'Task', primary: true },
        { key: 'caseId', header: 'Case', render: (row) => <Link to={`/cases/${row.caseId}`} className="cv-link">{row.caseId}</Link> },
        { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> },
        { key: 'priority', header: 'Priority', render: (row) => <Badge value={row.priority} /> },
    ];
}
