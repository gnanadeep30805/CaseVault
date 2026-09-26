import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { changePassword, getDemoMfaCode, getCurrentUserFromToken, getMfaSetup, loginUser, logoutUser, refreshAccessToken, registerUser, requestPasswordReset, resetPassword, getUserById } from '../services/auth.service.js';
import { asyncRoute, sendData, sendError, textValue } from '../utils/route-helpers.js';

const router = express.Router();

const signupHandler = asyncRoute(async (req, res) => {
    const result = await registerUser(req.body || {});
    return sendData(res, result, 201);
});

router.post('/signup', signupHandler);
router.post('/register', signupHandler);
router.post('/sign-up', signupHandler);

const loginHandler = asyncRoute(async (req, res) => {
    const { identifier, email, username, password, otp, mfaCode, challengeId } = req.body || {};
    const result = await loginUser({ identifier: identifier || email || username, password, otp, mfaCode, challengeId });
    return sendData(res, result);
});

router.post('/login', loginHandler);
router.post('/signin', loginHandler);
router.post('/verify-mfa', loginHandler);
router.post('/mfa/verify', loginHandler);

router.post('/demo-code', asyncRoute(async (req, res) => {
    const result = await getDemoMfaCode(req.body || {});
    return sendData(res, result);
}));

router.post('/refresh', asyncRoute(async (req, res) => {
    const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;
    const result = await refreshAccessToken(refreshToken);
    return sendData(res, result);
}));
router.post('/token/refresh', asyncRoute(async (req, res) => {
    const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;
    const result = await refreshAccessToken(refreshToken);
    return sendData(res, result);
}));

router.post('/logout', asyncRoute(async (req, res) => {
    const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;
    const result = logoutUser(refreshToken);
    return sendData(res, result);
}));

router.get('/me', requireAuth, asyncRoute(async (req, res) => {
    const user = await getCurrentUserFromToken(req.accessToken);
    return sendData(res, { user });
}));
router.get('/current-user', requireAuth, asyncRoute(async (req, res) => {
    const user = await getCurrentUserFromToken(req.accessToken);
    return sendData(res, { user });
}));

router.get('/mfa/setup', requireAuth, asyncRoute(async (req, res) => {
    const user = await getUserById(req.user.id);
    return sendData(res, getMfaSetup(user));
}));

router.post('/forgot-password', asyncRoute(async (req, res) => {
    const result = await requestPasswordReset({ identifier: textValue(req.body?.identifier || req.body?.email || req.body?.username) });
    return sendData(res, result);
}));
router.post('/password/forgot', asyncRoute(async (req, res) => {
    const result = await requestPasswordReset({ identifier: textValue(req.body?.identifier || req.body?.email || req.body?.username) });
    return sendData(res, result);
}));

router.post('/reset-password', asyncRoute(async (req, res) => {
    const result = await resetPassword({ token: textValue(req.body?.token || req.body?.resetToken), password: req.body?.password || req.body?.newPassword });
    return sendData(res, result);
}));
router.post('/password/reset', asyncRoute(async (req, res) => {
    const result = await resetPassword({ token: textValue(req.body?.token || req.body?.resetToken), password: req.body?.password || req.body?.newPassword });
    return sendData(res, result);
}));

router.post('/change-password', requireAuth, asyncRoute(async (req, res) => {
    const currentPassword = String(req.body?.currentPassword || req.body?.oldPassword || '');
    const newPassword = String(req.body?.newPassword || req.body?.password || '');
    if (!currentPassword || !newPassword) return sendError(res, 422, 'VALIDATION_ERROR', 'The current and new password are both required.');
    const result = await changePassword({ userId: req.user.id, currentPassword, newPassword, keepSession: textValue(req.body?.refreshToken) || null });
    return sendData(res, result);
}));
router.post('/password/change', requireAuth, asyncRoute(async (req, res) => {
    const currentPassword = String(req.body?.currentPassword || req.body?.oldPassword || '');
    const newPassword = String(req.body?.newPassword || req.body?.password || '');
    if (!currentPassword || !newPassword) return sendError(res, 422, 'VALIDATION_ERROR', 'The current and new password are both required.');
    const result = await changePassword({ userId: req.user.id, currentPassword, newPassword, keepSession: textValue(req.body?.refreshToken) || null });
    return sendData(res, result);
}));

export default router;
