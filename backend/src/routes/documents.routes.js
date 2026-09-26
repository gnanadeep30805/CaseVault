import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { env } from '../config/env.js';
import { requireAuth, requireRole, requirePermission } from '../middleware/auth.js';
import { canAccessResource, clearanceForUser, findDocumentForUser, hasPermission } from '../services/authorization.service.js';
import { HASH_ALGORITHM, sha256Hash, signPayload, verifySignature } from '../services/security-core.js';
import { getUploadPayload, readEncryptedDocument, saveEncryptedDocument, toPublicDocument } from '../services/document-storage.service.js';
import { addAuditEvent, addNotification, addTimelineEvent, appendToCollection, getSecureStoragePath, readCollection, updateCollectionItem } from '../services/store.js';
import { asyncRoute, sendData, sendError, textValue } from '../utils/route-helpers.js';

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.documentMaxSize + 1, files: 2, fields: 30 },
});
const documentWriter = requirePermission('document:write');
const documentSharer = requirePermission('document:share');
const approver = requireRole('Administrator', 'Supervisor', 'Legal Officer');

function multipart(req, res, next) {
    upload.any()(req, res, (error) => {
        if (error) return next(error);
        if (Array.isArray(req.files) && req.files.length > 1) return next(Object.assign(new Error('Only one document file may be uploaded at a time.'), { code: 'TOO_MANY_FILES', status: 422 }));
        return next();
    });
}

async function documentContext(req, { write = false, permission = 'document:read' } = {}) {
    const shares = (await readCollection('documentShares')).filter((share) => share.documentId === req.params.id);
    const context = await findDocumentForUser(req.user, req.params.id, { write, permission, shares });
    return { ...context, shares };
}

function signaturePayload(document) {
    return `${document.id}:${document.registeredHash}`;
}

function publicDocument(document, shares) {
    return toPublicDocument(document, shares);
}

router.get('/shared', requireAuth, asyncRoute(async (req, res) => {
    const [shares, documents, cases, users] = await Promise.all([
        readCollection('documentShares'),
        readCollection('documents'),
        readCollection('cases'),
        readCollection('users'),
    ]);
    const caseMap = new Map(cases.map((item) => [item.id, item]));
    const userMap = new Map(users.map((item) => [item.id, item]));
    const now = Date.now();
    const shared = shares
        .filter((share) => share.sharedWithId === req.user.id)
        .map((share) => {
            const document = documents.find((item) => item.id === share.documentId);
            return document ? { share, document } : null;
        })
        .filter(Boolean)
        .map(({ share, document }) => ({
            ...share,
            expired: Boolean(share.expiresAt && new Date(share.expiresAt).getTime() < now),
            status: share.revokedAt ? 'Revoked' : (share.expiresAt && new Date(share.expiresAt).getTime() < now ? 'Expired' : 'Active'),
            sharedByName: userMap.get(share.createdBy || share.ownerId)?.name || share.createdBy || 'Unknown',
            document: document.caseId ? publicDocument(document, shares) : null,
            caseNumber: caseMap.get(document.caseId)?.caseNumber || document.caseNumber || null,
            caseTitle: caseMap.get(document.caseId)?.title || null,
        }));
    return sendData(res, shared);
}));

router.get('/', requireAuth, asyncRoute(async (req, res) => {
    const [documents, cases, shares] = await Promise.all([readCollection('documents'), readCollection('cases'), readCollection('documentShares')]);
    const caseMap = new Map(cases.map((item) => [item.id, item]));
    const query = textValue(req.query.search || req.query.q).toLowerCase();
    const caseId = textValue(req.query.caseId);
    const status = textValue(req.query.status);
    const data = documents
        .filter((item) => !item.deletedAt)
        .map((item) => ({ ...item, shares: shares.filter((share) => share.documentId === item.id) }))
        .filter((item) => canAccessResource(req.user, item, caseMap.get(item.caseId), { permission: 'document:read' }))
        .filter((item) => !caseId || item.caseId === caseId)
        .filter((item) => !status || item.status === status)
        .filter((item) => !query || [item.id, item.fileName, item.caseNumber, item.category, item.classification].some((value) => String(value || '').toLowerCase().includes(query)))
        .map((item) => publicDocument(item, shares));
    return sendData(res, data);
}));

