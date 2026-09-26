import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLE_PERMISSIONS } from '../services/authorization.service.js';
import { getUserById, listUsersForUI, registerUser } from '../services/auth.service.js';
import { addAuditEvent, readCollection, updateCollectionItem } from '../services/store.js';
import { asyncRoute, sendData, sendError, textValue } from '../utils/route-helpers.js';

const router = express.Router();
const adminOnly = requireRole('Administrator');
const userReader = requireRole('Administrator', 'Supervisor', 'Legal Officer');

router.get('/roles', requireAuth, asyncRoute(async (req, res) => sendData(res, await readCollection('roles'))));
router.get('/departments', requireAuth, asyncRoute(async (req, res) => sendData(res, await readCollection('departments'))));

router.get('/', requireAuth, userReader, asyncRoute(async (req, res) => {
    const query = textValue(req.query.search || req.query.q).toLowerCase();
    const users = await listUsersForUI();
    return sendData(res, users.filter((user) => !query || [user.id, user.name, user.email, user.username, user.role, user.department].some((value) => String(value || '').toLowerCase().includes(query))));
}));

router.post('/', requireAuth, adminOnly, asyncRoute(async (req, res) => {
    const body = req.body || {};
    const role = textValue(body.role) || 'Investigation Officer';
    if (!ROLE_PERMISSIONS[role]) return sendError(res, 422, 'INVALID_ROLE', 'Unknown role.');
    const created = await registerUser({
        name: body.name,
        email: body.email,
        username: body.username,
        password: body.password,
        department: body.department || 'Investigation',
        role,
        mfaEnabled: body.mfaEnabled !== false,
        clearance: body.clearance || 'CONFIDENTIAL',
        allowPrivilegedRoles: true,
    });
    const updated = await updateCollectionItem('users', created.user.id, { role, department: textValue(body.department) || created.user.department, clearance: String(body.clearance || created.user.clearance).toUpperCase(), status: body.status === 'disabled' ? 'disabled' : 'active', mfaEnabled: body.mfaEnabled !== false });
    await addAuditEvent({ actor: req.user.id, action: 'USER_CREATED', resource: 'User', resourceId: created.user.id, metadata: { role } });
    return sendData(res, { id: updated.id, name: updated.name, email: updated.email, username: updated.username, role: updated.role, department: updated.department, clearance: updated.clearance, status: updated.status, mfaEnabled: updated.mfaEnabled, mfaSetup: created.mfaSetup }, 201);
}));

router.get('/me', requireAuth, asyncRoute(async (req, res) => {
    const user = await getUserById(req.user.id);
    return sendData(res, { id: user.id, name: user.name, email: user.email, username: user.username, role: user.role, department: user.department, clearance: user.clearance, status: user.status, mfaEnabled: user.mfaEnabled, lastLogin: user.lastLogin, createdAt: user.createdAt });
}));

router.patch('/me', requireAuth, asyncRoute(async (req, res) => {
    const update = {};
    if (req.body?.name !== undefined) update.name = textValue(req.body.name);
    if (!Object.keys(update).length || !update.name) return sendError(res, 422, 'VALIDATION_ERROR', 'A valid name is required.');
    const updated = await updateCollectionItem('users', req.user.id, { ...update, updatedAt: new Date().toISOString() });
    await addAuditEvent({ actor: req.user.id, action: 'PROFILE_UPDATED', resource: 'User', resourceId: req.user.id });
    return sendData(res, { id: updated.id, name: updated.name, email: updated.email, username: updated.username, role: updated.role, department: updated.department, clearance: updated.clearance, status: updated.status });
}));

router.get('/:id', requireAuth, userReader, asyncRoute(async (req, res) => {
    const user = await getUserById(req.params.id);
    if (!user) return sendError(res, 404, 'USER_NOT_FOUND', 'User not found.');
    return sendData(res, { id: user.id, name: user.name, email: user.email, username: user.username, role: user.role, department: user.department, clearance: user.clearance, status: user.status, mfaEnabled: user.mfaEnabled, lastLogin: user.lastLogin, createdAt: user.createdAt });
}));

router.patch('/:id', requireAuth, adminOnly, asyncRoute(async (req, res) => {
    const user = await getUserById(req.params.id);
    if (!user) return sendError(res, 404, 'USER_NOT_FOUND', 'User not found.');
    const update = {};
    for (const key of ['name', 'role', 'department', 'clearance', 'status']) if (req.body?.[key] !== undefined) update[key] = key === 'clearance' ? String(req.body[key]).toUpperCase() : textValue(req.body[key]);
    if (req.body?.mfaEnabled !== undefined) update.mfaEnabled = Boolean(req.body.mfaEnabled);
    if (update.role && !ROLE_PERMISSIONS[update.role]) return sendError(res, 422, 'INVALID_ROLE', 'Unknown role.');
    if (user.id === req.user.id && update.status === 'disabled') return sendError(res, 409, 'SELF_DISABLE', 'You cannot disable your own account.');
    if (!Object.keys(update).length) return sendError(res, 422, 'VALIDATION_ERROR', 'No user fields were supplied.');
    update.updatedAt = new Date().toISOString();
    const updated = await updateCollectionItem('users', user.id, update);
    await addAuditEvent({ actor: req.user.id, action: 'USER_UPDATED', resource: 'User', resourceId: user.id, metadata: { fields: Object.keys(update).filter((key) => key !== 'updatedAt') } });
    return sendData(res, { id: updated.id, name: updated.name, email: updated.email, username: updated.username, role: updated.role, department: updated.department, clearance: updated.clearance, status: updated.status, mfaEnabled: updated.mfaEnabled });
}));

router.patch('/:id/status', requireAuth, adminOnly, asyncRoute(async (req, res) => {
    const user = await getUserById(req.params.id);
    if (!user) return sendError(res, 404, 'USER_NOT_FOUND', 'User not found.');
    const status = textValue(req.body?.status);
    if (!['active', 'disabled', 'suspended'].includes(status)) return sendError(res, 422, 'VALIDATION_ERROR', 'Status must be active, disabled, or suspended.');
    if (user.id === req.user.id && status !== 'active') return sendError(res, 409, 'SELF_DISABLE', 'You cannot disable your own account.');
    const updated = await updateCollectionItem('users', user.id, { status, updatedAt: new Date().toISOString() });
    await addAuditEvent({ actor: req.user.id, action: 'USER_STATUS_CHANGED', resource: 'User', resourceId: user.id, metadata: { status } });
    return sendData(res, { id: updated.id, status: updated.status });
}));

router.delete('/:id', requireAuth, adminOnly, asyncRoute(async (req, res) => {
    if (req.params.id === req.user.id) return sendError(res, 409, 'SELF_DISABLE', 'You cannot disable your own account.');
    const user = await getUserById(req.params.id);
    if (!user) return sendError(res, 404, 'USER_NOT_FOUND', 'User not found.');
    const updated = await updateCollectionItem('users', user.id, { status: 'disabled', updatedAt: new Date().toISOString() });
    await addAuditEvent({ actor: req.user.id, action: 'USER_DISABLED', resource: 'User', resourceId: user.id });
    return sendData(res, { disabled: true, id: updated.id, status: updated.status });
}));

export default router;
