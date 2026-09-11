import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
    buildIntegrityReport,
    createHashChainEvent,
    getSecurityOverview,
    sha3Hash,
    verifyAuditChain,
    verifyCustodyChain,
} from '../services/security-core.js';
import { readCollection } from '../services/store.js';

const router = express.Router();

function evidenceHash(evidence) {
    const current = sha3Hash(`${evidence.id}:${evidence.description}:${evidence.type}:${evidence.collectionDate}`);
    const legacy = sha3Hash(`${evidence.id}:${evidence.description}:${evidence.type}`);
    return { current, legacy };
}

function notFound(res, message) {
    return res.status(404).json({ success: false, error: { code: 'RESOURCE_NOT_FOUND', message } });
}

router.get('/overview', requireAuth, (req, res) => {
    res.status(200).json({ success: true, data: getSecurityOverview() });
});

router.get('/events', requireAuth, async (req, res, next) => {
    try {
        const events = await readCollection('auditLogs');
        res.status(200).json({ success: true, data: events });
    } catch (error) {
        next(error);
    }
});

router.get('/alerts', requireAuth, (req, res) => {
    const alerts = [
        { id: 'SEC-101', severity: 'warning', title: 'MFA challenge pending', message: 'Two high-risk actions require secondary verification.' },
        { id: 'SEC-102', severity: 'info', title: 'Custody chain healthy', message: 'No chain-of-custody drift detected.' },
    ];
    res.status(200).json({ success: true, data: alerts });
});

router.post('/integrity/verify', requireAuth, (req, res) => {
    const { resource, currentHash, registeredHash } = req.body || {};
    const candidate = currentHash || resource || '';
    const verified = Boolean(registeredHash) && (candidate === registeredHash || sha3Hash(candidate) === registeredHash);
    const report = buildIntegrityReport(resource || 'Resource', { hash: verified });
    res.status(200).json({ success: true, data: { ...report, verified } });
});

router.post('/documents/:id/verify', requireAuth, async (req, res, next) => {
    try {
        const document = (await readCollection('documents')).find((item) => item.id === req.params.id);
        if (!document) return notFound(res, 'Document not found.');
        const sampleRegisteredHash = document.registeredHash;
        const currentHash = sha3Hash(req.body?.content || document.fileName);
        const verified = currentHash === sampleRegisteredHash;
        return res.status(200).json({
            success: true,
            data: {
                documentId: req.params.id,
                status: verified ? 'VERIFIED' : 'COMPROMISED',
                algorithm: 'SHA3-256',
                registeredHash: sampleRegisteredHash,
                currentHash,
                lastVerified: new Date().toISOString(),
                message: verified
                    ? 'Hash matches the registered document hash.'
                    : 'The current document does not match its registered integrity hash.',
            },
        });
    } catch (error) {
        next(error);
    }
});

router.post('/evidence/:id/verify', requireAuth, async (req, res, next) => {
    try {
        const evidence = (await readCollection('evidence')).find((item) => item.id === req.params.id);
        if (!evidence) return notFound(res, 'Evidence not found.');
        const hashes = evidenceHash(evidence);
        const registeredHash = evidence.evidenceHash;
        const currentHash = registeredHash === hashes.legacy ? hashes.legacy : hashes.current;
        const verified = registeredHash === hashes.current || registeredHash === hashes.legacy;
        return res.status(200).json({
            success: true,
            data: {
                evidenceId: req.params.id,
                status: verified ? 'VERIFIED' : 'COMPROMISED',
                algorithm: 'SHA3-256',
                registeredHash,
                currentHash,
                lastVerified: new Date().toISOString(),
                signatureStatus: 'NOT_IMPLEMENTED',
            },
        });
    } catch (error) {
        next(error);
    }
});

router.post('/audit/verify-chain', requireAuth, async (req, res, next) => {
    try {
        const result = verifyAuditChain(await readCollection('auditLogs'));
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

router.post('/evidence/:id/verify-custody', requireAuth, async (req, res, next) => {
    try {
        const evidence = (await readCollection('evidence')).find((item) => item.id === req.params.id);
        if (!evidence) return notFound(res, 'Evidence not found.');
        const events = (await readCollection('custodyEvents')).filter((item) => item.evidenceId === evidence.id);
        const result = events.length ? verifyCustodyChain(events) : { valid: false, reason: 'No custody events recorded.' };
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

router.post('/integrity/hash-chain', requireAuth, (req, res) => {
    const event = createHashChainEvent({ action: 'document-approved', actor: req.user?.id || 'system' });
    res.status(200).json({ success: true, data: event });
});

export default router;
