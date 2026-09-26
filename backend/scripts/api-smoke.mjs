import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const isolatedDirectory = await mkdtemp(join(tmpdir(), 'casevault-smoke-'));
process.env.CASEVAULT_NO_LISTEN = '1';
process.env.CASEVAULT_DATA_FILE = join(isolatedDirectory, 'casevault.json');
process.env.CASEVAULT_STORAGE_DIRECTORY = join(isolatedDirectory, 'secure-documents');
process.env.RATE_LIMIT_AUTH_MAX = '100000';
process.env.RATE_LIMIT_API_MAX = '100000';
const { startServer } = await import('../src/server.js');

const port = 4187;
const base = `http://127.0.0.1:${port}/api/v1`;
const results = [];
let failures = 0;
const PASSWORD = 'password123';

async function call(method, path, { token, body, expect } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 160) }; }
    const ok = expect ? response.status === expect : response.status < 400;
    if (!ok) failures += 1;
    results.push(`${ok ? 'PASS' : 'FAIL'} ${method} ${path} -> ${response.status}${ok ? '' : ` expected ${expect} got ${JSON.stringify(json).slice(0, 220)}`}`);
    return { status: response.status, body: json, data: json?.data };
}

async function callMultipart(path, { token, fields, file, expect } = {}) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields || {})) form.append(key, value);
    if (file) form.append('file', new Blob([file.content], { type: file.type }), file.name);
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${base}${path}`, { method: 'POST', headers, body: form });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 160) }; }
    const ok = expect ? response.status === expect : response.status < 400;
    if (!ok) failures += 1;
    results.push(`${ok ? 'PASS' : 'FAIL'} POST ${path} (multipart) -> ${response.status}${ok ? '' : ` expected ${expect} ${JSON.stringify(json).slice(0, 220)}`}`);
    return { status: response.status, data: json?.data, body: json };
}

async function login(identifier, password = PASSWORD) {
    const first = await call('POST', '/auth/login', { body: { identifier, password }, expect: 200 });
    if (!first.data?.requiresMfa) return first.data?.tokens?.accessToken;
    const code = await call('POST', '/auth/demo-code', { body: { identifier, password }, expect: 200 });
    const second = await call('POST', '/auth/verify-mfa', { body: { identifier, password, otp: code.data.code }, expect: 200 });
    return second.data?.tokens?.accessToken;
}

async function loginSession(identifier, password = PASSWORD) {
    const first = await call('POST', '/auth/login', { body: { identifier, password }, expect: 200 });
    if (!first.data?.requiresMfa) return first.data?.tokens || {};
    const code = await call('POST', '/auth/demo-code', { body: { identifier, password }, expect: 200 });
    const second = await call('POST', '/auth/verify-mfa', { body: { identifier, password, otp: code.data.code }, expect: 200 });
    return second.data?.tokens || {};
}

const server = startServer({ port });
await delay(400);

function expectTrue(condition, label) {
    if (condition) return true;
    results.push(`FAIL ${label}`);
    failures += 1;
    return false;
}

try {
    const admin = await login('admin@casevault.local');
    const investigator = await login('investigator@casevault.local');
    const supervisor = await login('supervisor@casevault.local');
    const legal = await login('legal@casevault.local');
    const analyst = await login('analyst@casevault.local');
    const forensics = await login('forensics@casevault.local');
    if (!admin || !investigator || !supervisor || !legal || !analyst || !forensics) {
        results.push('FAIL token issuance for one or more seeded roles');
        failures += 1;
    }

    await call('POST', '/auth/login', { body: { identifier: 'disabled@casevault.local', password: PASSWORD }, expect: 403 });
    await call('POST', '/auth/login', { body: { identifier: 'admin@casevault.local', password: 'wrong-password' }, expect: 401 });
    await call('GET', '/cases', { expect: 401 });
    await call('GET', '/cases', { token: 'not-a-token', expect: 401 });
    await call('POST', '/auth/forgot-password', { body: { identifier: 'unknown.person@casevault.local' }, expect: 200 });
    await call('POST', '/auth/change-password', { token: admin, body: { currentPassword: 'wrong-current', newPassword: 'NewPass123' }, expect: 401 });
    await call('POST', '/auth/change-password', { token: admin, body: { currentPassword: PASSWORD, newPassword: 'short' }, expect: 422 });

    const caseList = await call('GET', '/cases', { token: admin, expect: 200 });
    const seededCase = caseList.data.find((item) => item.caseNumber === 'CV-2026-001') || caseList.data[0];
    await call('GET', '/cases', { token: analyst, expect: 200 });
    await call('GET', '/cases', { token: forensics, expect: 200 });
    await call('GET', `/cases/${seededCase.id}`, { token: investigator, expect: 200 });
    await call('GET', `/cases/${seededCase.id}`, { token: forensics, expect: 403 });
    await call('GET', '/cases/case-missing', { token: admin, expect: 404 });

    await call('GET', '/documents', { token: investigator, expect: 200 });
    await call('GET', '/evidence', { token: analyst, expect: 200 });
    await call('GET', '/tasks', { token: investigator, expect: 200 });
    await call('GET', '/notifications', { token: investigator, expect: 200 });
    await call('GET', '/notifications/unread-count', { token: investigator, expect: 200 });
    await call('GET', '/search?q=fraud', { token: admin, expect: 200 });
    await call('GET', '/search?q=a', { token: admin, expect: 422 });
    await call('GET', '/dashboard', { token: admin, expect: 200 });
    await call('GET', '/dashboard', { token: analyst, expect: 200 });
    await call('GET', '/reports/summary', { token: admin, expect: 200 });
    await call('GET', '/reports/cases', { token: supervisor, expect: 200 });
    await call('GET', '/reports/documents', { token: supervisor, expect: 200 });
    await call('GET', '/reports/evidence', { token: supervisor, expect: 200 });
    await call('GET', '/reports/tasks', { token: supervisor, expect: 200 });
    await call('GET', '/reports/integrity', { token: supervisor, expect: 200 });
    await call('GET', '/reports/unknown-report', { token: supervisor, expect: 404 });
    await call('GET', '/users', { token: admin, expect: 200 });
    await call('GET', '/users', { token: investigator, expect: 403 });
    await call('GET', '/users/me', { token: analyst, expect: 200 });
    await call('GET', '/admin/users', { token: admin, expect: 200 });
    await call('GET', '/roles', { token: admin, expect: 200 });
    await call('GET', '/departments', { token: admin, expect: 200 });
    await call('GET', '/signatures/requests', { token: admin, expect: 200 });
    await call('GET', '/signatures', { token: admin, expect: 200 });
    await call('GET', '/audit', { token: admin, expect: 200 });
    await call('POST', '/audit/verify-chain', { token: admin, expect: 200 });
    await call('GET', '/security/overview', { token: admin, expect: 200 });
    await call('GET', '/security/events', { token: admin, expect: 200 });
    await call('GET', '/security/alerts', { token: admin, expect: 200 });
    await call('GET', '/security/overview', { token: analyst, expect: 403 });
    await call('GET', '/assets', { token: admin, expect: 200 });

    const ai = await call('POST', '/ai/analyze', { token: investigator, body: { caseId: seededCase.id, prompt: 'Summarize the fraud risk' }, expect: 200 });
    if (!Array.isArray(ai.data?.citations) || !ai.data.citations.length) {
        results.push('FAIL AI analysis returned no authorized citations');
        failures += 1;
    }
    const summary = await call('POST', `/ai/cases/${seededCase.id}/summarize`, { token: investigator, expect: 200 });
    if (!summary.data?.sections?.keyEvents?.length) {
        results.push('FAIL case summary missing key events');
        failures += 1;
    }
    const chat = await call('POST', `/ai/cases/${seededCase.id}/chat`, { token: investigator, body: { question: 'What evidence was collected?' }, expect: 200 });
    if (!chat.data?.answer) {
        results.push('FAIL case chat returned no answer');
        failures += 1;
    }
    await call('POST', `/ai/cases/${seededCase.id}/chat`, { token: investigator, body: {}, expect: 422 });
    await call('POST', '/ai/documents/DOC-2026-001/analyze', { token: investigator, expect: 200 });
    await call('POST', '/ai/documents/DOC-2026-001/analyze', { token: forensics, expect: 404 });
    await call('POST', `/ai/cases/${seededCase.id}/summarize`, { token: forensics, expect: 403 });
    await call('POST', '/ai/analyze', { token: forensics, body: { caseId: seededCase.id }, expect: 403 });
    await call('POST', '/ai/analyze', { token: admin, body: { caseId: 'case-missing' }, expect: 404 });

    await call('GET', '/documents/shared', { token: legal, expect: 200 });
    await call('GET', '/documents/shared', { token: admin, expect: 200 });

    const documents = await call('GET', '/documents', { token: investigator, expect: 200 });
    const document = documents.data[0];
    if (document) {
        const content = await call('GET', `/documents/${document.id}/content`, { token: investigator, expect: 200 });
        if (!content.data?.content) {
            results.push('FAIL document content payload missing');
            failures += 1;
        }
        await call('GET', `/documents/${document.id}/download`, { token: investigator, expect: 200 });
        await call('GET', `/documents/${document.id}/preview`, { token: investigator, expect: 200 });
        await call('GET', `/documents/${document.id}/versions`, { token: investigator, expect: 200 });
        await call('GET', `/documents/${document.id}/shares`, { token: investigator, expect: 200 });
        await call('POST', `/documents/${document.id}/verify`, { token: investigator, expect: 200 });
        await call('GET', `/documents/${document.id}`, { token: legal, expect: 200 });
        await call('GET', `/documents/${document.id}`, { token: forensics, expect: 404 });
        await call('POST', `/documents/${document.id}/verify`, { token: analyst, expect: 404 });
    }

    const createdDocument = await call('POST', '/documents', {
        token: investigator,
        body: { caseId: seededCase.id, category: 'Report', classification: 'CONFIDENTIAL', fileName: 'smoke-upload.txt', content: 'CaseVault smoke test document content.' },
        expect: 201,
    });
    const documentId = createdDocument.data?.id;
    await call('POST', '/documents', { token: investigator, body: { caseId: seededCase.id, category: 'Report', fileName: 'smoke-upload.txt', content: 'duplicate' }, expect: 409 });
    await call('POST', '/documents', { token: investigator, body: { caseId: seededCase.id, category: 'Report', fileName: 'smoke-upload.exe', content: 'binary' }, expect: 415 });
    await call('POST', '/documents', { token: analyst, body: { caseId: seededCase.id, category: 'Report', fileName: 'analyst.txt', content: 'x' }, expect: 403 });
    if (documentId) {
        await call('POST', `/documents/${documentId}/approve`, { token: investigator, expect: 403 });
        await call('POST', `/documents/${documentId}/verify`, { token: investigator, expect: 200 });
        await call('POST', `/documents/${documentId}/approve`, { token: investigator, expect: 403 });
        await call('POST', `/documents/${documentId}/approve`, { token: supervisor, expect: 200 });
        await call('POST', `/documents/${documentId}/approve`, { token: supervisor, expect: 409 });
        await call('POST', `/documents/${documentId}/versions`, { token: investigator, body: { fileName: 'smoke-upload.txt', content: 'version two content' }, expect: 201 });
        const share = await call('POST', `/documents/${documentId}/shares`, { token: investigator, body: { userId: 'u-analyst', permission: 'view' }, expect: 201 });
        const shareId = share.data?.id;
        await call('GET', `/documents/${documentId}`, { token: analyst, expect: 200 });
        if (shareId) {
            const recipientView = await call('GET', '/documents/shared', { token: analyst, expect: 200 });
            const shared = recipientView.data?.find((item) => item.id === shareId);
            expectTrue(shared, 'active share missing from the recipient /documents/shared listing');
            expectTrue(shared?.document?.id === documentId, 'shared listing did not serialize the document');
            expectTrue(Boolean(shared?.document?.fileName), 'shared listing document is missing fileName');
            expectTrue(shared?.status === 'Active', `shared listing status was ${shared?.status} instead of Active`);
            expectTrue(shared?.permission === 'view', 'shared listing lost the granted permission');
            expectTrue(shared?.expired === false, 'active share was serialized as expired');
            expectTrue(Boolean(shared?.sharedByName), 'shared listing is missing sharedByName');
            expectTrue(!JSON.stringify(shared || {}).includes('passwordHash'), 'shared listing leaked a credential field');
            const unrelatedView = await call('GET', '/documents/shared', { token: forensics, expect: 200 });
            expectTrue(!unrelatedView.data?.some((item) => item.id === shareId), 'share leaked to a user it was not granted to');

            await call('DELETE', `/documents/${documentId}/shares/${shareId}`, { token: investigator, expect: 200 });
            await call('GET', `/documents/${documentId}`, { token: analyst, expect: 404 });
            const afterRevoke = await call('GET', '/documents/shared', { token: analyst, expect: 200 });
            const revoked = afterRevoke.data?.find((item) => item.id === shareId);
            expectTrue(revoked?.status === 'Revoked', `revoked share reported status ${revoked?.status} instead of Revoked`);
        }
        const signatureRequest = await call('POST', `/documents/${documentId}/signature-requests`, { token: investigator, body: { signerId: 'u-legal', message: 'Please review and sign' }, expect: 201 });
        const signatureRequestId = signatureRequest.data?.id;
        if (signatureRequestId) {
            await call('POST', `/documents/${documentId}/signature-requests/${signatureRequestId}/confirm`, { token: investigator, expect: 403 });
            await call('POST', `/documents/${documentId}/signature-requests/${signatureRequestId}/confirm`, { token: legal, expect: 200 });
            await call('POST', `/documents/${documentId}/signature-requests/${signatureRequestId}/confirm`, { token: legal, expect: 409 });
        }
    }

    const uploaded = await callMultipart('/documents/upload', {
        token: investigator,
        fields: { caseId: seededCase.id, category: 'Statement', classification: 'CONFIDENTIAL' },
        file: { name: 'multipart-statement.txt', type: 'text/plain', content: 'Multipart upload smoke content.' },
    });
    if (uploaded.data?.id) {
        const tamperedId = uploaded.data.id;
        const cleanVerify = await call('POST', `/documents/${tamperedId}/verify`, { token: investigator, expect: 200 });
        expectTrue(cleanVerify.data?.integrityStatus === 'VERIFIED', `untouched document verified as ${cleanVerify.data?.integrityStatus} instead of VERIFIED`);
        expectTrue(cleanVerify.data?.algorithm === 'SHA-256', `integrity check reported ${cleanVerify.data?.algorithm} instead of SHA-256`);
        expectTrue(cleanVerify.data?.registeredHash === cleanVerify.data?.currentHash, 'integrity check reported a hash mismatch on an untouched document');

        const storagePath = join(process.env.CASEVAULT_STORAGE_DIRECTORY, `${String(tamperedId).replace(/[^a-zA-Z0-9_-]/g, '_')}.cvault`);
        const originalCipher = await readFile(storagePath);
        const tamperedCipher = Buffer.from(originalCipher);
        tamperedCipher[tamperedCipher.length - 1] ^= 0xff;
        await writeFile(storagePath, tamperedCipher);
        const tamperVerify = await call('POST', `/documents/${tamperedId}/verify`, { token: investigator, expect: 200 });
        expectTrue(tamperVerify.data?.integrityStatus === 'COMPROMISED', `tampered document verified as ${tamperVerify.data?.integrityStatus} instead of COMPROMISED`);
        await call('GET', `/documents/${tamperedId}/content`, { token: investigator, expect: 410 });
        const tamperAudit = await call('GET', '/audit?action=DOCUMENT_TAMPER_DETECTED', { token: admin, expect: 200 });
        expectTrue((tamperAudit.data || []).some((item) => item.resourceId === tamperedId), 'tampering produced no DOCUMENT_TAMPER_DETECTED audit event');
        const securityAlerts = await call('GET', '/security/events', { token: admin, expect: 200 });
        expectTrue(JSON.stringify(securityAlerts.data || {}).includes(tamperedId), 'tampering left no trace in the security event stream');
        await writeFile(storagePath, originalCipher);
        const restoredVerify = await call('POST', `/documents/${tamperedId}/verify`, { token: investigator, expect: 200 });
        expectTrue(restoredVerify.data?.integrityStatus === 'VERIFIED', `restored document verified as ${restoredVerify.data?.integrityStatus} instead of VERIFIED`);
    }
    await callMultipart('/documents/upload', {
        token: investigator,
        fields: { caseId: seededCase.id, category: 'Statement' },
        file: { name: 'multipart-blocked.exe', type: 'application/octet-stream', content: 'MZ binary' },
        expect: 415,
    });
    await callMultipart('/documents/upload', {
        token: analyst,
        fields: { caseId: seededCase.id, category: 'Statement' },
        file: { name: 'analyst-multipart.txt', type: 'text/plain', content: 'not allowed' },
        expect: 403,
    });

    const evidenceList = await call('GET', '/evidence', { token: investigator, expect: 200 });
    const evidence = evidenceList.data[0];
    if (evidence) {
        await call('GET', `/evidence/${evidence.id}`, { token: investigator, expect: 200 });
        await call('GET', `/evidence/${evidence.id}/custody`, { token: investigator, expect: 200 });
        await call('GET', `/evidence/${evidence.id}/custody-chain`, { token: investigator, expect: 200 });
        await call('POST', `/evidence/${evidence.id}/verify`, { token: investigator, expect: 200 });
        await call('POST', `/evidence/${evidence.id}/verify-custody`, { token: investigator, expect: 200 });
        await call('POST', `/evidence/${evidence.id}/custody`, { token: investigator, body: { recipient: 'Evidence Locker 9', location: 'Locker 9', reason: 'Smoke test transfer' }, expect: 201 });
        await call('POST', `/evidence/${evidence.id}/transfer`, { token: investigator, body: { recipient: 'Forensics Unit', location: 'Forensics Lab', reason: 'Second transfer' }, expect: 200 });
        await call('POST', `/evidence/${evidence.id}/verify-custody`, { token: investigator, expect: 200 });
        await call('POST', `/evidence/${evidence.id}/custody`, { token: investigator, body: { recipient: 'X' }, expect: 422 });
        await call('PATCH', `/evidence/${evidence.id}`, { token: investigator, body: { description: 'Smoke updated description' }, expect: 200 });
        await call('POST', `/evidence/${evidence.id}/verify`, { token: investigator, expect: 200 });
        await call('GET', `/evidence/${evidence.id}`, { token: forensics, expect: 200 });
        await call('GET', `/evidence/${evidence.id}`, { token: supervisor, expect: 200 });
    }
    const createdEvidence = await call('POST', '/evidence', {
        token: investigator,
        body: { caseId: seededCase.id, type: 'Digital', description: 'Smoke test evidence record', collectionDate: '2026-02-01', collectedBy: 'Smoke Officer' },
        expect: 201,
    });
    if (createdEvidence.data?.id) {
        await call('POST', `/evidence/${createdEvidence.data.id}/verify`, { token: investigator, expect: 200 });
    }
    await call('POST', '/evidence', { token: investigator, body: { caseId: 'case-missing', type: 'Digital', description: 'x', collectionDate: '2026-02-01', collectedBy: 'y' }, expect: 404 });

    const assetSerial = `SMOKE-${Date.now()}`;
    const createdAsset = await call('POST', '/assets', {
        token: supervisor,
        body: { name: 'Smoke Patrol Vehicle', category: 'Vehicle', serial: assetSerial, department: 'Operations', location: 'Central Station', condition: 'Good' },
        expect: 201,
    });
    const assetId = createdAsset.data?.id;
    expectTrue(createdAsset.data?.status === 'Available', `new asset started in status ${createdAsset.data?.status} instead of Available`);
    await call('POST', '/assets', { token: supervisor, body: { name: 'Duplicate Serial', category: 'Vehicle', serial: assetSerial, department: 'Operations', location: 'Central Station' }, expect: 409 });
    await call('POST', '/assets', { token: supervisor, body: { name: 'Incomplete Asset', category: 'Vehicle' }, expect: 422 });
    await call('POST', '/assets', { token: investigator, body: { name: 'Unauthorized Asset', category: 'Vehicle', serial: `${assetSerial}-X`, department: 'Operations', location: 'Central Station' }, expect: 403 });
    await call('GET', '/assets', { expect: 401 });
    if (assetId) {
        await call('PATCH', `/assets/${assetId}/assign`, { token: supervisor, body: { assignedOfficer: 'u-investigator' }, expect: 422 });
        await call('PATCH', `/assets/${assetId}/assign`, { token: supervisor, body: { assignedOfficer: 'u-investigator', location: 'North Precinct' }, expect: 200 });
        await call('PATCH', `/assets/${assetId}/assign`, { token: supervisor, body: { assignedOfficer: 'u-analyst', location: 'South Precinct' }, expect: 409 });
        const assetHistory = await call('GET', `/assets/${assetId}/history`, { token: supervisor, expect: 200 });
        expectTrue(assetHistory.data?.some((item) => item.action === 'ASSET_REGISTERED'), 'asset history is missing the registration event');
        expectTrue(assetHistory.data?.some((item) => item.action === 'ASSET_ASSIGNED'), 'asset history is missing the assignment event');
        await call('PATCH', `/assets/${assetId}/status`, { token: supervisor, body: { status: 'Retired' }, expect: 422 });
        await call('PATCH', `/assets/${assetId}/status`, { token: supervisor, body: { status: 'Disposed' }, expect: 409 });
        await call('PATCH', `/assets/${assetId}/status`, { token: supervisor, body: { status: 'Retired', reason: 'End of service life' }, expect: 200 });
        await call('PATCH', `/assets/${assetId}/status`, { token: supervisor, body: { status: 'Disposed', reason: 'Auctioned' }, expect: 200 });
        await call('PATCH', `/assets/${assetId}/status`, { token: supervisor, body: { status: 'Available', reason: 'Reinstatement attempt' }, expect: 409 });
    }
    await call('GET', '/assets/AS-missing/history', { token: supervisor, expect: 404 });

    const serviceSerial = `${assetSerial}-CAM`;
    const serviceAsset = await call('POST', '/assets', {
        token: supervisor,
        body: { name: 'Smoke Body Camera', category: 'Camera', serial: serviceSerial, department: 'Operations', location: 'Evidence Locker' },
        expect: 201,
    });
    const serviceAssetId = serviceAsset.data?.id;
    if (serviceAssetId) {
        await call('POST', `/assets/${serviceAssetId}/maintenance`, { token: supervisor, body: { vendor: 'Vendor' }, expect: 422 });
        await call('PATCH', `/assets/${serviceAssetId}/maintenance/complete`, { token: supervisor, expect: 409 });
        const maintenance = await call('POST', `/assets/${serviceAssetId}/maintenance`, { token: supervisor, body: { scheduledDate: '2026-08-14', vendor: 'SafeVision Services', notes: 'Lens calibration', estimatedCost: 4200 }, expect: 201 });
        expectTrue(maintenance.data?.status === 'SCHEDULED', `maintenance record started as ${maintenance.data?.status} instead of SCHEDULED`);
        await call('GET', `/assets/${serviceAssetId}/maintenance`, { token: supervisor, expect: 200 });
        await call('POST', `/assets/${serviceAssetId}/maintenance`, { token: supervisor, body: { scheduledDate: '2026-08-20', vendor: 'Duplicate Vendor' }, expect: 409 });
        const completed = await call('PATCH', `/assets/${serviceAssetId}/maintenance/complete`, { token: supervisor, body: { actualCost: 4500, condition: 'Excellent' }, expect: 200 });
        expectTrue(completed.data?.asset?.status === 'Available', `asset stayed in ${completed.data?.asset?.status} after maintenance instead of returning to Available`);
        expectTrue(completed.data?.maintenance?.status === 'COMPLETED', 'maintenance record was not marked COMPLETED');
        await call('PATCH', `/assets/${serviceAssetId}/assign`, { token: supervisor, body: { assignedOfficer: 'u-supervisor', location: 'Patrol Bay 3' }, expect: 200 });
        const returned = await call('PATCH', `/assets/${serviceAssetId}/return`, { token: supervisor, body: { location: 'Equipment Room' }, expect: 200 });
        expectTrue(returned.data?.status === 'Available' && !returned.data?.assignedOfficer, 'asset return did not clear the assigned officer and restore Available');
        await call('PATCH', `/assets/${serviceAssetId}/return`, { token: supervisor, expect: 409 });
        const finalHistory = await call('GET', `/assets/${serviceAssetId}/history`, { token: supervisor, expect: 200 });
        for (const action of ['ASSET_REGISTERED', 'MAINTENANCE_SCHEDULED', 'MAINTENANCE_COMPLETED', 'ASSET_ASSIGNED', 'ASSET_RETURNED']) {
            expectTrue(finalHistory.data?.some((item) => item.action === action), `asset lifecycle history is missing ${action}`);
        }
        const filteredAssets = await call('GET', '/assets?search=Body%20Camera', { token: supervisor, expect: 200 });
        expectTrue(filteredAssets.data?.every((item) => String(item.name).includes('Body Camera')), 'asset search filter returned unrelated records');
    }
    const assetAudit = await call('GET', '/audit?limit=500', { token: admin, expect: 200 });
    const auditedActions = (assetAudit.data?.items || assetAudit.data || []).map((item) => item.action);
    for (const action of ['ASSET_REGISTERED', 'ASSET_ASSIGNED', 'ASSET_STATUS_CHANGED', 'ASSET_MAINTENANCE_SCHEDULED', 'ASSET_MAINTENANCE_COMPLETED']) {
        expectTrue(auditedActions.includes(action), `audit trail is missing ${action}`);
    }

    const createdCase = await call('POST', '/cases', { token: investigator, body: { caseNumber: 'CV-2026-777', title: 'Smoke Test Case', type: 'Financial Crime', priority: 'High' }, expect: 201 });
    const createdCaseId = createdCase.data?.id;
    await call('POST', '/cases', { token: investigator, body: { caseNumber: 'CV-2026-777', title: 'Duplicate', type: 'Financial Crime' }, expect: 409 });
    await call('POST', '/cases', { token: investigator, body: { caseNumber: 'bad number', title: 'Invalid' }, expect: 422 });
    if (createdCaseId) {
        await call('PATCH', `/cases/${createdCaseId}`, { token: investigator, body: { description: 'Updated by smoke test' }, expect: 200 });
        await call('PATCH', `/cases/${createdCaseId}/status`, { token: investigator, body: { status: 'Under Investigation' }, expect: 200 });
        await call('PATCH', `/cases/${createdCaseId}/status`, { token: investigator, body: { status: 'Created' }, expect: 409 });
        await call('GET', `/cases/${createdCaseId}/timeline`, { token: investigator, expect: 200 });
        await call('GET', `/cases/${createdCaseId}/documents`, { token: investigator, expect: 200 });
        await call('GET', `/cases/${createdCaseId}/evidence`, { token: investigator, expect: 200 });
        const member = await call('POST', `/cases/${createdCaseId}/members`, { token: investigator, body: { userId: 'u-forensics' }, expect: 201 });
        if (member.data?.member) {
            await call('GET', `/cases/${createdCaseId}/members`, { token: investigator, expect: 200 });
        }
        const task = await call('POST', '/tasks', { token: investigator, body: { caseId: createdCaseId, title: 'Smoke task', priority: 'High' }, expect: 201 });
        const taskId = task.data?.id;
        if (taskId) {
            await call('GET', `/tasks/${taskId}`, { token: investigator, expect: 200 });
            await call('PATCH', `/tasks/${taskId}/status`, { token: investigator, body: { status: 'In Progress' }, expect: 200 });
            await call('PATCH', `/tasks/${taskId}/status`, { token: investigator, body: { status: 'Closed' }, expect: 409 });
            await call('PATCH', `/tasks/${taskId}/status`, { token: investigator, body: { status: 'Completed' }, expect: 200 });
        }
        const notifications = await call('GET', '/notifications', { token: investigator, expect: 200 });
        const firstNotification = notifications.data?.items?.[0];
        if (firstNotification) {
            await call('PATCH', `/notifications/${firstNotification.id}/read`, { token: investigator, expect: 200 });
            await call('POST', '/notifications/read-all', { token: investigator, expect: 200 });
        }
        await call('DELETE', `/cases/${createdCaseId}`, { token: supervisor, expect: 200 });
    }

    const createdUser = await call('POST', '/users', { token: admin, body: { name: 'Smoke User', email: 'smoke.user@casevault.local', username: 'smoke.user', password: 'SmokePass123', role: 'Viewer', department: 'Operations' }, expect: 201 });
    if (createdUser.data?.id) {
        await call('GET', `/users/${createdUser.data.id}`, { token: admin, expect: 200 });
        await call('PATCH', `/users/${createdUser.data.id}/status`, { token: admin, body: { status: 'disabled' }, expect: 200 });
        await call('POST', '/auth/login', { body: { identifier: 'smoke.user@casevault.local', password: 'SmokePass123' }, expect: 403 });
        await call('DELETE', `/users/${createdUser.data.id}`, { token: admin, expect: 200 });
    }
    await call('PATCH', `/users/${'u-admin'}/status`, { token: admin, body: { status: 'disabled' }, expect: 409 });

    const resetUser = await call('POST', '/users', { token: admin, body: { name: 'Reset Smoke', email: 'reset.smoke@casevault.local', username: 'reset.smoke', password: 'InitialPass123', role: 'Viewer', department: 'Operations' }, expect: 201 });
    if (resetUser.data?.id) {
        const session = await loginSession('reset.smoke@casevault.local', 'InitialPass123');
        expectTrue(Boolean(session.refreshToken), 'pre-reset session did not issue a refresh token');
        const resetRequest = await call('POST', '/auth/forgot-password', { body: { identifier: 'reset.smoke@casevault.local' }, expect: 200 });
        const demoToken = resetRequest.data?.demoToken;
        if (expectTrue(Boolean(demoToken), 'password reset did not return a token in the demo environment')) {
            await call('POST', '/auth/reset-password', { body: { token: 'not-a-real-token', password: 'ResetPass123' }, expect: 401 });
            await call('POST', '/auth/reset-password', { body: { token: demoToken, password: 'short' }, expect: 422 });
            await call('POST', '/auth/reset-password', { body: { token: demoToken, password: 'ResetPass123' }, expect: 200 });
            await call('POST', '/auth/reset-password', { body: { token: demoToken, password: 'ResetPass123' }, expect: 401 });
            await call('POST', '/auth/login', { body: { identifier: 'reset.smoke@casevault.local', password: 'InitialPass123' }, expect: 401 });
            const relogin = await call('POST', '/auth/login', { body: { identifier: 'reset.smoke@casevault.local', password: 'ResetPass123' }, expect: 200 });
            expectTrue(Boolean(relogin.data?.tokens?.accessToken || relogin.data?.requiresMfa), 'login with the reset password did not succeed');
            if (session.refreshToken) {
                await call('POST', '/auth/refresh', { body: { refreshToken: session.refreshToken }, expect: 401 });
            }
        }
    }
} finally {
    server.close();
}

console.log(results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} checks passed`);
if (failures) process.exitCode = 1;
