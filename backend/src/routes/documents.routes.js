import express from 'express';
import { env } from '../config/env.js';
import { canAccessResource, filterAccessibleResources, requireAuth, requireRole } from '../middleware/auth.js';
import { decryptBuffer, encryptBuffer, sha3Hash, signPayload, verifySignature } from '../services/security-core.js';
import { addAuditEvent, appendToCollection, readCollection, updateCollectionItem } from '../services/store.js';

const router = express.Router();

function signaturePayload(document) {
    return `${document.id}:${document.registeredHash}`;
}

function protectedContent(content) {
    const encrypted = encryptBuffer(Buffer.from(content, 'utf8'), env.documentStorageKey, { keyId: 'document-storage-v1' });
    return {
        encryptedContent: encrypted.encryptedData.toString('base64'),
        contentNonce: encrypted.nonce.toString('base64'),
        contentTag: encrypted.tag.toString('base64'),
        contentKeyId: encrypted.keyId,
    };
}

function readProtectedContent(document) {
    if (!document.encryptedContent || !document.contentNonce || !document.contentTag) return document.fileName;
    return decryptBuffer({
        encryptedData: Buffer.from(document.encryptedContent, 'base64'),
        nonce: Buffer.from(document.contentNonce, 'base64'),
        tag: Buffer.from(document.contentTag, 'base64'),
    }, env.documentStorageKey).toString('utf8');
}

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
        const cases = new Map((await readCollection('cases')).map((item) => [item.id, item]));
        const query = String(req.query.search || '').trim().toLowerCase();
        const data = filterAccessibleResources(req.user, items, cases).filter((item) => !query || [item.id, item.fileName, item.caseNumber, item.category].some((value) => String(value).toLowerCase().includes(query)));
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

