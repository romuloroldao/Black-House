/**
 * Envio de email de confirmação de conta (Resend HTTP ou SMTP via nodemailer).
 * Se nenhum provedor estiver configurado, retorna provider "none".
 */
const { buildTransactionalEmailHtml } = require('./transactional-email-html');
const { sendTransactionalEmail } = require('./send-transactional-email');

/**
 * @param {{ to: string, confirmUrl: string, appName?: string }} opts
 * @returns {Promise<{ provider: 'resend' | 'smtp' | 'none' }>}
 */
async function sendEmailConfirmation({ to, confirmUrl, appName = 'Black House' }) {
  const subject = `${appName} — Confirmação de conta (último passo)`;
  const text =
    `${appName}\n\n` +
    `Olá,\n\n` +
    `Bem-vindo à plataforma. Para ativar sua conta com segurança, confirme este endereço de e-mail usando o link abaixo (válido por 24 horas):\n\n` +
    `${confirmUrl}\n\n` +
    `Este passo garante que só você consegue concluir o cadastro. Se você não criou conta na ${appName}, ignore este e-mail — sem confirmação, a conta não fica ativa.\n`;
  const html = buildTransactionalEmailHtml({
    preheader: `Último passo: confirme o e-mail para entrar na ${appName}.`,
    appName,
    headline: 'Ative sua conta',
    intro:
      'Bem-vindo. Seu cadastro está quase concluído — falta apenas confirmar que este endereço de e-mail é seu.',
    introSecond:
      'Use o botão abaixo em um navegador seguro. Assim, protegemos seu acesso e o de demais usuários da plataforma.',
    ctaUrl: confirmUrl,
    ctaLabel: 'Confirmar e ativar a conta',
    expiryLine:
      'Por segurança, este link expira em 24 horas. Se o prazo acabar, acesse novamente a página de login e use a opção para reenviar o e-mail de confirmação.',
    footnote:
      'Se você não reconhece este cadastro, pode ignorar este e-mail com tranquilidade — sem esta etapa, ninguém consegue usar esta conta.',
  });

  return sendTransactionalEmail({ to, subject, text, html });
}

module.exports = { sendEmailConfirmation };
