export function requestIdMiddleware(req, res, next) {
    req.id = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    res.setHeader('x-request-id', req.id);
    next();
}
