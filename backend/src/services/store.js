import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha3Hash } from './security-core.js';

const dataDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
const dataFile = path.join(dataDirectory, 'casevault.json');

const seedState = {
    cases: [
        {
            id: 'case-1001', caseNumber: 'CV-2025-001', title: 'Operation North Ridge', type: 'Criminal',
            description: 'Cross-border smuggling investigation.', priority: 'High', department: 'Criminal Investigation',
            status: 'Under Investigation', assignedOfficer: 'Aisha Rahman', createdAt: '2025-01-15T09:00:00Z',
            updatedAt: '2025-01-18T11:30:00Z', classification: 'Confidential',
        },
        {
            id: 'case-1002', caseNumber: 'CV-2025-002', title: 'Forgery Network Review', type: 'Financial Crime',
            description: 'Document fraud and identity misuse.', priority: 'Medium', department: 'Cyber Crime',
            status: 'Evidence Collection', assignedOfficer: 'Arjun Nair', createdAt: '2025-01-20T12:00:00Z',
            updatedAt: '2025-01-22T09:00:00Z', classification: 'Restricted',
        },
    ],
    documents: [
        {
            id: 'DOC-001', fileName: 'FIR_0412.pdf', caseId: 'case-1001', caseNumber: 'CV-2025-001', category: 'FIR',
            classification: 'CONFIDENTIAL', version: '1.0', uploadedBy: 'Aisha Rahman', uploadedAt: '2026-02-10T09:30:00Z',
            status: 'Approved', integrityStatus: 'VERIFIED', algorithm: 'SHA3-256', registeredHash: sha3Hash('FIR_0412.pdf'),
            lastVerified: '2026-09-08T11:05:00Z',
        },
        {
            id: 'DOC-002', fileName: 'Statement_011.xml', caseId: 'case-1002', caseNumber: 'CV-2025-002', category: 'Statement',
            classification: 'RESTRICTED', version: '2.0', uploadedBy: 'K. Singh', uploadedAt: '2026-02-11T11:10:00Z',
            status: 'Pending', integrityStatus: 'PENDING', algorithm: 'SHA3-256', registeredHash: sha3Hash('Statement_011.xml'),
            lastVerified: null,
        },
    ],
    evidence: [
        {
            id: 'EV-001', caseId: 'case-1001', caseNumber: 'CV-2025-001', type: 'Digital', description: 'Recovered phone image set',
            collectedBy: 'M. Rao', collectionDate: '2025-01-16', currentCustodian: 'Forensics Unit', location: 'Evidence Locker 3',
            status: 'Verified', hashAlgorithm: 'SHA3-256', evidenceHash: sha3Hash('EV-001:Recovered phone image set:Digital'),
            registeredAt: '2026-09-08T10:00:00Z', currentVerificationState: 'VERIFIED',
        },
        {
            id: 'EV-002', caseId: 'case-1002', caseNumber: 'CV-2025-002', type: 'Physical', description: 'Seized ledger book',
            collectedBy: 'D. Prasad', collectionDate: '2025-01-21', currentCustodian: 'Ops Desk', location: 'Secure Vault',
            status: 'Stored', hashAlgorithm: 'SHA3-256', evidenceHash: sha3Hash('EV-002:Seized ledger book:Physical'),
            registeredAt: '2026-09-08T11:30:00Z', currentVerificationState: 'PENDING',
        },
    ],
    assets: [
        { id: 'AS-101', name: 'Patrol Vehicle 17', category: 'Vehicles', serial: 'VHC-7012', department: 'Traffic', assignedOfficer: 'S. Kumar', location: 'HQ Garage', condition: 'Operational', status: 'Active / In Use', createdAt: '2026-01-10T09:00:00Z' },
        { id: 'AS-201', name: 'Forensic Laptop-02', category: 'Computers', serial: 'LAP-22191', department: 'Forensics', assignedOfficer: 'M. Nair', location: 'Lab 1', condition: 'Good', status: 'Assigned', createdAt: '2026-01-12T09:00:00Z' },
    ],
    custodyEvents: [],
    auditLogs: [],
    assetHistory: [],
    maintenanceRecords: [],
};

let state;
let writePromise = Promise.resolve();

async function ensureLoaded() {
    if (state) return state;
    try {
        const persisted = JSON.parse(await fs.readFile(dataFile, 'utf8'));
        state = { ...structuredClone(seedState), ...persisted };
        for (const collection of Object.keys(seedState)) {
            if (!Array.isArray(state[collection])) state[collection] = structuredClone(seedState[collection]);
        }
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        state = structuredClone(seedState);
        await persist();
    }
    return state;
}

async function persist() {
    await fs.mkdir(dataDirectory, { recursive: true });
    await fs.writeFile(dataFile, JSON.stringify(state, null, 2));
}

async function save() {
    writePromise = writePromise.then(persist);
    return writePromise;
}

export async function readCollection(collection) {
    const loaded = await ensureLoaded();
    return loaded[collection];
}

export async function appendToCollection(collection, item) {
    const loaded = await ensureLoaded();
    loaded[collection].unshift(item);
    await save();
    return item;
}

export async function appendChronological(collection, item) {
    const loaded = await ensureLoaded();
    loaded[collection].push(item);
    await save();
    return item;
}

export async function updateCollectionItem(collection, id, update) {
    const loaded = await ensureLoaded();
    const item = loaded[collection].find((entry) => entry.id === id);
    if (!item) return null;
    Object.assign(item, update);
    await save();
    return item;
}

export async function replaceCollection(collection, items) {
    const loaded = await ensureLoaded();
    if (!Array.isArray(loaded[collection])) throw new Error(`Unknown collection: ${collection}`);
    loaded[collection] = items;
    await save();
    return loaded[collection];
}

export async function addAuditEvent({ actor, action, resource, resourceId, metadata = {} }) {
    const loaded = await ensureLoaded();
    const previousHash = loaded.auditLogs.at(-1)?.currentHash || 'GENESIS';
    const event = {
        eventId: `AUD-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        actor, timestamp: new Date().toISOString(), action, resource, resourceId, metadata, previousHash,
    };
    event.currentHash = sha3Hash(JSON.stringify(event));
    loaded.auditLogs.push(event);
    await save();
    return event;
}

export async function resetStoreForTests() {
    state = structuredClone(seedState);
    await persist();
}
