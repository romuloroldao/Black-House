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
  const raw = String(key || '').trim();
  const k = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (!k) return 'refeição';
  const numbered = k.match(/refeicao\s*(\d+)/);
  if (numbered) return `Refeição ${numbered[1]}`;
  if (k.includes('cafe') || k.includes('desjejum')) return 'café da manhã';
  if (k.includes('almoco')) return 'almoço';
  if (k.includes('jantar')) return 'jantar';
  if (k.includes('ceia')) return 'ceia';
  if (k.includes('lanche') && k.includes('manha')) return 'lanche da manhã';
  if (k.includes('lanche') && k.includes('tarde')) return 'lanche da tarde';
  if (k.includes('pre') && k.includes('treino')) return 'pré-treino';
  if (k.includes('pos') && k.includes('treino')) return 'pós-treino';
  return raw;
}

function formatItemQty(item) {
  const nome = String(item?.nome || item?.name || 'Alimento').trim();
  const q = item?.quantidade ?? item?.quantity;
  const u = String(item?.unidade || item?.unit || 'g').trim();
  if (q == null || Number.isNaN(Number(q))) return nome;
  const n = Number(q);
  const qty = Number.isInteger(n) ? String(n) : String(n);
  return `${qty} ${u} de ${nome}`;
}

function formatItemsBullets(items, limit = 8) {
  const list = Array.isArray(items) ? items.slice(0, limit) : [];
  if (!list.length) return [];
  return list.map((i) => `• ${formatItemQty(i)}`);
}

