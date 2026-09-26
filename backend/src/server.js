import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.routes.js';
import caseRoutes from './routes/cases.routes.js';
import documentRoutes from './routes/documents.routes.js';
import evidenceRoutes from './routes/evidence.routes.js';
import taskRoutes from './routes/tasks.routes.js';
import notificationRoutes from './routes/notifications.routes.js';
import searchRoutes from './routes/search.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import reportRoutes from './routes/reports.routes.js';
import userRoutes from './routes/users.routes.js';
import signatureRoutes from './routes/signatures.routes.js';
import aiRoutes from './routes/ai.routes.js';
import auditRoutes from './routes/audit.routes.js';
import securityRoutes from './routes/security.routes.js';
import assetRoutes from './routes/assets.routes.js';

export const app = express();

app.set('trust proxy', env.trustProxy ?? 1);
app.disable('x-powered-by');

app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: env.jsonBodyLimit || '10mb' }));
app.use(express.urlencoded({ extended: true, limit: env.jsonBodyLimit || '10mb' }));
app.use(requestIdMiddleware);
app.use('/api/v1/auth', rateLimit({ windowMs: env.rateLimit.windowMs, max: env.rateLimit.authMax, standardHeaders: true, legacyHeaders: false }));
app.use('/api/v1', rateLimit({ windowMs: env.rateLimit.windowMs, max: env.rateLimit.apiMax, standardHeaders: true, legacyHeaders: false }));

app.get('/health', (req, res) => {
    res.json({ success: true, data: { status: 'ok', service: 'casevault-backend', nodeEnv: env.nodeEnv, timestamp: new Date().toISOString() } });
});

app.get('/api/v1/health', (req, res) => {
    res.json({ success: true, data: { status: 'ok', service: 'casevault-backend', timestamp: new Date().toISOString() } });
});

app.get('/api/v1', requireAuth, (req, res) => {
    res.json({
        success: true,
        data: {
            service: 'CaseVault API',
            version: 'v1',
            resources: {
                auth: '/api/v1/auth',
                cases: '/api/v1/cases',
                documents: '/api/v1/documents',
                evidence: '/api/v1/evidence',
                tasks: '/api/v1/tasks',
                notifications: '/api/v1/notifications',
                search: '/api/v1/search?q=',
                dashboard: '/api/v1/dashboard',
                reports: '/api/v1/reports',
                users: '/api/v1/users',
                signatures: '/api/v1/signatures',
                ai: '/api/v1/ai',
                audit: '/api/v1/audit',
                security: '/api/v1/security',
                assets: '/api/v1/assets',
            },
        },
    });
});

const api = express.Router();
api.use('/auth', authRoutes);
api.use('/cases', caseRoutes);
api.use('/documents', documentRoutes);
api.use('/evidence', evidenceRoutes);
api.use('/tasks', taskRoutes);
api.use('/notifications', notificationRoutes);
api.use('/search', searchRoutes);
api.use('/dashboard', dashboardRoutes);
api.use('/reports', reportRoutes);
api.use('/users', userRoutes);
api.use('/admin/users', userRoutes);
api.use('/roles', userRoutes);
api.use('/departments', userRoutes);
api.use('/signatures', signatureRoutes);
api.use('/ai', aiRoutes);
api.use('/audit', auditRoutes);
api.use('/security', securityRoutes);
api.use('/assets', assetRoutes);
app.use('/api/v1', api);

app.use(notFoundHandler);
app.use(errorHandler);

export function startServer({ port = env.port } = {}) {
    return app.listen(port, () => {
        logger.info(`CaseVault backend listening on port ${port}`);
    });
}

if (process.env.CASEVAULT_NO_LISTEN !== '1') {
    startServer();
}

export default app;
