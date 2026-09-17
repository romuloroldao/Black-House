/**
 * Email Queue — fila persistente de e-mails com retry automático.
 * 
 * Garante que nenhum e-mail seja perdido mesmo em caso de:
 * - Falha temporária do SMTP
 * - Restart do servidor
 * - Rate limiting
 * 
 * Uso:
 *   const { setQueuePool, enqueueEmail, processEmailQueue } = require('./email-queue');
 *   setQueuePool(pool); // chamar uma vez no startup
 *   await enqueueEmail({ to, subject, text, html }); // pool opcional se já configurado
 */

const logger = require('./logger');
const { getAutomatedEmailFrom } = require('./automated-email-from');

/** @type {import('pg').Pool | null} */
let _pool = null;

/**
 * Configura o pool global para a fila de e-mails.
 * Chamar uma vez no startup do servidor.
 * @param {import('pg').Pool} pool
 */
function setQueuePool(pool) {
  _pool = pool;
}

/**
 * Retorna o pool configurado.
 * @returns {import('pg').Pool | null}
 */
function getQueuePool() {
  return _pool;
}

const RETRY_DELAYS_MS = [
  0,           // 1ª tentativa: imediata
  30_000,      // 2ª: 30s
  120_000,     // 3ª: 2min
  600_000,     // 4ª: 10min
  3_600_000,   // 5ª: 1h
];

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 10;

/**
 * Adiciona um e-mail à fila.
 * @param {import('pg').Pool | { to: string, subject: string, text?: string, html?: string, from?: string, metadata?: object }} poolOrOpts
 * @param {{ to: string, subject: string, text?: string, html?: string, from?: string, metadata?: object }} [opts]
 * @returns {Promise<string>} UUID do e-mail na fila
 */
async function enqueueEmail(poolOrOpts, opts) {
  // Suporta ambas as assinaturas: enqueueEmail(pool, opts) ou enqueueEmail(opts)
  let pool, emailOpts;
  if (opts === undefined && poolOrOpts && typeof poolOrOpts.to === 'string') {
    pool = _pool;
    emailOpts = poolOrOpts;
  } else {
    pool = poolOrOpts;
    emailOpts = opts;
  }
  
  if (!pool) {
    throw new Error('Email queue pool not configured. Call setQueuePool(pool) first or pass pool as argument.');
  }
  
  const { to, subject, text, html, from, metadata = {} } = emailOpts;
  const fromAddr = from || getAutomatedEmailFrom();
  
  const result = await pool.query(
    `INSERT INTO public.email_queue 
      (to_address, subject, text_body, html_body, from_address, metadata, next_retry_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     RETURNING id`,
    [to, subject, text || null, html || null, fromAddr, JSON.stringify(metadata)]
  );
  
  const id = result.rows[0].id;
  logger.info('email.queued', { id, to, subject: subject.slice(0, 50) });
  return id;
}

/**
 * Busca e-mails pendentes para processar.
 * @param {import('pg').Pool} pool
 * @returns {Promise<Array>}
 */
