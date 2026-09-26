import express from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { findDocumentForUser, findEvidenceForUser } from '../services/authorization.service.js';
import { getAuthSessionCount } from '../services/auth.service.js';
import { buildIntegrityReport, createHashChainEvent, getSecurityOverview, sha256Hash, sha3_256Hash, verifyAuditChain, verifyCustodyChain, verifySignature } from '../services/security-core.js';
import { readEncryptedDocument } from '../services/document-storage.service.js';
import { evidenceHashForEvidence, readCollection } from '../services/store.js';
import { asyncRoute, sendData, textValue } from '../utils/route-helpers.js';

const router = express.Router();
const securityReader = requirePermission('security:read');

function legacyEvidenceHashes(evidence) {
    return [sha3_256Hash(`${evidence.id}:${evidence.description}:${evidence.type}${evidence.collectionDate ? `:${evidence.collectionDate}` : ''}`), sha3_256Hash(`${evidence.id}:${evidence.description}:${evidence.type}`)];
}

router.get('/overview', requireAuth, securityReader, asyncRoute(async (req, res) => {
    const [documents, evidence, auditLogs, custodyEvents] = await Promise.all([readCollection('documents'), readCollection('evidence'), readCollection('auditLogs'), readCollection('custodyEvents')]);
    const failedLogins = auditLogs.filter((item) => item.action === 'LOGIN_FAILED' || item.action === 'LOGIN_REJECTED_DISABLED').length;
    const mfaFailures = auditLogs.filter((item) => item.action === 'MFA_FAILED' || item.action === 'MFA_CHALLENGE_INVALID').length;
    const privilegeViolations = auditLogs.filter((item) => item.action === 'ACCESS_DENIED' || item.action === 'PRIVILEGE_VIOLATION').length;
    const auditChain = verifyAuditChain(auditLogs);
    const custodyChain = verifyCustodyChain(custodyEvents);
    const overview = getSecurityOverview({
        failedLogins,
        mfaFailures,
        lockedAccounts: 0,
        activeSessions: getAuthSessionCount(),
        deniedRequests: privilegeViolations,
        privilegeViolations,
        suspiciousAccess: privilegeViolations,
        verifiedDocuments: documents.filter((item) => item.integrityStatus === 'VERIFIED').length,
        failedVerification: documents.filter((item) => item.integrityStatus === 'COMPROMISED').length,
        brokenAuditChains: auditChain.valid ? 0 : 1,
        brokenCustodyChains: custodyEvents.length && !custodyChain.valid ? 1 : 0,
    });
    return sendData(res, overview);
}));

router.get('/events', requireAuth, securityReader, asyncRoute(async (req, res) => {
    const events = await readCollection('auditLogs');
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const data = events.slice(-limit).reverse().map((item) => ({
        eventId: item.eventId,
        time: item.timestamp,
        timestamp: item.timestamp,
        user: item.actor,
        actor: item.actor,
        action: item.action,
        resource: item.resource,
        resourceId: item.resourceId,
        severity: String(item.action).includes('FAILED') || String(item.action).includes('COMPROMISED') ? 'warning' : 'info',
        hashAlgorithm: item.hashAlgorithm || 'SHA-256',
        currentHash: item.currentHash,
    }));
    return sendData(res, data);
}));

router.get('/alerts', requireAuth, securityReader, asyncRoute(async (req, res) => {
    const [auditLogs, documents, custodyEvents] = await Promise.all([readCollection('auditLogs'), readCollection('documents'), readCollection('custodyEvents')]);
    const alerts = [];
    if (!verifyAuditChain(auditLogs).valid) alerts.push({ id: 'SEC-AUDIT-CHAIN', severity: 'critical', title: 'Audit chain verification failed', message: 'The audit hash chain no longer verifies and requires investigation.' });
    if (custodyEvents.length && !verifyCustodyChain(custodyEvents).valid) alerts.push({ id: 'SEC-CUSTODY-CHAIN', severity: 'critical', title: 'Custody chain verification failed', message: 'A chain-of-custody record failed hash verification.' });
    const compromised = documents.filter((item) => item.integrityStatus === 'COMPROMISED');
    if (compromised.length) alerts.push({ id: 'SEC-DOC-INTEGRITY', severity: 'critical', title: 'Document integrity failure', message: `${compromised.length} document(s) do not match their registered integrity hash.` });
    const failedLogins = auditLogs.filter((item) => item.action === 'LOGIN_FAILED').length;
    if (failedLogins > 0) alerts.push({ id: 'SEC-LOGIN-FAILURES', severity: 'warning', title: 'Failed login attempts recorded', message: `${failedLogins} failed login attempt(s) are recorded in the audit trail.` });
    if (!alerts.length) alerts.push({ id: 'SEC-OK', severity: 'info', title: 'No active security alerts', message: 'Hash chains, document integrity, and cryptography health checks are nominal.' });
    return sendData(res, alerts);
}));

