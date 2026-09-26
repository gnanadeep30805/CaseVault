import express from 'express';
import crypto from 'node:crypto';
import { requireAuth, requirePermission, filterAccessibleResources } from '../middleware/auth.js';
import { canAccessResource, findEvidenceForUser } from '../services/authorization.service.js';
import { canonicalCustodyPayload, sha256Hash, sha3_256Hash, signPayload, verifyCustodyChain, verifySignature, HASH_ALGORITHM } from '../services/security-core.js';
import { addAuditEvent, addTimelineEvent, appendChronological, appendToCollection, evidenceHashForEvidence, readCollection, removeCollectionItem, updateCollectionItem } from '../services/store.js';
import { asyncRoute, sendData, sendError, textValue } from '../utils/route-helpers.js';

const router = express.Router();
const evidenceWriter = requirePermission('evidence:write');
const evidenceDeleter = requirePermission('evidence:delete');

async function evidenceContext(req, { write = false } = {}) {
    return findEvidenceForUser(req.user, req.params.id, { write });
}

function legacyEvidenceHashes(evidence) {
    return new Set([
        sha3_256Hash(`${evidence.id}:${evidence.description}:${evidence.type}${evidence.collectionDate ? `:${evidence.collectionDate}` : ''}`),
        sha3_256Hash(`${evidence.id}:${evidence.description}:${evidence.type}`),
    ]);
}

function signaturePayload(evidence) {
    return `${evidence.id}:${evidence.evidenceHash}`;
}

router.get('/', requireAuth, asyncRoute(async (req, res) => {
    const [items, cases, custodyEvents] = await Promise.all([readCollection('evidence'), readCollection('cases'), readCollection('custodyEvents')]);
    const caseMap = new Map(cases.map((item) => [item.id, item]));
    const query = textValue(req.query.search || req.query.q).toLowerCase();
    const data = filterAccessibleResources(req.user, items, caseMap)
        .filter((item) => !query || [item.id, item.caseNumber, item.type, item.description, item.currentCustodian, item.location].some((value) => String(value || '').toLowerCase().includes(query)))
        .map((item) => ({ ...item, custodyEventCount: custodyEvents.filter((event) => event.evidenceId === item.id).length }));
    return sendData(res, data);
}));

