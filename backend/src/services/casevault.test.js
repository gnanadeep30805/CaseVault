import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const isolatedDirectory = await mkdtemp(join(tmpdir(), 'casevault-unit-'));
process.env.CASEVAULT_DATA_FILE = join(isolatedDirectory, 'casevault.json');
process.env.CASEVAULT_STORAGE_DIRECTORY = join(isolatedDirectory, 'secure-documents');

const { canAccessResource, hasPermission, clearanceForUser, filterAccessibleResources } = await import('./authorization.service.js');
const { evidenceHashForEvidence, readCollection, appendToCollection, updateCollectionItem, addAuditEvent } = await import('./store.js');
const { validateUpload, inferMimeType, allowedDocumentExtensions } = await import('./document-storage.service.js');
const { getSecurityOverview, verifyAuditChain, verifyCustodyChain, sha256Hash, HASH_ALGORITHM } = await import('./security-core.js');
const { env } = await import('../config/env.js');

const officer = { id: 'u-investigator', role: 'Investigation Officer', department: 'Financial Crime', clearance: 'CONFIDENTIAL', status: 'active' };
const analyst = { id: 'u-analyst', role: 'Analyst', department: 'Cyber Crime', clearance: 'RESTRICTED', status: 'active' };
const viewer = { id: 'u-viewer', role: 'Viewer', department: 'Operations', clearance: 'INTERNAL', status: 'active' };

const fraudCase = { id: 'case-1', caseNumber: 'CV-2026-001', department: 'Financial Crime', classification: 'CONFIDENTIAL', members: [{ userId: 'u-investigator' }] };
const otherDepartmentCase = { id: 'case-2', caseNumber: 'CV-2026-002', department: 'Cyber Crime', classification: 'CONFIDENTIAL', members: [] };
const restrictedCase = { id: 'case-3', caseNumber: 'CV-2026-003', department: 'Financial Crime', classification: 'HIGHLY_RESTRICTED', members: [{ userId: 'u-investigator' }] };

test('role permissions and clearance levels are enforced', () => {
    assert.equal(hasPermission(officer, 'document:write'), true);
    assert.equal(hasPermission(officer, 'document:approve'), false);
    assert.equal(hasPermission(analyst, 'document:write'), false);
    assert.equal(hasPermission(viewer, 'evidence:write'), false);
    assert.equal(hasPermission({ ...officer, status: 'disabled' }, 'case:read'), false);
    assert.ok(clearanceForUser(analyst) > clearanceForUser(officer));
});

test('department, membership, and classification boundaries hold', () => {
    assert.equal(canAccessResource(officer, fraudCase, fraudCase), true);
    assert.equal(canAccessResource(viewer, fraudCase, fraudCase), false);
    assert.equal(canAccessResource(analyst, otherDepartmentCase, otherDepartmentCase), true);
    assert.equal(canAccessResource(analyst, fraudCase, fraudCase), false);
    assert.equal(canAccessResource(officer, restrictedCase, restrictedCase), false);
    assert.equal(canAccessResource({ ...officer, role: 'Administrator' }, restrictedCase, restrictedCase), true);
});

test('active document shares grant read access and respect revocation and expiry', () => {
    const document = { id: 'doc-1', caseId: fraudCase.id, classification: 'CONFIDENTIAL', shares: [{ sharedWithId: analyst.id, permission: 'view', revokedAt: null, expiresAt: null }] };
    assert.equal(canAccessResource(analyst, document, fraudCase, { permission: 'document:read' }), true);
    assert.equal(canAccessResource(analyst, { ...document, shares: [{ ...document.shares[0], revokedAt: new Date().toISOString() }] }, fraudCase, { permission: 'document:read' }), false);
    assert.equal(canAccessResource(analyst, { ...document, shares: [{ ...document.shares[0], expiresAt: '2020-01-01T00:00:00.000Z' }] }, fraudCase, { permission: 'document:read' }), false);
    assert.equal(canAccessResource(analyst, { ...document, shares: [{ ...document.shares[0], permission: 'view' }] }, fraudCase, { permission: 'document:write' }), false);
    assert.equal(canAccessResource(analyst, { ...document, shares: [{ ...document.shares[0], permission: 'manage' }] }, fraudCase, { permission: 'document:read' }), true);
    assert.equal(canAccessResource(analyst, { ...document, shares: [{ ...document.shares[0], permission: 'manage' }] }, fraudCase, { permission: 'document:write' }), false);
});

test('resource filtering never returns deleted or unauthorized records', () => {
    const items = [{ id: 'a', caseId: fraudCase.id, deletedAt: null }, { id: 'b', caseId: fraudCase.id, deletedAt: '2026-01-01' }, { id: 'c', caseId: otherDepartmentCase.id }];
    const visible = filterAccessibleResources(officer, items, new Map([[fraudCase.id, fraudCase], [otherDepartmentCase.id, otherDepartmentCase]]));
    assert.deepEqual(visible.map((item) => item.id), ['a']);
});

