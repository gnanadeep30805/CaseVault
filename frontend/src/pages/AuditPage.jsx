import { useMemo, useState } from 'react';
import { Download, Filter, ScrollText, ShieldCheck } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import DataTable from '../components/ui/DataTable.jsx';
import { Select } from '../components/ui/Form.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { ErrorState } from '../components/ui/States.jsx';
import { SkeletonTable } from '../components/ui/Skeleton.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle, useResource } from '../hooks/useResource.js';
import { api, apiErrorMessage, unwrap } from '../lib/apiClient.js';
import { AUDIT_RESOURCES } from '../lib/capabilities.js';
import { downloadBlob, downloadCsv, timestampedName } from '../lib/csv.js';
import { formatDateTime, severityFromAction, severityTone } from '../lib/format.js';

export default function AuditPage() {
    const toast = useToast();
    useDocumentTitle('Audit log');

    const [action, setAction] = useState('');
    const [resource, setResource] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [limit, setLimit] = useState('200');
    const [verifying, setVerifying] = useState(false);
    const [chain, setChain] = useState(null);

    const query = useMemo(() => {
        const params = { limit };
        if (action) params.action = action;
        if (resource) params.resource = resource;
        if (from) params.from = new Date(`${from}T00:00:00`).toISOString();
        if (to) params.to = new Date(`${to}T23:59:59`).toISOString();
        return params;
    }, [action, resource, from, to, limit]);

    const logs = useResource(() => api.get('/audit', { params: query }).then(unwrap), [JSON.stringify(query)]);
    const actions = useResource(() => api.get('/audit/actions').then(unwrap), []);

    const list = logs.data || [];

    const verifyChain = async () => {
        setVerifying(true);
        try {
            const result = await api.get('/audit/verify-chain').then(unwrap);
            setChain(result);
            if (result.valid) toast.success('Audit hash chain verified.');
            else toast.error(`Audit chain verification failed: ${result.reason || 'unknown reason'}`);
        } catch (error) {
            toast.error(apiErrorMessage(error, 'The audit chain could not be verified.'));
        } finally {
            setVerifying(false);
        }
    };

    const exportJson = async () => {
        try {
            const response = await api.get('/audit/export', { responseType: 'blob' });
            downloadBlob(response.data, timestampedName('casevault-audit', 'json'));
        } catch (error) {
            toast.error(apiErrorMessage(error, 'The audit export failed.'));
        }
    };

    const columns = [
        {
            key: 'timestamp',
            header: 'Timestamp',
            primary: true,
            render: (row) => <span className="whitespace-nowrap text-xs">{formatDateTime(row.timestamp)}</span>,
        },
        { key: 'action', header: 'Action', render: (row) => <Badge value={row.action} tone={severityTone(severityFromAction(row.action))} label={row.action} /> },
        { key: 'actor', header: 'Actor', render: (row) => <span className="text-xs">{row.actor}</span> },
        { key: 'resource', header: 'Resource', render: (row) => <span className="text-xs">{row.resource}</span> },
        { key: 'resourceId', header: 'Resource ID', render: (row) => <span className="font-mono text-[0.65rem] text-ink-500 dark:text-ink-400">{row.resourceId || '—'}</span> },
        { key: 'currentHash', header: 'Chain hash', render: (row) => <span className="font-mono text-[0.65rem] text-ink-500 dark:text-ink-400">{row.currentHash?.slice(0, 16) || '—'}…</span> },
    ];

    return (
        <div className="space-y-5">
            <PageHeader
                title="Audit log"
                description="Every state change is appended to a hash-chained log. Altering or removing an event breaks verification permanently."
                actions={(
                    <>
                        <Button variant="secondary" icon={ShieldCheck} loading={verifying} onClick={verifyChain}>Verify chain</Button>
                        <Button variant="secondary" icon={Download} onClick={exportJson}>Export JSON</Button>
                        <Button
                            variant="secondary"
                            icon={Download}
                            disabled={!list.length}
                            onClick={() => downloadCsv(timestampedName('casevault-audit'), list, ['eventId', 'timestamp', 'actor', 'action', 'resource', 'resourceId', 'previousHash', 'currentHash'])}
                        >
                            Export CSV
                        </Button>
                    </>
                )}
            />

            {chain ? (
                <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${chain.valid ? 'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'}`}>
                    {chain.valid
                        ? `Hash chain verified across ${chain.entries ?? list.length} event(s) using ${chain.algorithm || 'SHA-256'}.`
                        : `Hash chain verification failed: ${chain.reason || 'unknown reason'}.`}
                </div>
            ) : null}

            <Card>
                <CardBody className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <Select aria-label="Filter by action" value={action} onChange={(event) => setAction(event.target.value)} placeholder="All actions" options={actions.data || []} />
                        <Select aria-label="Filter by resource" value={resource} onChange={(event) => setResource(event.target.value)} placeholder="All resources" options={AUDIT_RESOURCES} />
                        <div>
                            <label htmlFor="audit-from" className="cv-label mb-1.5">From</label>
                            <input id="audit-from" type="date" className="cv-input" value={from} onChange={(event) => setFrom(event.target.value)} />
                        </div>
                        <div>
                            <label htmlFor="audit-to" className="cv-label mb-1.5">To</label>
                            <input id="audit-to" type="date" className="cv-input" value={to} onChange={(event) => setTo(event.target.value)} />
                        </div>
                        <div>
                            <label htmlFor="audit-limit" className="cv-label mb-1.5">Rows</label>
                            <select id="audit-limit" className="cv-input" value={limit} onChange={(event) => setLimit(event.target.value)}>
                                <option value="50">50</option>
                                <option value="200">200</option>
                                <option value="500">500</option>
                            </select>
                        </div>
                    </div>
                    <p className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
                        <Filter size={12} aria-hidden="true" />
                        {list.length} event(s) returned, newest first
                    </p>
                </CardBody>
            </Card>

            <Card>
                <CardHeader title="Audit events" icon={ScrollText} description="Read-only. The API never exposes an endpoint that can modify or delete an audit event." />
                <CardBody className="px-2 sm:px-3">
                    {logs.loading && !logs.data ? <SkeletonTable rows={10} columns={5} />
                        : logs.error ? <ErrorState message={apiErrorMessage(logs.error)} onRetry={logs.reload} />
                            : (
                                <DataTable
                                    columns={columns}
                                    rows={list}
                                    dense
                                    mobileTitle="Event"
                                    emptyIcon={ScrollText}
                                    emptyTitle="No audit events match these filters"
                                    emptyDescription="Clear the filters to see the full log."
                                />
                            )}
                </CardBody>
            </Card>
        </div>
    );
}
