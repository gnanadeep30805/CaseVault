import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, FileText, Fingerprint, FolderKanban, Search, User, Building2 } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { SkeletonText } from '../components/ui/Skeleton.jsx';
import { useDocumentTitle, useDebounced, useResource } from '../hooks/useResource.js';
import { api, apiErrorMessage, unwrap } from '../lib/apiClient.js';
import { formatDateTime } from '../lib/format.js';

const GROUPS = [
    { key: 'cases', label: 'Cases', icon: FolderKanban, describe: (item) => `${item.caseNumber} — ${item.title}` },
    { key: 'documents', label: 'Documents', icon: FileText, describe: (item) => `${item.fileName} (v${item.version})` },
    { key: 'evidence', label: 'Evidence', icon: Fingerprint, describe: (item) => `${item.id} — ${item.description}` },
    { key: 'tasks', label: 'Tasks', icon: CheckSquare, describe: (item) => item.title },
    { key: 'users', label: 'People', icon: User, describe: (item) => `${item.name} — ${item.role}` },
    { key: 'departments', label: 'Departments', icon: Building2, describe: (item) => item.name },
];

const LINKS = {
    cases: (item) => `/cases/${item.id}`,
    documents: (item) => `/documents/${item.id}`,
    evidence: (item) => `/evidence/${item.id}`,
    tasks: (item) => `/cases/${item.caseId}`,
    users: () => '/users',
    departments: () => '/departments',
};

function ResultGroup({ group, items, total }) {
    const Icon = group.icon;
    if (!total) return null;
    return (
        <Card>
            <CardHeader title={group.label} icon={Icon} description={`${total} result(s)`} />
            <CardBody className="space-y-2">
                {items.map((item) => (
                    <Link key={item.id} to={LINKS[group.key](item)} className="block rounded-lg border cv-divider px-3 py-2 transition hover:border-brand-500/50">
                        <p className="truncate text-sm font-semibold text-ink-900 dark:text-ink-50">{group.describe(item)}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
                            {item.caseNumber ? <span>{item.caseNumber}</span> : null}
                            {item.status ? <Badge value={item.status} /> : null}
                            {item.classification ? <Badge value={item.classification} /> : null}
                            {item.updatedAt ? <span>Updated {formatDateTime(item.updatedAt)}</span> : null}
                            {item.department ? <span>{item.department}</span> : null}
                        </p>
                    </Link>
                ))}
            </CardBody>
        </Card>
    );
}

export default function SearchPage() {
    useDocumentTitle('Search');
    const [term, setTerm] = useState('');
    const [submitted, setSubmitted] = useState('');
    const debounced = useDebounced(submitted || term, 350);

    const enabled = debounced.trim().length >= 2;
    const results = useResource(
        () => (enabled ? api.get('/search', { params: { q: debounced.trim() } }).then(unwrap) : Promise.resolve(null)),
        [debounced, enabled],
        { enabled },
    );

    const payload = results.data;
    const total = payload?.total || 0;

    return (
        <div className="space-y-5">
            <PageHeader
                title="Search"
                description="One query across the cases, documents, evidence, tasks and directory entries you are authorized to read. Results are filtered server-side."
            />

            <Card>
                <CardBody>
                    <form
                        className="relative"
                        onSubmit={(event) => {
                            event.preventDefault();
                            setSubmitted(term);
                        }}
                    >
                        <label htmlFor="global-search" className="sr-only">Search CaseVault</label>
                        <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                        <input
                            id="global-search"
                            type="search"
                            className="cv-input pl-10"
                            placeholder="Search case numbers, file names, evidence IDs, tasks, people…"
                            value={term}
                            onChange={(event) => setTerm(event.target.value)}
                            autoComplete="off"
                        />
                    </form>
                    <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
                        Enter at least two characters. Results never include records outside your role, department and clearance.
                    </p>
                </CardBody>
            </Card>

            {!enabled ? (
                <Card>
                    <CardBody>
                        <EmptyState
                            icon={Search}
                            title="Start typing to search"
                            description="CaseVault searches across every authorized collection in one pass and groups the results by type."
                        />
                    </CardBody>
                </Card>
            ) : results.error ? (
                <Card><CardBody><ErrorState message={apiErrorMessage(results.error)} onRetry={results.reload} /></CardBody></Card>
            ) : results.loading && !payload ? (
                <Card><CardBody><SkeletonText lines={6} /></CardBody></Card>
            ) : total === 0 ? (
                <Card>
                    <CardBody>
                        <EmptyState
                            icon={Search}
                            title={`No results for “${debounced.trim()}”`}
                            description="Try a case number, a document file name, an evidence ID or a person. Records you cannot access are never returned."
                        />
                    </CardBody>
                </Card>
            ) : (
                <>
                    <p className="text-sm font-semibold text-ink-700 dark:text-ink-200">
                        {total} result(s) for “{payload.query}”
                    </p>
                    <div className="grid gap-4 lg:grid-cols-2">
                        {GROUPS.map((group) => (
                            <ResultGroup
                                key={group.key}
                                group={group}
                                items={payload.results?.[group.key] || []}
                                total={payload.counts?.[group.key] || 0}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
