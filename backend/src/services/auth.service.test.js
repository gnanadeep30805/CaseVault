import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticator } from 'otplib';
import { env } from '../config/env.js';
import { getCurrentUserFromToken, loginUser, refreshAccessToken } from './auth.service.js';

test('MFA login supports refresh and never exposes credential secrets', async () => {
    const challenge = await loginUser({ identifier: 'ADMIN@CASEVAULT.LOCAL', password: 'password123' });
    assert.equal(challenge.requiresMfa, true);

    const login = await loginUser({
        identifier: 'admin@casevault.local',
        password: 'password123',
        otp: authenticator.generate(env.mfaSecret),
    });
    assert.ok(login.tokens.accessToken);
    assert.ok(login.tokens.refreshToken);

    const currentUser = await getCurrentUserFromToken(login.tokens.accessToken);
    assert.equal(currentUser.username, 'admin');
    assert.equal('passwordHash' in currentUser, false);
    assert.equal('mfaSecret' in currentUser, false);

    const refreshed = await refreshAccessToken(login.tokens.refreshToken);
    assert.ok(refreshed.accessToken);
});