async function fetchPendingEmails(pool) {
  const result = await pool.query(
    `UPDATE public.email_queue
     SET status = 'processing', updated_at = now()
     WHERE id IN (
       SELECT id FROM public.email_queue
       WHERE status IN ('pending', 'failed')
         AND (next_retry_at IS NULL OR next_retry_at <= now())
         AND attempts < max_attempts
       ORDER BY next_retry_at ASC NULLS FIRST, created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [BATCH_SIZE]
  );
  return result.rows;
}

/**
 * Marca e-mail como enviado.
 * @param {import('pg').Pool} pool
 * @param {string} id
 */
async function markSent(pool, id) {
  await pool.query(
    `UPDATE public.email_queue
     SET status = 'sent', sent_at = now(), updated_at = now()
     WHERE id = $1`,
    [id]
  );
}

/**
 * Marca e-mail como falhado (pode tentar novamente).
 * @param {import('pg').Pool} pool
 * @param {string} id
 * @param {string} error
 * @param {number} attempts
 */
async function markFailed(pool, id, error, attempts) {
  const nextStatus = attempts >= MAX_ATTEMPTS ? 'dead' : 'failed';
  const delayMs = RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length - 1)];
  const nextRetry = new Date(Date.now() + delayMs);
  
  await pool.query(
    `UPDATE public.email_queue
     SET status = $1, 
         last_error = $2, 
         attempts = $3,
         next_retry_at = $4,
         updated_at = now()
     WHERE id = $5`,
    [nextStatus, error.slice(0, 1000), attempts, nextRetry, id]
  );
  
  if (nextStatus === 'dead') {
    logger.error('email.dead_letter', { id, attempts, error: error.slice(0, 200) });
  }
}

/**
 * Envia um e-mail directamente (sem fila).
 * @param {{ to: string, subject: string, text?: string, html?: string, from?: string }} opts
 * @returns {Promise<boolean>}
 */
async function sendEmailDirect({ to, subject, text, html, from }) {
  const nodemailer = require('nodemailer');
  
  const host = process.env.SMTP_HOST && String(process.env.SMTP_HOST).trim();
  if (!host) {
    throw new Error('SMTP_HOST not configured');
  }
  
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    tls: host === '127.0.0.1' || host === 'localhost'
      ? { servername: process.env.SMTP_TLS_SERVERNAME || 'smtp.blackhouse.app.br' }
      : undefined,
  });
  
  const fromAddr = from || getAutomatedEmailFrom();
  
  await transporter.sendMail({ from: fromAddr, to, subject, text, html });
  transporter.close();
  return true;
}

/**
 * Processa a fila de e-mails (executar via cron/job).
 * @param {import('pg').Pool} pool
 * @returns {Promise<{ processed: number, sent: number, failed: number }>}
 */
async function processEmailQueue(pool) {
  const emails = await fetchPendingEmails(pool);
  
  if (emails.length === 0) {
    return { processed: 0, sent: 0, failed: 0 };
  }
  
  let sent = 0;
  let failed = 0;
  
  for (const email of emails) {
    const attempts = email.attempts + 1;
    
    try {
      await sendEmailDirect({
        to: email.to_address,
        subject: email.subject,
        text: email.text_body,
        html: email.html_body,
        from: email.from_address,
      });
      
      await markSent(pool, email.id);
      sent++;
      logger.info('email.sent', { 
        id: email.id, 
        to: email.to_address, 
        attempts,
        subject: email.subject.slice(0, 50),
      });
      
    } catch (err) {
      const errMsg = err.message || String(err);
      await markFailed(pool, email.id, errMsg, attempts);
      failed++;
      logger.warn('email.send_failed', { 
        id: email.id, 
        to: email.to_address, 
        attempts,
        error: errMsg.slice(0, 200),
      });
    }
  }
  
  return { processed: emails.length, sent, failed };
}

/**
 * Estatísticas da fila.
 * @param {import('pg').Pool} pool
 */
async function getQueueStats(pool) {
  const result = await pool.query(`
    SELECT 
      status,
      COUNT(*) as count,
      MIN(created_at) as oldest
    FROM public.email_queue
    WHERE created_at > now() - interval '7 days'
    GROUP BY status
  `);
  return result.rows;
}

/**
 * Limpa e-mails antigos já enviados (manter últimos 30 dias).
 * @param {import('pg').Pool} pool
 */
async function cleanupOldEmails(pool) {
  const result = await pool.query(`
    DELETE FROM public.email_queue
    WHERE status = 'sent' AND sent_at < now() - interval '30 days'
    RETURNING id
  `);
  return result.rowCount;
}

module.exports = {
  setQueuePool,
  getQueuePool,
  enqueueEmail,
  processEmailQueue,
  sendEmailDirect,
  getQueueStats,
  cleanupOldEmails,
  MAX_ATTEMPTS,
  BATCH_SIZE,
};
