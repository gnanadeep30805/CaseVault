import express from 'express';
import crypto from 'node:crypto';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { canAccessTask, canAccessResource, findCaseForUser } from '../services/authorization.service.js';
import { addAuditEvent, addNotification, addTimelineEvent, appendToCollection, readCollection, removeCollectionItem, updateCollectionItem } from '../services/store.js';
import { asyncRoute, sendData, sendError, textValue } from '../utils/route-helpers.js';

const router = express.Router();
const taskWriter = requirePermission('task:write');
const taskDeleter = requirePermission('task:delete');
const statusTransitions = {
    Todo: ['In Progress', 'Blocked', 'Completed', 'Cancelled'],
    'In Progress': ['Blocked', 'Completed', 'Cancelled'],
    Blocked: ['Todo', 'In Progress', 'Cancelled'],
    Completed: [],
    Cancelled: [],
};

async function taskContext(req, { write = false } = {}) {
    const [tasks, cases] = await Promise.all([readCollection('tasks'), readCollection('cases')]);
    const task = tasks.find((item) => item.id === req.params.id);
    if (!task || task.deletedAt) throw Object.assign(new Error('Task not found.'), { code: 'TASK_NOT_FOUND', status: 404 });
    const relatedCase = cases.find((item) => item.id === task.caseId);
    const allowed = write ? canAccessTask(req.user, task, relatedCase) && task.status !== 'Completed' : canAccessTask(req.user, task, relatedCase);
    if (!allowed) throw Object.assign(new Error('Task not found.'), { code: 'TASK_NOT_FOUND', status: 404 });
    return { task, relatedCase };
}

router.get('/', requireAuth, asyncRoute(async (req, res) => {
    const [tasks, cases] = await Promise.all([readCollection('tasks'), readCollection('cases')]);
    const caseMap = new Map(cases.map((item) => [item.id, item]));
    const query = textValue(req.query.search || req.query.q).toLowerCase();
    const caseId = textValue(req.query.caseId);
    const status = textValue(req.query.status);
    const assignee = textValue(req.query.assigneeId);
    const data = tasks.filter((item) => !item.deletedAt && canAccessTask(req.user, item, caseMap.get(item.caseId)))
        .filter((item) => !caseId || item.caseId === caseId)
        .filter((item) => !status || item.status === status)
        .filter((item) => !assignee || item.assigneeId === assignee)
        .filter((item) => !query || [item.id, item.title, item.description, item.status, item.priority].some((value) => String(value || '').toLowerCase().includes(query)));
    return sendData(res, data);
}));

router.get('/case/:caseId', requireAuth, asyncRoute(async (req, res) => {
    const relatedCase = await findCaseForUser(req.user, req.params.caseId);
    const [tasks, cases] = await Promise.all([readCollection('tasks'), readCollection('cases')]);
    const caseMap = new Map(cases.map((item) => [item.id, item]));
    const data = tasks.filter((item) => !item.deletedAt && item.caseId === relatedCase.id && canAccessTask(req.user, item, caseMap.get(item.caseId)));
    return sendData(res, data);
}));

router.post('/case/:caseId', requireAuth, taskWriter, asyncRoute(async (req, res) => createTask(req, res, req.params.caseId)));

async function createTask(req, res, caseId) {
    const title = textValue(req.body?.title);
    if (!title) return sendError(res, 422, 'VALIDATION_ERROR', 'Task title is required.');
    const relatedCase = await findCaseForUser(req.user, caseId, { write: true, permission: 'case:write' });
    if (relatedCase.status === 'Closed' || relatedCase.status === 'Archived') return sendError(res, 409, 'CASE_CLOSED', 'Tasks cannot be added to a closed case.');
    const users = await readCollection('users');
    const assigneeId = textValue(req.body?.assigneeId);
    if (assigneeId && !users.some((user) => user.id === assigneeId && user.status === 'active')) return sendError(res, 422, 'VALIDATION_ERROR', 'Assignee was not found.');
    const timestamp = new Date().toISOString();
    const task = {
        id: `TASK-${crypto.randomUUID()}`,
        caseId,
        title,
        description: textValue(req.body?.description),
        status: 'Todo',
        priority: textValue(req.body?.priority) || 'Medium',
        assigneeId: assigneeId || null,
        createdBy: req.user.id,
        dueDate: textValue(req.body?.dueDate) || null,
        createdAt: timestamp,
        updatedAt: timestamp,
        completedAt: null,
    };
    await appendToCollection('tasks', task);
    await addTimelineEvent({ caseId, type: 'task', title: 'Task created', detail: `${title} was created.`, actorId: req.user.id, metadata: { taskId: task.id } });
    if (task.assigneeId) await addNotification({ recipientId: task.assigneeId, type: 'task', title: 'Task assigned', message: `${title} is ready.`, resourceType: 'Task', resourceId: task.id });
    await addAuditEvent({ actor: req.user.id, action: 'TASK_CREATED', resource: 'Task', resourceId: task.id, metadata: { caseId } });
    return sendData(res, task, 201);
}

