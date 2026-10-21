/**
 * Nutrition Replacement Intelligence — helpers (parse NL + match itens do plano).
 * Usado pelo fast path `substitution` do Daily Agent.
 */

function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrai origem/destino da mensagem do aluno.
 * @returns {{ origins: string[], destination: string|null, multi: boolean }}
 */
function parseSubstitutionRequest(text) {
  const raw = String(text || '').trim();
  const t = normalizeText(raw);

  let destination = null;
  let origins = [];

  const swap =
    t.match(
      /(?:trocar|substituir|substitua|troque)\s+(?:o\s+|a\s+|os\s+|as\s+)?(.+?)\s+por\s+(?:o\s+|a\s+|os\s+|as\s+)?(.+)$/,
    ) ||
    t.match(
      /(?:quero|gostaria\s+de)\s+(?:trocar|substituir)\s+(?:o\s+|a\s+)?(.+?)\s+por\s+(?:o\s+|a\s+)?(.+)$/,
    );

  if (swap) {
    origins = splitFoodList(swap[1]);
    destination = cleanFoodToken(swap[2]);
  } else {
    const noHave =
      t.match(/nao\s+tenho\s+(?:mais\s+)?(.+)$/) ||
      t.match(/sem\s+(.+)$/) ||
      t.match(/acabou\s+(?:o\s+|a\s+)?(.+)$/) ||
      t.match(/nao\s+quero\s+(?:comer\s+)?(.+)$/) ||
      t.match(/nao\s+quero\s+(?:o\s+|a\s+)?(.+)\s+hoje/);
    if (noHave) {
      origins = splitFoodList(noHave[1]);
    } else {
      const onlyDest =
        t.match(
          /substituir\s+(?:minha\s+)?(?:refeicao|almoco|jantar|cafe).*?\s+por\s+(.+)$/,
        ) || t.match(/quero\s+(.+)\s+em\s+vez\s+(?:do|da|de)\s+(.+)$/);
      if (onlyDest && onlyDest[2]) {
        destination = cleanFoodToken(onlyDest[1]);
        origins = splitFoodList(onlyDest[2]);
      } else if (onlyDest) {
        destination = cleanFoodToken(onlyDest[1]);
      }
    }
  }

  origins = origins.filter(Boolean).slice(0, 4);
  return {
    origins,
    destination: destination || null,
    multi: origins.length > 1,
    rawNormalized: t,
  };
}

function cleanFoodToken(s) {
  return normalizeText(s)
    .replace(
      /^(o|a|os|as|um|uma|meu|minha|do|da|de|hoje|agora|na\s+refeicao|no\s+almoco|no\s+jantar)\s+/g,
      '',
    )
    .replace(
      /\s+(hoje|agora|na\s+refeicao|do\s+plano|da\s+dieta|em\s+casa)$/g,
      '',
    )
    .trim();
}

function splitFoodList(s) {
  const cleaned = cleanFoodToken(s);
  if (!cleaned) return [];
  return cleaned
    .split(/\s+(?:e|com|,|\/)\s+/)
    .map(cleanFoodToken)
    .filter((x) => x.length >= 2);
}

/**
 * Match fuzzy: token do pedido vs nome do alimento no plano.
 */
function scoreFoodMatch(query, foodName) {
  const q = normalizeText(query);
  const n = normalizeText(foodName);
  if (!q || !n) return 0;
  if (n === q) return 100;
  if (n.includes(q)) return 80 + Math.min(15, q.length);
  if (q.includes(n) && n.length >= 3) return 70;
  const qParts = q.split(' ').filter((p) => p.length > 2);
  const hits = qParts.filter((p) => n.includes(p)).length;
  if (hits && hits === qParts.length) return 60;
  if (hits) return 40 + hits * 5;
  return 0;
}

function matchItemsInMeal(origins, items) {
  if (!Array.isArray(items) || !items.length) return [];
  if (!origins.length) return [];

  const matched = [];
  for (const origin of origins) {
    let best = null;
    let bestScore = 0;
    for (const item of items) {
      const score = Math.max(
        scoreFoodMatch(origin, item.nome || item.alimento_nome || ''),
        scoreFoodMatch(origin, item.nome_original || ''),
      );
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }
    if (best && bestScore >= 40) {
      if (!matched.some((m) => m.id === best.id)) {
        matched.push({ ...best, match_query: origin, match_score: bestScore });
      }
    }
  }
  return matched;
}

/**
 * Extrai letra de plano do label de refeição (espelho leve do frontend).
 */
function parsePlanoFromRefeicao(refeicao) {
  const s = String(refeicao || '');
  const m =
    s.match(/[-–]\s*plano\s*([a-z])\s*$/i) ||
    s.match(/\bplano\s*([a-z])\b/i) ||
    s.match(/\(([a-z])\)\s*$/i);
  if (m) return String(m[1]).toUpperCase();
  return null;
}

function itemMatchesPlano(refeicao, plano) {
  const want = String(plano || 'A').toUpperCase();
  const itemPlano = parsePlanoFromRefeicao(refeicao);
  if (!itemPlano) return true; // item sem plano = todos os dias
  return itemPlano === want;
}

module.exports = {
  normalizeText,
  parseSubstitutionRequest,
  matchItemsInMeal,
  scoreFoodMatch,
  parsePlanoFromRefeicao,
  itemMatchesPlano,
  cleanFoodToken,
  splitFoodList,
};
