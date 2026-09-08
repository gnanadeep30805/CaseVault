import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sha3Hash } from '../services/security-core.js';
import { addAuditEvent, appendToCollection, readCollection, updateCollectionItem } from '../services/store.js';

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

router.get('/', requireAuth, async (req, res, next) => {
    try {
        const items = await readCollection('documents');
        const query = String(req.query.search || '').trim().toLowerCase();
        const data = items.filter((item) => !query || [item.id, item.fileName, item.caseNumber, item.category].some((value) => String(value).toLowerCase().includes(query)));
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

router.post('/', requireAuth, async (req, res, next) => {
    const body = req.body || {};
    if (!body.fileName || !body.caseId || !body.category || !body.classification) {
        return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'File name, case, category, and classification are required.' } });
    }
    try {
        const items = await readCollection('documents');
        const duplicate = items.some((item) => item.caseId === body.caseId && item.fileName === body.fileName);
        if (duplicate) return res.status(409).json({ success: false, error: { code: 'DUPLICATE_DOCUMENT', message: 'A document with this name already exists for the case.' } });
        const timestamp = new Date().toISOString();
        const document = {
            id: `DOC-${Date.now()}`, fileName: body.fileName, caseId: body.caseId, caseNumber: body.caseNumber || null,
            category: body.category, classification: body.classification, version: '1.0', uploadedBy: req.user.id,
            uploadedAt: timestamp, status: 'Pending', integrityStatus: 'PENDING', algorithm: 'SHA3-256',
            registeredHash: sha3Hash(body.content || body.fileName), lastVerified: null,
        };
        await appendToCollection('documents', document);
        await addAuditEvent({ actor: req.user.id, action: 'DOCUMENT_CREATED', resource: 'Document', resourceId: document.id });
        res.status(201).json({ success: true, data: document });
    } catch (error) {
        next(error);
    }
});

router.get('/:id', requireAuth, async (req, res, next) => {
    try {
    const items = await readCollection('documents');
    const found = items.find((item) => item.id === req.params.id);
    if (!found) {
        return res.status(404).json({ success: false, error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' } });
    }
    return res.status(200).json({ success: true, data: found });
    } catch (error) {
        next(error);
    }
});

router.post('/:id/verify', requireAuth, async (req, res, next) => {
    try {
    const items = await readCollection('documents');
    const found = items.find((item) => item.id === req.params.id);
    if (!found) {
        return res.status(404).json({ success: false, error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' } });
    }

    const currentHash = sha3Hash(req.body?.content || found.fileName);
    const verified = currentHash === found.registeredHash;
    await updateCollectionItem('documents', found.id, { integrityStatus: verified ? 'VERIFIED' : 'COMPROMISED', lastVerified: new Date().toISOString() });
    await addAuditEvent({ actor: req.user.id, action: 'DOCUMENT_INTEGRITY_VERIFIED', resource: 'Document', resourceId: found.id, metadata: { verified } });

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
    } catch (error) {
        next(error);
    }
});

export default router;
