import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

function normalizeError(error) {
    if (error?.name === 'MulterError') {
        if (error.code === 'LIMIT_FILE_SIZE') return { status: 413, code: 'FILE_TOO_LARGE', message: 'The uploaded file exceeds the allowed size.' };
        return { status: 422, code: 'UPLOAD_ERROR', message: 'The multipart upload could not be processed.' };
    }
    const status = Number(error?.status || error?.statusCode || 500);
    const safeStatus = Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
    const code = error?.code && typeof error.code === 'string' ? error.code : safeStatus >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR';
    const message = safeStatus >= 500 && env.isProduction
        ? 'An unexpected error occurred.'
        : String(error?.message || 'The request could not be completed.');
    return { status: safeStatus, code, message };
}

export function errorHandler(error, req, res, next) {
    if (res.headersSent) return next(error);
    const normalized = normalizeError(error);
    logger.error({ err: error, reqId: req.id }, 'request_failed');
    return res.status(normalized.status).json({
        success: false,
        error: {
            code: normalized.code,
            message: normalized.message,
            requestId: req.id,
        },
    });
}

export function notFoundHandler(req, res) {
    return res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: 'Route not found.',
            requestId: req.id,
        },
    });
}
