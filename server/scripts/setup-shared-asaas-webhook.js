#!/usr/bin/env node
/**
 * Regista um único webhook Asaas para conta partilhada (vários coaches, mesma chave API).
 * Uso: node server/scripts/setup-shared-asaas-webhook.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');
const AsaasService = require('../services/asaas.service');
const { registerSharedAsaasWebhook, ensureSharedWebhookToken } = require('../financial/sync/webhook-registration');

async function main() {
  if (!process.env.ASAAS_API_KEY) {
    console.error('❌ ASAAS_API_KEY não definida em server/.env');
    process.exit(1);
  }

  let webhookToken = await ensureSharedWebhookToken();
  const envPath = path.join(__dirname, '../.env');
  const envText = fs.readFileSync(envPath, 'utf8');

  if (!process.env.ASAAS_WEBHOOK_TOKEN) {
    webhookToken = crypto.randomBytes(32).toString('hex');
    const block = `\nASAAS_WEBHOOK_TOKEN=${webhookToken}\nASAAS_SHARED_ACCOUNT=true\n`;
    fs.appendFileSync(envPath, envText.includes('ASAAS_WEBHOOK_TOKEN') ? '' : block);
    process.env.ASAAS_WEBHOOK_TOKEN = webhookToken;
    process.env.ASAAS_SHARED_ACCOUNT = 'true';
    console.log('✅ ASAAS_WEBHOOK_TOKEN gerado e gravado em server/.env');
  } else if (!process.env.ASAAS_SHARED_ACCOUNT) {
    fs.appendFileSync(envPath, '\nASAAS_SHARED_ACCOUNT=true\n');
    process.env.ASAAS_SHARED_ACCOUNT = 'true';
    console.log('✅ ASAAS_SHARED_ACCOUNT=true gravado em server/.env');
  }

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  const svc = new AsaasService(
    process.env.ASAAS_API_KEY,
    process.env.ASAAS_ENVIRONMENT || 'production',
  );

  const result = await registerSharedAsaasWebhook(pool, svc);
  console.log('✅ Webhook partilhado registado:');
  console.log('   URL:', result.url);
  console.log('   ID:', result.webhookId);
  console.log('   Coach primário:', result.primaryCoachId);

  const listed = await svc.listWebhooks();
  console.log('   Total webhooks Asaas:', listed.totalCount ?? (listed.data || []).length);

  await pool.end();
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
