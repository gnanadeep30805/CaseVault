import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getSecurityOverview } from '../services/security-core.js';
import { accessibleSnapshot, countBy } from '../services/reporting.service.js';
import { readCollection } from '../services/store.js';
import { asyncRoute, sendData } from '../utils/route-helpers.js';

const router = express.Router();

router.get('/', requireAuth, asyncRoute(async (req, res) => {
    const snapshot = await accessibleSnapshot(req.user);
    const notifications = (await readCollection('notifications')).filter((item) => item.recipientId === req.user.id && !item.read && !item.deletedAt);
    return sendData(res, {
        stats: {
            activeCases: snapshot.cases.filter((item) => !['Closed', 'Archived'].includes(item.status)).length,
            totalCases: snapshot.cases.length,
            pendingReviews: snapshot.documents.filter((item) => item.status === 'Pending').length,
            documents: snapshot.documents.length,
            evidence: snapshot.evidence.length,
            openTasks: snapshot.tasks.filter((item) => !['Completed', 'Cancelled'].includes(item.status)).length,
            unreadNotifications: notifications.length,
        },
        caseStatus: countBy(snapshot.cases, 'status'),
        documentStatus: countBy(snapshot.documents, 'status'),
        evidenceStatus: countBy(snapshot.evidence, 'status'),
        taskStatus: countBy(snapshot.tasks, 'status'),
        recentActivity: snapshot.auditLogs.slice(0, 12),
        security: getSecurityOverview({
            verifiedDocuments: snapshot.documents.filter((item) => item.integrityStatus === 'VERIFIED').length,
            failedVerification: snapshot.documents.filter((item) => item.integrityStatus === 'COMPROMISED').length,
        }),
    });
}));

router.get('/summary', requireAuth, asyncRoute(async (req, res) => {
    const snapshot = await accessibleSnapshot(req.user);
    return sendData(res, { cases: snapshot.cases.length, documents: snapshot.documents.length, evidence: snapshot.evidence.length, tasks: snapshot.tasks.length });
}));

router.get('/recent-activity', requireAuth, asyncRoute(async (req, res) => {
    const snapshot = await accessibleSnapshot(req.user);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    return sendData(res, snapshot.auditLogs.slice(0, limit));
}));

export default router;
