/** Constantes partilhadas do motor de lembretes inteligentes. */

const MILESTONES = {
  INITIAL: 'INITIAL',
  PRE_DEADLINE_2H: 'PRE_DEADLINE_2H',
  EXPIRED: 'EXPIRED',
};

const DISPATCH_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  CANCELLED: 'cancelled',
  SKIPPED: 'skipped',
};

const DOMAINS = {
  CHECKIN_WEEKLY: 'checkin_weekly',
  WORKOUT_DAILY: 'workout_daily',
  PHOTOS_WEEKLY: 'photos_weekly',
  PAYMENT: 'payment',
  PROFILE_INCOMPLETE: 'profile_incomplete',
  RETURN_DIET: 'return_diet',
  RETURN_WORKOUT: 'return_workout',
  AGENDA_STUDENT: 'agenda_student',
};

const DEFAULT_TZ = 'America/Sao_Paulo';

module.exports = {
  MILESTONES,
  DISPATCH_STATUS,
  DOMAINS,
  DEFAULT_TZ,
};
