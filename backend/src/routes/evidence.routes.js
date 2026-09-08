import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sha3Hash, verifyCustodyChain } from '../services/security-core.js';
import { addAuditEvent, appendChronological, appendToCollection, readCollection, updateCollectionItem } from '../services/store.js';

const router = express.Router();

const evidence = [
    {
        id: 'EV-001',
        caseId: 'case-1001',
        caseNumber: 'CV-2025-001',
        type: 'Digital',
        description: 'Recovered phone image set',
        collectedBy: 'M. Rao',
        collectionDate: '2025-01-16',
        currentCustodian: 'Forensics Unit',
        location: 'Evidence Locker 3',
        status: 'Verified',
        hashAlgorithm: 'SHA3-256',
        evidenceHash: sha3Hash('EV-001:Recovered phone image set:Digital'),
        registeredAt: '2026-09-08T10:00:00Z',
        currentVerificationState: 'VERIFIED',
    },
    {
        id: 'EV-002',
        caseId: 'case-1002',
        caseNumber: 'CV-2025-002',
        type: 'Physical',
        description: 'Seized ledger book',
        collectedBy: 'D. Prasad',
        collectionDate: '2025-01-21',
        currentCustodian: 'Ops Desk',
        location: 'Secure Vault',
        status: 'Stored',
        hashAlgorithm: 'SHA3-256',
        evidenceHash: sha3Hash('EV-002:Seized ledger book:Physical'),
        registeredAt: '2026-09-08T11:30:00Z',
        currentVerificationState: 'PENDING',
    },
];

const custodyEvents = [
    {
        eventId: 'CUST-001',
        evidenceId: 'EV-001',
        from: 'Locker 3',
        to: 'Forensic Unit',
        timestamp: '2026-09-08T10:00:00Z',
        reason: 'Evidence transfer',
        location: 'Forensics Bay',
        previousHash: 'GENESIS',
        currentHash: sha3Hash(JSON.stringify({ eventId: 'CUST-001', evidenceId: 'EV-001', from: 'Locker 3', to: 'Forensic Unit', reason: 'Evidence transfer', location: 'Forensics Bay', timestamp: '2026-09-08T10:00:00Z', previousHash: 'GENESIS' })),
    },
    {
        eventId: 'CUST-002',
        evidenceId: 'EV-001',
        from: 'Forensic Unit',
        to: 'Court Locker',
        timestamp: '2026-09-08T10:30:00Z',
        reason: 'Court handoff',
        location: 'Court Vault',
        previousHash: sha3Hash(JSON.stringify({ eventId: 'CUST-001', evidenceId: 'EV-001', from: 'Locker 3', to: 'Forensic Unit', reason: 'Evidence transfer', location: 'Forensics Bay', timestamp: '2026-09-08T10:00:00Z', previousHash: 'GENESIS' })),
        currentHash: sha3Hash(JSON.stringify({ eventId: 'CUST-002', evidenceId: 'EV-001', from: 'Forensic Unit', to: 'Court Locker', reason: 'Court handoff', location: 'Court Vault', timestamp: '2026-09-08T10:30:00Z', previousHash: sha3Hash(JSON.stringify({ eventId: 'CUST-001', evidenceId: 'EV-001', from: 'Locker 3', to: 'Forensic Unit', reason: 'Evidence transfer', location: 'Forensics Bay', timestamp: '2026-09-08T10:00:00Z', previousHash: 'GENESIS' })) })),
    },
];

router.get('/', requireAuth, async (req, res, next) => {
    try {
        res.status(200).json({ success: true, data: await readCollection('evidence') });
    } catch (error) {
        next(error);
    }
});

router.post('/', requireAuth, async (req, res, next) => {
    const body = req.body || {};
    if (!body.caseId || !body.type || !body.description || !body.collectionDate || !body.collectedBy) {
        return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Case, type, description, collection date, and collector are required.' } });
    }
    try {
        const evidenceItem = {
            id: `EV-${Date.now()}`, caseId: body.caseId, caseNumber: body.caseNumber || null, type: body.type,
            description: body.description, collectedBy: body.collectedBy, collectionDate: body.collectionDate,
            currentCustodian: body.custodian || req.user.id, location: body.location || 'Unassigned', status: 'Registered',
            hashAlgorithm: 'SHA3-256', evidenceHash: sha3Hash(`${body.description}:${body.type}:${body.collectionDate}`),
            registeredAt: new Date().toISOString(), currentVerificationState: 'PENDING',
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
    const items = await readCollection('evidence');
    const found = items.find((item) => item.id === req.params.id);
    if (!found) {
        return res.status(404).json({ success: false, error: { code: 'EVIDENCE_NOT_FOUND', message: 'Evidence not found.' } });
    }
    return res.status(200).json({ success: true, data: found });
    } catch (error) {
        next(error);
    }
});

router.post('/:id/verify', requireAuth, async (req, res, next) => {
    try {
    const items = await readCollection('evidence');
    const found = items.find((item) => item.id === req.params.id);
    if (!found) {
        return res.status(404).json({ success: false, error: { code: 'EVIDENCE_NOT_FOUND', message: 'Evidence not found.' } });
    }

    const currentHash = sha3Hash(`${found.id}:${found.description}:${found.type}`);
    const verified = currentHash === found.evidenceHash;
    await updateCollectionItem('evidence', found.id, { currentVerificationState: verified ? 'VERIFIED' : 'COMPROMISED' });
    await addAuditEvent({ actor: req.user.id, action: 'EVIDENCE_INTEGRITY_VERIFIED', resource: 'Evidence', resourceId: found.id, metadata: { verified } });

    return res.status(200).json({
        success: true,
        data: {
            evidenceId: found.id,
            status: verified ? 'VERIFIED' : 'COMPROMISED',
            algorithm: 'SHA3-256',
            registeredHash: found.evidenceHash,
            currentHash,
            lastVerified: new Date().toISOString(),
            signatureStatus: verified ? 'VALID' : 'INVALID',
            message: verified
                ? 'The current evidence record matches its registered integrity hash.'
                : 'The current evidence does not match its registered integrity hash.',
        },
    });
    } catch (error) {
        next(error);
    }
});

router.post('/:id/transfer', requireAuth, async (req, res, next) => {
    const body = req.body || {};
    if (!body.recipient || !body.location || !body.reason) {
        return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Recipient, location, and reason are required.' } });
    }
    try {
        const items = await readCollection('evidence');
        const found = items.find((item) => item.id === req.params.id);
        if (!found) return res.status(404).json({ success: false, error: { code: 'EVIDENCE_NOT_FOUND', message: 'Evidence not found.' } });
        const previousCustodian = found.currentCustodian;
        const timestamp = new Date().toISOString();
        const events = await readCollection('custodyEvents');
        const previousHash = events.find((item) => item.evidenceId === found.id)?.currentHash || 'GENESIS';
        const event = { eventId: `CUST-${Date.now()}`, evidenceId: found.id, from: previousCustodian, to: body.recipient, timestamp, reason: body.reason, location: body.location, previousHash };
        event.currentHash = sha3Hash(JSON.stringify(event));
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
    const events = await readCollection('custodyEvents');
    const related = events.filter((item) => item.evidenceId === req.params.id);
    const result = verifyCustodyChain(related);
    return res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

export default router;
