import crypto from 'crypto';

const HASH_ALGORITHM = 'sha3-256';

export function sha3Hash(value) {
    const input = typeof value === 'string' ? value : JSON.stringify(value);
    return crypto.createHash(HASH_ALGORITHM).update(input).digest('hex');
}

export function deriveKey(secret, salt, length = 32) {
    const secretBuffer = Buffer.isBuffer(secret) ? secret : Buffer.from(String(secret));
    const saltBuffer = Buffer.isBuffer(salt) ? salt : Buffer.from(String(salt));
    const info = Buffer.from('casevault');
    const prk = crypto.createHmac('sha256', saltBuffer.length > 0 ? saltBuffer : Buffer.alloc(32, 0)).update(secretBuffer).digest();
    const output = Buffer.alloc(length);
    let previous = Buffer.alloc(0);
    let offset = 0;
    let counter = 1;

    while (offset < length) {
        const round = Buffer.concat([previous, info, Buffer.from([counter])]);
        previous = crypto.createHmac('sha256', prk).update(round).digest();
        const chunkLength = Math.min(previous.length, length - offset);
        previous.copy(output, offset, 0, chunkLength);
        offset += chunkLength;
        counter += 1;
    }

    return output;
}

export function encryptBuffer(buffer, masterKeyMaterial, metadata = {}) {
    const key = crypto.createHash('sha256').update(String(masterKeyMaterial)).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encryptedData = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
        encryptedData,
        nonce: iv,
        tag,
        algorithm: 'AES-256-GCM',
        keyId: metadata.keyId || 'dev-kek',
        createdAt: new Date().toISOString(),
        hash: sha3Hash(encryptedData),
    };
}

export function decryptBuffer({ encryptedData, nonce, tag }, masterKeyMaterial) {
    const key = crypto.createHash('sha256').update(String(masterKeyMaterial)).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}

function hashNode(left, right) {
    return sha3Hash(`${left}:${right}`);
}

export function createMerkleTree(items) {
    const leaves = items.map((item) => sha3Hash(typeof item === 'string' ? item : JSON.stringify(item)));
    const levels = [leaves];

    while (levels[levels.length - 1].length > 1) {
        const current = levels[levels.length - 1];
        const next = [];

        for (let index = 0; index < current.length; index += 2) {
            const left = current[index];
            const right = current[index + 1] || left;
            next.push(hashNode(left, right));
        }
        levels.push(next);
    }

    const proofs = leaves.map((leaf, index) => {
        const proof = [];
        let currentIndex = index;
        for (let level = 0; level < levels.length - 1; level += 1) {
            const currentLevel = levels[level];
            const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
            const sibling = currentLevel[siblingIndex] || currentLevel[currentIndex];
            proof.push(sibling);
            currentIndex = Math.floor(currentIndex / 2);
        }
        return { leaf, proof };
    });

    return {
        leaves,
        levels,
        root: levels[levels.length - 1][0],
        proofs,
    };
}

export function verifyMerkleProof(rootHash, proof, value) {
    const leafHash = sha3Hash(typeof value === 'string' ? value : JSON.stringify(value));
    let currentHash = leafHash;

    for (const sibling of proof.proof || proof) {
        currentHash = hashNode(currentHash, sibling);
    }

    return currentHash === rootHash;
}

export function verifyAuditChain(events) {
    if (!events.length) {
        return { valid: false, reason: 'No audit events recorded.' };
    }
    let previousHash = 'GENESIS';
    for (const event of events) {
        const canonical = event.data
            ? JSON.stringify({ eventId: event.eventId, actor: event.actor, timestamp: event.timestamp, data: event.data, previousHash })
            : JSON.stringify({ eventId: event.eventId, actor: event.actor, timestamp: event.timestamp, action: event.action, resource: event.resource, resourceId: event.resourceId, metadata: event.metadata || {}, previousHash });
        const expectedHash = sha3Hash(canonical);
        const actualHash = event.currentHash;
        if (!actualHash) {
            return { valid: false, suspiciousEvent: event.eventId, expectedHash, actualHash: null, reason: 'Missing current hash' };
        }
        if (actualHash !== expectedHash) {
            return { valid: false, suspiciousEvent: event.eventId, expectedHash, actualHash };
        }
        previousHash = actualHash;
    }
    return { valid: true };
}

export function verifyCustodyChain(events) {
    let previousHash = 'GENESIS';
    for (const event of events) {
        const canonical = JSON.stringify({
            eventId: event.eventId,
            evidenceId: event.evidenceId,
            from: event.from,
            to: event.to,
            reason: event.reason,
            location: event.location,
            timestamp: event.timestamp,
            previousHash,
        });
        const expectedHash = sha3Hash(canonical);
        const actualHash = event.currentHash;
        if (!actualHash) {
            return { valid: false, suspiciousEvent: event.eventId, expectedHash, actualHash: null, reason: 'Missing current hash' };
        }
        if (actualHash !== expectedHash) {
            return { valid: false, suspiciousEvent: event.eventId, expectedHash, actualHash };
        }
        previousHash = actualHash;
    }
    return { valid: true };
}

export function evaluateAccessPolicy({ user, resource, action, mfaLevel, deviceTrust, requestContext }) {
    const userClearance = { PUBLIC: 0, INTERNAL: 1, CONFIDENTIAL: 2, RESTRICTED: 3, HIGHLY_RESTRICTED: 4 };
    const resourceClearance = { PUBLIC: 0, INTERNAL: 1, CONFIDENTIAL: 2, RESTRICTED: 3, HIGHLY_RESTRICTED: 4 };

    const isAuthenticated = Boolean(user);
    const hasRoleAccess = ['Administrator', 'Investigation Officer', 'Supervisor'].includes(user?.role || '');
    const withinDepartment = user?.department === resource?.department || resource?.caseMember === true;
    const clearanceOk = (userClearance[user?.clearance || 'PUBLIC'] || 0) >= (resourceClearance[resource?.classification || 'PUBLIC'] || 0);
    const mfaOk = mfaLevel >= 1 || action === 'view_document';
    const deviceOk = deviceTrust === 'trusted' || requestContext?.ipRisk === 'low';

    const allowed = isAuthenticated && hasRoleAccess && withinDepartment && clearanceOk && mfaOk && deviceOk;

    return {
        allowed,
        checks: {
            authenticated: isAuthenticated,
            roleAccess: hasRoleAccess,
            department: withinDepartment,
            clearance: clearanceOk,
            mfa: mfaOk,
            deviceTrust: deviceOk,
        },
    };
}

export function getSecurityOverview() {
    return {
        authentication: { failedLogins: 3, mfaFailures: 1, lockedAccounts: 1, activeSessions: 12 },
        authorization: { deniedRequests: 5, privilegeViolations: 0, suspiciousAccess: 2 },
        integrity: { verifiedDocuments: 128, failedVerification: 0, brokenAuditChains: 0, brokenCustodyChains: 0 },
        cryptography: { encryptionStatus: 'HEALTHY', signatureStatus: 'HEALTHY', keyManagementHealth: 'READY' },
    };
}

export function createHashChainEvent(eventData, previousHash = 'GENESIS') {
    const canonical = JSON.stringify(eventData);
    const currentHash = sha3Hash(`${canonical}:${previousHash}`);
    return { ...eventData, previousHash, currentHash };
}

export function buildIntegrityReport(resourceName, checks) {
    const summary = Object.values(checks).every(Boolean) ? 'VERIFIED' : 'INTEGRITY COMPROMISED';
    return {
        resource: resourceName,
        overallStatus: summary,
        checks,
    };
}
