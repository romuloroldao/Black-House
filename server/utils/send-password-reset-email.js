/**
 * Envio do email de redefinição de senha (Resend HTTP ou SMTP via nodemailer).
 * Sem RESEND_* nem SMTP_*: não envia (o chamador pode expor link só em desenvolvimento).
 */
const { buildTransactionalEmailHtml } = require('./transactional-email-html');
const { sendTransactionalEmail } = require('./send-transactional-email');

/**
 * @param {{ to: string, resetUrl: string, appName?: string }} opts
 * @returns {Promise<{ provider: 'resend' | 'smtp' | 'none' }>}
 */
async function sendPasswordResetEmail({ to, resetUrl, appName = 'Black House' }) {
  const subject = `${appName} — Redefinição de senha (pedido recebido)`;
  const text =
    `${appName}\n\n` +
    `Olá,\n\n` +
    `Recebemos um pedido para redefinir a senha associada a esta conta. Se foi você, abra o link em um navegador seguro (válido por 1 hora):\n\n` +
    `${resetUrl}\n\n` +
    `Se você não pediu esta alteração, ignore este e-mail — sua senha permanece a mesma.\n`;
  const html = buildTransactionalEmailHtml({
    preheader: `Pedido de nova senha na ${appName} — link válido por 1 hora.`,
    appName,
    headline: 'Redefinir sua senha',
    intro:
      'Recebemos um pedido para criar uma nova senha na plataforma. Use o botão abaixo apenas se este pedido foi feito por você.',
    ctaUrl: resetUrl,
    ctaLabel: 'Criar nova senha',
    expiryLine:
      'Por segurança, este link expira em 1 hora. Se precisar de mais tempo, acesse novamente a página de login e solicite um novo e-mail.',
    footnote:
      'Se você não pediu esta alteração, pode ignorar este e-mail com tranquilidade — sua conta continua protegida com a senha atual.',
  });

  return sendTransactionalEmail({ to, subject, text, html });
}

module.exports = { sendPasswordResetEmail };
