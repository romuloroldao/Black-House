/** Marcadores que o coach usa para «vi o check-in» — não são feedback para o aluno. */
const PLACEHOLDER_EXACT = new Set([
  '!',
  'vi',
  'visto',
  'visto!',
  'visto.',
  'ok',
  'ok!',
  'feito',
  'feito!',
  'recebido',
  'recebido!',
]);

const MIN_MEANINGFUL_LENGTH = 12;

/**
 * @param {unknown} raw
 * @returns {boolean}
 */
function isMeaningfulCoachResposta(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return false;
  const lower = text.toLowerCase();
  if (PLACEHOLDER_EXACT.has(lower)) return false;
  if (text.length < MIN_MEANINGFUL_LENGTH) return false;
  return true;
}

const PLACEHOLDER_SQL_LIST = [...PLACEHOLDER_EXACT]
  .map((p) => `'${String(p).replace(/'/g, "''")}'`)
  .join(', ');

/** Clausula SQL para feedback publicável no portal do aluno. */
function sqlMeaningfulCoachRespostaWhere(columnRef = 'coach_resposta') {
  return `(
    ${columnRef} IS NOT NULL
    AND length(trim(${columnRef})) >= ${MIN_MEANINGFUL_LENGTH}
    AND lower(trim(${columnRef})) NOT IN (${PLACEHOLDER_SQL_LIST})
  )`;
}

module.exports = {
  isMeaningfulCoachResposta,
  sqlMeaningfulCoachRespostaWhere,
  MIN_MEANINGFUL_LENGTH,
  PLACEHOLDER_EXACT,
};
