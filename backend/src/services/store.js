import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import {
    canonicalAuditPayload,
    canonicalCustodyPayload,
    decryptBuffer,
    encryptBuffer,
    HASH_ALGORITHM,
    sha256Hash,
    signPayload,
    verifySignature,
} from './security-core.js';

const defaultDataDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
const dataFile = env.caseVaultDataFile
    ? path.resolve(env.caseVaultDataFile)
    : path.join(defaultDataDirectory, 'casevault.json');
const dataDirectory = path.dirname(dataFile);
const storageDirectory = env.caseVaultStorageDirectory
    ? path.resolve(env.caseVaultStorageDirectory)
    : path.join(dataDirectory, 'secure-documents');

const seedDocumentContents = {
    'DOC-2026-001': 'CASEVAULT FICTIONAL DEMO\nFinancial Fraud Investigation\nInitial intake and preservation record.\nAll names and values are fictional.',
    'DOC-2026-001-V2': 'CASEVAULT FICTIONAL DEMO\nFinancial Fraud Investigation\nSupplemental transaction reconciliation notes.\nAll names and values are fictional.',
    'DOC-2026-002': 'account,reference,amount,status\nFICTIONAL-001,INV-8842,12500,matched\nFICTIONAL-002,INV-8843,8750,review',
    'DOC-2025-001': 'CASEVAULT FICTIONAL DEMO\nFirst responder statement summary.\nAll names and values are fictional.',
};

const roleDefinitions = [
    { id: 'role-admin', name: 'Administrator', description: 'Full platform administration', permissions: ['*'] },
    { id: 'role-supervisor', name: 'Supervisor', description: 'Department oversight and approvals', permissions: ['case:read', 'case:write', 'case:delete', 'document:read', 'document:write', 'document:approve', 'document:share', 'document:verify', 'evidence:read', 'evidence:write', 'evidence:delete', 'task:read', 'task:write', 'task:delete', 'audit:read', 'security:read', 'report:read', 'report:write', 'ai:analyze'] },
    { id: 'role-investigator', name: 'Investigation Officer', description: 'Case and evidence operations', permissions: ['case:read', 'case:write', 'document:read', 'document:write', 'document:share', 'document:verify', 'evidence:read', 'evidence:write', 'task:read', 'task:write', 'ai:analyze'] },
    { id: 'role-legal', name: 'Legal Officer', description: 'Legal review and approvals', permissions: ['case:read', 'document:read', 'document:approve', 'document:share', 'document:verify', 'evidence:read', 'task:read', 'audit:read', 'security:read', 'report:read', 'ai:analyze'] },
    { id: 'role-analyst', name: 'Analyst', description: 'Read and analysis access', permissions: ['case:read', 'document:read', 'evidence:read', 'task:read', 'task:write', 'ai:analyze', 'report:read'] },
    { id: 'role-viewer', name: 'Viewer', description: 'Read-only access', permissions: ['case:read', 'document:read', 'evidence:read', 'task:read'] },
];

const departmentDefinitions = [
    { id: 'dept-administration', name: 'Administration', description: 'Platform administration', active: true },
    { id: 'dept-financial-crime', name: 'Financial Crime', description: 'Financial investigations and fraud response', active: true },
    { id: 'dept-criminal-investigation', name: 'Criminal Investigation', description: 'General criminal investigations', active: true },
    { id: 'dept-cyber-crime', name: 'Cyber Crime', description: 'Cyber and digital investigations', active: true },
    { id: 'dept-operations', name: 'Operations', description: 'Case operations and coordination', active: true },
    { id: 'dept-legal', name: 'Legal', description: 'Legal review and prosecution support', active: true },
    { id: 'dept-forensics', name: 'Forensics', description: 'Digital and physical forensic examination', active: true },
    { id: 'dept-traffic', name: 'Traffic', description: 'Traffic and transport operations', active: true },
];

function createId(prefix) {
    return `${prefix}-${crypto.randomUUID()}`;
}

function makeDemoUser({ id, name, email, username, role, department, status = 'active', mfaEnabled = true, clearance = 'CONFIDENTIAL' }) {
    return {
        id,
        name,
        email,
        username,
        passwordHash: env.devPasswordHash,
        role,
        department,
        status,
        clearance,
        mfaEnabled,
        mfaSecret: mfaEnabled ? env.mfaSecret : null,
        lastLogin: null,
        createdAt: '2026-01-05T08:00:00.000Z',
        updatedAt: '2026-01-05T08:00:00.000Z',
    };
}

