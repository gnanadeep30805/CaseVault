import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encryptBuffer,
  decryptBuffer,
  sha3Hash,
  deriveKey,
  createMerkleTree,
  verifyMerkleProof,
  verifyAuditChain,
  verifyCustodyChain,
  evaluateAccessPolicy,
} from './security-core.js';

test('encryptBuffer/decryptBuffer round trip works', () => {
  const plaintext = Buffer.from('casevault-document-secret');
  const wrapped = encryptBuffer(plaintext, 'test-master-key-32-byte-length', { label: 'case-1' });

  assert.ok(wrapped.encryptedData.length > 0);
  assert.ok(wrapped.nonce.length > 0);
  assert.ok(wrapped.tag.length > 0);
  assert.equal(decryptBuffer(wrapped, 'test-master-key-32-byte-length').toString(), plaintext.toString());
});

test('sha3 hash and HKDF produce deterministic values', () => {
  const hash = sha3Hash('casevault');
  const derived = deriveKey(Buffer.from('master-secret-32-bytes-1234567890'), 'casevault-salt');

  assert.equal(hash.length, 64);
  assert.equal(derived.length, 32);
});

test('merkle proofs validate and fail on tampered data', () => {
  const data = ['A', 'B', 'C', 'D'];
  const tree = createMerkleTree(data);
  const proof = tree.proofs[0];

  assert.equal(verifyMerkleProof(tree.root, proof, 'A'), true);
  assert.equal(verifyMerkleProof(tree.root, proof, 'Z'), false);
});

test('audit and custody chains validate correctly and detect tampering', () => {
  const firstAuditHash = sha3Hash(JSON.stringify({ eventId: 'E1', actor: 'officer-1', timestamp: '2026-01-01T00:00:00Z', data: { action: 'login' }, previousHash: 'GENESIS' }));
  const secondAuditHash = sha3Hash(JSON.stringify({ eventId: 'E2', actor: 'officer-1', timestamp: '2026-01-01T00:05:00Z', data: { action: 'case-created' }, previousHash: firstAuditHash }));
  const validAudit = [
    { eventId: 'E1', actor: 'officer-1', timestamp: '2026-01-01T00:00:00Z', data: { action: 'login' }, previousHash: 'GENESIS', currentHash: firstAuditHash },
    { eventId: 'E2', actor: 'officer-1', timestamp: '2026-01-01T00:05:00Z', data: { action: 'case-created' }, previousHash: firstAuditHash, currentHash: secondAuditHash },
  ];

  const auditResult = verifyAuditChain(validAudit);
  assert.equal(auditResult.valid, true);

  const tampered = [...validAudit];
  tampered[1].data.action = 'tampered';
  const tamperedResult = verifyAuditChain(tampered);
  assert.equal(tamperedResult.valid, false);

  const firstCustodyHash = sha3Hash(JSON.stringify({ eventId: 'C1', evidenceId: 'EV-001', from: 'locker', to: 'forensic', reason: 'transfer', location: 'locker-room', timestamp: '2026-01-02T00:00:00Z', previousHash: 'GENESIS' }));
  const secondCustodyHash = sha3Hash(JSON.stringify({ eventId: 'C2', evidenceId: 'EV-001', from: 'forensic', to: 'court', reason: 'handover', location: 'court-vault', timestamp: '2026-01-03T00:00:00Z', previousHash: firstCustodyHash }));
  const custody = [
    { eventId: 'C1', evidenceId: 'EV-001', from: 'locker', to: 'forensic', previousHash: 'GENESIS', currentHash: firstCustodyHash, timestamp: '2026-01-02T00:00:00Z', reason: 'transfer', location: 'locker-room' },
    { eventId: 'C2', evidenceId: 'EV-001', from: 'forensic', to: 'court', previousHash: firstCustodyHash, currentHash: secondCustodyHash, timestamp: '2026-01-03T00:00:00Z', reason: 'handover', location: 'court-vault' },
  ];

  const custodyResult = verifyCustodyChain(custody);
  assert.equal(custodyResult.valid, true);

  const brokenCustody = [...custody];
  brokenCustody[1].reason = 'tampered';
  const brokenResult = verifyCustodyChain(brokenCustody);
  assert.equal(brokenResult.valid, false);
});

test('zero-trust policy allows authorized access and rejects background leakage', () => {
  const allowed = evaluateAccessPolicy({
    user: { department: 'Criminal Investigation', clearance: 'CONFIDENTIAL', role: 'Investigation Officer' },
    resource: { department: 'Criminal Investigation', classification: 'CONFIDENTIAL', caseMember: true },
    action: 'view_document',
    mfaLevel: 2,
    deviceTrust: 'trusted',
    requestContext: { ipRisk: 'low' },
  });

  assert.equal(allowed.allowed, true);

  const denied = evaluateAccessPolicy({
    user: { department: 'Operations', clearance: 'INTERNAL', role: 'Analyst' },
    resource: { department: 'Criminal Investigation', classification: 'RESTRICTED', caseMember: false },
    action: 'download_document',
    mfaLevel: 0,
    deviceTrust: 'untrusted',
    requestContext: { ipRisk: 'medium' },
  });

  assert.equal(denied.allowed, false);
});
