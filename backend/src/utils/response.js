export function successResponse(data, meta = {}) {
    return { success: true, data, meta };
}

export function errorResponse(code, message, status = 500) {
    return {
        success: false,
        error: { code, message },
        status,
    };
}
