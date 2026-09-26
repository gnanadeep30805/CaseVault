import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';

export const env = {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port: Number(process.env.PORT || 4000),
    databaseUrl: process.env.DATABASE_URL || 'postgresql://casevault:casevault@localhost:5432/casevault',
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_me',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me',
    documentStorageKey: process.env.DOCUMENT_STORAGE_KEY || 'dev_document_storage_key_change_me',
    documentMaxSize: Number(process.env.DOCUMENT_MAX_SIZE || 10 * 1024 * 1024),
    mfaSecret: process.env.MFA_SECRET || 'JBSWY3DPEHPK3PXP',
    demoMfaCode: process.env.DEMO_MFA_CODE || '',
    devPasswordHash: process.env.DEV_PASSWORD_HASH || '$2b$12$/ordMkXGm.tJ.BCpXwOCy.SoXTrXMYOxFd4MRy3dL/WivS1sGceRG',
    allowDemoMfa: process.env.ALLOW_DEMO_MFA !== 'false' && nodeEnv !== 'production',
    caseVaultDataFile: process.env.CASEVAULT_DATA_FILE || '',
    caseVaultStorageDirectory: process.env.CASEVAULT_STORAGE_DIRECTORY || '',
    aiProviderHook: process.env.AI_PROVIDER_HOOK || '',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    trustProxy: process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY === 'false' ? false : 1,
    jsonBodyLimit: process.env.JSON_BODY_LIMIT || '10mb',
    rateLimit: {
        authMax: Number(process.env.RATE_LIMIT_AUTH_MAX || 20),
        apiMax: Number(process.env.RATE_LIMIT_API_MAX || 300),
        windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60 * 1000),
    },
    smtp: {
        host: process.env.SMTP_HOST || '',
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'CaseVault <noreply@casevault.local>',
    },
    minio: {
        endpoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: Number(process.env.MINIO_PORT || 9000),
        accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
        bucket: process.env.MINIO_BUCKET || 'casevault',
        useSSL: process.env.MINIO_USE_SSL === 'true',
    },
};
