/**
 * E-mail transacional para coach.
 */
const logger = require('./logger');
const { buildTransactionalEmailHtml } = require('./transactional-email-html');
const { sendTransactionalEmail } = require('./send-transactional-email');
const { buildCoachNotificationEmail, DEFAULT_APP } = require('./coach-notification-email-templates');

async function sendCoachNotificationEmail({ to, type, context = {}, appName = DEFAULT_APP }) {
  if (!to || !String(to).includes('@')) {
    return { provider: 'none', skipped: true };
  }

  const built = buildCoachNotificationEmail(type, { ...context, appName });
  if (!built) {
    return { provider: 'none', skipped: true };
  }

  const html = buildTransactionalEmailHtml(built.htmlPayload);

  try {
    return await sendTransactionalEmail({
      to: String(to).trim(),
      subject: built.subject,
      text: built.text,
      html,
    });
  } catch (error) {
    logger.error('coach_notification.email_send_failed', { to, type, error: error.message });
    throw error;
  }
}

module.exports = { sendCoachNotificationEmail };
