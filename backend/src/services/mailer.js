import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { appendToCollection } from './store.js';

function buildMessage({ to, name, code, subject }) {
    const greeting = name ? `Hello ${name},` : 'Hello,';
    const text = [
        greeting,
        '',
        'Use this 6-digit CaseVault authentication code:',
        code,
        '',
        'This code expires in 10 minutes. If you did not request it, ignore this message.',
        '',
        '— CaseVault Security',
    ].join('\n');

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:480px;line-height:1.5;color:#0f172a">
        <h2 style="color:#2563eb;margin-bottom:8px">CaseVault</h2>
        <p>${greeting}</p>
        <p>Use this 6-digit code to authenticate:</p>
        <p style="font-size:28px;letter-spacing:8px;font-weight:700;background:#eef2ff;padding:12px 16px;border-radius:12px;text-align:center">${code}</p>
        <p style="color:#64748b;font-size:14px">Expires in 10 minutes. If you did not request this, you can ignore the email.</p>
      </div>
    `;

    return { from: env.smtp.from, to, subject, text, html };
}

export async function sendAuthMail({ to, name, code, subject }) {
    const payload = buildMessage({ to, name, code, subject });
    const record = {
        id: `mail-${Date.now()}`,
        to,
        subject,
        sentAt: new Date().toISOString(),
        channel: 'outbox',
        preview: payload.text,
    };

    if (env.smtp.host && env.smtp.user && env.smtp.pass) {
        try {
            const nodemailer = await import('nodemailer');
            const transporter = nodemailer.createTransport({
                host: env.smtp.host,
                port: env.smtp.port,
                secure: env.smtp.secure,
                auth: { user: env.smtp.user, pass: env.smtp.pass },
            });
            await transporter.sendMail(payload);
            record.channel = 'smtp';
            await appendToCollection('mailOutbox', { ...record, delivered: true });
            logger.info({ to, channel: 'smtp' }, 'auth_mail_sent');
            return { sent: true, channel: 'smtp' };
        } catch (error) {
            logger.error({ err: error, to }, 'auth_mail_smtp_failed');
            record.channel = 'outbox';
            record.error = error.message;
        }
    }

    await appendToCollection('mailOutbox', { ...record, delivered: false });
    logger.info({ to, channel: 'outbox' }, 'auth_mail_queued');
    return { sent: false, channel: 'outbox' };
}
