import express from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { verifyAuditChain, verifyCustodyChain } from '../services/security-core.js';
import { accessibleSnapshot, countBy } from '../services/reporting.service.js';
import { asyncRoute, sendData, sendError, textValue } from '../utils/route-helpers.js';

const router = express.Router();
const reportReader = requirePermission('report:read');

async function buildReport(user, type) {
    const snapshot = await accessibleSnapshot(user);
    if (type === 'summary') return { type, generatedAt: new Date().toISOString(), totalCases: snapshot.cases.length, totalDocuments: snapshot.documents.length, totalEvidence: snapshot.evidence.length, totalTasks: snapshot.tasks.length, caseStatus: countBy(snapshot.cases, 'status'), documentStatus: countBy(snapshot.documents, 'status') };
    if (type === 'cases') return { type, total: snapshot.cases.length, byStatus: countBy(snapshot.cases, 'status'), byPriority: countBy(snapshot.cases, 'priority'), items: snapshot.cases };
    if (type === 'documents') return { type, total: snapshot.documents.length, byStatus: countBy(snapshot.documents, 'status'), byIntegrity: countBy(snapshot.documents, 'integrityStatus'), items: snapshot.documents.map(({ id, fileName, caseId, caseNumber, status, integrityStatus, version }) => ({ id, fileName, caseId, caseNumber, status, integrityStatus, version })) };
    if (type === 'evidence') return { type, total: snapshot.evidence.length, byStatus: countBy(snapshot.evidence, 'status'), byType: countBy(snapshot.evidence, 'type'), items: snapshot.evidence.map(({ id, caseId, caseNumber, type: evidenceType, description, status, currentCustodian }) => ({ id, caseId, caseNumber, type: evidenceType, description, status, currentCustodian })) };
    if (type === 'tasks') return { type, total: snapshot.tasks.length, byStatus: countBy(snapshot.tasks, 'status'), byPriority: countBy(snapshot.tasks, 'priority'), items: snapshot.tasks };
    if (type === 'integrity') return { type, algorithm: 'SHA-256', auditChain: verifyAuditChain(snapshot.auditLogs), custodyChain: verifyCustodyChain(snapshot.custodyEvents), documents: { verified: snapshot.documents.filter((item) => item.integrityStatus === 'VERIFIED').length, compromised: snapshot.documents.filter((item) => item.integrityStatus === 'COMPROMISED').length } };
    return null;
}

async function reportHandler(req, res, type) {
    const report = await buildReport(req.user, type);
    if (!report) return sendError(res, 404, 'REPORT_NOT_FOUND', 'Report type not found.');
    return sendData(res, report);
}

router.get('/', requireAuth, reportReader, asyncRoute(async (req, res) => reportHandler(req, res, textValue(req.query.type) || 'summary')));
router.get('/summary', requireAuth, reportReader, asyncRoute(async (req, res) => reportHandler(req, res, 'summary')));
router.get('/:type', requireAuth, reportReader, asyncRoute(async (req, res) => reportHandler(req, res, req.params.type)));

export default router;
