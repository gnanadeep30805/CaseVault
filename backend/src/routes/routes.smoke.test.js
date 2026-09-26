import test from 'node:test';
import assert from 'node:assert/strict';
import authRoutes from './auth.routes.js';
import caseRoutes from './cases.routes.js';
import documentRoutes from './documents.routes.js';
import evidenceRoutes from './evidence.routes.js';
import taskRoutes from './tasks.routes.js';
import notificationRoutes from './notifications.routes.js';
import searchRoutes from './search.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import reportRoutes from './reports.routes.js';
import userRoutes from './users.routes.js';
import signatureRoutes from './signatures.routes.js';
import aiRoutes from './ai.routes.js';
import auditRoutes from './audit.routes.js';
import securityRoutes from './security.routes.js';
import assetRoutes from './assets.routes.js';

const modules = {
    authRoutes,
    caseRoutes,
    documentRoutes,
    evidenceRoutes,
    taskRoutes,
    notificationRoutes,
    searchRoutes,
    dashboardRoutes,
    reportRoutes,
    userRoutes,
    signatureRoutes,
    aiRoutes,
    auditRoutes,
    securityRoutes,
    assetRoutes,
};

test('all API route modules load successfully', () => {
    for (const [name, route] of Object.entries(modules)) {
        assert.equal(typeof route, 'function', `${name} must export an express router`);
    }
});

test('application composes and serves health without a fixed port', async () => {
    process.env.CASEVAULT_NO_LISTEN = '1';
    const { app } = await import('../server.js');
    assert.equal(typeof app, 'function');
    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    try {
        const { port } = server.address();
        const health = await fetch(`http://127.0.0.1:${port}/health`);
        assert.equal(health.status, 200);
        const body = await health.json();
        assert.equal(body.success, true);
        assert.equal(body.data.status, 'ok');
        const missing = await fetch(`http://127.0.0.1:${port}/api/v1/does-not-exist`);
        assert.equal(missing.status, 404);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});
