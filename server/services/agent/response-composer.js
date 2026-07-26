/**
 * Compositor de respostas do Daily Agent.
 * Factos vêm das tools/domínio; aqui só se monta texto operacional + cards.
 * Não inventa plano — só narra o que já foi resolvido.
 */

const { WEEKDAY_NAMES } = require('./temporal');

function capitalize(s) {
  const t = String(s || '');
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function mealLabel(key) {
  const k = String(key || '').toLowerCase();
  if (!k) return 'refeição';
  if (k.includes('cafe') || k.includes('desjejum')) return 'café da manhã';
  if (k.includes('almoco')) return 'almoço';
  if (k.includes('jantar')) return 'jantar';
  if (k.includes('ceia')) return 'ceia';
  if (k.includes('lanche') && k.includes('manha')) return 'lanche da manhã';
  if (k.includes('lanche') && k.includes('tarde')) return 'lanche da tarde';
  if (k.includes('pre') && k.includes('treino')) return 'pré-treino';
  if (k.includes('pos') && k.includes('treino')) return 'pós-treino';
  return key;
}

function formatDayLabel(dayLabel, diaSemanaNome) {
  if (dayLabel && dayLabel !== 'hoje') return dayLabel;
  if (diaSemanaNome) return diaSemanaNome;
  return 'hoje';
}

function cardOpenUi(id, title, body, target, extraArgs = {}) {
  return {
    id,
    title,
    body: body || '',
    primary_action: {
      type: 'open_ui',
      name: 'open_ui',
      args: { target, ...extraArgs },
    },
    secondary_action: null,
  };
}

function cardFromProximaAcao(acao) {
  if (!acao) return null;
  if (acao.type === 'next_meal') {
    return {
      id: 'next-meal',
      title: 'Próxima refeição',
      body: mealLabel(acao.description || acao.payload?.meal_key),
      primary_action: {
        type: 'tool',
        name: 'complete_meal',
        args: {
          dieta_id: acao.payload?.dieta_id,
          meal_key: acao.payload?.meal_key,
          plano: acao.payload?.plano || 'A',
        },
      },
      secondary_action: {
        type: 'open_ui',
        name: 'open_ui',
        args: { target: 'dieta', meal_key: acao.payload?.meal_key },
      },
    };
  }
  if (acao.type === 'today_workout') {
    return {
      id: 'today-workout',
      title: acao.title || 'Treino de hoje',
      body: acao.description || 'Iniciar sessão',
      primary_action: {
        type: 'open_ui',
        name: 'open_ui',
        args: {
          target: 'treino_sessao',
          treino_id: acao.payload?.treino_id,
        },
      },
      secondary_action: {
        type: 'open_ui',
        name: 'open_ui',
        args: { target: 'treino' },
      },
    };
  }
  if (acao.type === 'checkin') {
    return cardOpenUi('checkin', 'Check-in semanal', acao.description || 'Peso, fotos e questionário', 'checkin');
  }
  if (acao.type === 'open_diet') {
    return cardOpenUi('open-diet', acao.title || 'Dieta de hoje', acao.description || '', 'dieta');
  }
  if (acao.type === 'idle') {
    return null;
  }
  if (acao.tab) {
    const target =
      acao.tab === 'diet'
        ? 'dieta'
        : acao.tab === 'workouts'
          ? 'treino'
          : acao.tab === 'checkin'
            ? 'checkin'
            : 'hoje';
    return cardOpenUi(acao.type || 'acao', acao.title || 'Continuar', acao.description || '', target);
  }
  return null;
}

/**
 * Descanso hoje + próximo treino conhecido.
 */
function composeRestDay({ dayPhrase, nextWorkout, proximaAcao }) {
  const day = capitalize(dayPhrase || 'hoje');
  const lines = [`${day} é dia de descanso na tua agenda.`];

  if (nextWorkout?.detalhe?.nome) {
    const when = formatDayLabel(nextWorkout.day_label, nextWorkout.dia_semana_nome);
    lines.push(
      `O teu próximo treino é ${when}: «${nextWorkout.detalhe.nome}».`,
    );
  } else {
    lines.push('Não há outro treino marcado nos próximos dias — confirma a agenda com o coach se precisares.');
  }

  if (proximaAcao?.type === 'next_meal' || proximaAcao?.type === 'open_diet') {
    lines.push(
      `Enquanto isso, a próxima acção do plano é a alimentação${
        proximaAcao.description ? ` (${mealLabel(proximaAcao.description)})` : ''
      }.`,
    );
  } else if (proximaAcao?.type === 'checkin') {
    lines.push('Se quiseres, ainda podes avançar o check-in semanal.');
  } else if (proximaAcao?.type && proximaAcao.type !== 'idle' && proximaAcao.type !== 'today_workout') {
    lines.push(`Agora faz sentido: ${proximaAcao.title || 'seguir o plano'}.`);
  }

  const cards = [];
  if (nextWorkout?.detalhe?.id) {
    cards.push(
      cardOpenUi(
        'next-workout',
        nextWorkout.detalhe.nome,
        `Agendado para ${formatDayLabel(nextWorkout.day_label, nextWorkout.dia_semana_nome)}`,
        'treino',
        { treino_id: nextWorkout.detalhe.id },
      ),
    );
  }
  const acaoCard = cardFromProximaAcao(proximaAcao);
  if (acaoCard && acaoCard.id !== 'today-workout') {
    cards.push(acaoCard);
  }
  if (!cards.length) {
    cards.push(cardOpenUi('open-workouts', 'Ver agenda de treinos', 'Abrir aba de treinos', 'treino'));
  }

  return { assistantText: lines.join(' '), cards };
}

/**
 * Treino encontrado para um dia.
 */
function composeWorkoutDay({ dayPhrase, treino, canStartToday, mode }) {
  const nome = treino?.detalhe?.nome || 'Treino';
  const explicit = dayPhrase && dayPhrase !== 'hoje';
  let assistantText;
  if (mode === 'start_workout' && canStartToday) {
    assistantText = `Vamos ao «${nome}» — série a série, com carga e RPE.`;
  } else if (explicit) {
    assistantText = `Treino de ${dayPhrase}: «${nome}».${
      canStartToday ? ' Podes iniciar a sessão guiada agora.' : ' A sessão guiada só no próprio dia.'
    }`;
  } else {
    assistantText = `O teu treino de hoje é «${nome}».${
      canStartToday ? ' Queres começar a sessão guiada?' : ''
    }`;
  }

  const cards = [
    {
      id: 'workout',
      title: nome,
      body: canStartToday ? 'Iniciar sessão guiada' : `Agendado para ${dayPhrase}`,
      primary_action: {
        type: 'open_ui',
        name: 'open_ui',
        args: {
          target: canStartToday ? 'treino_sessao' : 'treino',
          treino_id: treino?.detalhe?.id,
        },
      },
      secondary_action: canStartToday
        ? { type: 'open_ui', name: 'open_ui', args: { target: 'treino' } }
        : null,
    },
  ];

  return { assistantText, cards };
}

/**
 * Próximo treino na agenda (não necessariamente hoje).
 */
function composeNextWorkout({ nextWorkout, todayRest }) {
  if (!nextWorkout?.detalhe?.nome) {
    return {
      assistantText:
        'Não encontrei um próximo treino na tua agenda semanal. Abre Treinos ou pede ao coach para configurar os dias.',
      cards: [cardOpenUi('open-workouts', 'Ver treinos', 'Abrir agenda / treinos', 'treino')],
    };
  }

  const when = formatDayLabel(nextWorkout.day_label, nextWorkout.dia_semana_nome);
  const nome = nextWorkout.detalhe.nome;
  const isToday = nextWorkout.offset_days === 0;
  const lines = [];

  if (todayRest && !isToday) {
    lines.push(`Hoje é descanso.`);
  }
  lines.push(
    isToday
      ? `O teu próximo treino é hoje: «${nome}».`
      : `O teu próximo treino é ${when}: «${nome}».`,
  );
  if (isToday) {
    lines.push('Podes iniciar a sessão guiada quando quiseres.');
  } else if (nextWorkout.offset_days === 1) {
    lines.push('Amanhã é dia de treinar — prepara-te (água, refeição pré-treino se estiver no plano).');
  }

  const cards = [
    {
      id: 'next-workout',
      title: nome,
      body: isToday ? 'Iniciar agora' : `Em ${when}`,
      primary_action: {
        type: 'open_ui',
        name: 'open_ui',
        args: {
          target: isToday ? 'treino_sessao' : 'treino',
          treino_id: nextWorkout.detalhe.id,
        },
      },
      secondary_action: null,
    },
  ];

  return { assistantText: lines.join(' '), cards };
}

/**
 * Próxima acção / atrasado / voltei.
 */
function composeNextAction({ acao, tone = 'normal' }) {
  if (!acao || acao.type === 'idle') {
    const text =
      tone === 'late'
        ? 'Sem problema. Estás em dia no plano de agora — se quiseres, regista o peso ou vê a evolução.'
        : acao?.description || 'Estás em dia. Podes perguntar pela próxima refeição, treino ou evolução.';
    return {
      assistantText: text,
      cards: [
        cardOpenUi('progress', 'Ver evolução', 'Fotos e métricas', 'progress'),
        cardOpenUi('dieta', 'Ver dieta', 'Plano alimentar de hoje', 'dieta'),
      ],
    };
  }

  const prefix =
    tone === 'late'
      ? 'Sem problema. Vamos ao essencial: '
      : tone === 'resume'
        ? 'Bem-vindo de volta. '
        : '';

  if (acao.type === 'next_meal') {
    const meal = mealLabel(acao.description || acao.payload?.meal_key);
    return {
      assistantText: `${prefix}A tua próxima refeição é o ${meal}. Quando terminares, marca como concluída.`,
      cards: [cardFromProximaAcao(acao)].filter(Boolean),
    };
  }
  if (acao.type === 'today_workout') {
    return {
      assistantText: `${prefix}O foco agora é o treino «${acao.title || 'de hoje'}». ${
        acao.description || 'Podes iniciar a sessão guiada.'
      }`,
      cards: [cardFromProximaAcao(acao)].filter(Boolean),
    };
  }
  if (acao.type === 'checkin') {
    return {
      assistantText: `${prefix}Falta o check-in semanal (peso, fotos e questionário). Não bloqueia refeição nem treino.`,
      cards: [cardFromProximaAcao(acao)].filter(Boolean),
    };
  }
  if (acao.type === 'open_diet') {
    return {
      assistantText: `${prefix}Segue a dieta de hoje${acao.description ? ` («${acao.description}»)` : ''}.`,
      cards: [cardFromProximaAcao(acao)].filter(Boolean),
    };
  }

  return {
    assistantText: `${prefix}${acao.title || 'Próxima acção'}${
      acao.description ? ` — ${acao.description}` : ''
    }.`,
    cards: [cardFromProximaAcao(acao)].filter(Boolean),
  };
}

function composeMeal({ acao }) {
  if (!acao || acao.type === 'idle') {
    return {
      assistantText: 'Não há refeição pendente no plano de agora. Se comeste fora, podes registar com foto.',
      cards: [
        cardOpenUi('meal-photo', 'Refeição livre', 'Tirar foto do prato', 'meal_photo'),
        cardOpenUi('dieta', 'Ver dieta', 'Abrir plano alimentar', 'dieta'),
      ],
    };
  }
  if (acao.type === 'open_diet') {
    return {
      assistantText: `Abre a dieta de hoje${acao.description ? ` («${acao.description}»)` : ''} para ver as refeições e marcar o que já fizeste.`,
      cards: [cardFromProximaAcao(acao)].filter(Boolean),
    };
  }
  const meal = mealLabel(acao.description || acao.payload?.meal_key);
  return {
    assistantText: `A tua próxima refeição é o ${meal}. Conclui quando terminares, ou abre a dieta para ver os alimentos.`,
    cards: [cardFromProximaAcao(acao)].filter(Boolean),
  };
}

function composeBehavioral({ insightText, proximaAcao, checkinDue }) {
  const lines = [insightText || 'Ainda há poucos dados de execução nesta semana.'];
  if (proximaAcao?.type === 'next_meal' || proximaAcao?.type === 'today_workout') {
    lines.push(
      `Para recuperar ritmo: ${proximaAcao.title || 'próxima acção'}${
        proximaAcao.description ? ` (${mealLabel(proximaAcao.description)})` : ''
      }.`,
    );
  } else if (checkinDue) {
    lines.push('O check-in semanal ainda está em aberto — ajuda o coach a acompanhar-te.');
  }

  const cards = [
    cardOpenUi('progress', 'Ver evolução', 'Fotos e métricas', 'progress'),
  ];
  const acaoCard = cardFromProximaAcao(proximaAcao);
  if (acaoCard && proximaAcao?.type !== 'checkin') {
    cards.unshift(acaoCard);
  } else if (checkinDue) {
    cards.push(cardOpenUi('checkin', 'Check-in semanal', 'Quando puderes', 'checkin'));
  }

  return { assistantText: lines.join(' '), cards };
}

function composeRestaurant({ freeMealHint, coachHint }) {
  const lines = [
    'Ok — estás fora do plano. O melhor caminho é registar a refeição livre com uma foto e ajustar os itens antes de guardar.',
  ];
  if (coachHint) lines.push(`Orientação do teu coach:\n${coachHint}`);
  else if (freeMealHint) lines.push(`Orientação do coach: ${freeMealHint}`);

  return {
    assistantText: lines.join('\n\n'),
    cards: [
      cardOpenUi('restaurant', 'Registar refeição livre', 'Câmara / galeria', 'meal_photo'),
      cardOpenUi('dieta', 'Ver dieta', 'Consultar o plano', 'dieta'),
    ],
  };
}

module.exports = {
  mealLabel,
  capitalize,
  cardOpenUi,
  cardFromProximaAcao,
  composeRestDay,
  composeWorkoutDay,
  composeNextWorkout,
  composeNextAction,
  composeMeal,
  composeBehavioral,
  composeRestaurant,
  WEEKDAY_NAMES,
};
