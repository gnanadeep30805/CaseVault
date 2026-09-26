import express from 'express';
import { env } from '../config/env.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { analyzeCase, analyzeDocument, analyzeWorkspace, answerCaseQuestion, summarizeCase } from '../services/ai.service.js';
import { addAuditEvent } from '../services/store.js';
import { asyncRoute, sendData, sendError, textValue } from '../utils/route-helpers.js';

const router = express.Router();
const aiRunner = requirePermission('ai:analyze');

async function recordAnalysis(req, caseId, result) {
    await addAuditEvent({ actor: req.user.id, action: 'AI_ANALYSIS_REQUESTED', resource: caseId ? 'Case' : 'Workspace', resourceId: caseId || 'WORKSPACE', metadata: { analysisId: result.analysisId, provider: result.provider, analysisVersion: result.analysisVersion, citationCount: result.citations.length } });
    return result;
}

router.post('/analyze', requireAuth, aiRunner, asyncRoute(async (req, res) => {
    const caseId = textValue(req.body?.caseId);
    if (!caseId) return sendError(res, 422, 'VALIDATION_ERROR', 'A caseId is required for case analysis.');
    const result = await analyzeCase({ user: req.user, caseId, prompt: textValue(req.body?.prompt || req.body?.question) });
    await recordAnalysis(req, caseId, result);
    return sendData(res, result);
}));

router.post('/analyze/case/:caseId', requireAuth, aiRunner, asyncRoute(async (req, res) => {
    const result = await analyzeCase({ user: req.user, caseId: req.params.caseId, prompt: textValue(req.body?.prompt) });
    await recordAnalysis(req, req.params.caseId, result);
    return sendData(res, result);
}));

router.post('/case/:caseId/analyze', requireAuth, aiRunner, asyncRoute(async (req, res) => {
    const result = await analyzeCase({ user: req.user, caseId: req.params.caseId, prompt: textValue(req.body?.prompt) });
    await recordAnalysis(req, req.params.caseId, result);
    return sendData(res, result);
}));

router.post('/cases/:caseId/summarize', requireAuth, aiRunner, asyncRoute(async (req, res) => {
    const result = await summarizeCase({ user: req.user, caseId: req.params.caseId });
    await recordAnalysis(req, req.params.caseId, result);
    return sendData(res, result);
}));

router.post('/cases/:caseId/chat', requireAuth, aiRunner, asyncRoute(async (req, res) => {
    const question = textValue(req.body?.question || req.body?.prompt || req.body?.message);
    if (!question) return sendError(res, 422, 'VALIDATION_ERROR', 'A question is required.');
    const result = await answerCaseQuestion({ user: req.user, caseId: req.params.caseId, question });
    await recordAnalysis(req, req.params.caseId, result);
    return sendData(res, result);
}));

router.post('/documents/:documentId/analyze', requireAuth, aiRunner, asyncRoute(async (req, res) => {
    const result = await analyzeDocument({ user: req.user, documentId: req.params.documentId });
    await recordAnalysis(req, result.caseId, result);
    return sendData(res, result);
}));

router.get('/workspace', requireAuth, aiRunner, asyncRoute(async (req, res) => {
    const result = await analyzeWorkspace({ user: req.user, query: textValue(req.query.q || req.query.query) });
    return sendData(res, result);
}));

router.post('/workspace', requireAuth, aiRunner, asyncRoute(async (req, res) => {
    const result = await analyzeWorkspace({ user: req.user, query: textValue(req.body?.query) });
    await recordAnalysis(req, null, result);
    return sendData(res, result);
}));

router.get('/info', requireAuth, aiRunner, asyncRoute(async (req, res) => {
    return sendData(res, { provider: 'local-mock', mode: 'deterministic', analysisVersion: 'local-deterministic-v1', providerHookEnabled: Boolean(env.aiProviderHook), outputPolicy: 'Authorized sources only; investigator review required.' });
}));

export default router;
