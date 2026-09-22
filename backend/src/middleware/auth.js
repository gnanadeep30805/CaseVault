import { env } from '../config/env.js';
import { verifyAccessToken } from '../services/auth.service.js';

const clearanceByRole = {
    Administrator: 4,
    Supervisor: 3,
    'Legal Officer': 3,
    'Investigation Officer': 2,
};

const clearanceByClassification = {
    PUBLIC: 0,
    INTERNAL: 1,
    CONFIDENTIAL: 2,
    RESTRICTED: 3,
    HIGHLY_RESTRICTED: 4,
};

export function canAccessResource(user, resource, relatedResource = null) {
    if (!user) return false;
    if (user.role === 'Administrator') return true;

    const subject = relatedResource || resource;
    const departmentMatches = user.role === 'Supervisor' || !subject?.department || subject.department === user.department;
    const classification = String(resource?.classification || subject?.classification || 'PUBLIC').toUpperCase().replaceAll(' ', '_');
    const clearanceMatches = (clearanceByRole[user.role] || 0) >= (clearanceByClassification[classification] ?? 0);

    return departmentMatches && clearanceMatches;
}

export function filterAccessibleResources(user, resources, relatedResources = new Map()) {
    return resources.filter((resource) => canAccessResource(user, resource, relatedResources.get(resource.caseId)));
}

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
            name: payload.name,
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
