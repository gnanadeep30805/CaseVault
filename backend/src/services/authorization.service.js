import { readCollection } from './store.js';

export const ROLE_PERMISSIONS = {
    Administrator: ['*'],
    Supervisor: ['case:read', 'case:write', 'case:delete', 'document:read', 'document:write', 'document:approve', 'document:share', 'document:verify', 'evidence:read', 'evidence:write', 'evidence:delete', 'task:read', 'task:write', 'task:delete', 'audit:read', 'security:read', 'report:read', 'report:write', 'ai:analyze', 'user:read', 'user:write'],
    'Investigation Officer': ['case:read', 'case:write', 'document:read', 'document:write', 'document:share', 'document:verify', 'evidence:read', 'evidence:write', 'task:read', 'task:write', 'ai:analyze', 'report:read'],
    'Legal Officer': ['case:read', 'document:read', 'document:approve', 'document:share', 'document:verify', 'evidence:read', 'task:read', 'audit:read', 'security:read', 'report:read', 'ai:analyze'],
    Analyst: ['case:read', 'document:read', 'evidence:read', 'task:read', 'task:write', 'report:read', 'ai:analyze'],
    Viewer: ['case:read', 'document:read', 'evidence:read', 'task:read'],
};

const CLEARANCE_LEVELS = {
    PUBLIC: 0,
    INTERNAL: 1,
    CONFIDENTIAL: 2,
    RESTRICTED: 3,
    HIGHLY_RESTRICTED: 4,
};

export function normalizeClassification(value) {
    return String(value || 'PUBLIC').trim().toUpperCase().replaceAll(' ', '_');
}

export function clearanceForUser(user) {
    if (user?.clearance) return CLEARANCE_LEVELS[normalizeClassification(user.clearance)] ?? 0;
    const roleDefaults = { Administrator: 4, Supervisor: 3, 'Legal Officer': 3, 'Investigation Officer': 2, Analyst: 2, Viewer: 1 };
    return roleDefaults[user?.role] ?? 0;
}

export function hasPermission(user, permission) {
    if (!user || user.status === 'disabled') return false;
    const permissions = ROLE_PERMISSIONS[user.role] || [];
    return permissions.includes('*') || permissions.includes(permission);
}

function valuesFromMembers(members) {
    return new Set((Array.isArray(members) ? members : []).map((member) => typeof member === 'string' ? member : member.userId || member.id).filter(Boolean));
}

function shareKindForPermission(permission) {
    const value = String(permission || 'view');
    if (value === 'manage' || value === 'write' || value.endsWith(':write') || value.endsWith(':delete') || value.endsWith(':share') || value.endsWith(':approve')) return 'manage';
    return 'view';
}

function activeShareMatches(resource, user, permission = 'view') {
    const shares = Array.isArray(resource?.shares) ? resource.shares : [];
    const kind = shareKindForPermission(permission);
    return shares.some((share) => {
        if (share.revokedAt) return false;
        if (share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()) return false;
        const matches = share.sharedWithId === user?.id || share.sharedWithEmail === user?.email;
        if (!matches) return false;
        if (kind === 'manage') return share.permission === 'manage';
        return ['view', 'download', 'manage'].includes(share.permission);
    });
}

export function isExplicitlyRelated(user, resource) {
    if (!user || !resource) return false;
    const memberIds = valuesFromMembers(resource.members);
    if (memberIds.has(user.id)) return true;
    const identifiers = new Set([user.id, user.name, user.email, user.username].filter((value) => typeof value === 'string' && value.length));
    if (!identifiers.size) return false;
    return [resource.ownerId, resource.uploadedBy, resource.createdBy, resource.collectedBy, resource.assignedOfficerId, resource.signatureRequestedBy]
        .some((value) => typeof value === 'string' && value.length && identifiers.has(value));
}

