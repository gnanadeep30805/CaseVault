import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sha3Hash, verifyAuditChain } from '../services/security-core.js';
import { readCollection } from '../services/store.js';

const router = express.Router();

const auditLogs = [
    {
        eventId: 'AUD-001',
        actor: 'admin@casevault.local',
        timestamp: '2026-09-08T09:00:00Z',
        action: 'LOGIN_SUCCESS',
        resource: 'Auth',
        resourceId: 'LOGIN',
        previousHash: 'GENESIS',
        currentHash: sha3Hash(JSON.stringify({ eventId: 'AUD-001', actor: 'admin@casevault.local', timestamp: '2026-09-08T09:00:00Z', action: 'LOGIN_SUCCESS', resource: 'Auth', resourceId: 'LOGIN', previousHash: 'GENESIS' })),
    },
    {
        eventId: 'AUD-002',
        actor: 'Aisha Rahman',
        timestamp: '2026-09-08T09:05:00Z',
        action: 'CASE_CREATED',
        resource: 'Case',
        resourceId: 'CV-2025-001',
        previousHash: sha3Hash(JSON.stringify({ eventId: 'AUD-001', actor: 'admin@casevault.local', timestamp: '2026-09-08T09:00:00Z', action: 'LOGIN_SUCCESS', resource: 'Auth', resourceId: 'LOGIN', previousHash: 'GENESIS' })),
        currentHash: sha3Hash(JSON.stringify({ eventId: 'AUD-002', actor: 'Aisha Rahman', timestamp: '2026-09-08T09:05:00Z', action: 'CASE_CREATED', resource: 'Case', resourceId: 'CV-2025-001', previousHash: sha3Hash(JSON.stringify({ eventId: 'AUD-001', actor: 'admin@casevault.local', timestamp: '2026-09-08T09:00:00Z', action: 'LOGIN_SUCCESS', resource: 'Auth', resourceId: 'LOGIN', previousHash: 'GENESIS' })) })),
    },
];

router.get('/', requireAuth, async (req, res, next) => {
    try {
        res.status(200).json({ success: true, data: await readCollection('auditLogs') });
    } catch (error) {
        next(error);
    }
});

router.post('/verify-chain', requireAuth, async (req, res, next) => {
    try {
        const result = verifyAuditChain(await readCollection('auditLogs'));
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

export default router;
