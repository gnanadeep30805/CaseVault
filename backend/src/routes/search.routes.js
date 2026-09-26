import express from 'express';
import { canAccessResource, filterAccessibleResources, requireAuth } from '../middleware/auth.js';
import { readCollection } from '../services/store.js';
import { asyncRoute, sendData, sendError, textValue } from '../utils/route-helpers.js';

const router = express.Router();

function matches(value, query) {
    return !query || String(value || '').toLowerCase().includes(query);
}

router.get('/', requireAuth, asyncRoute(async (req, res) => {
    const query = textValue(req.query.q || req.query.query || req.query.search).toLowerCase();
    if (query.length < 2) return sendError(res, 422, 'VALIDATION_ERROR', 'A search query of at least two characters is required.');
    const [cases, documents, evidence, tasks, users, departments] = await Promise.all([readCollection('cases'), readCollection('documents'), readCollection('evidence'), readCollection('tasks'), readCollection('users'), readCollection('departments')]);
    const caseMap = new Map(cases.map((item) => [item.id, item]));
    const results = {
        cases: filterAccessibleResources(req.user, cases).filter((item) => [item.id, item.caseNumber, item.title, item.description, item.type].some((value) => matches(value, query))).slice(0, 50),
        documents: documents.filter((item) => !item.deletedAt && canAccessResource(req.user, item, caseMap.get(item.caseId))).filter((item) => [item.id, item.fileName, item.caseNumber, item.category].some((value) => matches(value, query))).slice(0, 50),
        evidence: filterAccessibleResources(req.user, evidence, caseMap).filter((item) => [item.id, item.caseNumber, item.description, item.type, item.location].some((value) => matches(value, query))).slice(0, 50),
        tasks: tasks.filter((item) => !item.deletedAt && canAccessResource(req.user, item, caseMap.get(item.caseId), { permission: 'task:read' })).filter((item) => [item.id, item.title, item.description, item.status].some((value) => matches(value, query))).slice(0, 50),
        users: (req.user.role === 'Administrator' ? users : users.filter((item) => item.id === req.user.id)).filter((item) => [item.id, item.name, item.email, item.username, item.department].some((value) => matches(value, query))).map(({ id, name, email, username, role, department }) => ({ id, name, email, username, role, department })).slice(0, 25),
        departments: departments.filter((item) => matches(item.name, query)).slice(0, 25),
    };
    const total = Object.values(results).reduce((sum, items) => sum + items.length, 0);
    return sendData(res, { query, total, results, counts: Object.fromEntries(Object.entries(results).map(([key, items]) => [key, items.length])) });
}));

export default router;
