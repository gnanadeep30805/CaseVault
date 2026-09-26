import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
    Activity,
    CircleAlert,
    FileText,
    Fingerprint,
    FolderKanban,
    ListChecks,
    RefreshCw,
    ScrollText,
    ShieldCheck,
    Sparkles,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader.jsx';
import StatCard from '../components/ui/StatCard.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import DataTable from '../components/ui/DataTable.jsx';
import { Card, CardBody, CardHeader, SectionTitle } from '../components/ui/Card.jsx';
import { ErrorState } from '../components/ui/States.jsx';
import { SkeletonChart, SkeletonStats, SkeletonTable } from '../components/ui/Skeleton.jsx';
import { ActivityChart, CaseStatusChart, CaseWorkloadChart, ChartCard, DocumentTypeChart } from '../components/charts/ChartKit.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle, useResource } from '../hooks/useResource.js';
import { api, apiErrorStatus, unwrap } from '../lib/apiClient.js';
import { countBy, formatDateTime, formatRelative, groupByDay, severityFromAction, toChartData } from '../lib/format.js';

const QUICK_ACTIONS = [
    { to: '/cases', label: 'Open case register', icon: FolderKanban, permission: 'case:read' },
    { to: '/documents', label: 'Document vault', icon: FileText, permission: 'document:read' },
    { to: '/evidence', label: 'Evidence locker', icon: Fingerprint, permission: 'evidence:read' },
    { to: '/tasks', label: 'Task board', icon: ListChecks, permission: 'task:read' },
    { to: '/assistant', label: 'Ask AI assistant', icon: Sparkles, permission: 'ai:analyze' },
    { to: '/audit', label: 'Audit trail', icon: ScrollText, permission: 'audit:read' },
];

