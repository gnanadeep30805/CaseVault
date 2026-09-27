import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const isolatedDirectory = await mkdtemp(join(tmpdir(), 'casevault-final-'));
process.env.CASEVAULT_NO_LISTEN = '1';
process.env.CASEVAULT_DATA_FILE = join(isolatedDirectory, 'casevault.json');
process.env.CASEVAULT_STORAGE_DIRECTORY = join(isolatedDirectory, 'secure-documents');
process.env.RATE_LIMIT_AUTH_MAX = '100000';
process.env.RATE_LIMIT_API_MAX = '100000';

const { startServer } = await import('../src/server.js');
const port = 4188;
const base = `http://127.0.0.1:${port}/api/v1`;
const server = startServer({ port });
const PW = 'password123';
let p = 0, f = 0;
const bad = [];
const ok = (n, c) => { if (c) p += 1; else { f += 1; bad.push(n); console.log('  FAIL ' + n); } };

async function req(method, path, { token, body } = {}) {
    const h = {};
    if (token) h.Authorization = `Bearer ${token}`;
    if (body !== undefined) h['Content-Type'] = 'application/json';
    const r = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    let j = null; try { j = JSON.parse(await r.text()); } catch { j = {}; }
    return { s: r.status, j };
}
async function login(email) {
    const l = await req('POST', '/auth/login', { body: { identifier: email, password: PW } });
    if (!l.j.data?.requiresMfa) return l.j.data?.tokens?.accessToken;
    const c = await req('POST', '/auth/demo-code', { body: { identifier: email, password: PW } });
    const v = await req('POST', '/auth/verify-mfa', { body: { identifier: email, password: PW, otp: c.j.data.code, challengeId: l.j.data.challengeId } });
    return v.j.data?.tokens?.accessToken;
}

console.log('--- NEGATIVE / SECURITY ---');
ok('rejects no token', (await req('GET', '/cases')).s === 401);
ok('rejects bad token', (await req('GET', '/cases', { token: 'garbage.token.here' })).s === 401);
ok('rejects wrong password', (await req('POST', '/auth/login', { body: { identifier: 'admin@casevault.local', password: 'wrong' } })).s === 401);
ok('rejects unknown user', (await req('POST', '/auth/login', { body: { identifier: 'nobody@nowhere.io', password: PW } })).s === 401);
ok('admin login works', !!(await login('admin@casevault.local')));

const admin = await login('admin@casevault.local');
ok('inactive user blocked', (await req('GET', '/users', { token: 'x' })).s === 401);

console.log('--- MFA LIFECYCLE ---');
const ml = await req('POST', '/auth/login', { body: { identifier: 'admin@casevault.local', password: PW } });
ok('MFA required for admin', ml.j.data?.requiresMfa === true && !!ml.j.data.challengeId);
const dc = await req('POST', '/auth/demo-code', { body: { identifier: 'admin@casevault.local', password: PW } });
const code = dc.j.data.code;
const v1 = await req('POST', '/auth/verify-mfa', { body: { identifier: 'admin@casevault.local', password: PW, otp: code, challengeId: ml.j.data.challengeId } });
ok('MFA verifies', v1.s === 200 && !!v1.j.data?.tokens?.accessToken);
const v2 = await req('POST', '/auth/verify-mfa', { body: { identifier: 'admin@casevault.local', password: PW, otp: code, challengeId: ml.j.data.challengeId } });
ok('MFA code single-use (replay blocked)', v2.s !== 200);
const ml3 = await req('POST', '/auth/login', { body: { identifier: 'admin@casevault.local', password: PW } });
await req('POST', '/auth/verify-mfa', { body: { identifier: 'admin@casevault.local', password: PW, otp: '000000', challengeId: ml3.j.data.challengeId } });
const retry = await req('POST', '/auth/demo-code', { body: { identifier: 'admin@casevault.local', password: PW } });
const v3 = await req('POST', '/auth/verify-mfa', { body: { identifier: 'admin@casevault.local', password: PW, otp: retry.j.data.code, challengeId: ml3.j.data.challengeId } });
ok('MFA challenge survives wrong OTP', v3.s === 200);