async function createDocument(req, res) {
    const body = req.body || {};
    const caseId = textValue(body.caseId);
    const category = textValue(body.category);
    const classification = String(body.classification || 'CONFIDENTIAL').toUpperCase();
    if (!caseId || !category || !classification) return sendError(res, 422, 'VALIDATION_ERROR', 'Case, category, and classification are required.');
    const cases = await readCollection('cases');
    const relatedCase = cases.find((item) => item.id === caseId);
    if (!relatedCase || relatedCase.deletedAt) return sendError(res, 404, 'CASE_NOT_FOUND', 'Case not found.');
    if (!canAccessResource(req.user, { classification }, relatedCase)) return sendError(res, 403, 'FORBIDDEN', 'You are not authorized to add documents to this case.');
    const uploadPayload = getUploadPayload(req);
    const documents = await readCollection('documents');
    const duplicate = documents.find((item) => !item.deletedAt && item.caseId === caseId && item.rootDocumentId === item.id && item.fileName === uploadPayload.fileName);
    if (duplicate) return sendError(res, 409, 'DUPLICATE_DOCUMENT', 'A document with this name already exists for the case.');
    const id = `DOC-${crypto.randomUUID()}`;
    const stored = await saveEncryptedDocument(id, uploadPayload);
    const timestamp = new Date().toISOString();
    const document = {
        id,
        fileName: uploadPayload.fileName,
        caseId,
        caseNumber: relatedCase.caseNumber,
        category,
        classification,
        version: '1.0',
        versionOf: null,
        rootDocumentId: id,
        uploadedBy: req.user.id,
        uploadedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        status: 'Pending',
        integrityStatus: 'PENDING',
        algorithm: HASH_ALGORITHM,
        hashAlgorithm: HASH_ALGORITHM,
        registeredHash: stored.registeredHash,
        contentHash: stored.contentHash,
        lastVerified: null,
        storageFile: stored.storageFile,
        storageNonce: stored.storageNonce,
        storageTag: stored.storageTag,
        storageKeyId: stored.storageKeyId,
        storageAlgorithm: stored.storageAlgorithm,
        size: stored.size,
        mimeType: stored.mimeType,
        extension: stored.extension,
        approvedBy: null,
        approvedAt: null,
    };
    document.signatureAlgorithm = 'Ed25519';
    document.signature = signPayload(signaturePayload(document));
    document.signatureStatus = 'VALID';
    await appendToCollection('documents', document);
    await addTimelineEvent({ caseId, type: 'document', title: 'Document uploaded', detail: `${document.fileName} version 1.0 was uploaded.`, actorId: req.user.id, metadata: { documentId: document.id } });
    await addAuditEvent({ actor: req.user.id, action: 'DOCUMENT_UPLOADED', resource: 'Document', resourceId: document.id, metadata: { caseId, fileName: document.fileName, version: '1.0' } });
    const shares = await readCollection('documentShares');
    return sendData(res, publicDocument(document, shares), 201);
}

router.post('/', requireAuth, documentWriter, multipart, asyncRoute(createDocument));
router.post('/upload', requireAuth, documentWriter, multipart, asyncRoute(createDocument));

router.get('/:id/metadata', requireAuth, asyncRoute(async (req, res) => {
    const { document } = await documentContext(req);
    const shares = await readCollection('documentShares');
    return sendData(res, publicDocument(document, shares));
}));

router.get('/:id/versions', requireAuth, asyncRoute(async (req, res) => {
    const { document } = await documentContext(req);
    const [documents, shares, cases] = await Promise.all([readCollection('documents'), readCollection('documentShares'), readCollection('cases')]);
    const caseMap = new Map(cases.map((item) => [item.id, item]));
    const rootId = document.rootDocumentId || document.versionOf || document.id;
    const versions = documents.filter((item) => !item.deletedAt && (item.id === rootId || item.versionOf === rootId || item.rootDocumentId === rootId) && canAccessResource(req.user, { ...item, shares: shares.filter((share) => share.documentId === item.id) }, caseMap.get(item.caseId), { permission: 'document:read' }));
    return sendData(res, versions.map((item) => publicDocument(item, shares)));
}));

