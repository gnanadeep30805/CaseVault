import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { addAuditEvent, appendToCollection, readCollection, updateCollectionItem } from '../services/store.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
    try {
        const items = await readCollection('assets');
        const query = String(req.query.search || '').trim().toLowerCase();
        res.json({ success: true, data: items.filter((item) => !query || [item.id, item.name, item.serial, item.department].some((value) => String(value).toLowerCase().includes(query))) });
    } catch (error) { next(error); }
});

router.post('/', requireAuth, async (req, res, next) => {
    const body = req.body || {};
    if (!body.name || !body.category || !body.serial || !body.department || !body.location) return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Name, category, serial, department, and location are required.' } });
    try {
        const items = await readCollection('assets');
        if (items.some((item) => item.serial === body.serial)) return res.status(409).json({ success: false, error: { code: 'DUPLICATE_ASSET', message: 'Asset serial number already exists.' } });
        const asset = { id: `AS-${Date.now()}`, name: body.name, category: body.category, serial: body.serial, department: body.department, assignedOfficer: null, location: body.location, condition: body.condition || 'Good', status: 'Available', createdAt: new Date().toISOString() };
        await appendToCollection('assets', asset);
        await addAuditEvent({ actor: req.user.id, action: 'ASSET_REGISTERED', resource: 'Asset', resourceId: asset.id });
        res.status(201).json({ success: true, data: asset });
    } catch (error) { next(error); }
});

router.patch('/:id/assign', requireAuth, async (req, res, next) => {
    const body = req.body || {};
    if (!body.assignedOfficer || !body.location) return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Officer and location are required.' } });
    try {
        const items = await readCollection('assets');
        const asset = items.find((item) => item.id === req.params.id);
        if (!asset) return res.status(404).json({ success: false, error: { code: 'ASSET_NOT_FOUND', message: 'Asset not found.' } });
        if (!['Available', 'Registered', 'Assigned'].includes(asset.status)) return res.status(409).json({ success: false, error: { code: 'INVALID_ASSET_STATE', message: 'Asset is not available for assignment.' } });
        const updated = await updateCollectionItem('assets', asset.id, { assignedOfficer: body.assignedOfficer, location: body.location, status: 'Assigned' });
        await addAuditEvent({ actor: req.user.id, action: 'ASSET_ASSIGNED', resource: 'Asset', resourceId: asset.id, metadata: { assignedOfficer: body.assignedOfficer } });
        res.json({ success: true, data: updated });
    } catch (error) { next(error); }
});

router.patch('/:id/return', requireAuth, async (req, res, next) => {
    try {
        const items = await readCollection('assets');
        const asset = items.find((item) => item.id === req.params.id);
        if (!asset) return res.status(404).json({ success: false, error: { code: 'ASSET_NOT_FOUND', message: 'Asset not found.' } });
        const updated = await updateCollectionItem('assets', asset.id, { assignedOfficer: null, location: req.body?.location || asset.location, condition: req.body?.condition || asset.condition, status: 'Available' });
        await addAuditEvent({ actor: req.user.id, action: 'ASSET_RETURNED', resource: 'Asset', resourceId: asset.id });
        res.json({ success: true, data: updated });
    } catch (error) { next(error); }
});

export default router;