export function evidenceIntegrityPayload(evidence) {
    return JSON.stringify({
        id: evidence.id,
        caseId: evidence.caseId,
        type: evidence.type,
        description: evidence.description,
        collectedBy: evidence.collectedBy,
        collectionDate: evidence.collectionDate,
        currentCustodian: evidence.currentCustodian,
        location: evidence.location,
        status: evidence.status,
    });
}

export function evidenceHashForEvidence(evidence) {
    return sha256Hash(evidenceIntegrityPayload(evidence));
}

function makeSeedDocument({ id, fileName, caseId, category, classification, version, uploadedBy, uploadedAt, status, content, versionOf = null, integrityStatus = 'VERIFIED' }) {
    const bytes = Buffer.from(content, 'utf8');
    const document = {
        id,
        fileName,
        caseId,
        category,
        classification,
        version,
        versionOf,
        rootDocumentId: versionOf || id,
        uploadedBy,
        uploadedAt,
        status,
        integrityStatus,
        algorithm: HASH_ALGORITHM,
        hashAlgorithm: HASH_ALGORITHM,
        registeredHash: sha256Hash(bytes),
        contentHash: sha256Hash(bytes),
        lastVerified: uploadedAt,
        mimeType: fileName.endsWith('.csv') ? 'text/csv' : 'application/pdf',
        size: bytes.length,
        extension: path.extname(fileName).toLowerCase(),
        storageFile: `${id}.cvault`,
        storageAlgorithm: 'AES-256-GCM',
        storageKeyId: 'document-storage-v1',
        createdAt: uploadedAt,
        updatedAt: uploadedAt,
        approvedBy: status === 'Approved' ? 'u-supervisor' : null,
        approvedAt: status === 'Approved' ? uploadedAt : null,
    };
    document.signatureAlgorithm = 'Ed25519';
    document.signature = signPayload(`${id}:${document.registeredHash}`);
    document.signatureStatus = 'VALID';
    return document;
}

function makeSeedEvidence({ id, caseId, caseNumber, type, description, collectedBy, collectionDate, currentCustodian, location, status, registeredAt, currentVerificationState = 'VERIFIED' }) {
    const evidence = {
        id,
        caseId,
        caseNumber,
        type,
        description,
        collectedBy,
        collectionDate,
        currentCustodian,
        location,
        status,
        hashAlgorithm: HASH_ALGORITHM,
        registeredAt,
        currentVerificationState,
        createdAt: registeredAt,
        updatedAt: registeredAt,
    };
    evidence.evidenceHash = evidenceHashForEvidence(evidence);
    evidence.signatureAlgorithm = 'Ed25519';
    evidence.signature = signPayload(`${id}:${evidence.evidenceHash}`);
    evidence.signatureStatus = 'VALID';
    return evidence;
}

function makeSeedCustodyEvent({ eventId, evidenceId, from, to, reason, location, timestamp, previousHash = 'GENESIS' }) {
    const event = { eventId, evidenceId, from, to, reason, location, timestamp, previousHash, hashAlgorithm: HASH_ALGORITHM };
    event.currentHash = sha256Hash(canonicalCustodyPayload(event, previousHash));
    return event;
}

function makeSeedAuditEvent({ eventId, actor, timestamp, action, resource, resourceId, metadata = {}, previousHash = 'GENESIS' }) {
    const event = { eventId, actor, timestamp, action, resource, resourceId, metadata, previousHash, hashAlgorithm: HASH_ALGORITHM };
    event.currentHash = sha256Hash(canonicalAuditPayload(event, previousHash));
    return event;
}

