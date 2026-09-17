/**
 * Envio genérico de e-mail transacional via fila persistente.
 * 
 * Fluxo:
 * 1. E-mail é adicionado à fila (email_queue) com status 'pending'
 * 2. Job processa a fila a cada 30s e envia via SMTP
 * 3. Se falhar, retry com backoff exponencial (até 5 tentativas)
 * 4. E-mails 'dead' ficam na tabela para investigação
 * 
 * Fallback: se a fila não estiver configurada, envia directamente.
 */
const logger = require('./logger');
const { getAutomatedEmailFrom } = require('./automated-email-from');
const { getQueuePool, enqueueEmail, sendEmailDirect } = require('./email-queue');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Envia e-mail transacional (via fila se configurada, senão directo).
 * @param {{ to: string, subject: string, text: string, html: string }} opts
 * @returns {Promise<{ provider: 'queue' | 'smtp' | 'none', id?: string }>}
 */
async function sendTransactionalEmail({ to, subject, text, html }) {
  const pool = getQueuePool();
  const from = getAutomatedEmailFrom();
  
  // Se a fila estiver configurada, enfileira e retorna imediatamente
  if (pool) {
    try {
      const id = await enqueueEmail({ to, subject, text, html, from });
      return { provider: 'queue', id };
    } catch (err) {
      logger.error('email.queue_failed', { to, error: err.message });
      // Fallback: tentar envio directo
    }
  }
  
  // Fallback: envio directo (sem fila)
  const host = process.env.SMTP_HOST && String(process.env.SMTP_HOST).trim();
  if (host) {
    try {
      await sendEmailDirect({ to, subject, text, html, from });
      return { provider: 'smtp' };
    } catch (err) {
      logger.error('email.direct_failed', { to, error: err.message });
      throw err;
    }
  }

  logger.warn('MAIL_NOT_CONFIGURED: e-mail transacional não enviado', { to, subject });
  return { provider: 'none' };
}

module.exports = { sendTransactionalEmail, sleep };