router.post('/:id/versions', requireAuth, documentWriter, multipart, asyncRoute(async (req, res) => {
    const { document: original, relatedCase } = await documentContext(req, { write: true });
    if (relatedCase.status === 'Archived' || relatedCase.status === 'Closed') return sendError(res, 409, 'CASE_NOT_IMMUTABLE', 'New versions cannot be added to a closed case.');
    const uploadPayload = getUploadPayload(req);
    const documents = await readCollection('documents');
    const rootId = original.rootDocumentId || original.versionOf || original.id;
    const versions = documents.filter((item) => item.rootDocumentId === rootId || item.versionOf === rootId || item.id === rootId);
    const currentVersion = Math.max(...versions.map((item) => Number.parseFloat(item.version) || 0), 0);
    const id = `DOC-${crypto.randomUUID()}`;
    const stored = await saveEncryptedDocument(id, uploadPayload);
    const timestamp = new Date().toISOString();
    const nextVersion = {
        id,
        fileName: uploadPayload.fileName,
        caseId: original.caseId,
        caseNumber: original.caseNumber || relatedCase.caseNumber,
        category: textValue(req.body?.category) || original.category,
        classification: String(req.body?.classification || original.classification).toUpperCase(),
        version: (currentVersion + 1).toFixed(1),
        versionOf: rootId,
        rootDocumentId: rootId,
        uploadedBy: req.user.id,
        uploadedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        status: 'Pending',
        integrityStatus: 'PENDING',
        algorithm: HASH_ALGORITHM,
        hashAlgorithm: HASH_ALGORITHM,
        registeredHash: stored.registeredHash,
        contentHash: stored.contentHash,
        lastVerified: null,
        storageFile: stored.storageFile,
        storageNonce: stored.storageNonce,
        storageTag: stored.storageTag,
        storageKeyId: stored.storageKeyId,
        storageAlgorithm: stored.storageAlgorithm,
        size: stored.size,
        mimeType: stored.mimeType,
        extension: stored.extension,
        approvedBy: null,
        approvedAt: null,
    };
    nextVersion.signatureAlgorithm = 'Ed25519';
    nextVersion.signature = signPayload(signaturePayload(nextVersion));
    nextVersion.signatureStatus = 'VALID';
    await appendToCollection('documents', nextVersion);
    await addTimelineEvent({ caseId: original.caseId, type: 'document', title: 'Document version uploaded', detail: `${original.fileName} version ${nextVersion.version} was uploaded.`, actorId: req.user.id, metadata: { documentId: id, version: nextVersion.version } });
    await addAuditEvent({ actor: req.user.id, action: 'DOCUMENT_VERSION_CREATED', resource: 'Document', resourceId: id, metadata: { originalId: rootId, version: nextVersion.version } });
    return sendData(res, publicDocument(nextVersion, await readCollection('documentShares')), 201);
}));

router.get('/:id/shares', requireAuth, asyncRoute(async (req, res) => {
    const { document } = await documentContext(req);
    const shares = (await readCollection('documentShares')).filter((share) => share.documentId === document.id);
    return sendData(res, shares);
}));