export function canAccessResource(user, resource, relatedResource = null, options = {}) {
    if (!user || user.status === 'disabled' || !resource) return false;
    if (user.role === 'Administrator') return true;
    const subject = relatedResource || resource;
    const classification = normalizeClassification(resource.classification || subject.classification);
    const userClearance = clearanceForUser(user);
    const resourceClearance = CLEARANCE_LEVELS[classification] ?? 0;
    if (userClearance < resourceClearance) return false;
    if (options.permission && !hasPermission(user, `${options.permission}:read`) && !hasPermission(user, options.permission)) return false;
    if (user.role === 'Supervisor') return true;
    const explicit = isExplicitlyRelated(user, resource) || isExplicitlyRelated(user, subject) || subject.caseMember === true;
    const shared = activeShareMatches(resource, user, options.permission || 'view') || activeShareMatches(subject, user, options.permission || 'view');
    if (explicit || shared) return true;
    if (!subject.department) return true;
    return subject.department === user.department;
}

export function filterAccessibleResources(user, resources, relatedResources = new Map()) {
    return resources.filter((resource) => {
        if (resource?.deletedAt || resource?.status === 'Deleted') return false;
        const related = relatedResources instanceof Map ? relatedResources.get(resource.caseId) : relatedResources;
        return canAccessResource(user, resource, related);
    });
}

export function policyError(code, message, status = 403) {
    return Object.assign(new Error(message), { code, status });
}

export async function findCaseForUser(user, id, { write = false, permission = 'case:read' } = {}) {
    const cases = await readCollection('cases');
    const record = cases.find((item) => item.id === id);
    if (!record || record.deletedAt) throw policyError('CASE_NOT_FOUND', 'Case not found.', 404);
    if (!canAccessResource(user, record, record, { permission: write ? permission.replace(':read', ':write') : permission })) {
        throw policyError('CASE_FORBIDDEN', 'You are not authorized to access this case.', 403);
    }
    if (write && !hasPermission(user, permission.replace(':read', ':write'))) {
        throw policyError('CASE_FORBIDDEN', 'You do not have permission to modify this case.', 403);
    }
    return record;
}

export async function findDocumentForUser(user, id, { write = false, permission = 'document:read', shares = [] } = {}) {
    const [documents, cases] = await Promise.all([readCollection('documents'), readCollection('cases')]);
    const document = documents.find((item) => item.id === id);
    if (!document || document.deletedAt) throw policyError('DOCUMENT_NOT_FOUND', 'Document not found.', 404);
    const relatedCase = cases.find((item) => item.id === document.caseId);
    const sharedDocument = { ...document, shares };
    if (!canAccessResource(user, sharedDocument, relatedCase, { permission })) {
        throw policyError('DOCUMENT_NOT_FOUND', 'Document not found.', 404);
    }
    if (write && !hasPermission(user, permission === 'document:read' ? 'document:write' : permission)) {
        throw policyError('DOCUMENT_FORBIDDEN', 'You do not have permission to modify this document.', 403);
    }
    return { document, relatedCase };
}

export async function findEvidenceForUser(user, id, { write = false, permission = 'evidence:read' } = {}) {
    const [evidence, cases] = await Promise.all([readCollection('evidence'), readCollection('cases')]);
    const record = evidence.find((item) => item.id === id);
    if (!record || record.deletedAt) throw policyError('EVIDENCE_NOT_FOUND', 'Evidence not found.', 404);
    const relatedCase = cases.find((item) => item.id === record.caseId);
    if (!canAccessResource(user, record, relatedCase, { permission })) {
        throw policyError('EVIDENCE_NOT_FOUND', 'Evidence not found.', 404);
    }
    if (write && !hasPermission(user, permission === 'evidence:read' ? 'evidence:write' : permission)) {
        throw policyError('EVIDENCE_FORBIDDEN', 'You do not have permission to modify this evidence.', 403);
    }
    return { evidence: record, relatedCase };
}

export function canAccessTask(user, task, relatedCase) {
    return canAccessResource(user, task, relatedCase, { permission: 'task:read' }) && (user.role === 'Administrator' || task.assigneeId === user.id || task.createdBy === user.id || hasPermission(user, 'task:write'));
}
