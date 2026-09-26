import express from 'express';
import crypto from 'node:crypto';
import { requireAuth, requireRole, filterAccessibleResources } from '../middleware/auth.js';
import { canAccessResource, findCaseForUser } from '../services/authorization.service.js';
import { addAuditEvent, addTimelineEvent, appendToCollection, readCollection, removeCollectionItem, updateCollectionItem } from '../services/store.js';
import { asyncRoute, sendData, sendError, textValue } from '../utils/route-helpers.js';
import { toPublicDocument } from '../services/document-storage.service.js';

const router = express.Router();
const caseWriter = requireRole('Administrator', 'Supervisor', 'Investigation Officer');
const transitions = {
    Created: ['Under Investigation', 'Archived'],
    'Under Investigation': ['Evidence Collection', 'Archived', 'Investigation Review'],
    'Evidence Collection': ['Investigation Review', 'Archived'],
    'Investigation Review': ['Legal Review', 'Archived'],
    'Legal Review': ['Closed', 'Archived'],
    Closed: ['Archived'],
    Archived: [],
};

function caseNumberValue(value) {
    return textValue(value).toUpperCase();
}

async function authorizedCase(req, write = false) {
    return findCaseForUser(req.user, req.params.id, { write });
}

router.get('/', requireAuth, asyncRoute(async (req, res) => {
    const items = await readCollection('cases');
    const query = textValue(req.query.search || req.query.q).toLowerCase();
    const status = textValue(req.query.status);
    const department = textValue(req.query.department);
    const type = textValue(req.query.type);
    const filtered = filterAccessibleResources(req.user, items).filter((item) => {
        const searchable = [item.id, item.caseNumber, item.title, item.type, item.description, item.assignedOfficer].map((value) => String(value || '').toLowerCase());
        return (!query || searchable.some((value) => value.includes(query)))
            && (!status || item.status === status)
            && (!department || item.department === department)
            && (!type || item.type === type);
    });
    return sendData(res, filtered);
}));

router.post('/', requireAuth, caseWriter, asyncRoute(async (req, res) => {
    const body = req.body || {};
    const caseNumber = caseNumberValue(body.caseNumber || `CV-${new Date().getUTCFullYear()}-${String(Date.now()).slice(-6)}`);
    const title = textValue(body.title);
    const type = textValue(body.type || 'Financial Crime');
    const priority = textValue(body.priority || 'Medium');
    const department = textValue(body.department || req.user.department);
    const classification = String(body.classification || 'INTERNAL').toUpperCase();
    if (!title || !caseNumber || !/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(caseNumber)) {
        return sendError(res, 422, 'VALIDATION_ERROR', 'A valid case number and title are required.');
    }
    if (req.user.role !== 'Administrator' && req.user.role !== 'Supervisor' && department !== req.user.department) {
        return sendError(res, 403, 'FORBIDDEN', 'You cannot create a case outside your department.');
    }
    if (!canAccessResource(req.user, { department, classification })) {
        return sendError(res, 403, 'FORBIDDEN', 'Your clearance does not permit this classification.');
    }
    const cases = await readCollection('cases');
    if (cases.some((item) => caseNumberValue(item.caseNumber) === caseNumber)) return sendError(res, 409, 'DUPLICATE_CASE_NUMBER', 'Case number already exists.');
    const users = await readCollection('users');
    const assignedId = body.assignedOfficerId || null;
    const assigned = users.find((user) => user.id === assignedId || user.name === body.assignedOfficer);
    if (assignedId && !assigned) return sendError(res, 422, 'VALIDATION_ERROR', 'Assigned officer was not found.');
    if (assigned && !canAccessResource(req.user, { department, classification })) return sendError(res, 403, 'FORBIDDEN', 'Assigned officer is outside the authorized department.');
    const timestamp = new Date().toISOString();
    const record = {
        id: `case-${crypto.randomUUID()}`,
        caseNumber,
        title,
        type,
        description: textValue(body.description),
        priority,
        department,
        status: 'Created',
        assignedOfficer: assigned?.name || textValue(body.assignedOfficer) || 'Unassigned',
        assignedOfficerId: assigned?.id || null,
        classification,
        members: [{ userId: req.user.id, role: 'Owner', addedAt: timestamp }],
        tags: Array.isArray(body.tags) ? body.tags.map(textValue).filter(Boolean).slice(0, 20) : [],
        createdAt: timestamp,
        updatedAt: timestamp,
    };
    await appendToCollection('cases', record);
    await addTimelineEvent({ caseId: record.id, type: 'case', title: 'Case created', detail: `${record.caseNumber} was created.`, actorId: req.user.id });
    await addAuditEvent({ actor: req.user.id, action: 'CASE_CREATED', resource: 'Case', resourceId: record.id, metadata: { caseNumber } });
    return sendData(res, record, 201);
}));

