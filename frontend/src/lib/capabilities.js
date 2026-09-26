export const ROLE_PERMISSIONS = {
    Administrator: ['*'],
    Supervisor: ['case:read', 'case:write', 'case:delete', 'document:read', 'document:write', 'document:approve', 'document:share', 'document:verify', 'evidence:read', 'evidence:write', 'evidence:delete', 'task:read', 'task:write', 'task:delete', 'audit:read', 'security:read', 'report:read', 'report:write', 'ai:analyze', 'user:read', 'user:write'],
    'Investigation Officer': ['case:read', 'case:write', 'document:read', 'document:write', 'document:share', 'document:verify', 'evidence:read', 'evidence:write', 'task:read', 'task:write', 'ai:analyze', 'report:read'],
    'Legal Officer': ['case:read', 'document:read', 'document:approve', 'document:share', 'document:verify', 'evidence:read', 'task:read', 'audit:read', 'security:read', 'report:read', 'ai:analyze'],
    Analyst: ['case:read', 'document:read', 'evidence:read', 'task:read', 'task:write', 'report:read', 'ai:analyze'],
    Viewer: ['case:read', 'document:read', 'evidence:read', 'task:read'],
};

export const ROLES = Object.keys(ROLE_PERMISSIONS);

export const CLEARANCE_LEVELS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED', 'HIGHLY_RESTRICTED'];

export const CASE_STATUSES = [
    'Created',
    'Under Investigation',
    'Evidence Collection',
    'Investigation Review',
    'Legal Review',
    'Closed',
    'Archived',
];

export const CASE_STATUS_TRANSITIONS = {
    Created: ['Under Investigation', 'Archived'],
    'Under Investigation': ['Evidence Collection', 'Archived', 'Investigation Review'],
    'Evidence Collection': ['Investigation Review', 'Archived'],
    'Investigation Review': ['Legal Review', 'Archived'],
    'Legal Review': ['Closed', 'Archived'],
    Closed: ['Archived'],
    Archived: [],
};

export const CASE_TYPES = [
    'Financial Crime',
    'Cyber Crime',
    'Criminal Investigation',
    'Fraud',
    'Narcotics',
    'Traffic Violation',
    'Public Safety',
    'Other',
];

export const CASE_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

export const CLASSIFICATIONS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED', 'HIGHLY_RESTRICTED'];

export const DOCUMENT_CATEGORIES = [
    'Investigation',
    'Financial Records',
    'Statement',
    'Correspondence',
    'Contract',
    'Forensic Report',
    'Legal Filing',
    'Image',
    'Other',
];

export const DOCUMENT_STATUSES = ['Pending', 'Approved', 'Rejected'];

export const EVIDENCE_TYPES = ['Digital', 'Physical', 'Biological', 'Documentary', 'Digital Forensic', 'Other'];

export const EVIDENCE_STATUSES = ['Registered', 'Stored', 'Verified', 'Transferred', 'Analysed', 'Disposed'];

export const TASK_STATUSES = ['Todo', 'In Progress', 'Blocked', 'Completed', 'Cancelled'];

export const TASK_STATUS_TRANSITIONS = {
    Todo: ['In Progress', 'Blocked', 'Completed', 'Cancelled'],
    'In Progress': ['Blocked', 'Completed', 'Cancelled'],
    Blocked: ['Todo', 'In Progress', 'Cancelled'],
    Completed: [],
    Cancelled: [],
};

export const AUDIT_RESOURCES = ['Auth', 'Case', 'Document', 'Evidence', 'Task', 'User', 'Security'];

export function hasPermission(user, permission) {
    if (!user || user.status === 'disabled' || !permission) return false;
    const permissions = ROLE_PERMISSIONS[user.role] || [];
    return permissions.includes('*') || permissions.includes(permission);
}

export function hasAnyRole(user, roles = []) {
    return Boolean(user && roles.includes(user.role));
}
