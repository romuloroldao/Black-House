/**
 * Envio genérico de e-mail transacional (Resend HTTP ou SMTP via nodemailer).
 */
const logger = require('./logger');
const { getAutomatedEmailFrom } = require('./automated-email-from');

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

  const smtpHost = process.env.SMTP_HOST;
  if (smtpHost) {
    // eslint-disable-next-line global-require
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
    const from =
      (process.env.SMTP_FROM && String(process.env.SMTP_FROM).trim()) || getAutomatedEmailFrom();
    await transporter.sendMail({ from, to, subject, text, html });
    return { provider: 'smtp' };
  }

  logger.warn('MAIL_NOT_CONFIGURED: e-mail transacional não enviado', { to, subject });
  return { provider: 'none' };
}

module.exports = { sendTransactionalEmail };