function buildSeedAuditLogs() {
    const definitions = [
        ['AUD-SEED-001', 'u-admin', '2026-01-05T08:00:00.000Z', 'LOGIN_SUCCESS', 'Auth', 'LOGIN', {}],
        ['AUD-SEED-002', 'u-investigator', '2026-01-06T09:00:00.000Z', 'CASE_CREATED', 'Case', 'case-cv-2026-001', { caseNumber: 'CV-2026-001' }],
        ['AUD-SEED-003', 'u-investigator', '2026-01-06T09:15:00.000Z', 'DOCUMENT_UPLOADED', 'Document', 'DOC-2026-001', { caseNumber: 'CV-2026-001', version: '1.0' }],
        ['AUD-SEED-004', 'u-supervisor', '2026-01-07T10:00:00.000Z', 'DOCUMENT_APPROVED', 'Document', 'DOC-2026-001', { version: '1.0' }],
        ['AUD-SEED-005', 'u-forensics', '2026-01-08T11:30:00.000Z', 'EVIDENCE_REGISTERED', 'Evidence', 'EV-2026-001', { caseNumber: 'CV-2026-001' }],
        ['AUD-SEED-006', 'u-forensics', '2026-01-08T12:00:00.000Z', 'EVIDENCE_CUSTODY_APPENDED', 'Evidence', 'EV-2026-001', { to: 'Evidence Locker 3' }],
        ['AUD-SEED-007', 'u-supervisor', '2026-01-09T12:00:00.000Z', 'CASE_STATUS_CHANGED', 'Case', 'case-cv-2026-001', { from: 'Evidence Collection', to: 'Investigation Review' }],
        ['AUD-SEED-008', 'u-legal', '2026-01-09T13:00:00.000Z', 'SIGNATURE_REQUESTED', 'Document', 'DOC-2026-002', {}],
    ];
    let previousHash = 'GENESIS';
    return definitions.map(([eventId, actor, timestamp, action, resource, resourceId, metadata]) => {
        const event = makeSeedAuditEvent({ eventId, actor, timestamp, action, resource, resourceId, metadata, previousHash });
        previousHash = event.currentHash;
        return event;
    });
}

