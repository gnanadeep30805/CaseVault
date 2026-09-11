import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { addAuditEvent, appendToCollection, readCollection, updateCollectionItem } from '../services/store.js';

const router = express.Router();
const transitions = {
    Created: ['Under Investigation', 'Archived'],
    'Under Investigation': ['Evidence Collection', 'Archived'],
    'Evidence Collection': ['Investigation Review', 'Archived'],
    'Investigation Review': ['Legal Review', 'Archived'],
    'Legal Review': ['Closed', 'Archived'],
    Closed: ['Archived'],
    Archived: [],
};

const caseWriter = requireRole('Administrator', 'Supervisor', 'Investigation Officer');

router.get('/', requireAuth, async (req, res, next) => {
    try {
        const items = await readCollection('cases');
        const query = String(req.query.search || '').trim().toLowerCase();
        const status = String(req.query.status || '').trim();
        const filtered = items.filter((item) => {
            const matchesQuery = !query || [item.id, item.caseNumber, item.title, item.type].some((value) => String(value).toLowerCase().includes(query));
            return matchesQuery && (!status || item.status === status);
        });
        res.status(200).json({ success: true, data: filtered });
    } catch (error) {
        next(error);
    }
});

router.post('/', requireAuth, caseWriter, async (req, res, next) => {
    const body = req.body || {};
    if (!body.caseNumber || !body.title || !body.type || !body.priority || !body.department || !body.classification) {
        return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Case number, title, type, priority, department, and classification are required.' } });
    }
    try {
        const items = await readCollection('cases');
        if (items.some((item) => item.caseNumber === body.caseNumber)) {
            return res.status(409).json({ success: false, error: { code: 'DUPLICATE_CASE_NUMBER', message: 'Case number already exists.' } });
        }
        const timestamp = new Date().toISOString();
        const newCase = {
            id: `case-${Date.now()}`,
            caseNumber: body.caseNumber,
            title: body.title,
            type: body.type,
            description: body.description || '',
            priority: body.priority,
            department: body.department,
            status: 'Created',
            assignedOfficer: body.assignedOfficer || 'Unassigned',
            createdAt: timestamp,
            updatedAt: timestamp,
            classification: body.classification,
        };
        await appendToCollection('cases', newCase);
        await addAuditEvent({ actor: req.user.id, action: 'CASE_CREATED', resource: 'Case', resourceId: newCase.id, metadata: { caseNumber: newCase.caseNumber } });
        res.status(201).json({ success: true, data: newCase });
    } catch (error) {
        next(error);
    }
});

router.get('/:id', requireAuth, async (req, res, next) => {
    try {
        const found = (await readCollection('cases')).find((item) => item.id === req.params.id);
        if (!found) return res.status(404).json({ success: false, error: { code: 'CASE_NOT_FOUND', message: 'Case not found.' } });
        res.status(200).json({ success: true, data: found });
    } catch (error) {
        next(error);
    }
});

router.patch('/:id/status', requireAuth, caseWriter, async (req, res, next) => {
    try {
        const found = (await readCollection('cases')).find((item) => item.id === req.params.id);
        if (!found) return res.status(404).json({ success: false, error: { code: 'CASE_NOT_FOUND', message: 'Case not found.' } });
        const nextStatus = req.body?.status;
        if (!transitions[found.status]?.includes(nextStatus)) {
            return res.status(409).json({ success: false, error: { code: 'INVALID_STATUS_TRANSITION', message: `Cannot transition case from ${found.status} to ${nextStatus || 'unknown'}.` } });
        }
        const previousStatus = found.status;
        const updated = await updateCollectionItem('cases', found.id, { status: nextStatus, updatedAt: new Date().toISOString() });
        await addAuditEvent({ actor: req.user.id, action: 'CASE_STATUS_CHANGED', resource: 'Case', resourceId: found.id, metadata: { from: previousStatus, to: nextStatus } });
        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
});

export default router;
