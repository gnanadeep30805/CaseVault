import { env } from '../config/env.js';
import { getCurrentUserFromToken, verifyAccessToken } from '../services/auth.service.js';
import { canAccessResource as policyCanAccessResource, filterAccessibleResources as policyFilterAccessibleResources, hasPermission } from '../services/authorization.service.js';

export function canAccessResource(user, resource, relatedResource = null, options = {}) {
    return policyCanAccessResource(user, resource, relatedResource, options);
}

export function filterAccessibleResources(user, resources, relatedResources = new Map()) {
    return policyFilterAccessibleResources(user, resources, relatedResources);
}

function bearerToken(req) {
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
    if (req.cookies?.accessToken) return req.cookies.accessToken;
    return null;
}

function unauthorized(res, message = 'Authentication required.') {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message } });
}

export async function requireAuth(req, res, next) {
    const token = bearerToken(req);
    if (!token) return unauthorized(res);
    try {
        const payload = verifyAccessToken(token);
        const user = await getCurrentUserFromToken(token);
        req.auth = payload;
        req.accessToken = token;
        req.user = { ...user, mfaLevel: payload.mfaLevel || (user.mfaEnabled ? 2 : 1) };
        return next();
    } catch (error) {
        const status = error.status || 401;
        return res.status(status).json({ success: false, error: { code: error.code || 'UNAUTHORIZED', message: error.message || 'Authentication required.' } });
    }
}

export function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) return unauthorized(res);
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions.' } });
        }
        return next();
    };
}

export function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user) return unauthorized(res);
        if (!hasPermission(req.user, permission)) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions.' } });
        }
        return next();
    };
}

export function requireMfa(req, res, next) {
    if (!req.user) return unauthorized(res);
    if ((req.auth?.mfaLevel || req.user.mfaLevel || 0) < 1) {
        return res.status(403).json({ success: false, error: { code: 'MFA_REQUIRED', message: 'Multi-factor verification is required.' } });
    }
    return next();
}

export function optionalAuth(req, res, next) {
    const token = bearerToken(req);
    if (!token) return next();
    try {
        const payload = verifyAccessToken(token);
        req.auth = payload;
        req.accessToken = token;
        req.user = {
            id: payload.sub,
            name: payload.name,
            email: payload.email,
            role: payload.role,
            department: payload.department,
            clearance: payload.clearance,
            mfaLevel: payload.mfaLevel || 1,
        };
    } catch {
        req.user = null;
    }
    return next();
}

export function authEnvironment() {
    return { nodeEnv: env.nodeEnv, allowDemoMfa: env.allowDemoMfa };
}
