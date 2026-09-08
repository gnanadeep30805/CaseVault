import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sha3Hash, verifyCustodyChain } from '../services/security-core.js';

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

router.get('/', requireAuth, (req, res) => {
    res.status(200).json({ success: true, data: evidence });
});

router.get('/:id', requireAuth, (req, res) => {
    const found = evidence.find((item) => item.id === req.params.id);
    if (!found) {
        return res.status(404).json({ success: false, error: { code: 'EVIDENCE_NOT_FOUND', message: 'Evidence not found.' } });
    }
    return res.status(200).json({ success: true, data: found });
});

router.post('/:id/verify', requireAuth, (req, res) => {
    const found = evidence.find((item) => item.id === req.params.id);
    if (!found) {
        return res.status(404).json({ success: false, error: { code: 'EVIDENCE_NOT_FOUND', message: 'Evidence not found.' } });
    }

    const currentHash = sha3Hash(`${found.id}:${found.description}:${found.type}`);
    const verified = currentHash === found.evidenceHash;

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
});

router.post('/:id/verify-custody', requireAuth, (req, res) => {
    const related = custodyEvents.filter((item) => item.evidenceId === req.params.id);
    const result = verifyCustodyChain(related);
    return res.status(200).json({ success: true, data: result });
});

export default router;
