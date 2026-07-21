/**
 * Envio genérico de e-mail transacional (Resend HTTP ou SMTP via nodemailer).
 * SMTP: transporter singleton + retry em 421 / too many connections.
 */
const logger = require('./logger');
const { getAutomatedEmailFrom } = require('./automated-email-from');

/** @type {import('nodemailer').Transporter | null} */
let smtpTransporter = null;
let smtpTransporterKey = '';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err) {
  const msg = String(err && err.message ? err.message : err || '');
  const code = err && (err.responseCode || err.code);
  return (
    code === 421 ||
    /too many connections/i.test(msg) ||
    /\b421\b/.test(msg) ||
    /Invalid greeting/i.test(msg)
  );
}

function getSmtpTransporter() {
  const host = process.env.SMTP_HOST && String(process.env.SMTP_HOST).trim();
  if (!host) return null;

  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const key = `${host}:${port}:${secure}:${user}`;

  if (smtpTransporter && smtpTransporterKey === key) {
    return smtpTransporter;
  }

  // eslint-disable-next-line global-require
  const nodemailer = require('nodemailer');
  smtpTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    pool: true,
    maxConnections: 1,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5,
    // Localhost / IP: validar cert com o nome SMTP público
    tls:
      host === '127.0.0.1' || host === 'localhost'
        ? { servername: process.env.SMTP_TLS_SERVERNAME || 'smtp.blackhouse.app.br' }
        : undefined,
  });
  smtpTransporterKey = key;
  return smtpTransporter;
}

/**
 * @param {{ to: string, subject: string, text: string, html: string }} opts
 * @returns {Promise<{ provider: 'resend' | 'smtp' | 'none' }>}
 */
async function sendTransactionalEmail({ to, subject, text, html }) {
  const resendKey = process.env.RESEND_API_KEY;
  const resendFrom =
    (process.env.RESEND_FROM && String(process.env.RESEND_FROM).trim()) || getAutomatedEmailFrom();

  if (resendKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [to],
        subject,
        text,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      logger.error('Resend: falha ao enviar e-mail transacional', {
        status: res.status,
        to,
        body,
      });
      throw new Error('Falha ao enviar e-mail');
    }
    return { provider: 'resend' };
  }

  const transporter = getSmtpTransporter();
  if (transporter) {
    const from =
      (process.env.SMTP_FROM && String(process.env.SMTP_FROM).trim()) || getAutomatedEmailFrom();
    const maxAttempts = 3;
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await transporter.sendMail({ from, to, subject, text, html });
        return { provider: 'smtp' };
      } catch (err) {
        lastErr = err;
        if (attempt < maxAttempts && isRateLimitError(err)) {
          const backoffMs = 1500 * attempt;
          logger.warn('smtp.rate_limit_retry', {
            to,
            attempt,
            backoffMs,
            error: err.message,
          });
          await sleep(backoffMs);
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  logger.warn('MAIL_NOT_CONFIGURED: e-mail transacional não enviado', { to, subject });
  return { provider: 'none' };
}

module.exports = { sendTransactionalEmail, sleep };
