import express from 'express';
import crypto from 'node:crypto';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { canAccessResource } from '../services/authorization.service.js';
import { addAuditEvent, addTimelineEvent, appendToCollection, readCollection, updateCollectionItem } from '../services/store.js';
import { asyncRoute, sendData, sendError, textValue } from '../utils/route-helpers.js';

const router = express.Router();

async function accessibleDocuments(user) {
    const [documents, cases, shares] = await Promise.all([readCollection('documents'), readCollection('cases'), readCollection('documentShares')]);
    const caseMap = new Map(cases.map((item) => [item.id, item]));
    return documents.filter((item) => !item.deletedAt && canAccessResource(user, { ...item, shares: shares.filter((share) => share.documentId === item.id) }, caseMap.get(item.caseId), { permission: 'document:read' }));
}

router.get('/requests', requireAuth, asyncRoute(async (req, res) => {
    const [requests, documents, users] = await Promise.all([readCollection('signatureRequests'), readCollection('documents'), readCollection('users')]);
    const documentMap = new Map(documents.map((item) => [item.id, item]));
    const userMap = new Map(users.map((item) => [item.id, item]));
    const query = textValue(req.query.status || req.query.type).toLowerCase();
    const data = requests.filter((item) => {
        if (query && String(item.status || '').toLowerCase() !== query) return false;
        if (['Administrator', 'Supervisor', 'Legal Officer'].includes(req.user.role)) return true;
        return item.signerId === req.user.id;
    }).map((item) => ({ ...item, document: documentMap.get(item.documentId), signer: userMap.get(item.signerId) ? { id: item.signerId, name: userMap.get(item.signerId).name, role: userMap.get(item.signerId).role } : null }));
    return sendData(res, { items: data, total: data.length, pending: data.filter((item) => item.status === 'Pending').length });
}));

router.post('/requests', requireAuth, requirePermission('document:share'), asyncRoute(async (req, res) => {
    const documentId = textValue(req.body?.documentId);
    const signerId = textValue(req.body?.signerId);
    const purpose = textValue(req.body?.purpose);
    if (!documentId || !signerId || !purpose) return sendError(res, 422, 'VALIDATION_ERROR', 'Document, signer, and purpose are required.');
    const [documents, users] = await Promise.all([readCollection('documents'), readCollection('users')]);
    const document = documents.find((item) => item.id === documentId);
    const signer = users.find((item) => item.id === signerId && item.status === 'active');
    if (!document) return sendError(res, 404, 'DOCUMENT_NOT_FOUND', 'Document not found.');
    if (!signer) return sendError(res, 422, 'VALIDATION_ERROR', 'Signer was not found.');
    const allowed = canAccessResource(req.user, document, { classification: document.classification }, { permission: 'document:share' });
    if (!allowed && req.user.id !== signerId) return sendError(res, 403, 'FORBIDDEN', 'You are not authorized to request a signature for this document.');
    const timestamp = new Date().toISOString();
    const request = { id: `SIG-${crypto.randomUUID()}`, documentId, documentName: document.fileName, caseId: document.caseId, signerId, requesterId: req.user.id, purpose, status: 'Pending', requestedAt: timestamp, dueDate: textValue(req.body?.dueDate) || null, documentHash: document.registeredHash || null, respondedAt: null, responseReason: null };
    await updateCollectionItem('documents', document.id, { signatureStatus: 'Pending', updatedAt: timestamp });
    await appendToCollection('signatureRequests', request);
    await addTimelineEvent({ caseId: document.caseId, type: 'signature', title: 'Signature requested', detail: `Signature requested from ${signer.name}.`, actorId: req.user.id, metadata: { documentId: document.id, signerId } });
    await addAuditEvent({ actor: req.user.id, action: 'SIGNATURE_REQUESTED', resource: 'Document', resourceId: document.id, metadata: { signerId, purpose } });
    return sendData(res, request, 201);
}));

router.post('/:id/sign', requireAuth, asyncRoute(async (req, res) => {
    const requests = await readCollection('signatureRequests');
    const request = requests.find((item) => item.id === req.params.id);
    if (!request) return sendError(res, 404, 'SIGNATURE_REQUEST_NOT_FOUND', 'Signature request not found.');
    if (request.signerId !== req.user.id && req.user.role !== 'Administrator') return sendError(res, 403, 'FORBIDDEN', 'Only the designated signer can sign this request.');
    if (request.status === 'Confirmed') return sendData(res, request);
    const documents = await readCollection('documents');
    const document = documents.find((item) => item.id === request.documentId);
    if (!document) return sendError(res, 404, 'DOCUMENT_NOT_FOUND', 'Document not found.');
    const timestamp = new Date().toISOString();
    const update = { status: 'Confirmed', signature: textValue(req.body?.signature) || `sig-${req.user.id}-${Date.now()}`, respondedAt: timestamp, respondedBy: req.user.id, signedAt: timestamp };
    await updateCollectionItem('signatureRequests', request.id, update);
    await updateCollectionItem('documents', document.id, { signatureStatus: 'Confirmed', lastSignatureAt: timestamp, updatedAt: timestamp });
    await addAuditEvent({ actor: req.user.id, action: 'SIGNATURE_CONFIRMED', resource: 'Document', resourceId: document.id, metadata: { requestId: request.id } });
    return sendData(res, { ...request, ...update });
}));

router.post('/:id/decline', requireAuth, asyncRoute(async (req, res) => {
    const requests = await readCollection('signatureRequests');
    const request = requests.find((item) => item.id === req.params.id);
    if (!request) return sendError(res, 404, 'SIGNATURE_REQUEST_NOT_FOUND', 'Signature request not found.');
    if (request.signerId !== req.user.id && req.user.role !== 'Administrator') return sendError(res, 403, 'FORBIDDEN', 'Only the designated signer can decline this request.');
    const update = { status: 'Rejected', respondedAt: new Date().toISOString(), respondedBy: req.user.id, responseReason: textValue(req.body?.reason) };
    await updateCollectionItem('signatureRequests', request.id, update);
    await updateCollectionItem('documents', request.documentId, { signatureStatus: 'Rejected', updatedAt: update.respondedAt });
    await addAuditEvent({ actor: req.user.id, action: 'SIGNATURE_REJECTED', resource: 'Document', resourceId: request.documentId, metadata: { requestId: request.id } });
    return sendData(res, { ...request, ...update });
}));

router.get('/', requireAuth, asyncRoute(async (req, res) => {
    const documents = await accessibleDocuments(req.user);
    const status = textValue(req.query.status).toLowerCase();
    const items = documents.map((item) => ({ id: item.id, fileName: item.fileName, caseId: item.caseId, caseNumber: item.caseNumber, version: item.version, signatureStatus: item.signatureStatus || 'Unsigned' })).filter((item) => !status || item.signatureStatus.toLowerCase() === status);
    return sendData(res, { items, total: items.length });
}));

export default router;
