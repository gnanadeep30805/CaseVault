import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { addAuditEvent, appendChronological, appendToCollection, readCollection, updateCollectionItem } from '../services/store.js';

const router = express.Router();
const assetWriter = requireRole('Administrator', 'Supervisor');
const transitions = {
    Available: ['Assigned', 'Maintenance', 'Retired'],
    Registered: ['Available', 'Assigned', 'Maintenance', 'Retired'],
    Assigned: ['Available', 'Maintenance', 'Retired'],
    'Active / In Use': ['Available', 'Maintenance', 'Retired'],
    Maintenance: ['Available', 'Assigned', 'Retired'],
    Retired: ['Disposed'],
    Disposed: [],
};

async function recordAssetEvent(asset, actor, action, metadata = {}) {
    await appendChronological('assetHistory', {
        eventId: `ASSET-EVT-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
        assetId: asset.id,
        actor,
        action,
        fromStatus: asset.status,
        toStatus: metadata.toStatus || asset.status,
        timestamp: new Date().toISOString(),
        metadata,
    });
}

router.get('/', requireAuth, async (req, res, next) => {
    try {
        const items = await readCollection('assets');
        const query = String(req.query.search || '').trim().toLowerCase();
        const data = items.filter((item) => !query || [item.id, item.name, item.serial, item.department].some((value) => String(value).toLowerCase().includes(query)));
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

router.post('/', requireAuth, assetWriter, async (req, res, next) => {
    const body = req.body || {};
    if (!body.name || !body.category || !body.serial || !body.department || !body.location) {
        return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Name, category, serial, department, and location are required.' } });
    }
    try {
        const items = await readCollection('assets');
        if (items.some((item) => item.serial === body.serial)) return res.status(409).json({ success: false, error: { code: 'DUPLICATE_ASSET', message: 'Asset serial number already exists.' } });
        const asset = {
            id: `AS-${Date.now()}`,
            name: body.name,
            category: body.category,
            serial: body.serial,
            department: body.department,
            assignedOfficer: null,
            location: body.location,
            condition: body.condition || 'Good',
            status: 'Available',
            createdAt: new Date().toISOString(),
        };
        await appendToCollection('assets', asset);
        await recordAssetEvent(asset, req.user.id, 'ASSET_REGISTERED', { toStatus: asset.status });
        await addAuditEvent({ actor: req.user.id, action: 'ASSET_REGISTERED', resource: 'Asset', resourceId: asset.id });
        res.status(201).json({ success: true, data: asset });
    } catch (error) {
        next(error);
    }
});

router.patch('/:id/assign', requireAuth, assetWriter, async (req, res, next) => {
    const body = req.body || {};
    if (!body.assignedOfficer || !body.location) return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Officer and location are required.' } });
    try {
        const asset = (await readCollection('assets')).find((item) => item.id === req.params.id);
        if (!asset) return res.status(404).json({ success: false, error: { code: 'ASSET_NOT_FOUND', message: 'Asset not found.' } });
        if (!transitions[asset.status]?.includes('Assigned')) return res.status(409).json({ success: false, error: { code: 'INVALID_ASSET_STATE', message: 'Asset is not available for assignment.' } });
        const updated = await updateCollectionItem('assets', asset.id, { assignedOfficer: body.assignedOfficer, location: body.location, status: 'Assigned' });
        await recordAssetEvent(asset, req.user.id, 'ASSET_ASSIGNED', { assignedOfficer: body.assignedOfficer, toStatus: 'Assigned' });
        await addAuditEvent({ actor: req.user.id, action: 'ASSET_ASSIGNED', resource: 'Asset', resourceId: asset.id, metadata: { assignedOfficer: body.assignedOfficer } });
        res.json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
});

router.patch('/:id/return', requireAuth, assetWriter, async (req, res, next) => {
    try {
        const asset = (await readCollection('assets')).find((item) => item.id === req.params.id);
        if (!asset) return res.status(404).json({ success: false, error: { code: 'ASSET_NOT_FOUND', message: 'Asset not found.' } });
        if (asset.status !== 'Assigned' && asset.status !== 'Active / In Use') return res.status(409).json({ success: false, error: { code: 'INVALID_ASSET_STATE', message: 'Only assigned or active assets can be returned.' } });
        const updated = await updateCollectionItem('assets', asset.id, { assignedOfficer: null, location: req.body?.location || asset.location, condition: req.body?.condition || asset.condition, status: 'Available' });
        await recordAssetEvent(asset, req.user.id, 'ASSET_RETURNED', { toStatus: 'Available' });
        await addAuditEvent({ actor: req.user.id, action: 'ASSET_RETURNED', resource: 'Asset', resourceId: asset.id });
        res.json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
});

router.get('/:id/history', requireAuth, async (req, res, next) => {
    try {
        const asset = (await readCollection('assets')).find((item) => item.id === req.params.id);
        if (!asset) return res.status(404).json({ success: false, error: { code: 'ASSET_NOT_FOUND', message: 'Asset not found.' } });
        const history = (await readCollection('assetHistory')).filter((item) => item.assetId === asset.id);
        res.json({ success: true, data: history });
    } catch (error) {
        next(error);
    }
});

router.patch('/:id/status', requireAuth, assetWriter, async (req, res, next) => {
    const { status, reason } = req.body || {};
    try {
        const asset = (await readCollection('assets')).find((item) => item.id === req.params.id);
        if (!asset) return res.status(404).json({ success: false, error: { code: 'ASSET_NOT_FOUND', message: 'Asset not found.' } });
        if (!transitions[asset.status]?.includes(status)) return res.status(409).json({ success: false, error: { code: 'INVALID_ASSET_TRANSITION', message: `Cannot transition asset from ${asset.status} to ${status || 'unknown'}.` } });
        if (!reason) return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'A reason is required for asset status changes.' } });
        const update = { status };
        if (status === 'Retired' || status === 'Disposed') update.assignedOfficer = null;
        const updated = await updateCollectionItem('assets', asset.id, update);
        await recordAssetEvent(asset, req.user.id, 'ASSET_STATUS_CHANGED', { reason, toStatus: status });
        await addAuditEvent({ actor: req.user.id, action: 'ASSET_STATUS_CHANGED', resource: 'Asset', resourceId: asset.id, metadata: { from: asset.status, to: status, reason } });
        res.json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
});

router.get('/:id/maintenance', requireAuth, async (req, res, next) => {
    try {
        const asset = (await readCollection('assets')).find((item) => item.id === req.params.id);
        if (!asset) return res.status(404).json({ success: false, error: { code: 'ASSET_NOT_FOUND', message: 'Asset not found.' } });
        const records = (await readCollection('maintenanceRecords')).filter((item) => item.assetId === asset.id);
        res.json({ success: true, data: records });
    } catch (error) {
        next(error);
    }
});

router.post('/:id/maintenance', requireAuth, assetWriter, async (req, res, next) => {
    const { scheduledDate, vendor, notes = '', estimatedCost = 0 } = req.body || {};
    if (!scheduledDate || !vendor) return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Scheduled date and vendor are required.' } });
    try {
        const asset = (await readCollection('assets')).find((item) => item.id === req.params.id);
        if (!asset) return res.status(404).json({ success: false, error: { code: 'ASSET_NOT_FOUND', message: 'Asset not found.' } });
        if (!transitions[asset.status]?.includes('Maintenance')) return res.status(409).json({ success: false, error: { code: 'INVALID_ASSET_STATE', message: 'Asset cannot enter maintenance from its current state.' } });
        const record = { id: `MNT-${Date.now()}`, assetId: asset.id, scheduledDate, vendor, notes, estimatedCost: Number(estimatedCost), actualCost: null, status: 'SCHEDULED', createdBy: req.user.id, createdAt: new Date().toISOString() };
        await appendToCollection('maintenanceRecords', record);
        await updateCollectionItem('assets', asset.id, { status: 'Maintenance', assignedOfficer: null });
        await recordAssetEvent(asset, req.user.id, 'MAINTENANCE_SCHEDULED', { toStatus: 'Maintenance', maintenanceId: record.id });
        await addAuditEvent({ actor: req.user.id, action: 'ASSET_MAINTENANCE_SCHEDULED', resource: 'Asset', resourceId: asset.id, metadata: { maintenanceId: record.id } });
        res.status(201).json({ success: true, data: record });
    } catch (error) {
        next(error);
    }
});

router.patch('/:id/maintenance/complete', requireAuth, assetWriter, async (req, res, next) => {
    try {
        const asset = (await readCollection('assets')).find((item) => item.id === req.params.id);
        if (!asset) return res.status(404).json({ success: false, error: { code: 'ASSET_NOT_FOUND', message: 'Asset not found.' } });
        const records = (await readCollection('maintenanceRecords')).filter((item) => item.assetId === asset.id && item.status !== 'COMPLETED');
        const record = records.at(-1);
        if (asset.status !== 'Maintenance' || !record) return res.status(409).json({ success: false, error: { code: 'NO_ACTIVE_MAINTENANCE', message: 'No active maintenance record exists.' } });
        const updatedRecord = await updateCollectionItem('maintenanceRecords', record.id, { status: 'COMPLETED', actualCost: Number(req.body?.actualCost ?? record.estimatedCost), completedAt: new Date().toISOString() });
        const updatedAsset = await updateCollectionItem('assets', asset.id, { status: 'Available', condition: req.body?.condition || asset.condition });
        await recordAssetEvent(asset, req.user.id, 'MAINTENANCE_COMPLETED', { toStatus: 'Available', maintenanceId: record.id });
        await addAuditEvent({ actor: req.user.id, action: 'ASSET_MAINTENANCE_COMPLETED', resource: 'Asset', resourceId: asset.id, metadata: { maintenanceId: record.id } });
        res.json({ success: true, data: { asset: updatedAsset, maintenance: updatedRecord } });
    } catch (error) {
        next(error);
    }
});

export default router;