router.get('/:id/members', requireAuth, asyncRoute(async (req, res) => {
    const record = await authorizedCase(req);
    const users = await readCollection('users');
    const members = (record.members || []).map((member) => ({ ...member, user: users.find((user) => user.id === member.userId) ? { id: member.userId, name: users.find((user) => user.id === member.userId).name, email: users.find((user) => user.id === member.userId).email, role: users.find((user) => user.id === member.userId).role } : null }));
    return sendData(res, members);
}));

router.post('/:id/members', requireAuth, caseWriter, asyncRoute(async (req, res) => {
    const record = await authorizedCase(req, true);
    const userId = textValue(req.body?.userId || req.body?.memberId);
    const users = await readCollection('users');
    const member = users.find((user) => user.id === userId || user.email === userId || user.username === userId);
    if (!member) return sendError(res, 404, 'USER_NOT_FOUND', 'User not found.');
    if ((record.members || []).some((entry) => entry.userId === member.id)) return sendError(res, 409, 'DUPLICATE_CASE_MEMBER', 'User is already a case member.');
    const entry = { userId: member.id, role: textValue(req.body?.role) || 'Member', addedAt: new Date().toISOString(), addedBy: req.user.id };
    const updated = await updateCollectionItem('cases', record.id, { members: [...(record.members || []), entry], updatedAt: new Date().toISOString() });
    await addTimelineEvent({ caseId: record.id, type: 'member', title: 'Case member added', detail: `${member.name} was added to the case.`, actorId: req.user.id });
    await addAuditEvent({ actor: req.user.id, action: 'CASE_MEMBER_ADDED', resource: 'Case', resourceId: record.id, metadata: { userId: member.id } });
    return sendData(res, { case: updated, member: entry }, 201);
}));

router.delete('/:id/members/:userId', requireAuth, caseWriter, asyncRoute(async (req, res) => {
    const record = await authorizedCase(req, true);
    const userId = req.params.userId;
    const existing = (record.members || []).find((member) => member.userId === userId);
    if (!existing) return sendError(res, 404, 'CASE_MEMBER_NOT_FOUND', 'Case member not found.');
    if (existing.role === 'Owner' && (record.members || []).filter((member) => member.role === 'Owner').length === 1) return sendError(res, 409, 'OWNER_REQUIRED', 'A case must retain an owner.');
    const updated = await updateCollectionItem('cases', record.id, { members: record.members.filter((member) => member.userId !== userId), updatedAt: new Date().toISOString() });
    await addAuditEvent({ actor: req.user.id, action: 'CASE_MEMBER_REMOVED', resource: 'Case', resourceId: record.id, metadata: { userId } });
    return sendData(res, updated);
}));

router.get('/:id/timeline', requireAuth, asyncRoute(async (req, res) => {
    const record = await authorizedCase(req);
    const events = (await readCollection('timeline')).filter((item) => item.caseId === record.id);
    return sendData(res, events);
}));
router.get('/:id/events', requireAuth, asyncRoute(async (req, res) => {
    const record = await authorizedCase(req);
    const events = (await readCollection('timeline')).filter((item) => item.caseId === record.id);
    return sendData(res, events);
}));

router.post('/:id/timeline', requireAuth, asyncRoute(async (req, res) => {
    const record = await authorizedCase(req);
    const title = textValue(req.body?.title);
    if (!title) return sendError(res, 422, 'VALIDATION_ERROR', 'Timeline title is required.');
    const event = await addTimelineEvent({ caseId: record.id, type: textValue(req.body?.type) || 'note', title, detail: textValue(req.body?.detail || req.body?.description), actorId: req.user.id, metadata: req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {} });
    await addAuditEvent({ actor: req.user.id, action: 'CASE_TIMELINE_APPENDED', resource: 'Case', resourceId: record.id, metadata: { eventId: event.id } });
    return sendData(res, event, 201);
}));

router.get('/:id/documents', requireAuth, asyncRoute(async (req, res) => {
    const record = await authorizedCase(req);
    const [documents, shares] = await Promise.all([readCollection('documents'), readCollection('documentShares')]);
    const data = documents.filter((item) => item.caseId === record.id && !item.deletedAt).map((item) => toPublicDocument(item, shares));
    return sendData(res, data);
}));

