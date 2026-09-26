import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { addNotification, readCollection, updateCollectionItem, removeCollectionItem } from '../services/store.js';
import { asyncRoute, sendData, sendError, textValue } from '../utils/route-helpers.js';

const router = express.Router();

function canReadNotification(user, notification) {
    return notification.recipientId === user.id || user.role === 'Administrator';
}

router.get('/', requireAuth, asyncRoute(async (req, res) => {
    const notifications = (await readCollection('notifications')).filter((item) => canReadNotification(req.user, item) && !item.deletedAt);
    const unreadOnly = String(req.query.unread || '').toLowerCase() === 'true';
    const filtered = unreadOnly ? notifications.filter((item) => !item.read) : notifications;
    return sendData(res, { items: filtered, unreadCount: notifications.filter((item) => !item.read).length, total: notifications.length });
}));

router.get('/unread-count', requireAuth, asyncRoute(async (req, res) => {
    const notifications = (await readCollection('notifications')).filter((item) => item.recipientId === req.user.id && !item.read && !item.deletedAt);
    return sendData(res, { count: notifications.length });
}));

router.post('/', requireAuth, asyncRoute(async (req, res) => {
    const recipientId = textValue(req.body?.recipientId) || req.user.id;
    if (recipientId !== req.user.id && req.user.role !== 'Administrator') return sendError(res, 403, 'FORBIDDEN', 'You cannot create notifications for another user.');
    const title = textValue(req.body?.title);
    const message = textValue(req.body?.message);
    if (!title || !message) return sendError(res, 422, 'VALIDATION_ERROR', 'Notification title and message are required.');
    const notification = await addNotification({ recipientId, type: textValue(req.body?.type) || 'general', title, message, resourceType: textValue(req.body?.resourceType) || null, resourceId: textValue(req.body?.resourceId) || null, metadata: req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {} });
    return sendData(res, notification, 201);
}));

async function markRead(req, res) {
    const notification = (await readCollection('notifications')).find((item) => item.id === req.params.id);
    if (!notification || !canReadNotification(req.user, notification)) return sendError(res, 404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
    if (notification.read) return sendData(res, notification);
    const updated = await updateCollectionItem('notifications', notification.id, { read: true, readAt: new Date().toISOString() });
    return sendData(res, updated);
}

router.patch('/:id/read', requireAuth, asyncRoute(markRead));
router.post('/:id/read', requireAuth, asyncRoute(markRead));
router.patch('/:id', requireAuth, asyncRoute(async (req, res) => {
    if (req.body?.read === true || req.body?.read === 'true') return markRead(req, res);
    return sendError(res, 422, 'VALIDATION_ERROR', 'Only notification read state can be changed.');
}));

router.post('/read-all', requireAuth, asyncRoute(async (req, res) => {
    const notifications = (await readCollection('notifications')).filter((item) => item.recipientId === req.user.id && !item.read && !item.deletedAt);
    const updated = [];
    for (const notification of notifications) updated.push(await updateCollectionItem('notifications', notification.id, { read: true, readAt: new Date().toISOString() }));
    return sendData(res, { updated: updated.length, items: updated });
}));

router.delete('/:id', requireAuth, asyncRoute(async (req, res) => {
    const notification = (await readCollection('notifications')).find((item) => item.id === req.params.id);
    if (!notification || !canReadNotification(req.user, notification)) return sendError(res, 404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
    const deleted = await removeCollectionItem('notifications', notification.id, { softDelete: false });
    return sendData(res, { deleted: true, notification: deleted });
}));

export default router;
