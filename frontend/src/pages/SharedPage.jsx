import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Eye, FileText, Search, Share2 } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { SkeletonText } from '../components/ui/Skeleton.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle, useResource } from '../hooks/useResource.js';
import { api, apiErrorMessage, unwrap } from '../lib/apiClient.js';
import { downloadCsv, timestampedName } from '../lib/csv.js';
import { formatBytes, formatDateTime, titleCase } from '../lib/format.js';
import { downloadSecureDocument, openSecurePreview } from '../lib/secureFiles.js';

export default function SharedPage() {
    const toast = useToast();
    useDocumentTitle('Shared with me');

    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [busy, setBusy] = useState('');

    const shares = useResource(() => api.get('/documents/shared').then(unwrap), []);

    const list = shares.data || [];

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return list.filter((item) => {
            const matchesTerm = !term || [item.document?.fileName, item.caseNumber, item.caseTitle, item.sharedWithEmail]
                .some((value) => String(value || '').toLowerCase().includes(term));
            return matchesTerm && (!status || item.status === status);
        });
    }, [list, search, status]);

    const exportCsv = () => {
        downloadCsv(timestampedName('casevault-shared-documents'), filtered, [
            (row) => row.document?.fileName || '',
            'sharedWithEmail',
            'permission',
            'status',
            'createdAt',
            'expiresAt',
            'caseNumber',
        ]);
    };

    const preview = async (share) => {
        if (!share.document) return;
        setBusy(share.id);
        try {
            await openSecurePreview(share.document.id, share.document.fileName);
        } catch (error) {
            toast.error(apiErrorMessage(error, 'The shared document could not be opened.'));
        } finally {
            setBusy('');
        }
    };

    const download = async (share) => {
        if (!share.document) return;
        setBusy(share.id);
        try {
            await downloadSecureDocument(share.document.id, share.document.fileName);
        } catch (error) {
            toast.error(apiErrorMessage(error, 'The shared document could not be downloaded.'));
        } finally {
            setBusy('');
        }
    };

    return (
        <div className="space-y-5">
            <PageHeader
                title="Shared with me"
                description="Documents other operators have explicitly shared with your account. Access still passes server-side authorization on every request."
                actions={<Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!filtered.length}>Export CSV</Button>}
            />

            <Card>
                <CardBody className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="relative">
                            <label htmlFor="shared-search" className="sr-only">Search shared documents</label>
                            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                            <input
                                id="shared-search"
                                type="search"
                                className="cv-input pl-9"
                                placeholder="Search file name or case…"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="shared-status" className="sr-only">Filter by share status</label>
                            <select id="shared-status" className="cv-input" value={status} onChange={(event) => setStatus(event.target.value)}>
                                <option value="">All statuses</option>
                                <option value="Active">Active</option>
                                <option value="Expired">Expired</option>
                                <option value="Revoked">Revoked</option>
                            </select>
                        </div>
                    </div>
                    <p className="text-xs text-ink-500 dark:text-ink-400">{filtered.length} of {list.length} share(s)</p>
                </CardBody>
            </Card>

            {shares.loading && !shares.data ? (
                <Card><CardBody><SkeletonText lines={5} /></CardBody></Card>
            ) : shares.error ? (
                <Card><CardBody><ErrorState message={apiErrorMessage(shares.error)} onRetry={shares.reload} /></CardBody></Card>
            ) : filtered.length === 0 ? (
                <Card>
                    <CardBody>
                        <EmptyState
                            icon={list.length ? Search : Share2}
                            title={list.length ? 'No shares match these filters' : 'Nothing shared with you yet'}
                            description={list.length ? 'Adjust or clear the filters to see more results.' : 'When a colleague shares a document with your account it will appear here with its expiry and permission.'}
                        />
                    </CardBody>
                </Card>
            ) : (
                <ul className="grid gap-3 lg:grid-cols-2">
                    {filtered.map((share) => (
                        <li key={share.id}>
                            <Card className="h-full">
                                <CardBody className="flex h-full flex-col gap-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            {share.document ? (
                                                <Link to={`/documents/${share.document.id}`} className="cv-link block truncate text-sm font-bold">{share.document.fileName}</Link>
                                            ) : (
                                                <p className="truncate text-sm font-bold text-ink-900 dark:text-ink-50">Unavailable document</p>
                                            )}
                                            <p className="truncate text-xs text-ink-500 dark:text-ink-400">
                                                {share.caseNumber ? `${share.caseNumber} · ${share.caseTitle}` : 'Unlinked'}
                                            </p>
                                        </div>
                                        <Badge value={share.status} />
                                    </div>

                                    <dl className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                            <dt className="font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">From</dt>
                                            <dd className="truncate text-ink-800 dark:text-ink-100">{share.sharedByName || share.createdBy || '—'}</dd>
                                        </div>
                                        <div>
                                            <dt className="font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">Permission</dt>
                                            <dd className="text-ink-800 dark:text-ink-100">{titleCase(share.permission)}</dd>
                                        </div>
                                        <div>
                                            <dt className="font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">Shared</dt>
                                            <dd className="text-ink-800 dark:text-ink-100">{formatDateTime(share.createdAt)}</dd>
                                        </div>
                                        <div>
                                            <dt className="font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">Expires</dt>
                                            <dd className="text-ink-800 dark:text-ink-100">{share.expiresAt ? formatDateTime(share.expiresAt) : 'Never'}</dd>
                                        </div>
                                    </dl>

                                    {share.document ? (
                                        <p className="text-[0.68rem] text-ink-500 dark:text-ink-400">
                                            <FileText size={11} className="mr-1 inline" aria-hidden="true" />
                                            v{share.document.version} · {share.document.classification} · {formatBytes(share.document.size)} · {share.document.category}
                                        </p>
                                    ) : null}

                                    {share.document && share.status === 'Active' ? (
                                        <div className="mt-auto flex flex-wrap gap-2 pt-1">
                                            <Button variant="secondary" size="sm" icon={Eye} loading={busy === share.id} onClick={() => preview(share)}>Preview</Button>
                                            {share.permission === 'download' ? (
                                                <Button variant="ghost" size="sm" icon={Download} loading={busy === share.id} onClick={() => download(share)}>Download</Button>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </CardBody>
                            </Card>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
