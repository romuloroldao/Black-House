/**
 * Endereço "From" para e-mails automáticos do sistema (não responder).
 * Pode ser sobrescrito por AUTOMATED_EMAIL_FROM no .env.
 */
const DEFAULT_AUTOMATED_FROM = 'Black House <nao-responda@blackhouse.app.br>';

function getAutomatedEmailFrom() {
  const explicit = process.env.AUTOMATED_EMAIL_FROM;
  if (explicit && String(explicit).trim()) {
    return String(explicit).trim();
  }
  return DEFAULT_AUTOMATED_FROM;
}

/** True se há transporte configurado (Resend ou SMTP). Sem isto, confirmação/reset não saem da API. */
function isOutboundMailConfigured() {
  if (process.env.RESEND_API_KEY && String(process.env.RESEND_API_KEY).trim()) {
    return true;
  }
  if (process.env.SMTP_HOST && String(process.env.SMTP_HOST).trim()) {
    return true;
  }
  return false;
}

module.exports = { getAutomatedEmailFrom, DEFAULT_AUTOMATED_FROM, isOutboundMailConfigured };