router.post('/integrity/verify', requireAuth, securityReader, asyncRoute(async (req, res) => {
    const candidate = textValue(req.body?.currentHash || req.body?.resource);
    const registeredHash = textValue(req.body?.registeredHash);
    const verified = Boolean(candidate && registeredHash) && (candidate === registeredHash || sha3_256Hash(candidate) === registeredHash);
    return sendData(res, { ...buildIntegrityReport(textValue(req.body?.resourceName) || 'Resource', { hash: verified }), verified });
}));

router.post('/documents/:id/verify', requireAuth, asyncRoute(async (req, res) => {
    const { document } = await findDocumentForUser(req.user, req.params.id, { permission: 'document:verify' });
    const stored = await readEncryptedDocument(document);
    const currentHash = sha256Hash(stored);
    const verified = currentHash === document.registeredHash;
    const signatureStatus = document.signature ? (verifySignature(`${document.id}:${document.registeredHash}`, document.signature) ? 'VALID' : 'INVALID') : 'UNSIGNED';
    return sendData(res, { documentId: document.id, status: verified ? 'VERIFIED' : 'COMPROMISED', algorithm: 'SHA-256', registeredHash: document.registeredHash, currentHash, lastVerified: new Date().toISOString(), signatureAlgorithm: 'Ed25519', signatureStatus, message: verified ? 'Hash matches the registered document hash.' : 'The current document does not match its registered integrity hash.' });
}));

router.post('/evidence/:id/verify', requireAuth, asyncRoute(async (req, res) => {
    const { evidence } = await findEvidenceForUser(req.user, req.params.id, { permission: 'evidence:read' });
    const currentHash = evidenceHashForEvidence(evidence);
    const legacy = legacyEvidenceHashes(evidence);
    const registeredHash = evidence.evidenceHash;
    const verified = registeredHash === currentHash || legacy.includes(registeredHash);
    const signatureStatus = evidence.signature ? (verifySignature(`${evidence.id}:${registeredHash}`, evidence.signature) ? 'VALID' : 'INVALID') : 'UNSIGNED';
    return sendData(res, { evidenceId: evidence.id, status: verified ? 'VERIFIED' : 'COMPROMISED', algorithm: verified && legacy.includes(registeredHash) ? 'SHA3-256' : 'SHA-256', registeredHash, currentHash: legacy.includes(registeredHash) ? registeredHash : currentHash, lastVerified: new Date().toISOString(), signatureAlgorithm: 'Ed25519', signatureStatus });
}));

router.post('/evidence/:id/verify-custody', requireAuth, asyncRoute(async (req, res) => {
    const { evidence } = await findEvidenceForUser(req.user, req.params.id, { permission: 'evidence:read' });
    const events = (await readCollection('custodyEvents')).filter((item) => item.evidenceId === evidence.id);
    const result = events.length ? verifyCustodyChain(events) : { valid: false, reason: 'No custody events recorded.' };
    return sendData(res, { evidenceId: evidence.id, algorithm: 'SHA-256', ...result });
}));

router.post('/audit/verify-chain', requireAuth, securityReader, asyncRoute(async (req, res) => sendData(res, { algorithm: 'SHA-256', ...verifyAuditChain(await readCollection('auditLogs')) })));

router.post('/integrity/hash-chain', requireAuth, securityReader, asyncRoute(async (req, res) => {
    const auditLogs = await readCollection('auditLogs');
    return sendData(res, createHashChainEvent({ action: 'integrity-check', actor: req.user.id, resource: 'Security', resourceId: 'HASH-CHAIN', timestamp: new Date().toISOString() }, auditLogs.at(-1)?.currentHash || 'GENESIS'));
}));

export default router;