function buildSeedState() {
    const cases = [
        {
            id: 'case-cv-2026-001',
            caseNumber: 'CV-2026-001',
            title: 'Financial Fraud Investigation',
            type: 'Financial Crime',
            description: 'Fictional investigation into a coordinated payment redirection and account takeover scheme.',
            priority: 'High',
            department: 'Financial Crime',
            status: 'Under Investigation',
            assignedOfficer: 'Aisha Rahman',
            assignedOfficerId: 'u-investigator',
            classification: 'CONFIDENTIAL',
            members: [
                { userId: 'u-investigator', role: 'Owner', addedAt: '2026-01-06T09:00:00.000Z' },
                { userId: 'u-supervisor', role: 'Supervisor', addedAt: '2026-01-06T09:05:00.000Z' },
                { userId: 'u-legal', role: 'Reviewer', addedAt: '2026-01-07T08:30:00.000Z' },
            ],
            tags: ['fictional', 'financial-crime', 'priority'],
            createdAt: '2026-01-06T09:00:00.000Z',
            updatedAt: '2026-01-09T12:00:00.000Z',
        },
        {
            id: 'case-cv-2026-002',
            caseNumber: 'CV-2026-002',
            title: 'Vendor Invoice Review',
            type: 'Financial Crime',
            description: 'Fictional review of duplicate vendor invoices and anomalous approvals.',
            priority: 'Medium',
            department: 'Operations',
            status: 'Evidence Collection',
            assignedOfficer: 'Arjun Nair',
            assignedOfficerId: 'u-supervisor',
            classification: 'INTERNAL',
            members: [{ userId: 'u-supervisor', role: 'Owner', addedAt: '2026-01-10T09:00:00.000Z' }],
            tags: ['fictional', 'review'],
            createdAt: '2026-01-10T09:00:00.000Z',
            updatedAt: '2026-01-10T09:00:00.000Z',
        },
        {
            id: 'case-cv-2026-003',
            caseNumber: 'CV-2026-003',
            title: 'Suspicious Login Review',
            type: 'Cyber Crime',
            description: 'Fictional review of anomalous authentication events from a fictional tenant.',
            priority: 'High',
            department: 'Cyber Crime',
            status: 'Investigation Review',
            assignedOfficer: 'Maya Nair',
            assignedOfficerId: 'u-analyst',
            classification: 'RESTRICTED',
            members: [{ userId: 'u-analyst', role: 'Owner', addedAt: '2026-01-11T09:00:00.000Z' }],
            tags: ['fictional', 'cyber'],
            createdAt: '2026-01-11T09:00:00.000Z',
            updatedAt: '2026-01-12T10:00:00.000Z',
        },
    ];

    const documents = [
        makeSeedDocument({ id: 'DOC-2026-001', fileName: 'Financial_Fraud_Intake.pdf', caseId: 'case-cv-2026-001', category: 'Investigation', classification: 'CONFIDENTIAL', version: '1.0', uploadedBy: 'u-investigator', uploadedAt: '2026-01-06T09:15:00.000Z', status: 'Approved', content: seedDocumentContents['DOC-2026-001'] }),
        makeSeedDocument({ id: 'DOC-2026-001-V2', fileName: 'Financial_Fraud_Intake.pdf', caseId: 'case-cv-2026-001', category: 'Investigation', classification: 'CONFIDENTIAL', version: '2.0', uploadedBy: 'u-investigator', uploadedAt: '2026-01-12T09:15:00.000Z', status: 'Pending', integrityStatus: 'PENDING', content: seedDocumentContents['DOC-2026-001-V2'], versionOf: 'DOC-2026-001' }),
        makeSeedDocument({ id: 'DOC-2026-002', fileName: 'Bank_Statement_Reconciliation.csv', caseId: 'case-cv-2026-001', category: 'Financial Records', classification: 'CONFIDENTIAL', version: '1.0', uploadedBy: 'u-investigator', uploadedAt: '2026-01-13T10:00:00.000Z', status: 'Pending', integrityStatus: 'PENDING', content: seedDocumentContents['DOC-2026-002'] }),
        makeSeedDocument({ id: 'DOC-2025-001', fileName: 'First_Responder_Statement.pdf', caseId: 'case-cv-2026-003', category: 'Statement', classification: 'RESTRICTED', version: '1.0', uploadedBy: 'u-analyst', uploadedAt: '2026-01-11T10:00:00.000Z', status: 'Approved', content: seedDocumentContents['DOC-2025-001'] }),
    ];

    const evidence = [
        makeSeedEvidence({ id: 'EV-2026-001', caseId: 'case-cv-2026-001', caseNumber: 'CV-2026-001', type: 'Digital', description: 'Fictional recovered mobile transaction export', collectedBy: 'M. Rao', collectionDate: '2026-01-08', currentCustodian: 'Forensics Unit', location: 'Evidence Locker 3', status: 'Verified', registeredAt: '2026-01-08T11:30:00.000Z' }),
        makeSeedEvidence({ id: 'EV-2026-002', caseId: 'case-cv-2026-001', caseNumber: 'CV-2026-001', type: 'Physical', description: 'Fictional seized paper ledger and storage media', collectedBy: 'D. Prasad', collectionDate: '2026-01-09', currentCustodian: 'Evidence Locker 3', location: 'Evidence Locker 3', status: 'Stored', registeredAt: '2026-01-09T08:00:00.000Z', currentVerificationState: 'PENDING' }),
        makeSeedEvidence({ id: 'EV-2026-003', caseId: 'case-cv-2026-003', caseNumber: 'CV-2026-003', type: 'Digital', description: 'Fictional authentication log extract', collectedBy: 'M. Nair', collectionDate: '2026-01-12', currentCustodian: 'Cyber Crime', location: 'Digital Lab', status: 'Verified', registeredAt: '2026-01-12T10:00:00.000Z' }),
    ];

    const custodyEvents = [
        makeSeedCustodyEvent({ eventId: 'CUST-SEED-001', evidenceId: 'EV-2026-001', from: 'Digital Forensics', to: 'Forensics Unit', reason: 'Initial forensic intake', location: 'Forensics Lab', timestamp: '2026-01-08T11:35:00.000Z' }),
        makeSeedCustodyEvent({ eventId: 'CUST-SEED-002', evidenceId: 'EV-2026-001', from: 'Forensics Unit', to: 'Evidence Locker 3', reason: 'Secure storage', location: 'Evidence Locker 3', timestamp: '2026-01-08T12:00:00.000Z', previousHash: 'pending' }),
        makeSeedCustodyEvent({ eventId: 'CUST-SEED-003', evidenceId: 'EV-2026-002', from: 'Ops Desk', to: 'Evidence Locker 3', reason: 'Evidence intake', location: 'Evidence Locker 3', timestamp: '2026-01-09T08:05:00.000Z' }),
    ];
    custodyEvents[1].previousHash = custodyEvents[0].currentHash;
    custodyEvents[1].currentHash = sha256Hash(canonicalCustodyPayload(custodyEvents[1], custodyEvents[1].previousHash));

    const tasks = [
        { id: 'TASK-2026-001', caseId: 'case-cv-2026-001', title: 'Reconcile suspicious payment references', description: 'Compare the fictional invoice references against the preserved bank export.', status: 'In Progress', priority: 'High', assigneeId: 'u-investigator', createdBy: 'u-investigator', dueDate: '2026-02-01', createdAt: '2026-01-13T10:15:00.000Z', updatedAt: '2026-01-14T09:00:00.000Z', completedAt: null },
        { id: 'TASK-2026-002', caseId: 'case-cv-2026-001', title: 'Prepare supervisor review note', description: 'Summarize the fictional findings for supervisor review.', status: 'Todo', priority: 'Medium', assigneeId: 'u-supervisor', createdBy: 'u-investigator', dueDate: '2026-02-05', createdAt: '2026-01-14T09:10:00.000Z', updatedAt: '2026-01-14T09:10:00.000Z', completedAt: null },
        { id: 'TASK-2026-003', caseId: 'case-cv-2026-003', title: 'Validate anomalous login timeline', description: 'Confirm the fictional login sequence and preserve the source export.', status: 'Blocked', priority: 'High', assigneeId: 'u-analyst', createdBy: 'u-analyst', dueDate: '2026-01-25', createdAt: '2026-01-12T11:00:00.000Z', updatedAt: '2026-01-13T08:00:00.000Z', completedAt: null },
    ];

    const notifications = [
        { id: 'NOT-SEED-001', recipientId: 'u-investigator', type: 'task', title: 'Task assigned', message: 'Reconcile suspicious payment references is ready.', resourceType: 'Task', resourceId: 'TASK-2026-001', read: false, createdAt: '2026-01-13T10:16:00.000Z', readAt: null },
        { id: 'NOT-SEED-002', recipientId: 'u-investigator', type: 'document', title: 'Document version uploaded', message: 'A supplemental version is pending review.', resourceType: 'Document', resourceId: 'DOC-2026-001-V2', read: false, createdAt: '2026-01-12T09:16:00.000Z', readAt: null },
        { id: 'NOT-SEED-003', recipientId: 'u-supervisor', type: 'approval', title: 'Approval requested', message: 'Financial Fraud Intake requires review.', resourceType: 'Document', resourceId: 'DOC-2026-002', read: false, createdAt: '2026-01-13T10:01:00.000Z', readAt: null },
    ];

    const timeline = [
        { id: 'TL-SEED-001', caseId: 'case-cv-2026-001', type: 'case', title: 'Case opened', detail: 'Financial Fraud Investigation was created.', actorId: 'u-investigator', createdAt: '2026-01-06T09:00:00.000Z' },
        { id: 'TL-SEED-002', caseId: 'case-cv-2026-001', type: 'document', title: 'Initial intake approved', detail: 'Financial Fraud Intake version 1.0 was approved.', actorId: 'u-supervisor', createdAt: '2026-01-07T10:00:00.000Z' },
        { id: 'TL-SEED-003', caseId: 'case-cv-2026-001', type: 'evidence', title: 'Evidence secured', detail: 'EV-2026-001 was moved to Evidence Locker 3.', actorId: 'u-forensics', createdAt: '2026-01-08T12:00:00.000Z' },
        { id: 'TL-SEED-004', caseId: 'case-cv-2026-001', type: 'status', title: 'Status changed', detail: 'Case moved to Under Investigation.', actorId: 'u-supervisor', createdAt: '2026-01-09T12:00:00.000Z' },
    ];

    return {
        schemaVersion: 2,
        cases,
        documents,
        documentShares: [
            { id: 'SHARE-SEED-001', documentId: 'DOC-2026-001', ownerId: 'u-investigator', sharedWithId: 'u-legal', sharedWithEmail: 'legal@casevault.local', permission: 'download', expiresAt: null, revokedAt: null, createdAt: '2026-01-07T08:45:00.000Z', createdBy: 'u-investigator' },
        ],
        signatureRequests: [
            { id: 'SIG-SEED-001', documentId: 'DOC-2026-002', requesterId: 'u-investigator', signerId: 'u-legal', signerEmail: 'legal@casevault.local', status: 'Pending', message: 'Please review the fictional reconciliation record.', createdAt: '2026-01-13T10:02:00.000Z', respondedAt: null, responseReason: null },
        ],
        evidence,
        custodyEvents,
        tasks,
        notifications,
        timeline,
        users: [
            makeDemoUser({ id: 'u-admin', name: 'System Admin', email: 'admin@casevault.local', username: 'admin', role: 'Administrator', department: 'Administration', clearance: 'HIGHLY_RESTRICTED' }),
            makeDemoUser({ id: 'u-investigator', name: 'Aisha Rahman', email: 'investigator@casevault.local', username: 'investigator', role: 'Investigation Officer', department: 'Financial Crime', clearance: 'CONFIDENTIAL' }),
            makeDemoUser({ id: 'u-supervisor', name: 'Arjun Nair', email: 'supervisor@casevault.local', username: 'supervisor', role: 'Supervisor', department: 'Operations', clearance: 'RESTRICTED', mfaEnabled: false }),
            makeDemoUser({ id: 'u-legal', name: 'Kavya Singh', email: 'legal@casevault.local', username: 'legal', role: 'Legal Officer', department: 'Legal', clearance: 'RESTRICTED' }),
            makeDemoUser({ id: 'u-analyst', name: 'Maya Nair', email: 'analyst@casevault.local', username: 'analyst', role: 'Analyst', department: 'Cyber Crime', clearance: 'RESTRICTED', mfaEnabled: false }),
            makeDemoUser({ id: 'u-forensics', name: 'M. Rao', email: 'forensics@casevault.local', username: 'forensics', role: 'Investigation Officer', department: 'Forensics', clearance: 'CONFIDENTIAL', mfaEnabled: false }),
            makeDemoUser({ id: 'u-disabled', name: 'Disabled Demo User', email: 'disabled@casevault.local', username: 'disabled', role: 'Viewer', department: 'Operations', status: 'disabled', mfaEnabled: false, clearance: 'INTERNAL' }),
        ],
        roles: roleDefinitions,
        departments: departmentDefinitions,
        auditLogs: buildSeedAuditLogs(),
        accessEvents: [],
        sessions: [],
        assetHistory: [],
        maintenanceRecords: [],
        assets: [
            { id: 'AS-101', name: 'Patrol Vehicle 17', category: 'Vehicles', serial: 'VHC-7012', department: 'Traffic', assignedOfficer: null, location: 'HQ Garage', condition: 'Operational', status: 'Available', createdAt: '2026-01-10T09:00:00.000Z' },
            { id: 'AS-201', name: 'Forensic Laptop-02', category: 'Computers', serial: 'LAP-22191', department: 'Forensics', assignedOfficer: 'u-forensics', location: 'Lab 1', condition: 'Good', status: 'Assigned', createdAt: '2026-01-12T09:00:00.000Z' },
        ],
        mailOutbox: [],
        reports: [],
    };
}

