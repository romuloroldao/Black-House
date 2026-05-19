/**
 * Envia e-mail de notificação para o aluno (layout transacional Black House).
 */
const logger = require('./logger');
const { buildTransactionalEmailHtml } = require('./transactional-email-html');
const { sendTransactionalEmail } = require('./send-transactional-email');
const { buildStudentNotificationEmail, DEFAULT_APP } = require('./student-notification-email-templates');

/**
 * @param {{
 *   to: string,
 *   type: string,
 *   context?: Record<string, unknown>,
 *   appName?: string,
 * }} opts
 * @returns {Promise<{ provider: 'resend' | 'smtp' | 'none', skipped?: boolean }>}
 */
async function sendStudentNotificationEmail({
  to,
  type,
  context = {},
  appName = DEFAULT_APP,
}) {
  if (!to || !String(to).includes('@')) {
    return { provider: 'none', skipped: true };
  }

  const built = buildStudentNotificationEmail(type, { ...context, appName });
  if (!built) {
    return { provider: 'none', skipped: true };
  }

  const html = buildTransactionalEmailHtml(built.htmlPayload);

  try {
    const result = await sendTransactionalEmail({
      to: String(to).trim(),
      subject: built.subject,
      text: built.text,
      html,
    });
    return result;
  } catch (error) {
    logger.error('student_notification.email_send_failed', {
      to,
      type,
      error: error.message,
    });
    throw error;
  }
}

module.exports = { sendStudentNotificationEmail };