export default function DashboardPage() {
    const { user, can } = useAuth();
    const navigate = useNavigate();
    useDocumentTitle('Dashboard');

    const dashboard = useResource(() => api.get('/dashboard').then(unwrap), []);
    const activity = useResource(() => api.get('/dashboard/recent-activity?limit=60').then(unwrap), []);
    const cases = useResource(() => api.get('/cases').then(unwrap), []);
    const documents = useResource(() => api.get('/documents').then(unwrap), []);

    const alerts = useResource(
        () => api.get('/security/alerts').then(unwrap),
        [],
        { enabled: can('security:read') },
    );

    const data = dashboard.data;
    const stats = data?.stats || {};
    const security = data?.security || null;

    const caseStatusData = useMemo(() => toChartData(data?.caseStatus), [data]);
    const documentTypeData = useMemo(() => toChartData(countBy(documents.data || [], 'category')), [documents.data]);
    const activityData = useMemo(
        () => groupByDay(activity.data || [], (event) => event.timestamp, 14),
        [activity.data],
    );
    const workloadData = useMemo(() => {
        const counts = countBy(cases.data || [], 'assignedOfficer');
        return Object.entries(counts)
            .map(([name, value]) => ({ name: name === 'Unassigned' || !name ? 'Unassigned' : name, value }))
            .sort((left, right) => right.value - left.value)
            .slice(0, 8);
    }, [cases.data]);

    const recentCases = useMemo(
        () => [...(cases.data || [])].sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''))).slice(0, 6),
        [cases.data],
    );

    const recentActivity = useMemo(
        () => [...(dashboard.data?.recentActivity || [])].slice(0, 8),
        [dashboard.data],
    );

    const alertItems = can('security:read')
        ? (alerts.data || [])
        : (security?.integrity?.failedVerification || security?.integrity?.brokenAuditChains || security?.integrity?.brokenCustodyChains
            ? [{
                id: 'SEC-SUMMARY',
                severity: 'critical',
                title: 'Integrity verification required',
                message: `${security.integrity.failedVerification || 0} document(s) failed verification and ${(security.integrity.brokenAuditChains || 0) + (security.integrity.brokenCustodyChains || 0)} hash chain(s) are broken.`,
            }]
            : []);

    const reloadAll = () => {
        dashboard.reload();
        activity.reload();
        cases.reload();
        documents.reload();
        if (can('security:read')) alerts.reload();
    };

    const columns = [
        {
            key: 'caseNumber',
            header: 'Case',
            primary: true,
            render: (row) => (
                <div className="min-w-0">
                    <Link to={`/cases/${row.id}`} className="cv-link block truncate">{row.caseNumber}</Link>
                    <p className="truncate text-xs text-ink-500 dark:text-ink-400">{row.title}</p>
                </div>
            ),
        },
        { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> },
        { key: 'priority', header: 'Priority', render: (row) => <Badge value={row.priority} /> },
        { key: 'department', header: 'Department', render: (row) => <span className="text-xs">{row.department || '—'}</span> },
        { key: 'assignedOfficer', header: 'Officer', render: (row) => <span className="text-xs">{row.assignedOfficer || 'Unassigned'}</span> },
        { key: 'updatedAt', header: 'Updated', render: (row) => <span className="text-xs">{formatRelative(row.updatedAt)}</span> },
    ];

    return (
        <div className="space-y-5">
            <PageHeader
                title={`Welcome back, ${(user?.name || '').split(' ')[0] || 'operator'}`}
                description="Operational overview of the casework you are authorized to see."
                actions={(
                    <>
                        <Link to="/search" className="cv-btn cv-btn-secondary">Search everything</Link>
                        <Button icon={RefreshCw} variant="secondary" onClick={reloadAll}>Refresh</Button>
                    </>
                )}
            />

            {dashboard.error ? <ErrorState message={apiStatusMessage(dashboard.error)} onRetry={dashboard.reload} /> : null}

            {dashboard.loading && !data ? (
                <SkeletonStats count={4} />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Active cases" value={stats.activeCases ?? 0} hint={`${stats.totalCases ?? 0} total in scope`} icon={FolderKanban} onClick={() => navigate('/cases')} />
                    <StatCard label="Documents" value={stats.documents ?? 0} hint={`${stats.pendingReviews ?? 0} awaiting review`} tone="blue" icon={FileText} />
                    <StatCard label="Evidence" value={stats.evidence ?? 0} hint="Registered items" tone="warning" icon={Fingerprint} />
                    <StatCard label="Open tasks" value={stats.openTasks ?? 0} hint={`${stats.unreadNotifications ?? 0} unread notifications`} tone="success" icon={ListChecks} />
                </div>
            )}

            <div className="grid gap-4 xl:grid-cols-2">
                {dashboard.loading && !data ? (
                    <div className="cv-panel p-4"><SkeletonChart /></div>
                ) : (
                    <ChartCard title="Cases by status" description="Distribution of authorized casework">
                        {caseStatusData.length ? <CaseStatusChart data={caseStatusData} /> : <p className="px-3 py-10 text-center text-xs text-ink-500 dark:text-ink-400">No cases in scope.</p>}
                    </ChartCard>
                )}
                {documents.loading && !documents.data ? (
                    <div className="cv-panel p-4"><SkeletonChart /></div>
                ) : (
                    <ChartCard title="Documents by type" description="Category mix of documents you can read">
                        {documentTypeData.length ? <DocumentTypeChart data={documentTypeData} /> : <p className="px-3 py-10 text-center text-xs text-ink-500 dark:text-ink-400">No documents in scope.</p>}
                    </ChartCard>
                )}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                {activity.loading && !activity.data ? (
                    <div className="cv-panel p-4"><SkeletonChart /></div>
                ) : (
                    <ChartCard title="Activity over time" description="Audited events recorded in your scope">
                        {activityData.some((point) => point.count > 0) ? <ActivityChart data={activityData} /> : <p className="px-3 py-10 text-center text-xs text-ink-500 dark:text-ink-400">No recent activity recorded.</p>}
                    </ChartCard>
                )}
                {cases.loading && !cases.data ? (
                    <div className="cv-panel p-4"><SkeletonChart /></div>
                ) : (
                    <ChartCard title="Case workload" description="Authorized cases per assigned officer">
                        {workloadData.length ? <CaseWorkloadChart data={workloadData} /> : <p className="px-3 py-10 text-center text-xs text-ink-500 dark:text-ink-400">No workload data.</p>}
                    </ChartCard>
                )}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <Card>
                    <CardHeader title="Recent cases" icon={FolderKanban} actions={<Link to="/cases" className="cv-btn cv-btn-ghost cv-btn-sm">View all</Link>} />
                    <CardBody className="px-2 sm:px-3">
                        {cases.loading && !cases.data ? <SkeletonTable rows={5} columns={4} /> : (
                            <DataTable
                                columns={columns}
                                rows={recentCases}
                                mobileTitle="Case"
                                emptyTitle="No cases in scope"
                                emptyDescription="Cases you create or are assigned to will appear here."
                            />
                        )}
                    </CardBody>
                </Card>

                <div className="space-y-4">
                    <Card>
                        <CardHeader title="Recent activity" icon={Activity} />
                        <CardBody className="space-y-3">
                            {dashboard.loading && !data ? <SkeletonTable rows={4} columns={2} /> : recentActivity.length === 0 ? (
                                <p className="py-6 text-center text-xs text-ink-500 dark:text-ink-400">No audited activity yet.</p>
                            ) : recentActivity.map((event) => (
                                <div key={event.eventId} className="flex items-start gap-2.5">
                                    <span className={clsx('mt-1 h-2 w-2 shrink-0 rounded-full', severityFromAction(event.action) === 'warning' ? 'bg-warning' : 'bg-brand-500')} aria-hidden="true" />
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-ink-800 dark:text-ink-100">{String(event.action || '').replaceAll('_', ' ')}</p>
                                        <p className="truncate text-[0.7rem] text-ink-500 dark:text-ink-400">
                                            {event.resource} · {event.resourceId} · {formatRelative(event.timestamp)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </CardBody>
                    </Card>

                    <Card>
                        <CardHeader title="Security alerts" icon={ShieldCheck} />
                        <CardBody className="space-y-3">
                            {!can('security:read') ? (
                                <p className="text-xs text-ink-500 dark:text-ink-400">
                                    Detailed security alerts require the <code className="font-mono">security:read</code> permission. Integrity metrics are summarised in the top bar.
                                </p>
                            ) : alerts.loading && !alerts.data ? (
                                <SkeletonTable rows={2} columns={2} />
                            ) : alertItems.length === 0 ? (
                                <p className="py-4 text-center text-xs text-ink-500 dark:text-ink-400">No security alerts.</p>
                            ) : alertItems.map((alert) => (
                                <div key={alert.id} className={clsx('rounded-lg border px-3 py-2', alert.severity === 'critical' ? 'border-danger/30 bg-danger/5' : alert.severity === 'warning' ? 'border-warning/30 bg-warning/5' : 'border-ink-200 bg-ink-50 dark:border-ink-600 dark:bg-ink-700/30')}>
                                    <p className="flex items-center gap-1.5 text-xs font-bold text-ink-900 dark:text-ink-50">
                                        <CircleAlert size={13} aria-hidden="true" />
                                        {alert.title}
                                    </p>
                                    <p className="mt-1 text-[0.72rem] text-ink-600 dark:text-ink-300">{alert.message}</p>
                                </div>
                            ))}
                            <Link to="/security" className="cv-link text-xs">Open security center</Link>
                        </CardBody>
                    </Card>
                </div>
            </div>

            <Card>
                <CardHeader title="Your access" description="Capabilities are enforced by the API; the interface only reflects them." />
                <CardBody>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                            <SectionTitle>Role</SectionTitle>
                            <p className="mt-1 text-sm font-bold">{user?.role}</p>
                        </div>
                        <div>
                            <SectionTitle>Department</SectionTitle>
                            <p className="mt-1 text-sm font-bold">{user?.department}</p>
                        </div>
                        <div>
                            <SectionTitle>Clearance</SectionTitle>
                            <p className="mt-1 text-sm font-bold">{user?.clearance}</p>
                        </div>
                        <div>
                            <SectionTitle>Last sign-in</SectionTitle>
                            <p className="mt-1 text-sm font-bold">{formatDateTime(user?.lastLogin)}</p>
                        </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {QUICK_ACTIONS.filter((action) => can(action.permission)).map((action) => (
                            <Link key={action.to} to={action.to} className="cv-btn cv-btn-secondary cv-btn-sm">
                                <action.icon size={13} aria-hidden="true" />
                                {action.label}
                            </Link>
                        ))}
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}

function apiStatusMessage(error) {
    if (apiErrorStatus(error) === 403) return 'You do not have permission to view this dashboard data.';
    return null;
}
