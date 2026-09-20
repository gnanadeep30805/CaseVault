import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { env } from '../config/env.js';
import { appendToCollection, readCollection } from './store.js';

const users = [
    {
        id: 'u-1001',
        name: 'System Admin',
        email: 'admin@casevault.local',
        username: 'admin',
        passwordHash: env.devPasswordHash,
        role: 'Administrator',
        department: 'Administration',
        status: 'active',
        mfaEnabled: true,
        mfaSecret: env.mfaSecret,
        lastLogin: null,
    },
    {
        id: 'u-1002',
        name: 'Aisha Rahman',
        email: 'investigator@casevault.local',
        username: 'investigator',
        passwordHash: env.devPasswordHash,
        role: 'Investigation Officer',
        department: 'Criminal Investigation',
        status: 'active',
        mfaEnabled: true,
        mfaSecret: env.mfaSecret,
        lastLogin: null,
    },
    {
        id: 'u-1003',
        name: 'Arjun Nair',
        email: 'supervisor@casevault.local',
        username: 'supervisor',
        passwordHash: env.devPasswordHash,
        role: 'Supervisor',
        department: 'Operations',
        status: 'active',
        mfaEnabled: false,
        mfaSecret: null,
        lastLogin: null,
    },
];

const refreshStore = new Map();

async function getUserByIdentifier(identifier) {
    const registeredUsers = await readCollection('users');
    const normalizedIdentifier = String(identifier || '').trim().toLowerCase();
    return [...users, ...registeredUsers].find(
        (user) => user.email.toLowerCase() === normalizedIdentifier || user.username.toLowerCase() === normalizedIdentifier || user.id === identifier,
    );
}

async function getUserById(id) {
    const registeredUsers = await readCollection('users');
    return [...users, ...registeredUsers].find((user) => user.id === id);
}

function toPublicUser(user) {
    if (!user) return null;
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        department: user.department,
        status: user.status,
        mfaEnabled: user.mfaEnabled,
        lastLogin: user.lastLogin,
    };
}

function createAccessToken(user) {
    return jwt.sign(
        { sub: user.id, email: user.email, role: user.role, department: user.department },
        env.jwtAccessSecret,
        { expiresIn: '15m', algorithm: 'HS256' },
    );
}

function createRefreshToken(user) {
    const refreshToken = crypto.randomBytes(32).toString('hex');
    refreshStore.set(refreshToken, user.id);
    return refreshToken;
}

export async function loginUser({ identifier, password, otp }) {
    const user = await getUserByIdentifier(identifier);
    if (!user || user.status !== 'active' || !await bcrypt.compare(String(password || ''), user.passwordHash)) {
        throw Object.assign(new Error('Invalid credentials.'), { code: 'INVALID_CREDENTIALS', status: 401 });
    }

    if (user.mfaEnabled) {
        if (!otp) {
            return {
                requiresMfa: true,
                user: { id: user.id, email: user.email, username: user.username, role: user.role },
            };
        }

        if (!otp || !authenticator.check(String(otp), user.mfaSecret)) {
            throw Object.assign(new Error('Invalid MFA code.'), { code: 'INVALID_MFA', status: 401 });
        }
    }

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);
    user.lastLogin = new Date().toISOString();

    return {
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            username: user.username,
            role: user.role,
            department: user.department,
            status: user.status,
            mfaEnabled: user.mfaEnabled,
            lastLogin: user.lastLogin,
        },
        tokens: { accessToken, refreshToken },
    };
}

export async function registerUser({ name, email, username, password, department = 'Operations' }) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedUsername = String(username || '').trim().toLowerCase();
    const registeredUsers = await readCollection('users');
    const exists = [...users, ...registeredUsers].some(
        (user) => user.email === normalizedEmail || user.username === normalizedUsername,
    );
    if (exists) {
        throw Object.assign(new Error('An account with that email or username already exists.'), { code: 'ACCOUNT_EXISTS', status: 409 });
    }
    if (!name || !normalizedEmail || !normalizedUsername || String(password || '').length < 8) {
        throw Object.assign(new Error('Name, email, username, and a password of at least 8 characters are required.'), { code: 'INVALID_SIGNUP', status: 400 });
    }

    const user = {
        id: `u-${Date.now()}`,
        name: String(name).trim(),
        email: normalizedEmail,
        username: normalizedUsername,
        passwordHash: await bcrypt.hash(String(password), 12),
        role: 'Investigation Officer',
        department,
        status: 'active',
        mfaEnabled: true,
        mfaSecret: authenticator.generateSecret(),
        lastLogin: null,
    };
    await appendToCollection('users', user);
    const mfaSetup = {
        secret: user.mfaSecret,
        otpAuthUrl: authenticator.keyuri(user.username, 'CaseVault', user.mfaSecret),
    };
    if (env.allowDemoMfa) mfaSetup.demoOtp = authenticator.generate(user.mfaSecret);

    return {
        user: { id: user.id, name: user.name, email: user.email, username: user.username, role: user.role, department: user.department },
        mfaSetup,
    };
}

export async function getDemoMfaCode({ identifier, password }) {
    if (env.nodeEnv === 'production' || env.allowDemoMfa !== true) {
        throw Object.assign(new Error('Demo MFA codes are disabled.'), { code: 'DEMO_MFA_DISABLED', status: 404 });
    }
    const user = await getUserByIdentifier(identifier);
    if (!user || !user.mfaEnabled || !await bcrypt.compare(String(password || ''), user.passwordHash)) {
        throw Object.assign(new Error('Invalid credentials.'), { code: 'INVALID_CREDENTIALS', status: 401 });
    }
    return { code: authenticator.generate(user.mfaSecret), validForSeconds: 30 };
}

export function verifyAccessToken(token) {
    try {
        return jwt.verify(token, env.jwtAccessSecret, { algorithms: ['HS256'] });
    } catch (error) {
        const err = new Error('Unauthorized');
        err.code = 'UNAUTHORIZED';
        err.status = 401;
        throw err;
    }
}

export async function refreshAccessToken(token) {
    const userId = refreshStore.get(token);
    if (!userId) {
        const err = new Error('Invalid refresh token.');
        err.code = 'INVALID_REFRESH_TOKEN';
        err.status = 401;
        throw err;
    }

    const user = await getUserById(userId);
    if (!user) {
        const err = new Error('User not found.');
        err.code = 'USER_NOT_FOUND';
        err.status = 404;
        throw err;
    }

    const accessToken = createAccessToken(user);
    return { accessToken };
}

export function logoutUser(token) {
    if (token) refreshStore.delete(token);
    return { success: true };
}

export async function getCurrentUserFromToken(token) {
    const payload = verifyAccessToken(token);
    const user = await getUserById(payload.sub);
    return toPublicUser(user);
}

export function listUsersForUI() {
    return users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
    }));
}