function collectionNames(seed) {
    return Object.keys(seed).filter((key) => Array.isArray(seed[key]));
}

function mergeCollection(seedItems, persistedItems) {
    const result = Array.isArray(persistedItems) ? persistedItems.map((item) => ({ ...item })) : [];
    const ids = new Set(result.map((item) => item.id));
    for (const seedItem of seedItems) {
        const index = result.findIndex((item) => item.id === seedItem.id);
        if (index === -1) result.push({ ...seedItem });
        else result[index] = { ...seedItem, ...result[index] };
    }
    return result;
}

function rebuildAuditChain(events) {
    let previousHash = 'GENESIS';
    return events.map((source) => {
        const event = { ...source, previousHash, hashAlgorithm: HASH_ALGORITHM };
        event.currentHash = sha256Hash(canonicalAuditPayload(event, previousHash));
        previousHash = event.currentHash;
        return event;
    });
}

function rebuildCustodyChains(events) {
    const byEvidence = new Map();
    for (const event of events) {
        if (!byEvidence.has(event.evidenceId)) byEvidence.set(event.evidenceId, []);
        byEvidence.get(event.evidenceId).push(event);
    }
    const result = [];
    for (const evidenceEvents of byEvidence.values()) {
        let previousHash = 'GENESIS';
        for (const source of evidenceEvents) {
            const event = { ...source, previousHash, hashAlgorithm: HASH_ALGORITHM };
            event.currentHash = sha256Hash(canonicalCustodyPayload(event, previousHash));
            previousHash = event.currentHash;
            result.push(event);
        }
    }
    return result.sort((left, right) => String(left.timestamp).localeCompare(String(right.timestamp)));
}

