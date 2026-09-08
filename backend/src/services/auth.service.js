import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { env } from '../config/env.js';

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

function getUserByIdentifier(identifier) {
    return users.find(
        (user) => user.email === identifier || user.username === identifier || user.id === identifier,
    );
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
    const user = getUserByIdentifier(identifier);
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

export function refreshAccessToken(token) {
    const userId = refreshStore.get(token);
    if (!userId) {
        const err = new Error('Invalid refresh token.');
        err.code = 'INVALID_REFRESH_TOKEN';
        err.status = 401;
        throw err;
    }

    const user = users.find((item) => item.id === userId);
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

export function getCurrentUserFromToken(token) {
    const payload = verifyAccessToken(token);
    const user = users.find((item) => item.id === payload.sub);
    return user ? { ...user } : null;
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
