import test from 'node:test';
import assert from 'node:assert/strict';
import authRoutes from './auth.routes.js';
import caseRoutes from './cases.routes.js';
import documentRoutes from './documents.routes.js';
import evidenceRoutes from './evidence.routes.js';
import auditRoutes from './audit.routes.js';
import securityRoutes from './security.routes.js';
import assetRoutes from './assets.routes.js';

test('all API route modules load successfully', () => {
    for (const route of [authRoutes, caseRoutes, documentRoutes, evidenceRoutes, auditRoutes, securityRoutes, assetRoutes]) {
        assert.equal(typeof route, 'function');
    }
});
