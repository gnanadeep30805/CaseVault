import { canAccessResource } from './authorization.service.js';
import { readCollection } from './store.js';

export async function accessibleSnapshot(user) {
    const [cases, documents, evidence, tasks, shares, auditLogs, custodyEvents] = await Promise.all([readCollection('cases'), readCollection('documents'), readCollection('evidence'), readCollection('tasks'), readCollection('documentShares'), readCollection('auditLogs'), readCollection('custodyEvents')]);
    const caseMap = new Map(cases.map((item) => [item.id, item]));
    const accessibleCases = cases.filter((item) => !item.deletedAt && canAccessResource(user, item, item));
    const accessibleCaseIds = new Set(accessibleCases.map((item) => item.id));
    const accessibleDocuments = documents.filter((item) => !item.deletedAt && accessibleCaseIds.has(item.caseId) && canAccessResource(user, { ...item, shares: shares.filter((share) => share.documentId === item.id) }, caseMap.get(item.caseId), { permission: 'document:read' }));
    const accessibleEvidence = evidence.filter((item) => !item.deletedAt && accessibleCaseIds.has(item.caseId) && canAccessResource(user, item, caseMap.get(item.caseId), { permission: 'evidence:read' }));
    const accessibleTasks = tasks.filter((item) => !item.deletedAt && accessibleCaseIds.has(item.caseId) && canAccessResource(user, item, caseMap.get(item.caseId), { permission: 'task:read' }));
    const resourceIds = new Set([...accessibleCases.map((item) => item.id), ...accessibleDocuments.map((item) => item.id), ...accessibleEvidence.map((item) => item.id), ...accessibleTasks.map((item) => item.id)]);
    const accessibleAudit = auditLogs.filter((item) => user.role === 'Administrator' || item.actor === user.id || resourceIds.has(item.resourceId)).slice(-100).reverse();
    const evidenceIds = new Set(accessibleEvidence.map((item) => item.id));
    return { cases: accessibleCases, documents: accessibleDocuments, evidence: accessibleEvidence, tasks: accessibleTasks, auditLogs: accessibleAudit, custodyEvents: custodyEvents.filter((item) => evidenceIds.has(item.evidenceId)), shares };
}

export function countBy(items, field) {
    return items.reduce((result, item) => {
        const key = item[field] || 'Unknown';
        result[key] = (result[key] || 0) + 1;
        return result;
    }, {});
}