router.post('/:id/shares', requireAuth, documentSharer, asyncRoute(async (req, res) => {
    const { document } = await documentContext(req, { write: true, permission: 'document:share' });
    const target = textValue(req.body?.userId || req.body?.sharedWithId || req.body?.email);
    const permission = textValue(req.body?.permission).toLowerCase() === 'download' ? 'download' : 'view';
    const users = await readCollection('users');
    const sharedUser = users.find((user) => user.id === target || user.email === target || user.username === target);
    if (!sharedUser || sharedUser.status !== 'active') return sendError(res, 404, 'USER_NOT_FOUND', 'Active user not found.');
    if (clearanceForUser(sharedUser) < clearanceForUser({ role: 'Investigation Officer', clearance: document.classification })) return sendError(res, 403, 'SHARE_CLEARANCE', 'The target user does not have sufficient clearance.');
    if (sharedUser.id === req.user.id) return sendError(res, 409, 'SHARE_SELF', 'A document cannot be shared with its current owner.');
    let expiresAt = null;
    if (req.body?.expiresAt) {
        expiresAt = new Date(req.body.expiresAt);
        if (Number.isNaN(expiresAt.getTime())) return sendError(res, 422, 'VALIDATION_ERROR', 'Share expiry must be a valid date.');
    }
    const share = {
        id: `SHARE-${crypto.randomUUID()}`,
        documentId: document.id,
        ownerId: document.uploadedBy,
        sharedWithId: sharedUser.id,
        sharedWithEmail: sharedUser.email,
        permission,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        revokedAt: null,
        createdAt: new Date().toISOString(),
        createdBy: req.user.id,
    };
    await appendToCollection('documentShares', share);
    await addAuditEvent({ actor: req.user.id, action: 'DOCUMENT_SHARED', resource: 'Document', resourceId: document.id, metadata: { shareId: share.id, sharedWithId: sharedUser.id, permission } });
    await addNotification({ recipientId: sharedUser.id, type: 'document', title: 'Document shared with you', message: `${document.fileName} was shared with you.`, resourceType: 'Document', resourceId: document.id });
    return sendData(res, share, 201);
}));

router.post('/:id/share', requireAuth, documentSharer, asyncRoute(async (req, res) => {
    const { document } = await documentContext(req, { write: true, permission: 'document:share' });
    const target = textValue(req.body?.userId || req.body?.sharedWithId || req.body?.email);
    const users = await readCollection('users');
    const sharedUser = users.find((user) => user.id === target || user.email === target || user.username === target);
    if (!sharedUser || sharedUser.status !== 'active') return sendError(res, 404, 'USER_NOT_FOUND', 'Active user not found.');
    if (clearanceForUser(sharedUser) < clearanceForUser({ role: 'Investigation Officer', clearance: document.classification })) return sendError(res, 403, 'SHARE_CLEARANCE', 'The target user does not have sufficient clearance.');
    if (sharedUser.id === req.user.id) return sendError(res, 409, 'SHARE_SELF', 'A document cannot be shared with its current owner.');
    const share = { id: `SHARE-${crypto.randomUUID()}`, documentId: document.id, ownerId: document.uploadedBy, sharedWithId: sharedUser.id, sharedWithEmail: sharedUser.email, permission: textValue(req.body?.permission).toLowerCase() === 'download' ? 'download' : 'view', expiresAt: null, revokedAt: null, createdAt: new Date().toISOString(), createdBy: req.user.id };
    await appendToCollection('documentShares', share);
    await addAuditEvent({ actor: req.user.id, action: 'DOCUMENT_SHARED', resource: 'Document', resourceId: document.id, metadata: { shareId: share.id, sharedWithId: sharedUser.id } });
    return sendData(res, share, 201);
}));

router.delete('/:id/shares/:shareId', requireAuth, documentSharer, asyncRoute(async (req, res) => {
    const { document } = await documentContext(req, { write: true, permission: 'document:share' });
    const share = (await readCollection('documentShares')).find((item) => item.id === req.params.shareId && item.documentId === document.id);
    if (!share) return sendError(res, 404, 'SHARE_NOT_FOUND', 'Document share not found.');
    if (share.revokedAt) return sendError(res, 409, 'SHARE_REVOKED', 'Document share is already revoked.');
    const revoked = await updateCollectionItem('documentShares', share.id, { revokedAt: new Date().toISOString(), revokedBy: req.user.id });
    await addAuditEvent({ actor: req.user.id, action: 'DOCUMENT_SHARE_REVOKED', resource: 'Document', resourceId: document.id, metadata: { shareId: share.id } });
    return sendData(res, revoked);
}));

router.delete('/:id/shares', requireAuth, documentSharer, asyncRoute(async (req, res) => {
    const { document } = await documentContext(req, { write: true, permission: 'document:share' });
    const shareId = textValue(req.body?.shareId);
    const share = (await readCollection('documentShares')).find((item) => item.id === shareId && item.documentId === document.id);
    if (!share) return sendError(res, 404, 'SHARE_NOT_FOUND', 'Document share not found.');
    const revoked = await updateCollectionItem('documentShares', share.id, { revokedAt: new Date().toISOString(), revokedBy: req.user.id });
    await addAuditEvent({ actor: req.user.id, action: 'DOCUMENT_SHARE_REVOKED', resource: 'Document', resourceId: document.id, metadata: { shareId: share.id } });
    return sendData(res, revoked);
}));