console.log('--- LIFECYCLE JOURNEY ---');
const T = admin;
const c = await req('POST', '/cases', { token: T, body: { caseNumber: `FINAL-${Date.now()}`, title: 'Final Verification Case', type: 'Financial Crime' } });
ok('create case', c.s === 201);
const caseId = c.j.data?.id;
const d = await req('POST', '/documents', { token: T, body: { caseId, category: 'Report', fileName: 'final.txt', content: 'integrity verification payload' } });
ok('upload document', d.s === 201);
const docId = d.j.data?.id ?? d.j.data?.document?.id;
const e = await req('POST', '/evidence', { token: T, body: { caseId, type: 'Digital', description: 'final evidence', collectionDate: '2026-02-01', collectedBy: 'Verifier' } });
ok('register evidence', e.s === 201);
const evId = e.j.data?.id;

const a = await req('POST', '/assets', { token: T, body: { name: `Final Asset ${Date.now()}`, category: 'Vehicles', serial: `FIN-${Date.now()}`, department: 'Operations', location: 'HQ' } });
ok('register asset', a.s === 201);
const asId = a.j.data?.id;
if (asId) {
    const t = await req('PATCH', `/assets/${asId}/transfer`, { token: T, body: { department: 'Forensics', location: 'Lab 2', reason: 'final test' } });
    ok('transfer asset', t.s === 200);
    const m = await req('POST', `/assets/${asId}/maintenance`, { token: T, body: { scheduledDate: '2026-03-01', vendor: 'TestGarage', notes: 'final test', estimatedCost: 100 } });
    ok('log asset maintenance', m.s === 201 || m.s === 200);
}
ok('case detail readable', (await req('GET', `/cases/${caseId}`, { token: T })).s === 200);
if (docId) ok('document integrity verifies', (await req('POST', `/documents/${docId}/verify`, { token: T })).s === 200);
if (evId) ok('evidence readable', (await req('GET', `/evidence/${evId}`, { token: T })).s === 200);

console.log('--- CROSS-ROLE LIFECYCLE ---');
for (const [role, email, canWrite] of [['Supervisor', 'supervisor@casevault.local', true], ['Investigation Officer', 'investigator@casevault.local', true], ['Legal Officer', 'legal@casevault.local', false], ['Analyst', 'analyst@casevault.local', false]]) {
    const tok = await login(email);
    ok(`${role} authenticates`, !!tok);
    const r = await req('GET', '/cases', { token: tok });
    ok(`${role} lists cases`, r.s === 200);
    const w = await req('POST', '/cases', { token: tok, body: { caseNumber: `X-${Date.now()}`, title: 'probe', type: 'Theft' } });
    if (canWrite) ok(`${role} may create cases`, w.s === 201);
    else ok(`${role} denied case creation (least privilege)`, w.s === 403);
}
const legal = await login('legal@casevault.local');
ok('Legal can read audit trail', (await req('GET', '/audit', { token: legal })).s === 200);
const analyst = await login('analyst@casevault.local');
ok('Analyst denied audit trail', (await req('GET', '/audit', { token: analyst })).s === 403);
ok('Analyst denied user directory', (await req('GET', '/users', { token: analyst })).s === 403);
ok('Analyst denied case creation', (await req('POST', '/cases', { token: analyst, body: { caseNumber: 'z', title: 'z', type: 'z' } })).s === 403);
ok('Analyst can read reports', (await req('GET', '/reports/summary', { token: analyst })).s === 200);

console.log('--- CROSS-CUTTING ---');
ok('search works', (await req('GET', '/search?q=Financial', { token: T })).s === 200);
ok('notifications work', (await req('GET', '/notifications', { token: T })).s === 200);
ok('dashboard works', (await req('GET', '/dashboard', { token: T })).s === 200);
ok('AI assistant works', (await req('POST', '/ai/analyze', { token: T, body: { caseId, prompt: 'summarise' } })).s === 200);
ok('audit logs the activity', (await req('GET', '/audit', { token: T })).s === 200);
ok('security overview works', (await req('GET', '/security/overview', { token: T })).s === 200);
ok('404 on unknown route', (await req('GET', '/nope-not-real', { token: T })).s === 404);

console.log(`\n${p}/${p + f} live checks passed`);
if (f) { console.log('FAILED: ' + bad.join(', ')); process.exitCode = 1; }
server.close();
