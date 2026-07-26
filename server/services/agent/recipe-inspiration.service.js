/**
 * Receitas personalizadas: plano Black House = verdade; web = inspiração.
 *
 * Hierarquia: Sistema → Black House → Plano → Contexto → Web
 */

const { sanitizeExternalText } = require('../web-search.service');

const CUISINE_PATTERNS = [
  { id: 'japonesa', re: /japon(e|ê)s|donburi|teriyaki|asian\s*fusion|wasabi/i, query: 'japanese' },
  { id: 'mexicana', re: /mexic|taco|burrito|latin/i, query: 'mexican' },
  { id: 'tailandesa', re: /tailand|thai|pad\s*thai/i, query: 'thai' },
  { id: 'italiana', re: /italian|italiano|mediterr[aâ]n/i, query: 'italian' },
  { id: 'brasileira', re: /brasil|brasileir|caseir/i, query: 'brazilian' },
  { id: 'indiana', re: /indian|curry|masala/i, query: 'indian' },
  { id: 'mediterranea', re: /mediterr[aâ]n/i, query: 'mediterranean' },
];

const IMPACT_INGREDIENTS_RE =
  /queijo|manteiga|óleo|oleo|bacon|creme\s+de\s+leite|açúcar|acucar|molho\s+branco|maionese|chocolate|vinho/i;

/**
 * Decide se a mensagem justifica pesquisa web.
 */
function shouldSearchWebForRecipe(text) {
  const t = String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

  // Pedidos criativos / culinária / preferências ricas
  if (
    /diferente|criativ|inspirad|culinaria|restaurante|sofisticad|gourmet|nova\s+forma|outra\s+forma|gostos[ao]|delicios|interessante|apimentad|ex[oó]tic/.test(
      t,
    )
  ) {
    return true;
  }
  if (CUISINE_PATTERNS.some((c) => c.re.test(t))) return true;
  if (/rapido|15\s*min|20\s*min|pouca\s+louca|one\s*pan|air\s*fryer/.test(t)) return true;

  // "Me dê uma receita" genérica → pesquisa leve para evitar respostas óbvias
  if (/receita/.test(t) && !/substitu|trocar|quantas?\s+gramas|proxima\s+refeicao/.test(t)) {
    return true;
  }
  return false;
}

/**
 * Extrai preferências do texto do aluno.
 */
function parseRecipePreferences(text) {
  const t = String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

  const cuisine = CUISINE_PATTERNS.find((c) => c.re.test(t));
  return {
    cuisine: cuisine?.id || null,
    cuisineQuery: cuisine?.query || null,
    quick: /rapido|15\s*min|20\s*min|pouco\s+tempo/.test(t),
    fancy: /sofisticad|restaurante|gourmet/.test(t),
    spicy: /apimentad|picante|chili/.test(t),
    creative: /diferente|criativ|nova\s+forma|outra\s+forma|interessante/.test(t),
    lowDishes: /pouca\s+louca|uma\s+panela|one\s*pan/.test(t),
    tasty: /gostos[ao]|delicios|saboros/.test(t),
  };
}