router.get('/:id/signature-requests', requireAuth, asyncRoute(async (req, res) => {
    const { document } = await documentContext(req);
    const requests = (await readCollection('signatureRequests')).filter((item) => item.documentId === document.id);
    return sendData(res, requests);
}));

router.post('/:id/signature-requests', requireAuth, documentSharer, asyncRoute(async (req, res) => {
    const { document, relatedCase, shares: contextShares } = await documentContext(req, { write: true, permission: 'document:share' });
    const signer = textValue(req.body?.signerId || req.body?.signerEmail || req.body?.email);
    const users = await readCollection('users');
    const signerUser = users.find((user) => user.id === signer || user.email === signer || user.username === signer);
    if (!signerUser || signerUser.status !== 'active') return sendError(res, 404, 'USER_NOT_FOUND', 'Active signer not found.');
    if (!canAccessResource(signerUser, { ...document, shares: contextShares }, relatedCase, { permission: 'document:read' })) return sendError(res, 403, 'SIGNER_FORBIDDEN', 'Signer is not authorized to read this document.');
    const request = {
        id: `SIG-${crypto.randomUUID()}`,
        documentId: document.id,
        requesterId: req.user.id,
        signerId: signerUser.id,
        signerEmail: signerUser.email,
        status: 'Pending',
        message: textValue(req.body?.message),
        createdAt: new Date().toISOString(),
        respondedAt: null,
        responseReason: null,
    };
    await appendToCollection('signatureRequests', request);
    await addAuditEvent({ actor: req.user.id, action: 'SIGNATURE_REQUESTED', resource: 'Document', resourceId: document.id, metadata: { requestId: request.id, signerId: signerUser.id } });
    await addNotification({ recipientId: signerUser.id, type: 'signature', title: 'Signature requested', message: `${document.fileName} is ready for review.`, resourceType: 'Document', resourceId: document.id });
    return sendData(res, request, 201);
}));
router.post('/:id/signature-request', requireAuth, documentSharer, asyncRoute(async (req, res) => {
    const { document, relatedCase } = await documentContext(req, { write: true, permission: 'document:share' });
    const signer = textValue(req.body?.signerId || req.body?.signerEmail || req.body?.email);
    const users = await readCollection('users');
    const signerUser = users.find((user) => user.id === signer || user.email === signer || user.username === signer);
    if (!signerUser || signerUser.status !== 'active') return sendError(res, 404, 'USER_NOT_FOUND', 'Active signer not found.');
    const request = { id: `SIG-${crypto.randomUUID()}`, documentId: document.id, requesterId: req.user.id, signerId: signerUser.id, signerEmail: signerUser.email, status: 'Pending', message: textValue(req.body?.message), createdAt: new Date().toISOString(), respondedAt: null, responseReason: null };
    await appendToCollection('signatureRequests', request);
    await addAuditEvent({ actor: req.user.id, action: 'SIGNATURE_REQUESTED', resource: 'Document', resourceId: document.id, metadata: { requestId: request.id, signerId: signerUser.id } });
    return sendData(res, request, 201);
}));

