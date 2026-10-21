/**
 * URL pública do frontend (SPA). Usada em links de email e redirects GET /auth na API.
 * Nunca deve apontar para api.* — links de reset/confirmação abrem no domínio do site.
 */
function getFrontendBaseUrl() {
  const candidates = [
    process.env.FRONTEND_URL,
    process.env.PUBLIC_APP_URL,
    'https://blackhouse.app.br',
  ].filter(Boolean);

  for (const raw of candidates) {
    let url = String(raw).trim().replace(/\/$/, '');
    if (!url) continue;
    // FRONTEND_URL=https://api.dominio.com → https://dominio.com
    url = url.replace(/^(https?:\/\/)api\./i, '$1');
    if (/^https?:\/\/api\./i.test(url)) continue;
    return url;
  }

  return 'https://blackhouse.app.br';
}

module.exports = { getFrontendBaseUrl };
