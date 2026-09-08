import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { loginUser, refreshAccessToken, logoutUser, getCurrentUserFromToken } from '../services/auth.service.js';

const router = express.Router();

router.post('/login', async (req, res, next) => {
    try {
        const { identifier, password, otp } = req.body || {};
        const result = await loginUser({ identifier, password, otp });
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

router.post('/verify-mfa', async (req, res, next) => {
    try {
        const { identifier, password, otp } = req.body || {};
        const result = await loginUser({ identifier, password, otp });
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

router.post('/refresh', async (req, res, next) => {
    try {
        const { refreshToken } = req.body || {};
        const result = refreshAccessToken(refreshToken);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

router.post('/logout', async (req, res, next) => {
    try {
        const { refreshToken } = req.body || {};
        const result = logoutUser(refreshToken);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

router.get('/me', requireAuth, (req, res) => {
    const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
    const user = getCurrentUserFromToken(token);
    res.status(200).json({ success: true, data: { user } });
});

export default router;
