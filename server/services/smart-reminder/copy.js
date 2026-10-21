/** Textos canónicos por domínio e marco. */

const COPY = {
  checkin_weekly: {
    INITIAL: {
      studentTitle: 'Check-in semanal',
      studentMessage:
        'Você ainda não preencheu o check-in desta semana. Reserve alguns minutos para atualizar seu progresso.',
      coachTitle: 'Lembrete de Check-in',
      coachMessage: (nome) => `${nome} precisa fazer check-in semanal`,
      emailType: 'checkin_reminder',
      notificationType: 'checkin_reminder',
      link: 'checkin',
    },
    PRE_DEADLINE_2H: {
      studentTitle: 'Check-in semanal',
      studentMessage:
        'Faltam poucas horas para encerrar a semana. Se ainda não fez o check-in, ainda dá tempo.',
      coachTitle: 'Check-in pendente',
      coachMessage: (nome) => `${nome} ainda não enviou o check-in desta semana`,
      emailType: 'checkin_reminder',
      notificationType: 'checkin_reminder',
      link: 'checkin',
    },
    EXPIRED: {
      studentTitle: null,
      studentMessage: null,
      coachTitle: 'Check-in não realizado',
      coachMessage: (nome) => `${nome} não enviou o check-in semanal dentro do prazo`,
      emailType: null,
      notificationType: 'checkin_missed',
      link: 'check-ins',
    },
  },
};

function getCopy(domain, milestone) {
  return COPY[domain]?.[milestone] || null;
}

module.exports = {
  COPY,
  getCopy,
};