async function respondToSignature(req, res, status) {
    const request = (await readCollection('signatureRequests')).find((item) => item.id === req.params.requestId && item.documentId === req.params.id);
    if (!request) return sendError(res, 404, 'SIGNATURE_REQUEST_NOT_FOUND', 'Signature request not found.');
    if (request.signerId !== req.user.id && req.user.role !== 'Administrator') return sendError(res, 403, 'FORBIDDEN', 'Only the requested signer or an administrator can respond.');
    if (request.status !== 'Pending') return sendError(res, 409, 'SIGNATURE_ALREADY_RESPONDED', 'Signature request has already been answered.');
    const respondedAt = new Date().toISOString();
    const updated = await updateCollectionItem('signatureRequests', request.id, { status, respondedAt, respondedBy: req.user.id, responseReason: textValue(req.body?.reason) });
    await updateCollectionItem('documents', request.documentId, { signatureStatus: status, lastSignatureAt: respondedAt, updatedAt: respondedAt });
    await addAuditEvent({ actor: req.user.id, action: status === 'Confirmed' ? 'SIGNATURE_CONFIRMED' : 'SIGNATURE_REJECTED', resource: 'Document', resourceId: request.documentId, metadata: { requestId: request.id } });
    await addTimelineEvent({ caseId: (await readCollection('documents')).find((item) => item.id === request.documentId)?.caseId, type: 'signature', title: `Signature ${status.toLowerCase()}`, detail: `Signature request ${request.id} was ${status.toLowerCase()}.`, actorId: req.user.id, metadata: { requestId: request.id } });
    return sendData(res, updated);
}

router.post('/:id/signature-requests/:requestId/confirm', requireAuth, asyncRoute((req, res) => respondToSignature(req, res, 'Confirmed')));
router.post('/:id/signature-requests/:requestId/reject', requireAuth, asyncRoute((req, res) => respondToSignature(req, res, 'Rejected')));
router.post('/:id/signature/confirm', requireAuth, asyncRoute(async (req, res) => {
    req.params.requestId = textValue(req.body?.requestId);
    return respondToSignature(req, res, 'Confirmed');
}));
router.post('/:id/signature/reject', requireAuth, asyncRoute(async (req, res) => {
    req.params.requestId = textValue(req.body?.requestId);
    return respondToSignature(req, res, 'Rejected');
}));

async function secureStorageFileExists(storageFile) {
    try {
        await fs.access(getSecureStoragePath(storageFile));
        return true;
    } catch {
        return false;
    }
}

async function verifyDocumentIntegrity(req, res) {
    const { document } = await documentContext(req);
    let content;
    try {
        content = await readEncryptedDocument(document);
    } catch {
        const stored = document.storageFile && await secureStorageFileExists(document.storageFile);
        if (!stored) return sendError(res, 410, 'DOCUMENT_CONTENT_UNAVAILABLE', 'Stored document content is unavailable.');
        const checkedAt = new Date().toISOString();
        await updateCollectionItem('documents', document.id, { integrityStatus: 'COMPROMISED', lastVerified: checkedAt, lastComputedHash: null });
        await addAuditEvent({ actor: req.user.id, action: 'DOCUMENT_TAMPER_DETECTED', resource: 'Document', resourceId: document.id, metadata: { verified: false, algorithm: HASH_ALGORITHM, reason: 'Authenticated decryption failed; stored ciphertext no longer matches its AES-256-GCM tag.' } });
        return sendData(res, {
            documentId: document.id,
            integrityStatus: 'COMPROMISED',
            algorithm: HASH_ALGORITHM,
            registeredHash: document.registeredHash,
            currentHash: null,
            signatureAlgorithm: 'Ed25519',
            signatureStatus: 'UNVERIFIABLE',
            lastVerified: checkedAt,
            message: 'The stored document failed authenticated decryption. Its ciphertext was modified after registration, so the document is treated as tampered.',
        });
    }
    const currentHash = sha256Hash(content);
    const verified = currentHash === document.registeredHash;
    const signatureStatus = document.signature ? (verifySignature(signaturePayload(document), document.signature) ? 'VALID' : 'INVALID') : 'UNSIGNED';
    const checkedAt = new Date().toISOString();
    await updateCollectionItem('documents', document.id, { integrityStatus: verified ? 'VERIFIED' : 'COMPROMISED', signatureStatus, lastVerified: checkedAt, lastComputedHash: currentHash });
    await addAuditEvent({ actor: req.user.id, action: 'DOCUMENT_INTEGRITY_VERIFIED', resource: 'Document', resourceId: document.id, metadata: { verified, algorithm: HASH_ALGORITHM } });
    return sendData(res, {
        documentId: document.id,
        integrityStatus: verified ? 'VERIFIED' : 'COMPROMISED',
        algorithm: HASH_ALGORITHM,
        registeredHash: document.registeredHash,
        currentHash,
        signatureAlgorithm: 'Ed25519',
        signatureStatus,
        lastVerified: checkedAt,
        message: verified ? 'Hash matches the registered document hash.' : 'The stored document does not match its registered integrity hash.',
    });
}