function ingredientTokens(items) {
  return (Array.isArray(items) ? items : [])
    .map((i) =>
      String(i.nome || i.name || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 6);
}

/**
 * Query contextual — nunca "receitas gostosas" genérico.
 */
function buildRecipeSearchQuery({ items, preferences, language = 'pt' }) {
  const tokens = ingredientTokens(items);
  const prefs = preferences || {};
  const parts = [];

  if (language === 'en' || prefs.cuisineQuery) {
    parts.push('recipe');
    if (prefs.cuisineQuery) parts.push(prefs.cuisineQuery);
    if (prefs.quick) parts.push('quick 15 minute');
    if (prefs.fancy) parts.push('restaurant style');
    if (prefs.spicy) parts.push('spicy');
    parts.push(...tokens.slice(0, 4).map((n) => n.split(/\s+/)[0]));
    if (!tokens.length) parts.push('lean protein rice vegetables');
  } else {
    parts.push('receita');
    if (prefs.cuisine) parts.push(prefs.cuisine);
    if (prefs.quick) parts.push('rápida');
    if (prefs.creative || prefs.tasty) parts.push('criativa');
    if (prefs.fancy) parts.push('restaurante');
    if (prefs.spicy) parts.push('apimentada');
    parts.push(...tokens.slice(0, 4).map((n) => n.split(/\s+/)[0]));
    if (!tokens.length) parts.push('frango arroz legumes');
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 180);
}

/**
 * Ranking: relevância + compatibilidade com ingredientes do plano.
 */
function rankInspirationResults(results, { items, preferences }) {
  const tokens = ingredientTokens(items);
  const prefs = preferences || {};

  return (Array.isArray(results) ? results : [])
    .map((r) => {
      const blob = `${r.title || ''} ${r.snippet || ''}`.toLowerCase();
      let score = 40;
      for (const tok of tokens) {
        const head = tok.split(/\s+/)[0];
        if (head && blob.includes(head)) score += 18;
      }
      if (prefs.cuisineQuery && blob.includes(prefs.cuisineQuery)) score += 15;
      if (prefs.quick && /(quick|rápid|rapido|15|minute|minuto)/i.test(blob)) score += 10;
      if (prefs.spicy && /(spicy|piment|chili)/i.test(blob)) score += 8;
      if (IMPACT_INGREDIENTS_RE.test(blob)) score -= 12;
      // Prompt injection residual (já sanitizado) — penalizar
      if (/conteúdo externo omitido/i.test(blob)) score -= 30;
      return {
        ...r,
        title: sanitizeExternalText(r.title, 120),
        snippet: sanitizeExternalText(r.snippet, 280),
        score,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Sintetiza título + técnica a partir das ideias (sem copiar receita).
 */
function synthesizeFromInspiration({ items, preferences, ranked }) {
  const top = (ranked || []).filter((r) => r.score >= 50).slice(0, 3);
  const names = ingredientTokens(items);
  const hasMeat = names.some((n) =>
    /patinho|frango|carne|peito|alcatra|pescado|peixe|ovo|proteina/.test(n),
  );
  const hasCarb = names.some((n) => /arroz|batata|macarrao|pao|aveia|tapioca|feijao/.test(n));
  const hasVeg = names.some((n) =>
    /legume|salada|brocolis|cenoura|abobrinha|alface|tomate|couve/.test(n),
  );
  const prefs = preferences || {};

  let technique = 'salteado';
  let dish = null;
  const blob = top.map((t) => `${t.title} ${t.snippet}`).join(' ').toLowerCase();

  if (/bowl|donburi|poke/.test(blob) || prefs.cuisine === 'japonesa') {
    technique = 'bowl / montagem';
    dish = hasMeat
      ? `Bowl de ${proteinLabel(names)} inspirado no donburi`
      : 'Bowl montado com os ingredientes do plano';
  } else if (/stir[\s-]?fry|wok|salte/.test(blob)) {
    technique = 'salteado rápido';
    dish = hasMeat
      ? `${proteinLabel(names)} salteado com legumes`
      : 'Salteado dos ingredientes do plano';
  } else if (/grill|grelh|churrasc/.test(blob)) {
    technique = 'grelhado';
    dish = hasMeat ? `${proteinLabel(names)} grelhado` : 'Grelhados do plano';
  } else if (/roast|forno|assad/.test(blob)) {
    technique = 'assado';
    dish = hasMeat ? `${proteinLabel(names)} assado` : 'Assado dos ingredientes do plano';
  } else if (prefs.cuisine === 'mexicana') {
    technique = 'estilo mexicano (temperos)';
    dish = hasMeat
      ? `${proteinLabel(names)} temperado estilo mexicano com acompanhamento`
      : 'Prato temperado estilo mexicano';
  } else if (prefs.cuisine === 'tailandesa') {
    technique = 'inspiração tailandesa (limão, ervas)';
    dish = hasMeat
      ? `${proteinLabel(names)} com toque tailandês`
      : 'Prato com toque tailandês';
  } else if (prefs.quick) {
    technique = 'rápido em uma panela';
    dish = hasMeat
      ? `${proteinLabel(names)} rápido com acompanhamento`
      : 'Prato rápido do plano';
  }

  if (!dish) {
    if (hasMeat && hasCarb && hasVeg) {
      dish = prefs.fancy
        ? `${proteinLabel(names)} selado com arroz e legumes crocantes`
        : `${proteinLabel(names)} acebolado com arroz e legumes salteados`;
    } else if (hasMeat && hasCarb) {
      dish = `${proteinLabel(names)} com acompanhamento do plano`;
    } else {
      dish = 'Preparação criativa com os ingredientes do teu plano';
    }
    technique = technique || 'salteado';
  }

  if (hasCarb && /crocante|crispy|tostad/.test(blob)) {
    dish = dish.replace(/com arroz/, 'com arroz crocante');
  }

  const spiceNote = prefs.spicy
    ? 'Usa pimenta ou chili a gosto — tempero auxiliar, sem mudar as quantidades do plano.'
    : null;

  const steps = buildSteps({ hasMeat, hasCarb, hasVeg, technique, prefs });

  return {
    dish,
    technique,
    steps,
    spiceNote,
    inspirations: top.map((r) => ({
      title: r.title,
      url: r.url || null,
      score: r.score,
    })),
    usedWeb: top.length > 0,
  };
}

function proteinLabel(names) {
  for (const n of names) {
    if (/patinho/.test(n)) return 'Patinho';
    if (/frango|peito/.test(n)) return 'Frango';
    if (/alcatra|carne/.test(n)) return 'Carne';
    if (/peixe|pescado|salmao|tilapia/.test(n)) return 'Peixe';
    if (/ovo/.test(n)) return 'Ovos';
  }
  return 'Proteína';
}

function buildSteps({ hasMeat, hasCarb, hasVeg, technique, prefs }) {
  const steps = [
    '1. Separa exactamente as quantidades do teu plano (não aumentes as doses).',
  ];
  if (hasMeat) {
    steps.push(
      `2. Tempere a proteína (sal, alho, ervas${prefs.spicy ? ', pimenta' : ''}) e prepare em técnica ${technique}.`,
    );
  } else {
    steps.push(`2. Prepare os ingredientes principais com técnica ${technique}.`);
  }
  if (hasCarb) {
    steps.push(
      prefs.quick
        ? '3. Aquece o carboidrato do plano em paralelo (micro-ondas ou panela) para ganhar tempo.'
        : '3. Cozinha o carboidrato do plano; se quiseres textura, tosta ligeiramente no fim.',
    );
  } else {
    steps.push('3. Mantém o foco nos itens do plano — evita acrescentar bases calóricas.');
  }
  if (hasVeg) {
    steps.push('4. Salteia os legumes no fim para ficarem crocantes (óleo mínimo ou antiaderente).');
  } else {
    steps.push('4. Ajusta temperos auxiliares (sal, limão, ervas) sem alterar o plano.');
  }
  steps.push(
    '5. Monta o prato. Temperos básicos (sal, alho, ervas) são auxiliares; queijo/molhos calóricos só se quiseres recalcular.',
  );
  return steps;
}

/**
 * Fallback local sem web (mantém quantidades).
 */
function synthesizeLocal({ items, preferences }) {
  return synthesizeFromInspiration({ items, preferences, ranked: [] });
}

module.exports = {
  shouldSearchWebForRecipe,
  parseRecipePreferences,
  buildRecipeSearchQuery,
  rankInspirationResults,
  synthesizeFromInspiration,
  synthesizeLocal,
  IMPACT_INGREDIENTS_RE,
};
