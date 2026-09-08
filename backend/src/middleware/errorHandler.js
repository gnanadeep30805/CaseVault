import { logger } from '../config/logger.js';

export function errorHandler(err, req, res, next) {
    const status = err.status || 500;
    const code = err.code || 'INTERNAL_SERVER_ERROR';
    const message = err.message || 'An unexpected error occurred.';

    logger.error({ err, reqId: req.id }, 'request_failed');

    res.status(status).json({
        success: false,
        error: {
            code,
            message: process.env.NODE_ENV === 'production' ? message : message,
        },
    });
}
