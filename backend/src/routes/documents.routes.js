import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sha3Hash } from '../services/security-core.js';

const router = express.Router();

const documents = [
    {
        id: 'DOC-001',
        fileName: 'FIR_0412.pdf',
        caseId: 'case-1001',
        caseNumber: 'CV-2025-001',
        category: 'FIR',
        classification: 'CONFIDENTIAL',
        version: '1.0',
        uploadedBy: 'Aisha Rahman',
        uploadedAt: '2026-02-10T09:30:00Z',
        status: 'Approved',
        integrityStatus: 'VERIFIED',
        algorithm: 'SHA3-256',
        registeredHash: sha3Hash('FIR_0412.pdf'),
        lastVerified: '2026-09-08T11:05:00Z',
    },
    {
        id: 'DOC-002',
        fileName: 'Statement_011.xml',
        caseId: 'case-1002',
        caseNumber: 'CV-2025-002',
        category: 'Statement',
        classification: 'RESTRICTED',
        version: '2.0',
        uploadedBy: 'K. Singh',
        uploadedAt: '2026-02-11T11:10:00Z',
        status: 'Pending',
        integrityStatus: 'PENDING',
        algorithm: 'SHA3-256',
        registeredHash: sha3Hash('Statement_011.xml'),
        lastVerified: null,
    },
];

router.get('/', requireAuth, (req, res) => {
    res.status(200).json({ success: true, data: documents });
});

router.get('/:id', requireAuth, (req, res) => {
    const found = documents.find((item) => item.id === req.params.id);
    if (!found) {
        return res.status(404).json({ success: false, error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' } });
    }
    return res.status(200).json({ success: true, data: found });
});

router.post('/:id/verify', requireAuth, (req, res) => {
    const found = documents.find((item) => item.id === req.params.id);
    if (!found) {
        return res.status(404).json({ success: false, error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' } });
    }

    const currentHash = sha3Hash(found.fileName);
    const verified = currentHash === found.registeredHash;

    return res.status(200).json({
        success: true,
        data: {
            documentId: found.id,
            integrityStatus: verified ? 'VERIFIED' : 'COMPROMISED',
            algorithm: 'SHA3-256',
            registeredHash: found.registeredHash,
            currentHash,
            lastVerified: new Date().toISOString(),
            message: verified
                ? 'Hash matches the registered document hash.'
                : 'The current document does not match its registered integrity hash.',
        },
    });
});

export default router;
