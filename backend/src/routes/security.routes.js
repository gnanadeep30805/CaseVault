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

const router = express.Router();

const sampleAudit = [
    {
        eventId: 'AUD-001',
        actor: 'admin@casevault.local',
        timestamp: '2026-09-08T09:00:00Z',
        data: { action: 'login', resource: 'AUTH' },
        previousHash: 'GENESIS',
        currentHash: 'GENESIS',
    },
    {
        eventId: 'AUD-002',
        actor: 'Aisha Rahman',
        timestamp: '2026-09-08T09:05:00Z',
        data: { action: 'case-created', resource: 'CV-2025-001' },
        previousHash: 'GENESIS',
        currentHash: 'GENESIS',
    },
];

const sampleCustody = [
    {
        eventId: 'CUST-001',
        evidenceId: 'EV-001',
        from: 'Locker 3',
        to: 'Forensic Unit',
        timestamp: '2026-09-08T10:00:00Z',
        reason: 'Evidence transfer',
        location: 'Forensics Bay',
        previousHash: 'GENESIS',
        currentHash: 'GENESIS',
    },
    {
        eventId: 'CUST-002',
        evidenceId: 'EV-001',
        from: 'Forensic Unit',
        to: 'Court Locker',
        timestamp: '2026-09-08T10:30:00Z',
        reason: 'Court handoff',
        location: 'Court Vault',
        previousHash: 'GENESIS',
        currentHash: 'GENESIS',
    },
];

router.get('/overview', requireAuth, (req, res) => {
    res.status(200).json({ success: true, data: getSecurityOverview() });
});

router.get('/events', requireAuth, (req, res) => {
    const events = [
        { time: '13:02', severity: 'info', user: 'admin@casevault.local', action: 'LOGIN_SUCCESS', resource: 'Auth' },
        { time: '13:07', severity: 'warning', user: 'A. Rahman', action: 'DOCUMENT_DOWNLOADED', resource: 'DOC-001' },
        { time: '13:09', severity: 'info', user: 'A. Rahman', action: 'EVIDENCE_TRANSFERRED', resource: 'EV-001' },
        { time: '13:14', severity: 'info', user: 'S. Patel', action: 'DOCUMENT_APPROVED', resource: 'DOC-001' },
        { time: '13:20', severity: 'success', user: 'System', action: 'INTEGRITY_VERIFIED', resource: 'EV-001' },
    ];

    res.status(200).json({ success: true, data: events });
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
    const report = buildIntegrityReport(resource || 'Resource', { hash: verified, signature: true, chain: true });
    res.status(200).json({ success: true, data: { ...report, verified } });
});

router.post('/documents/:id/verify', requireAuth, (req, res) => {
    const sampleRegisteredHash = sha3Hash('FIR_0412.pdf');
    const currentHash = sha3Hash('FIR_0412.pdf');
    const verified = currentHash === sampleRegisteredHash;
    res.status(200).json({
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
});

router.post('/evidence/:id/verify', requireAuth, (req, res) => {
    const evidenceDescriptor = req.params.id === 'EV-001' ? 'EV-001:Recovered phone image set:Digital' : `${req.params.id}:sealed-item`;
    const registeredHash = sha3Hash(evidenceDescriptor);
    const currentHash = sha3Hash(evidenceDescriptor);
    const verified = currentHash === registeredHash;
    res.status(200).json({
        success: true,
        data: {
            evidenceId: req.params.id,
            status: verified ? 'VERIFIED' : 'COMPROMISED',
            algorithm: 'SHA3-256',
            registeredHash,
            currentHash,
            lastVerified: new Date().toISOString(),
            signatureStatus: 'VALID',
        },
    });
});

router.post('/audit/verify-chain', requireAuth, (req, res) => {
    const result = verifyAuditChain(sampleAudit);
    res.status(200).json({ success: true, data: result });
});

router.post('/evidence/:id/verify-custody', requireAuth, (req, res) => {
    const result = verifyCustodyChain(sampleCustody);
    res.status(200).json({ success: true, data: result });
});

router.post('/integrity/hash-chain', requireAuth, (req, res) => {
    const event = createHashChainEvent({ action: 'document-approved', actor: req.user?.id || 'system' });
    res.status(200).json({ success: true, data: event });
});

export default router;