router.post('/', requireAuth, taskWriter, asyncRoute(async (req, res) => createTask(req, res, textValue(req.body?.caseId))));

async function updateTaskStatus(req, res) {
    const { task, relatedCase } = await taskContext(req, { write: true });
    const nextStatus = textValue(req.body?.status);
    if (!statusTransitions[task.status]?.includes(nextStatus)) return sendError(res, 409, 'INVALID_TASK_STATUS', `Cannot transition task from ${task.status} to ${nextStatus || 'unknown'}.`);
    const timestamp = new Date().toISOString();
    const updated = await updateCollectionItem('tasks', task.id, { status: nextStatus, updatedAt: timestamp, completedAt: nextStatus === 'Completed' ? timestamp : null });
    await addTimelineEvent({ caseId: task.caseId, type: 'task', title: 'Task status changed', detail: `${task.status} changed to ${nextStatus}.`, actorId: req.user.id, metadata: { taskId: task.id, from: task.status, to: nextStatus } });
    if (task.assigneeId && task.assigneeId !== req.user.id) await addNotification({ recipientId: task.assigneeId, type: 'task', title: 'Task updated', message: `${task.title} is now ${nextStatus}.`, resourceType: 'Task', resourceId: task.id });
    await addAuditEvent({ actor: req.user.id, action: 'TASK_STATUS_CHANGED', resource: 'Task', resourceId: task.id, metadata: { from: task.status, to: nextStatus } });
    return sendData(res, updated);
}

router.patch('/:id/status', requireAuth, taskWriter, asyncRoute(updateTaskStatus));
router.put('/:id/status', requireAuth, taskWriter, asyncRoute(updateTaskStatus));

router.get('/:id', requireAuth, asyncRoute(async (req, res) => {
    const { task } = await taskContext(req);
    return sendData(res, task);
}));

router.patch('/:id', requireAuth, taskWriter, asyncRoute(async (req, res) => {
    const { task } = await taskContext(req, { write: true });
    const allowed = ['title', 'description', 'priority', 'assigneeId', 'dueDate'];
    const update = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
    if (!Object.keys(update).length) return sendError(res, 422, 'VALIDATION_ERROR', 'No editable task fields were supplied.');
    if (update.assigneeId) {
        const users = await readCollection('users');
        if (!users.some((user) => user.id === update.assigneeId && user.status === 'active')) return sendError(res, 422, 'VALIDATION_ERROR', 'Assignee was not found.');
    }
    update.updatedAt = new Date().toISOString();
    const updated = await updateCollectionItem('tasks', task.id, update);
    if (update.assigneeId) await addNotification({ recipientId: update.assigneeId, type: 'task', title: 'Task assigned', message: `${update.title || task.title} was assigned to you.`, resourceType: 'Task', resourceId: task.id });
    await addAuditEvent({ actor: req.user.id, action: 'TASK_UPDATED', resource: 'Task', resourceId: task.id, metadata: { fields: Object.keys(update).filter((key) => key !== 'updatedAt') } });
    return sendData(res, updated);
}));

router.delete('/:id', requireAuth, taskDeleter, asyncRoute(async (req, res) => {
    const { task } = await taskContext(req, { write: true });
    const deleted = await removeCollectionItem('tasks', task.id, { softDelete: false });
    await addAuditEvent({ actor: req.user.id, action: 'TASK_DELETED', resource: 'Task', resourceId: task.id });
    return sendData(res, { deleted: true, task: deleted });
}));

export default router;