router.get('/:id/evidence', requireAuth, asyncRoute(async (req, res) => {
    const record = await authorizedCase(req);
    const data = (await readCollection('evidence')).filter((item) => item.caseId === record.id && !item.deletedAt);
    return sendData(res, data);
}));

router.get('/:id', requireAuth, asyncRoute(async (req, res) => {
    const record = await authorizedCase(req);
    const [documents, evidence, tasks, timeline, shares] = await Promise.all([readCollection('documents'), readCollection('evidence'), readCollection('tasks'), readCollection('timeline'), readCollection('documentShares')]);
    return sendData(res, {
        ...record,
        documents: documents.filter((item) => item.caseId === record.id && !item.deletedAt).map((item) => toPublicDocument(item, shares)),
        evidence: evidence.filter((item) => item.caseId === record.id && !item.deletedAt),
        tasks: tasks.filter((item) => item.caseId === record.id && !item.deletedAt),
        timeline: timeline.filter((item) => item.caseId === record.id),
    });
}));

router.patch('/:id', requireAuth, caseWriter, asyncRoute(async (req, res) => {
    const record = await authorizedCase(req, true);
    const allowed = ['title', 'type', 'description', 'priority', 'department', 'assignedOfficer', 'assignedOfficerId', 'classification', 'tags'];
    const update = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
    if (!Object.keys(update).length) return sendError(res, 422, 'VALIDATION_ERROR', 'No editable case fields were supplied.');
    const nextDepartment = textValue(update.department || record.department);
    const nextClassification = String(update.classification || record.classification).toUpperCase();
    if (req.user.role !== 'Administrator' && req.user.role !== 'Supervisor' && nextDepartment !== req.user.department) return sendError(res, 403, 'FORBIDDEN', 'You cannot move a case outside your department.');
    if (!canAccessResource(req.user, { department: nextDepartment, classification: nextClassification })) return sendError(res, 403, 'FORBIDDEN', 'Your clearance does not permit this case classification.');
    if (update.tags && !Array.isArray(update.tags)) return sendError(res, 422, 'VALIDATION_ERROR', 'Tags must be an array.');
    update.department = nextDepartment;
    update.classification = nextClassification;
    update.updatedAt = new Date().toISOString();
    const updated = await updateCollectionItem('cases', record.id, update);
    await addTimelineEvent({ caseId: record.id, type: 'case', title: 'Case details updated', detail: 'Case metadata was updated.', actorId: req.user.id });
    await addAuditEvent({ actor: req.user.id, action: 'CASE_UPDATED', resource: 'Case', resourceId: record.id, metadata: { fields: Object.keys(update).filter((key) => key !== 'updatedAt') } });
    return sendData(res, updated);
}));

router.delete('/:id', requireAuth, requireRole('Administrator', 'Supervisor'), asyncRoute(async (req, res) => {
    const record = await authorizedCase(req, true);
    const updated = await removeCollectionItem('cases', record.id, { softDelete: false });
    await addAuditEvent({ actor: req.user.id, action: 'CASE_DELETED', resource: 'Case', resourceId: record.id, metadata: { caseNumber: record.caseNumber } });
    return sendData(res, { deleted: true, case: updated });
}));

async function changeStatus(req, res) {
    const record = await authorizedCase(req, true);
    const nextStatus = textValue(req.body?.status);
    if (!transitions[record.status]?.includes(nextStatus)) return sendError(res, 409, 'INVALID_STATUS_TRANSITION', `Cannot transition case from ${record.status} to ${nextStatus || 'unknown'}.`);
    const previousStatus = record.status;
    const updated = await updateCollectionItem('cases', record.id, { status: nextStatus, updatedAt: new Date().toISOString(), closedAt: nextStatus === 'Closed' ? new Date().toISOString() : null });
    await addTimelineEvent({ caseId: record.id, type: 'status', title: 'Case status changed', detail: `${previousStatus} changed to ${nextStatus}.`, actorId: req.user.id, metadata: { from: previousStatus, to: nextStatus } });
    await addAuditEvent({ actor: req.user.id, action: 'CASE_STATUS_CHANGED', resource: 'Case', resourceId: record.id, metadata: { from: previousStatus, to: nextStatus } });
    return sendData(res, updated);
}

router.patch('/:id/status', requireAuth, caseWriter, asyncRoute(changeStatus));
router.put('/:id/status', requireAuth, caseWriter, asyncRoute(changeStatus));

export default router;
