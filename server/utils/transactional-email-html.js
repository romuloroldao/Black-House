/**
 * Layout HTML transacional alinhado à identidade Black House (dark + ouro).
 * Estilos inline e tabelas simples para compatibilidade com clientes de email.
 */

const BRAND = {
  bg: '#0a0a0a',
  card: '#111111',
  cardBorder: '#2a2a2a',
  text: '#f5f5f5',
  muted: '#a3a3a3',
  subtle: '#737373',
  gold: '#c9a03f',
  goldDark: '#a68432',
  goldText: '#0c0c0c',
  accentBar: '#c9a03f',
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

const { getFrontendBaseUrl } = require('./frontend-base-url');

function siteBaseUrl() {
  return getFrontendBaseUrl();
}

/**
 * @param {{
 *   preheader: string,
 *   appName: string,
 *   headline: string,
 *   intro: string,
 *   introSecond?: string,
 *   ctaUrl: string,
 *   ctaLabel: string,
 *   expiryLine: string,
 *   footnote: string,
 * }} p
 */
function buildTransactionalEmailHtml(p) {
  const pre = escapeHtml(p.preheader);
  const app = escapeHtml(p.appName);
  const headline = escapeHtml(p.headline);
  const intro = escapeHtml(p.intro);
  const introSecond = p.introSecond ? escapeHtml(p.introSecond) : '';
  const foot = escapeHtml(p.footnote);
  const expiry = escapeHtml(p.expiryLine);
  const ctaHref = escapeAttr(p.ctaUrl);
  const ctaLabel = escapeHtml(p.ctaLabel);
  const base = escapeAttr(siteBaseUrl());

  const introBlock = introSecond
    ? `<p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:${BRAND.muted};">${intro}</p>` +
      `<p style="margin:0 0 28px;font-size:16px;line-height:1.6;color:${BRAND.muted};">${introSecond}</p>`
    : `<p style="margin:0 0 28px;font-size:16px;line-height:1.6;color:${BRAND.muted};">${intro}</p>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${headline}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BRAND.bg};opacity:0;">${pre}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${BRAND.bg};">
    <tr>
      <td align="center" style="padding:32px 16px 48px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
          <tr>
            <td style="height:3px;background-color:${BRAND.accentBar};border-radius:2px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="background-color:${BRAND.card};border:1px solid ${BRAND.cardBorder};border-top:none;border-radius:0 0 12px 12px;padding:36px 28px 32px;">
              <p style="margin:0 0 20px;font-size:11px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:${BRAND.gold};">${app}</p>
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;line-height:1.25;color:${BRAND.text};">${headline}</h1>
              ${introBlock}
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
                <tr>
                  <td align="center" bgcolor="${BRAND.gold}" style="border-radius:8px;background-color:${BRAND.gold};">
                    <a href="${ctaHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:${BRAND.goldText};text-decoration:none;border-radius:8px;">${ctaLabel}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px;padding:12px 14px;font-size:13px;line-height:1.5;color:${BRAND.subtle};background-color:#0d0d0d;border:1px solid ${BRAND.cardBorder};border-radius:8px;">${expiry}</p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:${BRAND.subtle};">${foot}</p>
              <hr style="margin:28px 0;border:none;border-top:1px solid ${BRAND.cardBorder};">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${BRAND.subtle};">
                Este e-mail foi enviado pela plataforma <strong style="color:${BRAND.muted};">${app}</strong>.<br>
                <a href="${base}" style="color:${BRAND.gold};text-decoration:underline;">Acessar o site</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = {
  buildTransactionalEmailHtml,
  escapeHtml,
  siteBaseUrl,
};