function toCardItems(items, limit = 8) {
  return (Array.isArray(items) ? items : []).slice(0, limit).map((i) => ({
    name: String(i.nome || i.name || 'Alimento'),
    quantity:
      i.quantidade != null || i.quantity != null
        ? `${i.quantidade ?? i.quantity} ${i.unidade || i.unit || 'g'}`
        : null,
  }));
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

function cardFromProximaAcao(acao, { items = null } = {}) {
  if (!acao) return null;
  if (acao.type === 'next_meal') {
    const meal = mealLabel(acao.description || acao.payload?.meal_key);
    const bullets = formatItemsBullets(items, 6);
    return {
      id: 'next-meal',
      type: 'meal_preview',
      title: meal,
      body: bullets.length ? bullets.join('\n') : 'Marca como concluída quando terminares',
      items: toCardItems(items),
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
function composeNextAction({ acao, tone = 'normal', items = null }) {
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
      ? 'Sem problema. Vamos ao essencial:\n\n'
      : tone === 'resume'
        ? 'Bem-vindo de volta.\n\n'
        : '';

  if (acao.type === 'next_meal') {
    return composeMeal({ acao, items, prefix });
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

function composeMeal({ acao, items = null, prefix = '' }) {
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
      assistantText: `Aqui está o teu plano de hoje${acao.description ? ` («${acao.description}»)` : ''}. Abre a dieta só se quiseres ver todas as refeições.`,
      cards: [cardFromProximaAcao(acao)].filter(Boolean),
    };
  }

  const meal = mealLabel(acao.description || acao.payload?.meal_key);
  const bullets = formatItemsBullets(items, 8);
  const lines = [`${prefix}A tua próxima refeição é a ${meal} 🍽️`];
  if (bullets.length) {
    lines.push('', ...bullets);
    if (Array.isArray(items) && items.length > 8) {
      lines.push(`• … e mais ${items.length - 8} itens`);
    }
  } else {
    lines.push('', 'Ainda não consegui listar os alimentos desta refeição.');
  }

  return {
    assistantText: lines.join('\n'),
    cards: [cardFromProximaAcao(acao, { items })].filter(Boolean),
  };
}

/** Receita personalizada: plano = verdade; web = inspiração opcional. */
function composeRecipe({
  acao,
  items = null,
  synthesis = null,
  preferences = null,
  searched = false,
  searchFailed = false,
}) {
  const meal = mealLabel(acao?.description || acao?.payload?.meal_key || 'próxima refeição');
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    return {
      assistantText:
        `Queria montar uma receita com a ${meal}, mas não encontrei os ingredientes no plano. Abre a dieta para confirmar os itens.`,
      cards: [
        cardOpenUi('dieta', 'Ver dieta', 'Confirmar ingredientes', 'dieta', {
          meal_key: acao?.payload?.meal_key,
        }),
      ],
    };
  }

  const syn =
    synthesis ||
    (() => {
      const names = list.map((i) => String(i.nome || '').toLowerCase());
      const hasMeat = names.some((n) =>
        /patinho|frango|carne|peito|alcatra|pescado|peixe|ovo|whey|proteina/.test(n),
      );
      const hasCarb = names.some((n) => /arroz|batata|macarrao|pao|aveia|tapioca|feijao/.test(n));
      const hasVeg = names.some((n) =>
        /legume|salada|brocolis|cenoura|abobrinha|alface|tomate/.test(n),
      );
      let dish = `Prato com os ingredientes da ${meal}`;
      if (hasMeat && hasCarb && hasVeg) dish = 'Proteína acebolada com acompanhamento e legumes salteados';
      else if (hasMeat && hasCarb) dish = 'Proteína grelhada com acompanhamento';
      else if (hasMeat) dish = 'Proteína temperada ao ponto';
      return {
        dish,
        technique: 'salteado',
        steps: [
          '1. Separa os ingredientes nas quantidades do teu plano (não aumentes as doses).',
          hasMeat
            ? '2. Tempere a proteína e doure em fogo médio-alto até ficar ao ponto.'
            : '2. Prepara os alimentos principais conforme o teu hábito de cozinha.',
          hasCarb
            ? '3. Cozinha o acompanhamento (arroz/batata/etc.) em paralelo.'
            : '3. Monta o prato com o que tens.',
          hasVeg
            ? '4. Salteia os legumes no fim para ficarem crocantes.'
            : '4. Ajusta temperos (sal, limão, ervas) sem mudar as quantidades.',
          '5. Monta o prato e serve.',
        ],
        spiceNote: null,
        inspirations: [],
        usedWeb: false,
      };
    })();

  const dish = syn.dish;
  const bullets = formatItemsBullets(list, 8);
  const lines = [];

  if (searched && syn.usedWeb) {
    lines.push(
      `Com os ingredientes da tua ${meal}, busquei ideias diferentes e adaptei uma preparação ao teu plano.`,
    );
  } else if (searchFailed) {
    lines.push(
      `Não consegui consultar referências externas agora — montei uma preparação com base no teu plano.`,
    );
  } else {
    lines.push(`Claro! Com os ingredientes da tua ${meal}, podes fazer:`);
  }

  lines.push('', `🍽️ ${dish}`);
  if (preferences?.cuisine) {
    lines.push(`Inspiração: culinária ${preferences.cuisine}.`);
  }
  if (preferences?.quick) {
    lines.push('Foco: preparo rápido.');
  }
  lines.push(
    '',
    'As quantidades continuam a seguir o teu planeamento — só muda a técnica e a apresentação.',
    '',
    'Ingredientes (do teu plano):',
    ...bullets,
    '',
    'Temperos auxiliares ok: sal, alho, ervas, limão, pimenta.',
    'Evita acrescentar queijo, molhos calóricos ou óleo em excesso sem avisar — posso recalcular se quiseres.',
    '',
    'Modo de preparo:',
    ...(syn.steps || []),
  );
  if (syn.spiceNote) {
    lines.push('', syn.spiceNote);
  }
  if (syn.usedWeb) {
    lines.push(
      '',
      'Essa ideia foi inspirada em técnicas culinárias de referências externas e adaptada aos teus itens — não é uma cópia de uma receita da internet.',
    );
  }

  const mealCard = cardFromProximaAcao(acao, { items: list });
  if (mealCard) {
    mealCard.id = 'recipe-meal';
    mealCard.type = 'recipe';
    mealCard.title = dish;
    mealCard.secondary_action = {
      type: 'open_ui',
      name: 'open_ui',
      args: { target: 'dieta', meal_key: acao?.payload?.meal_key },
    };
  }

  const cards = [mealCard].filter(Boolean);
  if (syn.usedWeb && syn.inspirations?.length) {
    cards.push({
      id: 'recipe-refs',
      type: 'references',
      title: 'Referências (inspiração)',
      body: syn.inspirations
        .slice(0, 3)
        .map((r, i) => `${i + 1}. ${r.title || 'Fonte'}`)
        .join('\n'),
      items: syn.inspirations.slice(0, 3).map((r) => ({
        name: r.title || 'Fonte',
        quantity: r.url || null,
      })),
      primary_action: null,
      secondary_action: null,
    });
  }

  return {
    assistantText: lines.join('\n'),
    cards,
    meta: {
      searched: Boolean(searched),
      used_web: Boolean(syn.usedWeb),
      search_failed: Boolean(searchFailed),
      dish,
    },
  };
}

/**
 * Aluno atrasado / refeição falhada — orientar o que falta sem forçar navegação.
 */
function composeReorganizeDay({ acao, items = null }) {
  if (!acao || acao.type === 'idle') {
    return {
      assistantText:
        'Sem problema. Neste momento não há refeição ou treino pendente no plano — podes retomar no próximo marco do dia.',
      cards: [
        cardOpenUi('dieta', 'Ver dieta do dia', 'Rever o plano completo', 'dieta'),
        cardOpenUi('progress', 'Ver evolução', 'Fotos e métricas', 'progress'),
      ],
    };
  }

  if (acao.type === 'next_meal') {
    const meal = mealLabel(acao.description || acao.payload?.meal_key);
    const bullets = formatItemsBullets(items, 6);
    const lines = [
      'Sem problema — vamos reorganizar o restante do dia.',
      '',
      `Prioridade agora: a ${meal}.`,
    ];
    if (bullets.length) {
      lines.push('', ...bullets);
    }
    lines.push(
      '',
      'Se já passou a hora, faz esta refeição assim que puderes e depois retoma a sequência do plano. Não compenses comendo a dobrar.',
    );
    return {
      assistantText: lines.join('\n'),
      cards: [cardFromProximaAcao(acao, { items })].filter(Boolean),
    };
  }

  if (acao.type === 'today_workout') {
    return {
      assistantText: `Sem problema. O essencial agora é o treino «${
        acao.title || 'de hoje'
      }». Se a refeição pré-treino falhou, come algo leve do plano e treina quando puderes — melhor feito do que perfeito.`,
      cards: [cardFromProximaAcao(acao)].filter(Boolean),
    };
  }

  return composeNextAction({ acao, tone: 'late', items });
}

function composeProgressPreview({ insightText }) {
  const lines = [];
  if (insightText) {
    lines.push('A tua evolução recente (resumo):', '', insightText);
  } else {
    lines.push(
      'Ainda há poucos dados para um resumo fino de evolução.',
      'Podes abrir a área de progresso para ver fotos e métricas.',
    );
  }
  return {
    assistantText: lines.join('\n'),
    cards: [
      cardOpenUi('progress', 'Ver evolução completa', 'Fotos e métricas', 'progress'),
      cardOpenUi('progress-photos', 'Comparar fotos', 'Álbum de evolução', 'progress_photos'),
    ],
  };
}

function composeBehavioral({ insightText, proximaAcao, checkinDue, items = null }) {
  const lines = [insightText || 'Ainda há poucos dados de execução nesta semana.'];
  if (proximaAcao?.type === 'next_meal' || proximaAcao?.type === 'today_workout') {
    const mealBit =
      proximaAcao.type === 'next_meal'
        ? mealLabel(proximaAcao.description || proximaAcao.payload?.meal_key)
        : proximaAcao.title || 'próxima acção';
    lines.push('', `Para recuperar ritmo: ${mealBit}.`);
    const bullets = formatItemsBullets(items, 4);
    if (bullets.length) lines.push(...bullets);
  } else if (checkinDue) {
    lines.push('', 'O check-in semanal ainda está em aberto — ajuda o coach a acompanhar-te.');
  }

  const cards = [cardOpenUi('progress', 'Ver evolução completa', 'Fotos e métricas', 'progress')];
  const acaoCard = cardFromProximaAcao(proximaAcao, { items });
  if (acaoCard && proximaAcao?.type !== 'checkin') {
    cards.unshift(acaoCard);
  } else if (checkinDue) {
    cards.push(cardOpenUi('checkin', 'Check-in semanal', 'Quando puderes', 'checkin'));
  }

  return { assistantText: lines.join('\n'), cards };
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
  formatItemQty,
  formatItemsBullets,
  cardOpenUi,
  cardFromProximaAcao,
  composeRestDay,
  composeWorkoutDay,
  composeNextWorkout,
  composeNextAction,
  composeMeal,
  composeRecipe,
  composeReorganizeDay,
  composeProgressPreview,
  composeBehavioral,
  composeRestaurant,
};
