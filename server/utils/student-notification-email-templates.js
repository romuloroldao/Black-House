/**
 * Templates de e-mail para notificações do aluno (mesmo layout dos e-mails de conta).
 */
const { siteBaseUrl } = require('./transactional-email-html');

const DEFAULT_APP = 'Black House';

function studentPortalUrl(tab) {
  const base = siteBaseUrl();
  const t = tab && String(tab).trim() ? String(tab).trim() : 'dashboard';
  return `${base}/student-portal?tab=${encodeURIComponent(t)}`;
}

function formatBRL(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateBR(date) {
  if (!date) return 'em breve';
  try {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return 'em breve';
  }
}

function formatDateTimeBR(date) {
  if (!date) return 'em breve';
  try {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'em breve';
  }
}

/**
 * @param {string} type
 * @param {Record<string, unknown>} ctx
 * @returns {{ subject: string, text: string, htmlPayload: object }|null}
 */
function buildStudentNotificationEmail(type, ctx = {}) {
  const appName = (ctx.appName && String(ctx.appName)) || DEFAULT_APP;
  const nome = ctx.alunoNome ? String(ctx.alunoNome).trim() : '';
  const greeting = nome ? `Olá, ${nome}.` : 'Olá.';

  const baseFoot =
    'Você está recebendo este e-mail porque tem uma conta na plataforma. Se não reconhecer este aviso, fale com seu coach.';

  switch (type) {
    case 'checkin_reminder':
      return {
        subject: `${appName} — Check-in semanal pendente`,
        text:
          `${appName}\n\n${greeting}\n\n` +
          `Você ainda não preencheu o check-in desta semana. Reserve alguns minutos para atualizar peso, medidas e como se sentiu.\n\n` +
          `${studentPortalUrl('checkin')}\n\n${baseFoot}`,
        htmlPayload: {
          preheader: 'Seu check-in semanal está pendente.',
          appName,
          headline: 'Check-in semanal',
          intro:
            'Você ainda não preencheu o check-in desta semana. Manter o registro em dia ajuda seu coach a ajustar treino e nutrição com mais precisão.',
          ctaUrl: studentPortalUrl('checkin'),
          ctaLabel: 'Preencher check-in',
          expiryLine: 'Recomendamos atualizar seu check-in pelo menos uma vez por semana.',
          footnote: baseFoot,
        },
      };

    case 'payment_reminder': {
      const days = ctx.daysUntilDue != null ? Number(ctx.daysUntilDue) : 3;
      const due = formatDateBR(ctx.dueDate);
      const value = formatBRL(ctx.value);
      const valueLine = value ? ` Valor: ${value}.` : '';
      return {
        subject: `${appName} — Mensalidade vence em ${days} dia(s)`,
        text:
          `${appName}\n\n${greeting}\n\n` +
          `Sua mensalidade vence em ${days} dia(s) (${due}).${valueLine}\n\n` +
          `${studentPortalUrl('financial')}\n\n${baseFoot}`,
        htmlPayload: {
          preheader: `Sua mensalidade vence em ${days} dia(s).`,
          appName,
          headline: 'Lembrete de pagamento',
          intro: `Sua mensalidade vence em ${days} dia(s), no dia ${due}.${valueLine}`,
          introSecond: 'Acesse Financeiro na plataforma para ver detalhes e formas de pagamento.',
          ctaUrl: studentPortalUrl('financial'),
          ctaLabel: 'Ver financeiro',
          expiryLine: 'Após o vencimento, o acesso à plataforma pode ser temporariamente suspenso.',
          footnote: baseFoot,
        },
      };
    }

    case 'payment_status': {
      const status = String(ctx.status || '').toUpperCase();
      const due = formatDateBR(ctx.dueDate);
      const value = formatBRL(ctx.value);
      const valueLine = value ? ` Valor: ${value}.` : '';

      if (status === 'OVERDUE') {
        return {
          subject: `${appName} — Mensalidade em atraso`,
          text:
            `${appName}\n\n${greeting}\n\n` +
            `Sua mensalidade está vencida (vencimento: ${due}).${valueLine} Regularize em Financeiro para restaurar o acesso.\n\n` +
            `${studentPortalUrl('financial')}\n\n${baseFoot}`,
          htmlPayload: {
            preheader: 'Sua mensalidade está em atraso.',
            appName,
            headline: 'Pagamento em atraso',
            intro: `Identificamos pendência na sua mensalidade (vencimento: ${due}).${valueLine}`,
            introSecond:
              'Regularize o pagamento em Financeiro para restaurar o acesso completo à plataforma.',
            ctaUrl: studentPortalUrl('financial'),
            ctaLabel: 'Regularizar pagamento',
            expiryLine: 'Em caso de dúvida, entre em contato com seu coach.',
            footnote: baseFoot,
          },
        };
      }

      if (status === 'RECEIVED' || status === 'CONFIRMED') {
        return {
          subject: `${appName} — Pagamento confirmado`,
          text:
            `${appName}\n\n${greeting}\n\n` +
            `Recebemos a confirmação do seu pagamento. Obrigado!${valueLine}\n\n` +
            `${studentPortalUrl('financial')}\n\n${baseFoot}`,
          htmlPayload: {
            preheader: 'Seu pagamento foi confirmado.',
            appName,
            headline: 'Pagamento confirmado',
            intro: `Confirmamos o recebimento do seu pagamento.${valueLine} Obrigado por manter sua conta em dia.`,
            ctaUrl: studentPortalUrl('financial'),
            ctaLabel: 'Ver comprovante',
            expiryLine: 'O comprovante também fica disponível na área Financeiro da plataforma.',
            footnote: baseFoot,
          },
        };
      }

      return null;
    }

    case 'workout_expiration_reminder': {
      const treino = ctx.treinoNome ? String(ctx.treinoNome) : 'seu treino';
      const days = ctx.daysUntilExpiration != null ? Number(ctx.daysUntilExpiration) : 0;
      const when =
        days <= 0 ? 'vence hoje' : `vence em ${days} dia(s)`;
      return {
        subject: `${appName} — Treino perto do vencimento`,
        text:
          `${appName}\n\n${greeting}\n\n` +
          `Seu treino "${treino}" ${when}. Confira os detalhes na plataforma.\n\n` +
          `${studentPortalUrl('workouts')}\n\n${baseFoot}`,
        htmlPayload: {
          preheader: `Seu treino ${when}.`,
          appName,
          headline: 'Treino perto do vencimento',
          intro: `O treino "${treino}" ${when}.`,
          introSecond: 'Acesse Treinos para ver o plano atualizado ou falar com seu coach.',
          ctaUrl: studentPortalUrl('workouts'),
          ctaLabel: 'Abrir treinos',
          expiryLine: 'Treinos vencidos podem ser substituídos pelo seu coach em breve.',
          footnote: baseFoot,
        },
      };
    }

    case 'event_reminder': {
      const titulo = ctx.eventTitle ? String(ctx.eventTitle) : 'Evento';
      const quando = formatDateTimeBR(ctx.eventDate);
      return {
        subject: `${appName} — Evento amanhã: ${titulo}`,
        text:
          `${appName}\n\n${greeting}\n\n` +
          `O evento "${titulo}" acontece amanhã (${quando}).\n\n` +
          `${studentPortalUrl('calendar')}\n\n${baseFoot}`,
        htmlPayload: {
          preheader: `Lembrete: ${titulo} amanhã.`,
          appName,
          headline: 'Evento amanhã',
          intro: `O evento "${titulo}" está marcado para amanhã (${quando}).`,
          ctaUrl: studentPortalUrl('calendar'),
          ctaLabel: 'Ver calendário',
          expiryLine: 'Confira horário e detalhes na plataforma.',
          footnote: baseFoot,
        },
      };
    }

    case 'novo_evento': {
      const titulo = ctx.eventTitle ? String(ctx.eventTitle) : 'Novo evento';
      const quando = formatDateTimeBR(ctx.eventDate);
      return {
        subject: `${appName} — Convite: ${titulo}`,
        text:
          `${appName}\n\n${greeting}\n\n` +
          `Você foi convidado para o evento "${titulo}" em ${quando}.\n\n` +
          `${studentPortalUrl('calendar')}\n\n${baseFoot}`,
        htmlPayload: {
          preheader: `Convite para ${titulo}.`,
          appName,
          headline: 'Novo evento',
          intro: `Você foi convidado para "${titulo}" em ${quando}.`,
          ctaUrl: studentPortalUrl('calendar'),
          ctaLabel: 'Ver evento',
          expiryLine: 'Adicione à sua agenda e confira os detalhes na plataforma.',
          footnote: baseFoot,
        },
      };
    }

    case 'evento_cancelado': {
      const titulo = ctx.eventTitle ? String(ctx.eventTitle) : 'Evento';
      return {
        subject: `${appName} — Evento cancelado: ${titulo}`,
        text:
          `${appName}\n\n${greeting}\n\n` +
          `O evento "${titulo}" foi cancelado.\n\n` +
          `${studentPortalUrl('calendar')}\n\n${baseFoot}`,
        htmlPayload: {
          preheader: `O evento ${titulo} foi cancelado.`,
          appName,
          headline: 'Evento cancelado',
          intro: `Informamos que o evento "${titulo}" foi cancelado.`,
          ctaUrl: studentPortalUrl('calendar'),
          ctaLabel: 'Ver calendário',
          expiryLine: 'Em caso de dúvida, fale com seu coach.',
          footnote: baseFoot,
        },
      };
    }

    case 'aviso': {
      const titulo = ctx.title ? String(ctx.title) : 'Novo aviso do seu coach';
      const mensagem = ctx.message ? String(ctx.message) : 'Seu coach enviou um comunicado.';
      const tab = ctx.linkTab ? String(ctx.linkTab) : 'messages';
      return {
        subject: `${appName} — ${titulo}`,
        text:
          `${appName}\n\n${greeting}\n\n${titulo}\n\n${mensagem}\n\n` +
          `${studentPortalUrl(tab)}\n\n${baseFoot}`,
        htmlPayload: {
          preheader: titulo,
          appName,
          headline: titulo,
          intro: mensagem,
          ctaUrl: studentPortalUrl(tab),
          ctaLabel: 'Ler na plataforma',
          expiryLine: 'Este aviso também aparece no sininho de notificações do portal.',
          footnote: baseFoot,
        },
      };
    }

    default:
      if (ctx.title && ctx.message) {
        const titulo = String(ctx.title);
        const mensagem = String(ctx.message);
        const tab = ctx.linkTab ? String(ctx.linkTab) : 'dashboard';
        return {
          subject: `${appName} — ${titulo}`,
          text: `${appName}\n\n${greeting}\n\n${mensagem}\n\n${studentPortalUrl(tab)}\n\n${baseFoot}`,
          htmlPayload: {
            preheader: titulo,
            appName,
            headline: titulo,
            intro: mensagem,
            ctaUrl: studentPortalUrl(tab),
            ctaLabel: 'Abrir plataforma',
            expiryLine: 'Acesse o portal para mais detalhes.',
            footnote: baseFoot,
          },
        };
      }
      return null;
  }
}

module.exports = {
  buildStudentNotificationEmail,
  studentPortalUrl,
  DEFAULT_APP,
};
