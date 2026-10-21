/** Textos de lembrete da Agenda para o coach. */

const TIPO_LABEL = {
  ajuste_dieta: 'dieta',
  alteracao_treino: 'treino',
  consulta: 'consulta',
  acompanhamento: 'acompanhamento',
  avaliacao: 'consulta',
  retorno: 'retorno',
  outro: 'acompanhamento',
};

function alunoRef(nome) {
  const n = nome && String(nome).trim();
  return n ? `o aluno ${n}` : 'o aluno';
}

function buildCoachAgendaCopy(tipo, milestone, alunoNome, titulo) {
  const assunto = TIPO_LABEL[tipo] || 'retorno';
  const aluno = alunoRef(alunoNome);

  if (!alunoNome && titulo) {
    return buildGenericCopy(milestone, titulo);
  }

  switch (milestone) {
    case 'D_MINUS_2':
      if (tipo === 'ajuste_dieta') {
        return {
          title: 'Retorno de dieta em 2 dias',
          message: `O aluno ${alunoNome || '—'} retorna a dieta em 2 dias.`,
          emailType: 'agenda_coach_d_minus_2',
        };
      }
      if (tipo === 'alteracao_treino') {
        return {
          title: 'Retorno de treino em 2 dias',
          message: `O aluno ${alunoNome || '—'} retorna o treino em 2 dias.`,
          emailType: 'agenda_coach_d_minus_2',
        };
      }
      if (tipo === 'avaliacao') {
        return {
          title: 'Consulta em 2 dias',
          message: `${aluno.charAt(0).toUpperCase() + aluno.slice(1)} tem consulta em 2 dias.`,
          emailType: 'agenda_coach_d_minus_2',
        };
      }
      return {
        title: `Retorno em 2 dias`,
        message: `${aluno.charAt(0).toUpperCase() + aluno.slice(1)} tem ${assunto} em 2 dias.`,
        emailType: 'agenda_coach_d_minus_2',
      };

    case 'D_MINUS_1':
      if (tipo === 'ajuste_dieta') {
        return {
          title: 'Retorno de dieta amanhã',
          message: `Amanhã é o retorno da dieta do aluno ${alunoNome || '—'}.`,
          emailType: 'agenda_coach_d_minus_1',
        };
      }
      if (tipo === 'alteracao_treino') {
        return {
          title: 'Retorno de treino amanhã',
          message: `Amanhã é o retorno do treino do aluno ${alunoNome || '—'}.`,
          emailType: 'agenda_coach_d_minus_1',
        };
      }
      if (tipo === 'avaliacao') {
        return {
          title: 'Consulta amanhã',
          message: `Amanhã é a consulta do aluno ${alunoNome || '—'}.`,
          emailType: 'agenda_coach_d_minus_1',
        };
      }
      return {
        title: 'Retorno amanhã',
        message: `Amanhã é o retorno de ${assunto} do aluno ${alunoNome || '—'}.`,
        emailType: 'agenda_coach_d_minus_1',
      };

    case 'D_DAY':
      if (tipo === 'ajuste_dieta') {
        return {
          title: 'Retorno de dieta hoje',
          message: `Hoje é o retorno da dieta do aluno ${alunoNome || '—'}.`,
          emailType: 'agenda_coach_d_day',
        };
      }
      if (tipo === 'alteracao_treino') {
        return {
          title: 'Retorno de treino hoje',
          message: `Hoje é o retorno do treino do aluno ${alunoNome || '—'}.`,
          emailType: 'agenda_coach_d_day',
        };
      }
      if (tipo === 'avaliacao') {
        return {
          title: 'Consulta hoje',
          message: `Hoje é a consulta do aluno ${alunoNome || '—'}.`,
          emailType: 'agenda_coach_d_day',
        };
      }
      return {
        title: 'Retorno hoje',
        message: `Hoje é o retorno de ${assunto} do aluno ${alunoNome || '—'}.`,
        emailType: 'agenda_coach_d_day',
      };

    case 'OVERDUE_DAILY':
      return {
        title: 'Retorno atrasado',
        message: `O retorno (${assunto}) do aluno ${alunoNome || titulo || '—'} está pendente e a data já passou.`,
        emailType: 'agenda_coach_overdue',
      };

    default:
      return null;
  }
}

function buildGenericCopy(milestone, titulo) {
  const t = titulo || 'Compromisso';
  switch (milestone) {
    case 'D_MINUS_2':
      return {
        title: 'Agenda: em 2 dias',
        message: `"${t}" está marcado para daqui a 2 dias.`,
        emailType: 'agenda_coach_d_minus_2',
      };
    case 'D_MINUS_1':
      return {
        title: 'Agenda: amanhã',
        message: `"${t}" acontece amanhã.`,
        emailType: 'agenda_coach_d_minus_1',
      };
    case 'D_DAY':
      return {
        title: 'Agenda: hoje',
        message: `"${t}" é hoje.`,
        emailType: 'agenda_coach_d_day',
      };
    case 'OVERDUE_DAILY':
      return {
        title: 'Agenda: atrasado',
        message: `"${t}" está pendente e a data já passou.`,
        emailType: 'agenda_coach_overdue',
      };
    default:
      return null;
  }
}

const MILESTONES = [
  { key: 'D_MINUS_2', daysBefore: 2 },
  { key: 'D_MINUS_1', daysBefore: 1 },
  { key: 'D_DAY', daysBefore: 0 },
];

module.exports = {
  MILESTONES,
  TIPO_LABEL,
  buildCoachAgendaCopy,
};
