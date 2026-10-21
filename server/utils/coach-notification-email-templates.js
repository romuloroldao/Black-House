/**
 * Templates de e-mail para o coach (Agenda / lembretes operacionais).
 */
const { siteBaseUrl } = require('./transactional-email-html');

const DEFAULT_APP = 'Black House';

function coachAgendaUrl() {
  const base = siteBaseUrl().replace(/\/$/, '');
  return `${base}/?tab=agenda`;
}

function coachCheckinsUrl() {
  const base = siteBaseUrl().replace(/\/$/, '');
  return `${base}/?tab=check-ins`;
}

function formatDateBR(date) {
  if (!date) return '';
  try {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function buildCoachNotificationEmail(type, ctx = {}) {
  const appName = (ctx.appName && String(ctx.appName)) || DEFAULT_APP;
  const coachNome = ctx.coachNome ? String(ctx.coachNome).trim() : '';
  const greeting = coachNome ? `Olá, ${coachNome}.` : 'Olá.';
  const foot =
    'Você está recebendo este e-mail porque é coach na plataforma. Ajuste suas preferências em Configurações.';

  const eventDate = formatDateBR(ctx.eventDate);
  const aluno = ctx.alunoNome ? String(ctx.alunoNome) : 'Aluno';
  const titulo = ctx.eventTitle ? String(ctx.eventTitle) : 'Compromisso na Agenda';

  const basePayload = (preheader, headline, intro, introSecond) => ({
    subject: `${appName} — ${headline}`,
    text: `${appName}\n\n${greeting}\n\n${intro}\n\n${coachAgendaUrl()}\n\n${foot}`,
    htmlPayload: {
      preheader,
      appName,
      headline,
      intro,
      introSecond: introSecond || '',
      ctaUrl: coachAgendaUrl(),
      ctaLabel: 'Abrir Agenda',
      expiryLine: eventDate ? `Data prevista: ${eventDate}.` : 'Confira os detalhes na Agenda.',
      footnote: foot,
    },
  });

  switch (type) {
    case 'agenda_coach_d_minus_2':
      return basePayload(
        ctx.message || 'Retorno em 2 dias.',
        'Lembrete da Agenda',
        ctx.message || `Retorno em 2 dias — ${aluno}.`,
        titulo !== 'Compromisso na Agenda' ? `Evento: ${titulo}.` : '',
      );
    case 'agenda_coach_d_minus_1':
      return basePayload(
        ctx.message || 'Retorno amanhã.',
        'Lembrete da Agenda',
        ctx.message || `Retorno amanhã — ${aluno}.`,
        titulo !== 'Compromisso na Agenda' ? `Evento: ${titulo}.` : '',
      );
    case 'agenda_coach_d_day':
      return basePayload(
        ctx.message || 'Retorno hoje.',
        'Lembrete da Agenda — hoje',
        ctx.message || `Retorno hoje — ${aluno}.`,
        titulo !== 'Compromisso na Agenda' ? `Evento: ${titulo}.` : '',
      );
    case 'agenda_coach_overdue':
      return basePayload(
        'Retorno pendente e atrasado.',
        'Agenda — retorno atrasado',
        ctx.message || `Retorno atrasado — ${aluno}.`,
        'Marque como concluído ou reagende na Agenda.',
      );
    case 'new_weekly_checkin': {
      const summary = ctx.summary ? String(ctx.summary) : '';
      const intro = ctx.message || `${aluno} enviou o check-in semanal.`;
      return {
        subject: `${appName} — Novo check-in de ${aluno}`,
        text: `${appName}\n\n${greeting}\n\n${intro}\n${summary ? `\n${summary}\n` : ''}\n${coachCheckinsUrl()}\n\n${foot}`,
        htmlPayload: {
          preheader: intro,
          appName,
          headline: 'Novo check-in semanal',
          intro,
          introSecond: summary,
          ctaUrl: coachCheckinsUrl(),
          ctaLabel: 'Abrir Check-ins',
          expiryLine: 'Responda na inbox para manter o aluno engajado.',
          footnote: foot,
        },
      };
    }
    default:
      if (ctx.message) {
        return basePayload(ctx.message, 'Lembrete da Agenda', String(ctx.message), '');
      }
      return null;
  }
}

module.exports = {
  buildCoachNotificationEmail,
  coachAgendaUrl,
  coachCheckinsUrl,
  DEFAULT_APP,
};