test('upload validation accepts allowed types and rejects everything else', () => {
    const text = validateUpload({ fileName: 'statement.txt', mimeType: 'text/plain', size: 12, buffer: Buffer.from('hello world!') });
    assert.equal(text.extension, '.txt');
    assert.equal(text.size, 12);
    assert.equal(inferMimeType('report.pdf'), 'application/pdf');
    assert.ok(allowedDocumentExtensions.includes('.csv'));
    assert.throws(() => validateUpload({ fileName: 'payload.exe', mimeType: 'application/octet-stream', size: 4, buffer: Buffer.from('MZ..') }), /not supported/i);
    assert.throws(() => validateUpload({ fileName: '../escape.txt', mimeType: 'text/plain', size: 4, buffer: Buffer.from('data') }), /path traversal|file name/i);
    assert.throws(() => validateUpload({ fileName: 'note.txt', mimeType: 'application/pdf', size: 4, buffer: Buffer.from('data') }), /MIME type/i);
    const originalLimit = env.documentMaxSize;
    env.documentMaxSize = 8;
    try {
        assert.throws(() => validateUpload({ fileName: 'note.txt', mimeType: 'text/plain', size: 64, buffer: Buffer.alloc(64) }), /exceeds/i);
    } finally {
        env.documentMaxSize = originalLimit;
    }
});

test('evidence integrity hashes are deterministic and detect tampering', () => {
    const evidence = { id: 'EV-1', caseId: 'case-1', type: 'Digital', description: 'Original', collectedBy: 'Officer', collectionDate: '2026-01-01', currentCustodian: 'Locker 1', location: 'Locker 1', status: 'Registered' };
    const hash = evidenceHashForEvidence(evidence);
    assert.equal(hash, evidenceHashForEvidence({ ...evidence }));
    assert.notEqual(hash, evidenceHashForEvidence({ ...evidence, description: 'Tampered' }));
    assert.equal(hash.length, 64);
    assert.equal(HASH_ALGORITHM, 'SHA-256');
});

test('seed state exposes the fictional demo case with linked integrity records', async () => {
    const [cases, documents, evidence, custodyEvents, auditLogs, users] = await Promise.all([readCollection('cases'), readCollection('documents'), readCollection('evidence'), readCollection('custodyEvents'), readCollection('auditLogs'), readCollection('users')]);
    const seeded = cases.find((item) => item.caseNumber === 'CV-2026-001');
    assert.ok(seeded, 'seed case CV-2026-001 must exist');
    assert.equal(seeded.title, 'Financial Fraud Investigation');
    assert.ok(documents.some((item) => item.caseId === seeded.id));
    assert.ok(evidence.some((item) => item.caseId === seeded.id));
    assert.ok(custodyEvents.some((item) => item.evidenceId.startsWith('EV-')));
    assert.ok(users.some((user) => user.role === 'Administrator'));
    assert.equal(verifyAuditChain(auditLogs).valid, true);
    const evidenceChain = verifyCustodyChain(custodyEvents.filter((item) => item.evidenceId === 'EV-2026-001'));
    assert.equal(evidenceChain.valid, true);
});

test('audit events extend a verifiable chain and detect tampering', async () => {
    await addAuditEvent({ actor: 'u-investigator', action: 'UNIT_TEST_EVENT', resource: 'Test', resourceId: 'T-1' });
    const [auditLogs, users] = await Promise.all([readCollection('auditLogs'), readCollection('users')]);
    assert.equal(verifyAuditChain(auditLogs).valid, true);
    const tampered = auditLogs.map((event) => (event.action === 'UNIT_TEST_EVENT' ? { ...event, currentHash: sha256Hash('tampered') } : event));
    assert.equal(verifyAuditChain(tampered).valid, false);
    const disabled = await updateCollectionItem('users', 'u-analyst', { status: 'disabled' });
    assert.equal(disabled.status, 'disabled');
    assert.equal(hasPermission(disabled, 'case:read'), false);
    assert.equal(canAccessResource(disabled, fraudCase, fraudCase), false);
});

test('security overview reports the configured hash algorithm', () => {
    const overview = getSecurityOverview({ verifiedDocuments: 3, failedVerification: 1, activeSessions: 2 });
    assert.equal(overview.integrity.algorithm, 'SHA-256');
    assert.equal(overview.integrity.verifiedDocuments, 3);
    assert.equal(overview.integrity.failedVerification, 1);
    assert.equal(overview.authentication.activeSessions, 2);
    assert.equal(overview.cryptography.signatureAlgorithm, 'Ed25519');
});