router.post('/:id/verify', requireAuth, asyncRoute(verifyDocumentIntegrity));
router.post('/:id/verify-integrity', requireAuth, asyncRoute(verifyDocumentIntegrity));

router.get('/:id/content', requireAuth, asyncRoute(async (req, res) => {
    const { document } = await documentContext(req);
    let content;
    try {
        content = await readEncryptedDocument(document);
    } catch {
        return sendError(res, 410, 'DOCUMENT_CONTENT_UNAVAILABLE', 'Stored document content is unavailable.');
    }
    res.setHeader('Cache-Control', 'no-store');
    return sendData(res, { documentId: document.id, content: content.toString('base64'), encoding: 'base64', size: content.length, integrityStatus: document.integrityStatus, algorithm: HASH_ALGORITHM });
}));

async function sendDocumentFile(req, res, disposition) {
    const { document } = await documentContext(req);
    let content;
    try {
        content = await readEncryptedDocument(document);
    } catch {
        return sendError(res, 410, 'DOCUMENT_CONTENT_UNAVAILABLE', 'Stored document content is unavailable.');
    }
    const safeName = document.fileName.replace(/[\r\n"\\]/g, '_');
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', content.length);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`);
    await addAuditEvent({ actor: req.user.id, action: disposition === 'attachment' ? 'DOCUMENT_DOWNLOADED' : 'DOCUMENT_PREVIEWED', resource: 'Document', resourceId: document.id });
    return res.status(200).end(content);
}

router.get('/:id/download', requireAuth, asyncRoute((req, res) => sendDocumentFile(req, res, 'attachment')));
router.get('/:id/preview', requireAuth, asyncRoute((req, res) => sendDocumentFile(req, res, 'inline')));
router.get('/:id/raw', requireAuth, asyncRoute((req, res) => sendDocumentFile(req, res, 'attachment')));

router.post('/:id/approve', requireAuth, approver, asyncRoute(async (req, res) => {
    const { document } = await documentContext(req);
    if (!hasPermission(req.user, 'document:approve')) return sendError(res, 403, 'FORBIDDEN', 'You do not have permission to approve documents.');
    if (document.status === 'Approved') return sendError(res, 409, 'ALREADY_APPROVED', 'Document is already approved.');
    if (document.integrityStatus !== 'VERIFIED') return sendError(res, 409, 'INTEGRITY_NOT_VERIFIED', 'Document integrity must be verified before approval.');
    const updated = await updateCollectionItem('documents', document.id, { status: 'Approved', approvedBy: req.user.id, approvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await addAuditEvent({ actor: req.user.id, action: 'DOCUMENT_APPROVED', resource: 'Document', resourceId: document.id, metadata: { version: document.version } });
    return sendData(res, publicDocument(updated, await readCollection('documentShares')));
}));

router.post('/:id/reject', requireAuth, approver, asyncRoute(async (req, res) => {
    const { document } = await documentContext(req);
    if (!hasPermission(req.user, 'document:approve')) return sendError(res, 403, 'FORBIDDEN', 'You do not have permission to reject documents.');
    if (document.status === 'Approved') return sendError(res, 409, 'APPROVED_DOCUMENT_IMMUTABLE', 'Approved documents require a new version.');
    const updated = await updateCollectionItem('documents', document.id, { status: 'Rejected', rejectionReason: textValue(req.body?.reason) || 'No reason supplied', updatedAt: new Date().toISOString() });
    await addAuditEvent({ actor: req.user.id, action: 'DOCUMENT_REJECTED', resource: 'Document', resourceId: document.id, metadata: { reason: updated.rejectionReason } });
    return sendData(res, publicDocument(updated, await readCollection('documentShares')));
}));

router.get('/:id', requireAuth, asyncRoute(async (req, res) => {
    const { document } = await documentContext(req);
    return sendData(res, publicDocument(document, await readCollection('documentShares')));
}));

export default router;
