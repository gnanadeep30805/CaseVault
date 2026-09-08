import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import caseRoutes from './routes/cases.routes.js';
import documentRoutes from './routes/documents.routes.js';
import evidenceRoutes from './routes/evidence.routes.js';
import auditRoutes from './routes/audit.routes.js';
import securityRoutes from './routes/security.routes.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestIdMiddleware);
app.use(rateLimit({ windowMs: 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false }));

app.get('/health', (req, res) => {
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/cases', caseRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/evidence', evidenceRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/security', securityRoutes);

app.use((req, res) => {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found.' } });
});

app.use(errorHandler);

app.listen(env.port, () => {
    logger.info(`CaseVault backend listening on port ${env.port}`);
});
