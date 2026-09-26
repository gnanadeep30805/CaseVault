import express from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { verifyAuditChain } from '../services/security-core.js';
import { readCollection } from '../services/store.js';
import { asyncRoute, sendData, textValue } from '../utils/route-helpers.js';

const router = express.Router();
const auditReader = requirePermission('audit:read');

router.get('/', requireAuth, auditReader, asyncRoute(async (req, res) => {
    const logs = await readCollection('auditLogs');
    const action = textValue(req.query.action);
    const actor = textValue(req.query.actor);
    const resource = textValue(req.query.resource);
    const from = textValue(req.query.from);
    const to = textValue(req.query.to);
    const filtered = logs.filter((item) => (!action || item.action === action) && (!actor || item.actor === actor) && (!resource || item.resource === resource) && (!from || new Date(item.timestamp) >= new Date(from)) && (!to || new Date(item.timestamp) <= new Date(to)));
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
    res.setHeader('X-Total-Count', String(filtered.length));
    return sendData(res, filtered.slice(-limit).reverse());
}));

router.get('/actions', requireAuth, auditReader, asyncRoute(async (req, res) => {
    const logs = await readCollection('auditLogs');
    return sendData(res, [...new Set(logs.map((item) => item.action))].sort());
}));

router.get('/export', requireAuth, auditReader, asyncRoute(async (req, res) => {
    const logs = await readCollection('auditLogs');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="casevault-audit-${new Date().toISOString().slice(0, 10)}.json"`);
    return res.status(200).json({ success: true, exportedAt: new Date().toISOString(), data: logs });
}));

async function verifyChain(req, res) {
    const logs = await readCollection('auditLogs');
    return sendData(res, { algorithm: 'SHA-256', ...verifyAuditChain(logs) });
}

router.get('/verify-chain', requireAuth, auditReader, asyncRoute(verifyChain));
router.post('/verify-chain', requireAuth, auditReader, asyncRoute(verifyChain));
router.get('/verify', requireAuth, auditReader, asyncRoute(verifyChain));
router.post('/verify', requireAuth, auditReader, asyncRoute(verifyChain));

export default router;
