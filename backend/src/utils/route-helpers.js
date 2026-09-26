export function asyncRoute(handler) {
    return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function sendData(res, data, status = 200) {
    return res.status(status).json({ success: true, data });
}

export function sendError(res, status, code, message) {
    return res.status(status).json({ success: false, error: { code, message } });
}

export function textValue(value) {
    return String(value || '').trim();
}

export function positiveInteger(value, fallback) {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function paginate(items, query = {}) {
    const page = positiveInteger(query.page, 1);
    const limit = Math.min(positiveInteger(query.limit, 50), 200);
    const start = (page - 1) * limit;
    return {
        items: items.slice(start, start + limit),
        meta: { page, limit, total: items.length, pages: Math.max(1, Math.ceil(items.length / limit)) },
    };
}

export function publicUserReference(user) {
    if (!user) return null;
    return { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department };
}
