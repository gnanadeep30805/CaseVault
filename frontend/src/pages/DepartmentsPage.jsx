import { useMemo, useState } from 'react';
import { Building2, Search } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader.jsx';
import Badge from '../components/ui/Badge.jsx';
import { Card, CardBody, CardHeader, KeyValue } from '../components/ui/Card.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { useDocumentTitle, useResource } from '../hooks/useResource.js';
import { api, apiErrorMessage, unwrap } from '../lib/apiClient.js';

export default function DepartmentsPage() {
    useDocumentTitle('Departments');
    const [search, setSearch] = useState('');

    const departments = useResource(() => api.get('/users/departments').then(unwrap), []);
    const cases = useResource(() => api.get('/cases').then(unwrap), []);
    const users = useResource(() => api.get('/users').then(unwrap), []);

    const list = departments.data || [];

    const enriched = useMemo(() => {
        const term = search.trim().toLowerCase();
        return list
            .map((department) => ({
                ...department,
                caseCount: (cases.data || []).filter((item) => item.department === department.name).length,
                userCount: (users.data || []).filter((item) => item.department === department.name && item.status === 'active').length,
            }))
            .filter((department) => !term || [department.name, department.code, department.description]
                .some((value) => String(value || '').toLowerCase().includes(term)));
    }, [list, search, cases.data, users.data]);

    return (
        <div className="space-y-5">
            <PageHeader
                title="Departments"
                description="Organisational units that scope case access. Officers can only open or create cases inside their own department unless their role allows otherwise."
            />

            <Card>
                <CardBody>
                    <div className="relative">
                        <label htmlFor="department-search" className="sr-only">Search departments</label>
                        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                        <input
                            id="department-search"
                            type="search"
                            className="cv-input pl-9"
                            placeholder="Search department name or code…"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>
                </CardBody>
            </Card>

            {departments.loading && !departments.data ? (
                <div className="grid gap-3 lg:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32" />)}
                </div>
            ) : departments.error ? (
                <Card><CardBody><ErrorState message={apiErrorMessage(departments.error)} onRetry={departments.reload} /></CardBody></Card>
            ) : enriched.length === 0 ? (
                <Card>
                    <CardBody>
                        <EmptyState
                            icon={Building2}
                            title={list.length ? 'No departments match this search' : 'No departments configured'}
                            description={list.length ? 'Try a different name or code.' : 'Departments are seeded with the workspace data.'}
                        />
                    </CardBody>
                </Card>
            ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                    {enriched.map((department) => (
                        <Card key={department.id || department.name}>
                            <CardHeader
                                title={department.name}
                                icon={Building2}
                                description={department.description}
                                actions={<Badge value={department.active === false ? 'Inactive' : 'Active'} />}
                            />
                            <CardBody>
                                <KeyValue
                                    columns={2}
                                    items={[
                                        { label: 'Active users', value: department.userCount },
                                        { label: 'Cases', value: department.caseCount },
                                        { label: 'Identifier', value: <span className="font-mono text-xs">{department.id}</span> },
                                        { label: 'Status', value: department.active === false ? 'Inactive' : 'Active' },
                                    ]}
                                />
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
