const crypto = require('crypto');
const { encryptCoachAsaasApiKey, decryptCoachAsaasApiKey } = require('../../utils/asaas-coach-secret-crypto');
const { WEBHOOK_REGISTER_EVENTS } = require('../constants');
const { usesSharedAsaasAccount, getSharedWebhookPrimaryCoachId } = require('../coach-asaas');
const logger = require('../../utils/logger');

function generateWebhookToken() {
  return crypto.randomBytes(32).toString('hex');
}

function timingSafeEqualToken(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function getCoachWebhookToken(pool, coachId) {
  const result = await pool.query(
    'SELECT webhook_auth_token_encrypted FROM public.asaas_config WHERE coach_id = $1 LIMIT 1',
    [coachId],
  );
  const stored = result.rows[0]?.webhook_auth_token_encrypted;
  if (!stored) return null;
  try {
    return decryptCoachAsaasApiKey(stored);
  } catch {
    return stored;
  }
}

async function ensureCoachWebhookToken(pool, coachId) {
  const existing = await getCoachWebhookToken(pool, coachId);
  if (existing) return existing;

  const token = generateWebhookToken();
  const encrypted = encryptCoachAsaasApiKey(token);
  await pool.query(
    `UPDATE public.asaas_config
     SET webhook_auth_token_encrypted = $1, updated_at = NOW()
     WHERE coach_id = $2`,
    [encrypted, coachId],
  );
  return token;
}

function buildWebhookUrl(coachId) {
  const base = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
  return `${base.replace(/\/$/, '')}/api/webhooks/asaas/${coachId}`;
}

function buildSharedWebhookUrl() {
  const base = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
  return `${base.replace(/\/$/, '')}/api/webhooks/asaas/shared`;
}

function isBlackHouseWebhookUrl(url) {
  if (!url) return false;
  return String(url).includes('/api/webhooks/asaas');
}

function resolveWebhookAlertEmail() {
  if (process.env.ASAAS_WEBHOOK_EMAIL) return String(process.env.ASAAS_WEBHOOK_EMAIL).trim();
  const from = process.env.AUTOMATED_EMAIL_FROM || '';
  const match = from.match(/<([^>]+)>/);
  if (match) return match[1];
  if (from.includes('@')) return from.trim();
  return 'nao-responda@blackhouse.app.br';
}

function buildWebhookPayload({ name, url, authToken }) {
  return {
    name,
    url,
    email: resolveWebhookAlertEmail(),
    enabled: true,
    interrupted: false,
    apiVersion: 3,
    authToken,
    sendType: 'SEQUENTIALLY',
    events: WEBHOOK_REGISTER_EVENTS,
  };
}

async function ensureSharedWebhookToken() {
  const existing = process.env.ASAAS_WEBHOOK_TOKEN;
  if (existing && String(existing).trim()) return String(existing).trim();
  return generateWebhookToken();
}

async function ensurePrimaryCoachConfig(pool, coachId) {
  await pool.query(
    `INSERT INTO public.asaas_config (coach_id, is_sandbox)
     VALUES ($1, $2)
     ON CONFLICT (coach_id) DO NOTHING`,
    [coachId, process.env.ASAAS_ENVIRONMENT !== 'production'],
  );
}

async function pruneDuplicateBlackHouseWebhooks(asaasService, keepWebhookId = null) {
  const listed = await asaasService.listWebhooks();
  const items = listed?.data || [];
  for (const wh of items) {
    if (!isBlackHouseWebhookUrl(wh.url)) continue;
    if (keepWebhookId && wh.id === keepWebhookId) continue;
    try {
      await asaasService.deleteWebhook(wh.id);
      logger.info('financial.webhook.removed_duplicate', { webhookId: wh.id, url: wh.url });
    } catch (err) {
      logger.warn('financial.webhook.remove_failed', { webhookId: wh.id, error: err.message });
    }
  }
}

async function registerSharedAsaasWebhook(pool, asaasService) {
  const primaryCoachId = await getSharedWebhookPrimaryCoachId(pool);
  if (!primaryCoachId) {
    throw new Error('Nenhum coach primário para webhook partilhado Asaas');
  }

  await ensurePrimaryCoachConfig(pool, primaryCoachId);

  const authToken = await ensureSharedWebhookToken();
  const url = buildSharedWebhookUrl();

  const configResult = await pool.query(
    'SELECT webhook_id FROM public.asaas_config WHERE coach_id = $1 LIMIT 1',
    [primaryCoachId],
  );
  const existingWebhookId = configResult.rows[0]?.webhook_id;

  const payload = buildWebhookPayload({
    name: 'Black House — conta partilhada',
    url,
    authToken,
  });

  let webhookId = existingWebhookId;
  if (existingWebhookId) {
    try {
      await asaasService.updateWebhook(existingWebhookId, payload);
    } catch (err) {
      logger.warn('financial.webhook.shared_update_failed_creating_new', { error: err.message });
      const created = await asaasService.createWebhook(payload);
      webhookId = created.id;
    }
  } else {
    const created = await asaasService.createWebhook(payload);
    webhookId = created.id;
  }

  await pruneDuplicateBlackHouseWebhooks(asaasService, webhookId);

  await pool.query(
    `UPDATE public.asaas_config
     SET webhook_id = $1,
         webhook_url = $2,
         webhook_registered_at = NOW(),
         updated_at = NOW()
     WHERE coach_id = $3`,
    [webhookId, url, primaryCoachId],
  );

  logger.info('financial.webhook.shared_registered', {
    primaryCoachId,
    webhookId,
    url,
  });

  return { webhookId, url, authToken, primaryCoachId };
}

async function registerCoachWebhook(pool, coachId, asaasService) {
  if (usesSharedAsaasAccount()) {
    const primaryCoachId = await getSharedWebhookPrimaryCoachId(pool);
    if (primaryCoachId && coachId !== primaryCoachId) {
      logger.info('financial.webhook.skip_per_coach_shared_account', { coachId, primaryCoachId });
      return null;
    }
    return registerSharedAsaasWebhook(pool, asaasService);
  }

  const authToken = await ensureCoachWebhookToken(pool, coachId);
  const url = buildWebhookUrl(coachId);

  const configResult = await pool.query(
    'SELECT webhook_id FROM public.asaas_config WHERE coach_id = $1 LIMIT 1',
    [coachId],
  );
  const existingWebhookId = configResult.rows[0]?.webhook_id;

  const payload = buildWebhookPayload({
    name: `Black House - ${coachId.slice(0, 8)}`,
    url,
    authToken,
  });

  let webhookId = existingWebhookId;
  if (existingWebhookId) {
    try {
      await asaasService.updateWebhook(existingWebhookId, payload);
    } catch (err) {
      logger.warn('financial.webhook.update_failed_creating_new', { coachId, error: err.message });
      const created = await asaasService.createWebhook(payload);
      webhookId = created.id;
    }
  } else {
    const created = await asaasService.createWebhook(payload);
    webhookId = created.id;
  }

  await pool.query(
    `UPDATE public.asaas_config
     SET webhook_id = $1, webhook_url = $2, webhook_registered_at = NOW(), updated_at = NOW()
     WHERE coach_id = $3`,
    [webhookId, url, coachId],
  );

  return { webhookId, url, authToken };
}

module.exports = {
  generateWebhookToken,
  timingSafeEqualToken,
  getCoachWebhookToken,
  ensureCoachWebhookToken,
  buildWebhookUrl,
  buildSharedWebhookUrl,
  registerCoachWebhook,
  registerSharedAsaasWebhook,
  ensureSharedWebhookToken,
  isBlackHouseWebhookUrl,
};
