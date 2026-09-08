import dotenv from 'dotenv';

dotenv.config();

export const env = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT || 4000),
    databaseUrl: process.env.DATABASE_URL || 'postgresql://casevault:casevault@localhost:5432/casevault',
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_me',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me',
    mfaSecret: process.env.MFA_SECRET || 'JBSWY3DPEHPK3PXP',
    devPasswordHash: process.env.DEV_PASSWORD_HASH || '$2b$12$/ordMkXGm.tJ.BCpXwOCy.SoXTrXMYOxFd4MRy3dL/WivS1sGceRG',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    minio: {
        endpoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: Number(process.env.MINIO_PORT || 9000),
        accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
        bucket: process.env.MINIO_BUCKET || 'casevault',
        useSSL: process.env.MINIO_USE_SSL === 'true',
    },
};
