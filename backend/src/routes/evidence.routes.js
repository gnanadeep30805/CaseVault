import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sha3Hash, verifyCustodyChain } from '../services/security-core.js';
import { addAuditEvent, appendChronological, appendToCollection, readCollection, updateCollectionItem } from '../services/store.js';

const router = express.Router();
const evidenceWriter = requireRole('Administrator', 'Supervisor', 'Investigation Officer');

function createEvidenceHash({ id, description, type, collectionDate }) {
    return sha3Hash(`${id}:${description}:${type}${collectionDate ? `:${collectionDate}` : ''}`);
}

function createLegacyEvidenceHash({ id, description, type }) {
    return sha3Hash(`${id}:${description}:${type}`);
}

function createCustodyHash(event) {
    return sha3Hash(JSON.stringify({
        eventId: event.eventId,
        evidenceId: event.evidenceId,
        from: event.from,
        to: event.to,
        reason: event.reason,
        location: event.location,
        timestamp: event.timestamp,
        previousHash: event.previousHash,
    }));
}

router.get('/', requireAuth, async (req, res, next) => {
    try {
        res.status(200).json({ success: true, data: await readCollection('evidence') });
    } catch (error) {
        next(error);
    }
});

router.post('/', requireAuth, evidenceWriter, async (req, res, next) => {
    const body = req.body || {};
    if (!body.caseId || !body.type || !body.description || !body.collectionDate || !body.collectedBy) {
        return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Case, type, description, collection date, and collector are required.' } });
    }
    try {
        const evidenceId = `EV-${Date.now()}`;
        const evidenceItem = {
            id: evidenceId,
            caseId: body.caseId,
            caseNumber: body.caseNumber || null,
            type: body.type,
            description: body.description,
            collectedBy: body.collectedBy,
            collectionDate: body.collectionDate,
            currentCustodian: body.custodian || req.user.id,
            location: body.location || 'Unassigned',
            status: 'Registered',
            hashAlgorithm: 'SHA3-256',
            evidenceHash: createEvidenceHash({ id: evidenceId, description: body.description, type: body.type, collectionDate: body.collectionDate }),
            registeredAt: new Date().toISOString(),
            currentVerificationState: 'PENDING',
        };
        await appendToCollection('evidence', evidenceItem);
        await addAuditEvent({ actor: req.user.id, action: 'EVIDENCE_REGISTERED', resource: 'Evidence', resourceId: evidenceItem.id });
        res.status(201).json({ success: true, data: evidenceItem });
    } catch (error) {
        next(error);
    }
});

router.get('/:id', requireAuth, async (req, res, next) => {
    try {
        const found = (await readCollection('evidence')).find((item) => item.id === req.params.id);
        if (!found) return res.status(404).json({ success: false, error: { code: 'EVIDENCE_NOT_FOUND', message: 'Evidence not found.' } });
        res.status(200).json({ success: true, data: found });
    } catch (error) {
        next(error);
    }
});

router.post('/:id/verify', requireAuth, async (req, res, next) => {
    try {
        const found = (await readCollection('evidence')).find((item) => item.id === req.params.id);
        if (!found) return res.status(404).json({ success: false, error: { code: 'EVIDENCE_NOT_FOUND', message: 'Evidence not found.' } });
        const currentHash = createEvidenceHash(found);
        const legacyHash = createLegacyEvidenceHash(found);
        const verified = found.evidenceHash === currentHash || found.evidenceHash === legacyHash;
        await updateCollectionItem('evidence', found.id, { currentVerificationState: verified ? 'VERIFIED' : 'COMPROMISED' });
        await addAuditEvent({ actor: req.user.id, action: 'EVIDENCE_INTEGRITY_VERIFIED', resource: 'Evidence', resourceId: found.id, metadata: { verified } });
        res.status(200).json({
            success: true,
            data: {
                evidenceId: found.id,
                status: verified ? 'VERIFIED' : 'COMPROMISED',
                algorithm: 'SHA3-256',
                registeredHash: found.evidenceHash,
                currentHash: found.evidenceHash === legacyHash ? legacyHash : currentHash,
                lastVerified: new Date().toISOString(),
                signatureStatus: 'NOT_IMPLEMENTED',
                message: verified ? 'The current evidence record matches its registered integrity hash.' : 'The current evidence does not match its registered integrity hash.',
            },
        });
    } catch (error) {
        next(error);
    }
});

router.post('/:id/transfer', requireAuth, evidenceWriter, async (req, res, next) => {
    const body = req.body || {};
    if (!body.recipient || !body.location || !body.reason) {
        return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Recipient, location, and reason are required.' } });
    }
    try {
        const found = (await readCollection('evidence')).find((item) => item.id === req.params.id);
        if (!found) return res.status(404).json({ success: false, error: { code: 'EVIDENCE_NOT_FOUND', message: 'Evidence not found.' } });
        const events = await readCollection('custodyEvents');
        const previousHash = events.filter((item) => item.evidenceId === found.id).at(-1)?.currentHash || 'GENESIS';
        const event = {
            eventId: `CUST-${Date.now()}`,
            evidenceId: found.id,
            from: found.currentCustodian,
            to: body.recipient,
            timestamp: new Date().toISOString(),
            reason: body.reason,
            location: body.location,
            previousHash,
        };
        event.currentHash = createCustodyHash(event);
        await appendChronological('custodyEvents', event);
        const updated = await updateCollectionItem('evidence', found.id, { currentCustodian: body.recipient, location: body.location, status: 'Transferred' });
        await addAuditEvent({ actor: req.user.id, action: 'EVIDENCE_TRANSFERRED', resource: 'Evidence', resourceId: found.id, metadata: { recipient: body.recipient, location: body.location } });
        res.status(200).json({ success: true, data: { evidence: updated, custodyEvent: event } });
    } catch (error) {
        next(error);
    }
});

router.post('/:id/verify-custody', requireAuth, async (req, res, next) => {
    try {
        const evidence = (await readCollection('evidence')).find((item) => item.id === req.params.id);
        if (!evidence) return res.status(404).json({ success: false, error: { code: 'EVIDENCE_NOT_FOUND', message: 'Evidence not found.' } });
        const events = (await readCollection('custodyEvents')).filter((item) => item.evidenceId === evidence.id);
        const result = events.length ? verifyCustodyChain(events) : { valid: false, reason: 'No custody events recorded.' };
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

export default router;
