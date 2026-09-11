import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { replaceCollection } from '../src/services/store.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../CaseVault_Synthetic_Test_Data');
const csvPath = path.join(root, 'assets.csv');

function parseCsv(text) {
    const [header, ...rows] = text.trim().split(/\r?\n/).map((row) => row.split(','));
    return rows.filter((row) => row.length === header.length).map((row) => Object.fromEntries(header.map((key, index) => [key, row[index]])));
}

const statusMap = { ACTIVE: 'Active / In Use', ASSIGNED: 'Assigned', AVAILABLE: 'Available', MAINTENANCE: 'Maintenance', RETIRED: 'Retired' };
const rows = parseCsv(await fs.readFile(csvPath, 'utf8'));
const assets = rows.map((row) => ({
    id: row.asset_id,
    name: row.name,
    category: row.category,
    serial: row.serial_number,
    department: row.department_id,
    assignedOfficer: row.assigned_to || null,
    location: row.location,
    condition: row.condition,
    status: statusMap[row.status] || row.status,
    createdAt: new Date().toISOString(),
}));

const assetHistory = assets.map((asset) => ({
    eventId: `ASSET-SEED-${asset.id}`,
    assetId: asset.id,
    actor: 'synthetic-import',
    action: 'ASSET_IMPORTED',
    fromStatus: null,
    toStatus: asset.status,
    timestamp: new Date().toISOString(),
    metadata: { source: 'CaseVault_Synthetic_Test_Data/assets.csv' },
}));

const maintenanceRecords = assets
    .filter((asset) => asset.status === 'Maintenance')
    .map((asset) => ({
        id: `MNT-${asset.id}`,
        assetId: asset.id,
        scheduledDate: new Date().toISOString().slice(0, 10),
        vendor: 'Pending assignment',
        notes: 'Imported from synthetic maintenance state.',
        estimatedCost: 0,
        actualCost: null,
        status: 'SCHEDULED',
        createdBy: 'synthetic-import',
        createdAt: new Date().toISOString(),
    }));

await replaceCollection('assets', assets);
await replaceCollection('assetHistory', assetHistory);
await replaceCollection('maintenanceRecords', maintenanceRecords);
console.log(`Imported ${assets.length} synthetic assets into backend/data/casevault.json`);
