import express from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const cases = [
    {
        id: 'case-1001',
        caseNumber: 'CV-2025-001',
        title: 'Operation North Ridge',
        type: 'Criminal',
        description: 'Cross-border smuggling investigation.',
        priority: 'High',
        department: 'Criminal Investigation',
        status: 'Under Investigation',
        assignedOfficer: 'Aisha Rahman',
        createdAt: '2025-01-15T09:00:00Z',
        updatedAt: '2025-01-18T11:30:00Z',
        classification: 'Confidential',
    },
    {
        id: 'case-1002',
        caseNumber: 'CV-2025-002',
        title: 'Forgery Network Review',
        type: 'Financial Crime',
        description: 'Document fraud and identity misuse.',
        priority: 'Medium',
        department: 'Cyber Crime',
        status: 'Evidence Collection',
        assignedOfficer: 'Arjun Nair',
        createdAt: '2025-01-20T12:00:00Z',
        updatedAt: '2025-01-22T09:00:00Z',
        classification: 'Restricted',
    },
];

router.get('/', requireAuth, (req, res) => {
    res.status(200).json({ success: true, data: cases });
});

router.post('/', requireAuth, (req, res) => {
    const body = req.body || {};
    const newCase = {
        id: `case-${Date.now()}`,
        caseNumber: body.caseNumber || `CV-${Date.now()}`,
        title: body.title || 'Untitled Case',
        type: body.type || 'Criminal',
        description: body.description || '',
        priority: body.priority || 'Medium',
        department: body.department || 'General',
        status: 'Created',
        assignedOfficer: body.assignedOfficer || 'Unassigned',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        classification: body.classification || 'Internal',
    };

    cases.unshift(newCase);
    res.status(201).json({ success: true, data: newCase });
});

router.get('/:id', requireAuth, (req, res) => {
    const found = cases.find((item) => item.id === req.params.id);
    if (!found) {
        return res.status(404).json({ success: false, error: { code: 'CASE_NOT_FOUND', message: 'Case not found.' } });
    }
    res.status(200).json({ success: true, data: found });
});

router.patch('/:id/status', requireAuth, (req, res) => {
    const found = cases.find((item) => item.id === req.params.id);
    if (!found) {
        return res.status(404).json({ success: false, error: { code: 'CASE_NOT_FOUND', message: 'Case not found.' } });
    }
    found.status = req.body?.status || found.status;
    found.updatedAt = new Date().toISOString();
    res.status(200).json({ success: true, data: found });
});

export default router;