router.post('/', requireAuth, requireRole('Administrator', 'Supervisor', 'Investigation Officer'), async (req, res, next) => {
    const body = req.body || {};
    const fileName = String(body.fileName || '');
    const content = body.content == null ? '' : String(body.content);
    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.xml', '.txt'];
    const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
    if (!fileName || !body.caseId || !body.category || !body.classification) {
        return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'File name, case, category, and classification are required.' } });
    }
    if (fileName !== fileName.split(/[\\/]/).pop() || fileName.includes('..')) {
        return res.status(422).json({ success: false, error: { code: 'INVALID_FILE_NAME', message: 'Path traversal is not allowed.' } });
    }
    if (!allowedExtensions.includes(extension)) {
        return res.status(415).json({ success: false, error: { code: 'UNSUPPORTED_FILE_TYPE', message: 'This file type is not supported.' } });
    }
    if (Buffer.byteLength(content, 'utf8') > 10 * 1024 * 1024) {
        return res.status(413).json({ success: false, error: { code: 'FILE_TOO_LARGE', message: 'Document exceeds the 10 MB limit.' } });
    }
    try {
        const items = await readCollection('documents');
        const relatedCase = (await readCollection('cases')).find((item) => item.id === body.caseId);
        if (!relatedCase) return res.status(404).json({ success: false, error: { code: 'CASE_NOT_FOUND', message: 'Case not found.' } });
        if (!canAccessResource(req.user, { classification: body.classification }, relatedCase)) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You cannot add a document to this case.' } });
        const duplicate = items.some((item) => item.caseId === body.caseId && item.fileName === fileName);
        if (duplicate) return res.status(409).json({ success: false, error: { code: 'DUPLICATE_DOCUMENT', message: 'A document with this name already exists for the case.' } });
        const timestamp = new Date().toISOString();
        const document = {
            id: `DOC-${Date.now()}`, fileName, caseId: body.caseId, caseNumber: body.caseNumber || null,
            category: body.category, classification: body.classification, version: '1.0', uploadedBy: req.user.id,
            uploadedAt: timestamp, status: 'Pending', integrityStatus: 'PENDING', algorithm: 'SHA3-256',
            registeredHash: sha3Hash(content || fileName), lastVerified: null,
        };
        Object.assign(document, protectedContent(content || fileName));
        document.signatureAlgorithm = 'Ed25519';
        document.signature = signPayload(signaturePayload(document));
        document.signatureStatus = 'VALID';
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
        const cases = new Map((await readCollection('cases')).map((item) => [item.id, item]));
        const found = items.find((item) => item.id === req.params.id);
        if (!found) {
            return res.status(404).json({ success: false, error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' } });
        }
        if (!canAccessResource(req.user, found, cases.get(found.caseId))) return res.status(404).json({ success: false, error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' } });
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

        const currentHash = sha3Hash(req.body?.content || readProtectedContent(found));
        const verified = currentHash === found.registeredHash;
        const signatureValid = verifySignature(signaturePayload(found), found.signature);
        const signatureStatus = found.signature ? (signatureValid ? 'VALID' : 'INVALID') : 'UNSIGNED';
        await updateCollectionItem('documents', found.id, { integrityStatus: verified ? 'VERIFIED' : 'COMPROMISED', signatureStatus, lastVerified: new Date().toISOString() });
        await addAuditEvent({ actor: req.user.id, action: 'DOCUMENT_INTEGRITY_VERIFIED', resource: 'Document', resourceId: found.id, metadata: { verified } });

        return res.status(200).json({
            success: true,
            data: {
                documentId: found.id,
                integrityStatus: verified ? 'VERIFIED' : 'COMPROMISED',
                algorithm: 'SHA3-256',
                registeredHash: found.registeredHash,
                currentHash,
                signatureAlgorithm: 'Ed25519',
                signatureStatus,
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

router.get('/:id/content', requireAuth, async (req, res, next) => {
    try {
        const items = await readCollection('documents');
        const cases = new Map((await readCollection('cases')).map((item) => [item.id, item]));
        const document = items.find((item) => item.id === req.params.id);
        if (!document || !canAccessResource(req.user, document, cases.get(document.caseId))) return res.status(404).json({ success: false, error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' } });
        const content = readProtectedContent(document);
        res.status(200).json({ success: true, data: { documentId: document.id, content: Buffer.from(content, 'utf8').toString('base64'), encoding: 'base64' } });
    } catch (error) {
        next(error);
    }
});

router.get('/:id/versions', requireAuth, async (req, res, next) => {
    try {
        const document = (await readCollection('documents')).find((item) => item.id === req.params.id);
        if (!document) return res.status(404).json({ success: false, error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' } });
        const versions = (await readCollection('documents')).filter((item) => item.versionOf === document.id || item.id === document.id);
        res.status(200).json({ success: true, data: versions });
    } catch (error) {
        next(error);
    }
});

router.post('/:id/approve', requireAuth, requireRole('Administrator', 'Supervisor', 'Legal Officer'), async (req, res, next) => {
    try {
        const document = (await readCollection('documents')).find((item) => item.id === req.params.id);
        if (!document) return res.status(404).json({ success: false, error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' } });
        if (document.status === 'Approved') return res.status(409).json({ success: false, error: { code: 'ALREADY_APPROVED', message: 'Document is already approved.' } });
        const updated = await updateCollectionItem('documents', document.id, { status: 'Approved', approvedBy: req.user.id, approvedAt: new Date().toISOString() });
        await addAuditEvent({ actor: req.user.id, action: 'DOCUMENT_APPROVED', resource: 'Document', resourceId: document.id });
        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
});

router.post('/:id/reject', requireAuth, requireRole('Administrator', 'Supervisor', 'Legal Officer'), async (req, res, next) => {
    try {
        const document = (await readCollection('documents')).find((item) => item.id === req.params.id);
        if (!document) return res.status(404).json({ success: false, error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' } });
        if (document.status === 'Approved') return res.status(409).json({ success: false, error: { code: 'APPROVED_DOCUMENT_IMMUTABLE', message: 'Approved documents require a new version.' } });
        const updated = await updateCollectionItem('documents', document.id, { status: 'Rejected', rejectionReason: req.body?.reason || 'No reason supplied' });
        await addAuditEvent({ actor: req.user.id, action: 'DOCUMENT_REJECTED', resource: 'Document', resourceId: document.id });
        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
});

router.post('/:id/versions', requireAuth, requireRole('Administrator', 'Supervisor', 'Investigation Officer'), async (req, res, next) => {
    const body = req.body || {};
    try {
        const items = await readCollection('documents');
        const original = items.find((item) => item.id === req.params.id);
        if (!original) return res.status(404).json({ success: false, error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' } });
        const content = body.content == null ? '' : String(body.content);
        const currentVersion = Math.max(...items.filter((item) => item.id === original.id || item.versionOf === original.id).map((item) => Number.parseFloat(item.version) || 0));
        const version = (currentVersion + 1).toFixed(1);
        const nextDocument = { ...original, id: `DOC-${Date.now()}`, version, versionOf: original.versionOf || original.id, uploadedBy: req.user.id, uploadedAt: new Date().toISOString(), status: 'Pending', integrityStatus: 'PENDING', registeredHash: sha3Hash(content || original.fileName), lastVerified: null };
        Object.assign(nextDocument, protectedContent(content || original.fileName));
        nextDocument.signatureAlgorithm = 'Ed25519';
        nextDocument.signature = signPayload(signaturePayload(nextDocument));
        nextDocument.signatureStatus = 'VALID';
        await appendToCollection('documents', nextDocument);
        await addAuditEvent({ actor: req.user.id, action: 'DOCUMENT_VERSION_CREATED', resource: 'Document', resourceId: nextDocument.id, metadata: { version } });
        res.status(201).json({ success: true, data: nextDocument });
    } catch (error) {
        next(error);
    }
});

export default router;
