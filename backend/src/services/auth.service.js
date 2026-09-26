import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { env } from '../config/env.js';
import { addAuditEvent, appendToCollection, readCollection, updateCollectionItem } from './store.js';

const refreshSessions = new Map();
const mfaChallenges = new Map();
const passwordResetTokens = new Map();
const fallbackPasswordHash = '$2b$12$/ordMkXGm.tJ.BCpXwOCy.SoXTrXMYOxFd4MRy3dL/WivS1sGceRG';
const resetTokenTtlMs = 15 * 60 * 1000;

authenticator.options = { window: 1 };

function passwordPolicyError(message) {
    return accessError('WEAK_PASSWORD', message, 422);
}

function assertPasswordPolicy(password) {
    const value = String(password || '');
    if (value.length < 8) throw passwordPolicyError('A password of at least 8 characters is required.');
    if (value.length > 200) throw passwordPolicyError('The password is too long.');
    if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) throw passwordPolicyError('The password must contain at least one letter and one number.');
    return value;
}

function identifierValue(value) {
    return String(value || '').trim().toLowerCase();
}

function publicUser(user) {
    if (!user) return null;
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        department: user.department,
        clearance: user.clearance || 'INTERNAL',
        status: user.status,
        mfaEnabled: Boolean(user.mfaEnabled),
        lastLogin: user.lastLogin || null,
        createdAt: user.createdAt || null,
        updatedAt: user.updatedAt || null,
    };
}

function accessError(code, message, status = 401) {
    return Object.assign(new Error(message), { code, status });
}

async function getUserByIdentifier(identifier) {
    const normalized = identifierValue(identifier);
    if (!normalized) return null;
    const users = await readCollection('users');
    return users.find((user) => identifierValue(user.email) === normalized || identifierValue(user.username) === normalized || user.id === identifier) || null;
}

export async function getUserById(id) {
    const users = await readCollection('users');
    return users.find((user) => user.id === id) || null;
}

function createAccessToken(user) {
    return jwt.sign({
        sub: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        clearance: user.clearance || 'INTERNAL',
        mfaLevel: user.mfaEnabled ? 2 : 1,
        sessionVersion: user.updatedAt || user.createdAt || 'seed',
    }, env.jwtAccessSecret, { expiresIn: '15m', algorithm: 'HS256' });
}

function createRefreshToken(user) {
    const refreshToken = crypto.randomBytes(48).toString('base64url');
    refreshSessions.set(refreshToken, {
        id: crypto.randomUUID(),
        userId: user.id,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        revokedAt: null,
    });
    return refreshToken;
}

function issueSession(user) {
    return {
        user: publicUser(user),
        tokens: {
            accessToken: createAccessToken(user),
            refreshToken: createRefreshToken(user),
            tokenType: 'Bearer',
            expiresIn: 900,
        },
    };
}

async function comparePassword(password, passwordHash) {
    try {
        return await bcrypt.compare(String(password || ''), passwordHash || fallbackPasswordHash);
    } catch {
        return false;
    }
}

async function recordFailedLogin(identifier, action = 'LOGIN_FAILED', metadata = {}) {
    try {
        await addAuditEvent({
            actor: identifierValue(identifier) || 'anonymous',
            action,
            resource: 'Auth',
            resourceId: 'LOGIN',
            metadata: { identifier: identifierValue(identifier) || 'anonymous', ...metadata },
        });
    } catch {
        return undefined;
    }
    return undefined;
}

function isValidOtp(otp, user) {
    const value = String(otp || '').trim();
    if (!value || !user.mfaSecret) return false;
    try {
        if (authenticator.check(value, user.mfaSecret)) return true;
    } catch {
        return false;
    }
    return env.allowDemoMfa && env.demoMfaCode && value === env.demoMfaCode;
}