function normalizeState(persisted) {
    const seed = buildSeedState();
    const state = { ...seed, ...(persisted || {}), schemaVersion: 2 };
    let changed = !persisted || persisted.schemaVersion !== 2;
    for (const name of collectionNames(seed)) {
        const merged = mergeCollection(seed[name], persisted?.[name]);
        if (JSON.stringify(merged) !== JSON.stringify(state[name])) changed = true;
        state[name] = merged;
    }
    state.cases = state.cases.map((item) => ({
        ...item,
        classification: String(item.classification || 'INTERNAL').toUpperCase(),
        members: Array.isArray(item.members) ? item.members : [],
        tags: Array.isArray(item.tags) ? item.tags : [],
    }));
    state.documents = state.documents.map((item) => ({
        ...item,
        classification: String(item.classification || 'INTERNAL').toUpperCase(),
        version: String(item.version || '1.0'),
        versionOf: item.versionOf || null,
        rootDocumentId: item.rootDocumentId || item.versionOf || item.id,
    }));
    state.evidence = state.evidence.map((item) => ({ ...item, hashAlgorithm: item.hashAlgorithm || HASH_ALGORITHM }));
    state.auditLogs = rebuildAuditChain(state.auditLogs);
    state.custodyEvents = rebuildCustodyChains(state.custodyEvents);
    state.sessions = Array.isArray(state.sessions) ? state.sessions : [];
    state.accessEvents = Array.isArray(state.accessEvents) ? state.accessEvents : [];
    return { state, changed };
}

