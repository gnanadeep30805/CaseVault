import { env } from '../config/env.js';
import { verifyAccessToken } from '../services/auth.service.js';

export function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
    }

    try {
        const payload = verifyAccessToken(token);
        req.user = {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
            department: payload.department,
        };
        next();
    } catch (error) {
        return res.status(401).json({ success: false, error: { code: error.code || 'UNAUTHORIZED', message: error.message || 'Unauthorized.' } });
    }
}

export function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions.' } });
        }

        next();
    };
}

export function optionalAuth(req, res, next) {
    const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
    if (!token) return next();

    try {
        const payload = verifyAccessToken(token);
        req.user = {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
            department: payload.department,
        };
    } catch (error) {
        req.user = null;
    }
    next();
}