router.post('/', requireAuth, evidenceWriter, asyncRoute(async (req, res) => {
    const body = req.body || {};
    const caseId = textValue(body.caseId);
    const type = textValue(body.type);
    const description = textValue(body.description);
    const collectionDate = textValue(body.collectionDate);
    const collectedBy = textValue(body.collectedBy);
    if (!caseId || !type || !description || !collectionDate || !collectedBy) return sendError(res, 422, 'VALIDATION_ERROR', 'Case, type, description, collection date, and collector are required.');
    const cases = await readCollection('cases');
    const relatedCase = cases.find((item) => item.id === caseId);
    if (!relatedCase || relatedCase.deletedAt) return sendError(res, 404, 'CASE_NOT_FOUND', 'Case not found.');
    if (!canAccessResource(req.user, relatedCase, relatedCase, { permission: 'evidence:read' })) return sendError(res, 403, 'FORBIDDEN', 'You are not authorized to access this case.');
    const id = `EV-${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();
    const evidence = {
        id,
        caseId,
        caseNumber: relatedCase.caseNumber,
        type,
        description,
        collectedBy,
        collectionDate,
        currentCustodian: textValue(body.custodian || body.currentCustodian) || req.user.id,
        location: textValue(body.location) || 'Unassigned',
        status: 'Registered',
        hashAlgorithm: HASH_ALGORITHM,
        registeredAt: timestamp,
        currentVerificationState: 'PENDING',
        createdAt: timestamp,
        updatedAt: timestamp,
    };
    evidence.evidenceHash = evidenceHashForEvidence(evidence);
    evidence.signatureAlgorithm = 'Ed25519';
    evidence.signature = signPayload(signaturePayload(evidence));
    evidence.signatureStatus = 'VALID';
    await appendToCollection('evidence', evidence);
    await addTimelineEvent({ caseId, type: 'evidence', title: 'Evidence registered', detail: `${evidence.id} was registered.`, actorId: req.user.id, metadata: { evidenceId: evidence.id } });
    await addAuditEvent({ actor: req.user.id, action: 'EVIDENCE_REGISTERED', resource: 'Evidence', resourceId: evidence.id, metadata: { caseId } });
    return sendData(res, evidence, 201);
}));

router.get('/:id/custody', requireAuth, asyncRoute(async (req, res) => {
    const { evidence } = await evidenceContext(req);
    const events = (await readCollection('custodyEvents')).filter((item) => item.evidenceId === evidence.id);
    return sendData(res, events);
}));
router.get('/:id/custody-chain', requireAuth, asyncRoute(async (req, res) => {
    const { evidence } = await evidenceContext(req);
    const events = (await readCollection('custodyEvents')).filter((item) => item.evidenceId === evidence.id);
    return sendData(res, events);
}));

router.post('/:id/custody', requireAuth, evidenceWriter, asyncRoute(async (req, res) => {
    const { evidence } = await evidenceContext(req, { write: true });
    const recipient = textValue(req.body?.recipient || req.body?.to || req.body?.custodian);
    const location = textValue(req.body?.location);
    const reason = textValue(req.body?.reason);
    if (!recipient || !location || !reason) return sendError(res, 422, 'VALIDATION_ERROR', 'Recipient, location, and reason are required.');
    const previous = (await readCollection('custodyEvents')).filter((item) => item.evidenceId === evidence.id).at(-1);
    const event = {
        eventId: `CUST-${crypto.randomUUID()}`,
        evidenceId: evidence.id,
        from: evidence.currentCustodian,
        to: recipient,
        timestamp: new Date().toISOString(),
        reason,
        location,
        previousHash: previous?.currentHash || 'GENESIS',
        hashAlgorithm: HASH_ALGORITHM,
    };
    event.currentHash = sha256Hash(canonicalCustodyPayload(event, event.previousHash));
    await appendChronological('custodyEvents', event);
    const updated = { currentCustodian: recipient, location, status: 'Transferred', updatedAt: new Date().toISOString() };
    updated.evidenceHash = evidenceHashForEvidence({ ...evidence, ...updated });
    updated.signature = signPayload(signaturePayload({ ...evidence, ...updated }));
    updated.signatureAlgorithm = 'Ed25519';
    updated.signatureStatus = 'VALID';
    await updateCollectionItem('evidence', evidence.id, updated);
    await addTimelineEvent({ caseId: evidence.caseId, type: 'evidence', title: 'Custody transferred', detail: `${evidence.id} moved to ${recipient}.`, actorId: req.user.id, metadata: { evidenceId: evidence.id, eventId: event.eventId } });
    await addAuditEvent({ actor: req.user.id, action: 'EVIDENCE_CUSTODY_APPENDED', resource: 'Evidence', resourceId: evidence.id, metadata: { eventId: event.eventId, recipient, location } });
    return sendData(res, { evidence: { ...evidence, ...updated }, custodyEvent: event }, 201);
}));

router.post('/:id/transfer', requireAuth, evidenceWriter, asyncRoute(async (req, res) => {
    const { evidence } = await evidenceContext(req, { write: true });
    const recipient = textValue(req.body?.recipient || req.body?.to);
    const location = textValue(req.body?.location);
    const reason = textValue(req.body?.reason);
    if (!recipient || !location || !reason) return sendError(res, 422, 'VALIDATION_ERROR', 'Recipient, location, and reason are required.');
    const previous = (await readCollection('custodyEvents')).filter((item) => item.evidenceId === evidence.id).at(-1);
    const event = { eventId: `CUST-${crypto.randomUUID()}`, evidenceId: evidence.id, from: evidence.currentCustodian, to: recipient, timestamp: new Date().toISOString(), reason, location, previousHash: previous?.currentHash || 'GENESIS', hashAlgorithm: HASH_ALGORITHM };
    event.currentHash = sha256Hash(canonicalCustodyPayload(event, event.previousHash));
    await appendChronological('custodyEvents', event);
    const update = { currentCustodian: recipient, location, status: 'Transferred', updatedAt: new Date().toISOString() };
    update.evidenceHash = evidenceHashForEvidence({ ...evidence, ...update });
    update.signature = signPayload(signaturePayload({ ...evidence, ...update }));
    update.signatureAlgorithm = 'Ed25519';
    update.signatureStatus = 'VALID';
    await updateCollectionItem('evidence', evidence.id, update);
    await addAuditEvent({ actor: req.user.id, action: 'EVIDENCE_TRANSFERRED', resource: 'Evidence', resourceId: evidence.id, metadata: { recipient, location } });
    return sendData(res, { evidence: { ...evidence, ...update }, custodyEvent: event });
}));

router.get('/:id/verify-custody', requireAuth, asyncRoute(async (req, res) => {
    const { evidence } = await evidenceContext(req);
    const events = (await readCollection('custodyEvents')).filter((item) => item.evidenceId === evidence.id);
    const result = events.length ? verifyCustodyChain(events) : { valid: false, reason: 'No custody events recorded.' };
    return sendData(res, { evidenceId: evidence.id, algorithm: HASH_ALGORITHM, ...result });
}));
router.post('/:id/verify-custody', requireAuth, asyncRoute(async (req, res) => {
    const { evidence } = await evidenceContext(req);
    const events = (await readCollection('custodyEvents')).filter((item) => item.evidenceId === evidence.id);
    const result = events.length ? verifyCustodyChain(events) : { valid: false, reason: 'No custody events recorded.' };
    return sendData(res, { evidenceId: evidence.id, algorithm: HASH_ALGORITHM, ...result });
}));

async function verifyEvidenceIntegrity(req, res) {
    const { evidence } = await evidenceContext(req);
    const currentHash = evidenceHashForEvidence(evidence);
    const legacyHashes = legacyEvidenceHashes(evidence);
    const registeredHash = evidence.evidenceHash;
    const verified = registeredHash === currentHash || legacyHashes.has(registeredHash);
    const legacyHash = [...legacyHashes].includes(registeredHash) ? registeredHash : null;
    const signatureStatus = evidence.signature ? (verifySignature(signaturePayload(evidence), evidence.signature) ? 'VALID' : 'INVALID') : 'UNSIGNED';
    const checkedAt = new Date().toISOString();
    await updateCollectionItem('evidence', evidence.id, { currentVerificationState: verified ? 'VERIFIED' : 'COMPROMISED', signatureStatus, lastVerified: checkedAt });
    await addAuditEvent({ actor: req.user.id, action: 'EVIDENCE_INTEGRITY_VERIFIED', resource: 'Evidence', resourceId: evidence.id, metadata: { verified, algorithm: HASH_ALGORITHM } });
    return sendData(res, { evidenceId: evidence.id, status: verified ? 'VERIFIED' : 'COMPROMISED', algorithm: HASH_ALGORITHM, registeredHash, currentHash: registeredHash === legacyHash ? legacyHash : currentHash, lastVerified: checkedAt, signatureAlgorithm: 'Ed25519', signatureStatus, message: verified ? 'The evidence record matches its registered integrity hash.' : 'The evidence record does not match its registered integrity hash.' });
}

router.post('/:id/verify', requireAuth, asyncRoute(verifyEvidenceIntegrity));
router.post('/:id/verify-integrity', requireAuth, asyncRoute(verifyEvidenceIntegrity));

router.get('/:id', requireAuth, asyncRoute(async (req, res) => {
    const { evidence } = await evidenceContext(req);
    const custodyEvents = (await readCollection('custodyEvents')).filter((item) => item.evidenceId === evidence.id);
    return sendData(res, { ...evidence, custodyEvents, custodyChain: verifyCustodyChain(custodyEvents) });
}));

router.patch('/:id', requireAuth, evidenceWriter, asyncRoute(async (req, res) => {
    const { evidence } = await evidenceContext(req, { write: true });
    const allowed = ['type', 'description', 'collectedBy', 'collectionDate'];
    const update = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
    if (!Object.keys(update).length) return sendError(res, 422, 'VALIDATION_ERROR', 'No editable evidence fields were supplied.');
    const next = { ...evidence, ...update, updatedAt: new Date().toISOString() };
    const evidenceHash = evidenceHashForEvidence(next);
    const updated = await updateCollectionItem('evidence', evidence.id, { ...update, evidenceHash, signature: signPayload(signaturePayload({ ...evidence, ...update, evidenceHash })), signatureAlgorithm: 'Ed25519', signatureStatus: 'VALID', currentVerificationState: 'PENDING', updatedAt: next.updatedAt });
    await addAuditEvent({ actor: req.user.id, action: 'EVIDENCE_UPDATED', resource: 'Evidence', resourceId: evidence.id, metadata: { fields: Object.keys(update) } });
    return sendData(res, updated);
}));

router.delete('/:id', requireAuth, evidenceDeleter, asyncRoute(async (req, res) => {
    const { evidence } = await evidenceContext(req, { write: true });
    const deleted = await removeCollectionItem('evidence', evidence.id, { softDelete: false });
    await addAuditEvent({ actor: req.user.id, action: 'EVIDENCE_DELETED', resource: 'Evidence', resourceId: evidence.id });
    return sendData(res, { deleted: true, evidence: deleted });
}));

export default router;