function createMfaChallenge(user) {
    const challengeId = crypto.randomBytes(24).toString('base64url');
    mfaChallenges.set(challengeId, {
        userId: user.id,
        expiresAt: Date.now() + 5 * 60 * 1000,
    });
    return {
        challengeId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
}

export async function loginUser({ identifier, password, otp, mfaCode, challengeId } = {}) {
    const user = await getUserByIdentifier(identifier);
    const validPassword = await comparePassword(password, user?.passwordHash);
    if (!user || !validPassword) {
        await recordFailedLogin(identifier, 'LOGIN_FAILED', { reason: 'INVALID_CREDENTIALS' });
        throw accessError('INVALID_CREDENTIALS', 'Invalid credentials.');
    }
    if (user.status !== 'active') {
        await recordFailedLogin(identifier, 'LOGIN_REJECTED_DISABLED', { reason: 'ACCOUNT_DISABLED', userId: user.id });
        throw accessError('ACCOUNT_DISABLED', 'This account is disabled.', 403);
    }
    if (user.mfaEnabled) {
        if (!otp && !mfaCode) {
            const challenge = createMfaChallenge(user);
            return {
                requiresMfa: true,
                mfaRequired: true,
                ...challenge,
                user: { id: user.id, name: user.name, email: user.email, username: user.username, role: user.role },
            };
        }
        if (challengeId) {
            const challenge = mfaChallenges.get(challengeId);
            if (!challenge || challenge.userId !== user.id || challenge.expiresAt < Date.now()) {
                await recordFailedLogin(identifier, 'MFA_CHALLENGE_INVALID', { userId: user.id });
                throw accessError('INVALID_MFA_CHALLENGE', 'The MFA challenge is invalid or expired.');
            }
            mfaChallenges.delete(challengeId);
        }
        if (!isValidOtp(otp || mfaCode, user)) {
            await recordFailedLogin(identifier, 'MFA_FAILED', { userId: user.id });
            throw accessError('INVALID_MFA', 'Invalid MFA code.');
        }
    }
    user.lastLogin = new Date().toISOString();
    await updateCollectionItem('users', user.id, { lastLogin: user.lastLogin });
    await addAuditEvent({ actor: user.id, action: 'LOGIN_SUCCESS', resource: 'Auth', resourceId: 'LOGIN' });
    return issueSession(user);
}

export async function registerUser({ name, email, username, password, department = 'Operations', role = 'Investigation Officer', mfaEnabled = true, clearance = 'CONFIDENTIAL', allowPrivilegedRoles = false } = {}) {
    const normalizedEmail = identifierValue(email);
    const normalizedUsername = identifierValue(username);
    const normalizedName = String(name || '').trim();
    const normalizedDepartment = String(department || 'Operations').trim();
    const normalizedRole = String(role || 'Investigation Officer').trim();
    const allowedRoles = allowPrivilegedRoles ? new Set(['Administrator', 'Supervisor', 'Investigation Officer', 'Analyst', 'Viewer', 'Legal Officer']) : new Set(['Investigation Officer', 'Analyst', 'Viewer']);
    if (!normalizedName || !normalizedEmail.includes('@') || !normalizedUsername || String(password || '').length < 8) {
        throw accessError('INVALID_SIGNUP', 'Name, valid email, username, and a password of at least 8 characters are required.', 400);
    }
    if (!allowedRoles.has(normalizedRole)) throw accessError('INVALID_ROLE', allowPrivilegedRoles ? 'Unknown role.' : 'The requested role cannot be self-assigned.', 400);
    const users = await readCollection('users');
    if (users.some((user) => identifierValue(user.email) === normalizedEmail || identifierValue(user.username) === normalizedUsername)) {
        throw accessError('ACCOUNT_EXISTS', 'An account with that email or username already exists.', 409);
    }
    const user = {
        id: `u-${crypto.randomUUID()}`,
        name: normalizedName,
        email: normalizedEmail,
        username: normalizedUsername,
        passwordHash: await bcrypt.hash(String(password), 12),
        role: normalizedRole,
        department: normalizedDepartment,
        clearance: String(clearance || 'CONFIDENTIAL').toUpperCase(),
        status: 'active',
        mfaEnabled: mfaEnabled !== false,
        mfaSecret: mfaEnabled !== false ? authenticator.generateSecret() : null,
        lastLogin: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    await appendToCollection('users', user);
    await addAuditEvent({ actor: user.id, action: 'ACCOUNT_CREATED', resource: 'User', resourceId: user.id });
    const setup = user.mfaEnabled ? {
        secret: user.mfaSecret,
        otpAuthUrl: authenticator.keyuri(user.username, 'CaseVault', user.mfaSecret),
        ...(env.allowDemoMfa ? { demoAvailable: true } : {}),
    } : { enabled: false };
    return { user: publicUser(user), mfaSetup: setup };
}

export async function getDemoMfaCode({ identifier, password } = {}) {
    if (env.isProduction || !env.allowDemoMfa) throw accessError('DEMO_MFA_DISABLED', 'Demo MFA codes are disabled.', 404);
    const user = await getUserByIdentifier(identifier);
    if (!user || user.status !== 'active' || !await comparePassword(password, user.passwordHash) || !user.mfaEnabled) {
        throw accessError('INVALID_CREDENTIALS', 'Invalid credentials.');
    }
    return { code: authenticator.generate(user.mfaSecret), validForSeconds: 30 };
}

export function verifyAccessToken(token) {
    try {
        return jwt.verify(token, env.jwtAccessSecret, { algorithms: ['HS256'] });
    } catch {
        throw accessError('UNAUTHORIZED', 'Authentication required.');
    }
}

export async function refreshAccessToken(token) {
    const session = refreshSessions.get(token);
    if (!session || session.revokedAt || new Date(session.expiresAt).getTime() < Date.now()) {
        refreshSessions.delete(token);
        throw accessError('INVALID_REFRESH_TOKEN', 'Invalid refresh token.');
    }
    const user = await getUserById(session.userId);
    if (!user || user.status !== 'active') {
        refreshSessions.delete(token);
        throw accessError('ACCOUNT_DISABLED', 'This account is disabled.', 403);
    }
    return { accessToken: createAccessToken(user), refreshToken: token, user: publicUser(user) };
}

export function logoutUser(token) {
    if (token) refreshSessions.delete(token);
    return { success: true };
}

export async function getCurrentUserFromToken(token) {
    const payload = verifyAccessToken(token);
    const user = await getUserById(payload.sub);
    if (!user || user.status !== 'active') throw accessError('ACCOUNT_DISABLED', 'This account is disabled.', 403);
    return publicUser(user);
}

export async function listUsersForUI() {
    return (await readCollection('users')).map(publicUser);
}

export async function requestPasswordReset({ identifier } = {}) {
    const user = await getUserByIdentifier(identifier);
    if (!user || user.status !== 'active') {
        await recordFailedLogin(identifier, 'PASSWORD_RESET_REQUESTED_UNKNOWN', { reason: 'UNKNOWN_OR_DISABLED_ACCOUNT' });
        return { accepted: true, message: 'If the account exists and is active, a reset token has been issued to its registered channels.' };
    }
    const token = crypto.randomBytes(32).toString('base64url');
    passwordResetTokens.set(token, { userId: user.id, createdAt: Date.now(), expiresAt: Date.now() + resetTokenTtlMs, usedAt: null });
    await addAuditEvent({ actor: user.id, action: 'PASSWORD_RESET_REQUESTED', resource: 'User', resourceId: user.id, metadata: { delivery: 'outbox' } });
    const result = { accepted: true, message: 'If the account exists and is active, a reset token has been issued to its registered channels.', expiresAt: new Date(Date.now() + resetTokenTtlMs).toISOString() };
    if (env.allowDemoMfa) result.demoToken = token;
    return result;
}

export async function resetPassword({ token, password } = {}) {
    const resetToken = String(token || '').trim();
    const record = resetToken ? passwordResetTokens.get(resetToken) : null;
    if (!record || record.usedAt || record.expiresAt < Date.now()) {
        throw accessError('INVALID_RESET_TOKEN', 'The password reset token is invalid or has expired.');
    }
    assertPasswordPolicy(password);
    const user = await getUserById(record.userId);
    if (!user || user.status !== 'active') throw accessError('ACCOUNT_DISABLED', 'This account is disabled.', 403);
    passwordResetTokens.delete(resetToken);
    await updateCollectionItem('users', user.id, { passwordHash: await bcrypt.hash(String(password), 12), updatedAt: new Date().toISOString() });
    for (const [sessionToken, session] of refreshSessions) {
        if (session.userId === user.id) refreshSessions.delete(sessionToken);
    }
    await addAuditEvent({ actor: user.id, action: 'PASSWORD_RESET_COMPLETED', resource: 'User', resourceId: user.id, metadata: { sessionsRevoked: true } });
    return { reset: true, message: 'Your password has been reset. Sign in with the new password.' };
}

export async function changePassword({ userId, currentPassword, newPassword, keepSession = null } = {}) {
    const user = await getUserById(userId);
    if (!user) throw accessError('USER_NOT_FOUND', 'User not found.', 404);
    if (!await comparePassword(currentPassword, user.passwordHash)) {
        await recordFailedLogin(user.id, 'PASSWORD_CHANGE_REJECTED', { reason: 'CURRENT_PASSWORD_MISMATCH', userId: user.id });
        throw accessError('INVALID_CREDENTIALS', 'The current password is incorrect.', 401);
    }
    assertPasswordPolicy(newPassword);
    await updateCollectionItem('users', user.id, { passwordHash: await bcrypt.hash(String(newPassword), 12), updatedAt: new Date().toISOString() });
    for (const [sessionToken, session] of refreshSessions) {
        if (session.userId === user.id && sessionToken !== keepSession) refreshSessions.delete(sessionToken);
    }
    await addAuditEvent({ actor: user.id, action: 'PASSWORD_CHANGED', resource: 'User', resourceId: user.id });
    return { changed: true, message: 'Password updated. Other active sessions were signed out.' };
}

export function getMfaSetup(user) {
    if (!user?.mfaEnabled || !user.mfaSecret) return { enabled: false };
    return {
        enabled: true,
        secret: user.mfaSecret,
        otpAuthUrl: authenticator.keyuri(user.username, 'CaseVault', user.mfaSecret),
        ...(env.allowDemoMfa ? { demoAvailable: true } : {}),
    };
}

export function getAuthSessionCount() {
    return [...refreshSessions.values()].filter((session) => !session.revokedAt && new Date(session.expiresAt).getTime() > Date.now()).length;
}