function safeStorageName(documentId) {
    const normalized = String(documentId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${normalized || createId('document')}.cvault`;
}

function storagePathForFile(storageFile) {
    const safeName = path.basename(String(storageFile || ''));
    if (!safeName || safeName === '.' || safeName === '..') throw new Error('Invalid storage file.');
    const resolved = path.resolve(storageDirectory, safeName);
    if (resolved !== storageDirectory && !resolved.startsWith(`${storageDirectory}${path.sep}`)) throw new Error('Invalid storage path.');
    return resolved;
}

async function readLegacyDocumentContent(document) {
    if (!document.encryptedContent || !document.contentNonce || !document.contentTag) return null;
    try {
        return decryptBuffer({
            encryptedData: Buffer.from(document.encryptedContent, 'base64'),
            nonce: Buffer.from(document.contentNonce, 'base64'),
            tag: Buffer.from(document.contentTag, 'base64'),
        }, env.documentStorageKey);
    } catch {
        return null;
    }
}

async function materializeDocuments(state) {
    await fs.mkdir(storageDirectory, { recursive: true });
    let changed = false;
    for (const document of state.documents) {
        const expectedStorageFile = safeStorageName(document.id);
        let storageFile = document.storageFile;
        if (storageFile !== expectedStorageFile) {
            storageFile = expectedStorageFile;
            document.storageFile = storageFile;
            changed = true;
        }
        const filePath = storagePathForFile(storageFile);
        let plaintext = null;
        let existingFile = true;
        try {
            const encrypted = await fs.readFile(filePath);
            plaintext = decryptBuffer({
                encryptedData: encrypted,
                nonce: Buffer.from(document.storageNonce || document.contentNonce || '', 'base64'),
                tag: Buffer.from(document.storageTag || document.contentTag || '', 'base64'),
            }, env.documentStorageKey);
        } catch {
            existingFile = false;
            plaintext = await readLegacyDocumentContent(document);
            if (!plaintext && seedDocumentContents[document.id]) plaintext = Buffer.from(seedDocumentContents[document.id], 'utf8');
            if (!plaintext) plaintext = Buffer.from(String(document.fileName || 'empty document'), 'utf8');
        }

        const contentHash = sha256Hash(plaintext);
        if (!existingFile || document.registeredHash !== contentHash || document.algorithm !== HASH_ALGORITHM || document.contentHash !== contentHash || document.size !== plaintext.length) {
            const encrypted = encryptBuffer(plaintext, env.documentStorageKey, { keyId: 'document-storage-v1' });
            await fs.writeFile(filePath, encrypted.encryptedData, { mode: 0o600 });
            document.storageNonce = encrypted.nonce.toString('base64');
            document.storageTag = encrypted.tag.toString('base64');
            document.storageKeyId = encrypted.keyId;
            document.storageAlgorithm = encrypted.algorithm;
            document.registeredHash = contentHash;
            document.contentHash = contentHash;
            document.algorithm = HASH_ALGORITHM;
            document.hashAlgorithm = HASH_ALGORITHM;
            document.size = plaintext.length;
            changed = true;
        } else {
            document.storageNonce ||= document.contentNonce;
            document.storageTag ||= document.contentTag;
        }
        if (!document.mimeType) {
            document.mimeType = document.extension === '.csv' ? 'text/csv' : 'application/pdf';
            changed = true;
        }
        if (!document.extension) {
            document.extension = path.extname(String(document.fileName || '')).toLowerCase();
            changed = true;
        }
        const expectedSignature = `${document.id}:${document.registeredHash}`;
        if (!document.signature || !verifySignature(expectedSignature, document.signature)) {
            document.signatureAlgorithm = 'Ed25519';
            document.signature = signPayload(expectedSignature);
            document.signatureStatus = 'VALID';
            changed = true;
        }
        delete document.encryptedContent;
        delete document.contentNonce;
        delete document.contentTag;
        delete document.contentKeyId;
    }
    return changed;
}

let state;
let writePromise = Promise.resolve();
let loadPromise;

async function persist() {
    await fs.mkdir(dataDirectory, { recursive: true });
    const temporaryFile = `${dataFile}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(temporaryFile, JSON.stringify(state, null, 2), { mode: 0o600 });
    await fs.rename(temporaryFile, dataFile);
}

async function load() {
    let persisted = null;
    let exists = true;
    try {
        persisted = JSON.parse(await fs.readFile(dataFile, 'utf8'));
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        exists = false;
    }
    const normalized = normalizeState(persisted);
    state = normalized.state;
    const documentMigrationChanged = await materializeDocuments(state);
    if (!exists || normalized.changed || documentMigrationChanged) await persist();
    return state;
}

async function ensureLoaded() {
    if (state) return state;
    if (!loadPromise) {
        loadPromise = load().finally(() => {
            loadPromise = undefined;
        });
    }
    return loadPromise;
}

async function save() {
    const operation = writePromise.catch(() => {}).then(persist);
    writePromise = operation.catch(() => {});
    return operation;
}

export async function readCollection(collection) {
    const loaded = await ensureLoaded();
    if (!Array.isArray(loaded[collection])) throw new Error(`Unknown collection: ${collection}`);
    return loaded[collection];
}

export async function appendToCollection(collection, item) {
    const loaded = await ensureLoaded();
    loaded[collection].unshift(item);
    await save();
    return item;
}

export async function appendChronological(collection, item) {
    const loaded = await ensureLoaded();
    loaded[collection].push(item);
    await save();
    return item;
}

export async function updateCollectionItem(collection, id, update) {
    const loaded = await ensureLoaded();
    const item = loaded[collection].find((entry) => entry.id === id);
    if (!item) return null;
    Object.assign(item, update);
    await save();
    return item;
}

export async function replaceCollection(collection, items) {
    const loaded = await ensureLoaded();
    if (!Array.isArray(loaded[collection])) throw new Error(`Unknown collection: ${collection}`);
    loaded[collection] = items;
    await save();
    return loaded[collection];
}

export async function removeCollectionItem(collection, id, { softDelete = true } = {}) {
    const loaded = await ensureLoaded();
    const index = loaded[collection].findIndex((entry) => entry.id === id);
    if (index === -1) return null;
    if (softDelete) {
        loaded[collection][index] = { ...loaded[collection][index], deletedAt: new Date().toISOString(), status: 'Deleted' };
        await save();
        return loaded[collection][index];
    }
    const [removed] = loaded[collection].splice(index, 1);
    await save();
    return removed;
}

export async function addAuditEvent({ actor, action, resource, resourceId, metadata = {}, data }) {
    const loaded = await ensureLoaded();
    const previousHash = loaded.auditLogs.at(-1)?.currentHash || 'GENESIS';
    const event = {
        eventId: createId('AUD'),
        actor: typeof actor === 'string' ? actor : actor?.id || 'system',
        timestamp: new Date().toISOString(),
        action,
        resource,
        resourceId,
        metadata: metadata || {},
        ...(data ? { data } : {}),
        previousHash,
        hashAlgorithm: HASH_ALGORITHM,
    };
    event.currentHash = sha256Hash(canonicalAuditPayload(event, previousHash));
    loaded.auditLogs.push(event);
    await save();
    return event;
}

export async function addTimelineEvent({ caseId, type, title, detail = '', actorId = 'system', metadata = {} }) {
    const event = {
        id: createId('TL'),
        caseId,
        type,
        title,
        detail,
        actorId: typeof actorId === 'string' ? actorId : actorId?.id || 'system',
        metadata,
        createdAt: new Date().toISOString(),
    };
    await appendChronological('timeline', event);
    return event;
}

export async function addNotification({ recipientId, type, title, message, resourceType = null, resourceId = null, metadata = {} }) {
    const notification = {
        id: createId('NOT'),
        recipientId,
        type,
        title,
        message,
        resourceType,
        resourceId,
        metadata,
        read: false,
        createdAt: new Date().toISOString(),
        readAt: null,
    };
    await appendToCollection('notifications', notification);
    return notification;
}

export function getSecureStorageDirectory() {
    return storageDirectory;
}

export function getSecureStoragePath(storageFile) {
    return storagePathForFile(storageFile);
}

export function createStoreId(prefix) {
    return createId(prefix);
}

export async function resetStoreForTests() {
    loadPromise = undefined;
    state = buildSeedState();
    await materializeDocuments(state);
    await persist();
    return state;
}
