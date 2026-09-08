/** Espelho de src/lib/diet-rotation.ts + diet-plano para o backend Node. */

const {
  civilDateKeyInTimeZone,
  civilDateAtNoonInTimeZone,
  diffCivilDays,
} = require('./zoned-time');

const APP_TIME_ZONE = 'America/Sao_Paulo';
const PLANO_LETTER_RE = /^[A-Z]$/;

function normalizePlanoLetter(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim().toUpperCase();
  if (!PLANO_LETTER_RE.test(s)) return null;
  return s;
}

function parseJsonBlocks(raw) {
  if (!raw) return null;
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const blocks = [];
  for (const entry of arr) {
    const plano = normalizePlanoLetter(entry?.plano);
    const dias = Number(entry?.dias);
    if (!plano || !Number.isFinite(dias) || dias < 1) continue;
    blocks.push({ plano, dias: Math.min(14, Math.floor(dias)) });
  }
  return blocks.length > 0 ? blocks : null;
}

function normalizeRotationBlocks(config) {
  const fromJson = parseJsonBlocks(config?.rotacao_sequencia);
  if (fromJson?.length) return fromJson;

  const a = Number(config?.rotacao_dias_plano_a) || 0;
  const b = Number(config?.rotacao_dias_plano_b) || 0;
  if (a < 1 || b < 1) return [];

  const inicial = String(config?.rotacao_plano_inicial || 'A').toUpperCase() === 'B' ? 'B' : 'A';
  if (inicial === 'B') {
    return [
      { plano: 'B', dias: b },
      { plano: 'A', dias: a },
    ];
  }
  return [
    { plano: 'A', dias: a },
    { plano: 'B', dias: b },
  ];
}

function formatRotationBlocksSummary(blocks) {
  if (!blocks.length) return '';
  return blocks
    .map((b) => `${b.dias} dia${b.dias !== 1 ? 's' : ''} Plano ${b.plano}`)
    .join(' · ');
}

function isRotationEnabled(config) {
  if (!config?.rotacao_ativa) return false;
  return normalizeRotationBlocks(config).length > 0;
}

function buildRotationSequence(config) {
  const blocks = normalizeRotationBlocks(config);
  const seq = [];
  for (const block of blocks) {
    for (let i = 0; i < block.dias; i++) seq.push(block.plano);
  }
  return seq;
}

function blockAtIndex(sequence, index) {
  const plano = sequence[index];
  let start = index;
  while (start > 0 && sequence[start - 1] === plano) start -= 1;
  let end = index;
  while (end < sequence.length - 1 && sequence[end + 1] === plano) end += 1;
  return {
    plano,
    dayInBlock: index - start + 1,
    blockLength: end - start + 1,
  };
}

function resolveRotationAnchor(config, timeZone = APP_TIME_ZONE) {
  if (config.rotacao_data_inicio) {
    const fromStart = civilDateAtNoonInTimeZone(config.rotacao_data_inicio, timeZone);
    if (fromStart) return fromStart;
  }
  if (config.created_at) {
    return civilDateAtNoonInTimeZone(config.created_at, timeZone);
  }
  return null;
}

function getRotationForDate(config, date = new Date(), timeZone = APP_TIME_ZONE) {
  if (!isRotationEnabled(config)) return null;

  const blocks = normalizeRotationBlocks(config);
  const sequence = buildRotationSequence(config);
  if (sequence.length === 0) return null;

  const todayKey = civilDateKeyInTimeZone(date, timeZone);
  const today = civilDateAtNoonInTimeZone(todayKey, timeZone);
  if (!today) return null;

  const anchor = resolveRotationAnchor(config, timeZone) || today;
  const daysRaw = diffCivilDays(anchor, today);
  const beforeStart = daysRaw < 0;
  const days = beforeStart ? 0 : daysRaw;
  const idx = days % sequence.length;
  const block = blockAtIndex(sequence, idx);

  return {
    plano: block.plano,
    cycle_summary: formatRotationBlocksSummary(blocks),
    today_label: beforeStart
      ? `Ciclo inicia em breve · Plano ${block.plano} (pré-início)`
      : `Hoje: Plano ${block.plano} (dia ${block.dayInBlock} de ${block.blockLength})`,
    day_in_block: block.dayInBlock,
    block_length: block.blockLength,
    cycle_length: sequence.length,
    day_index_in_cycle: idx + 1,
    blocks,
    before_start: beforeStart,
  };
}

function inferRotationBlocksFromPlanos(planos, options = {}) {
  const sorted = [...new Set(planos.map(normalizePlanoLetter).filter(Boolean))].sort();
  if (sorted.length < 2) return [];

  if (sorted.length === 2) {
    return [
      { plano: sorted[0], dias: options.diasA ?? 3 },
      { plano: sorted[1], dias: options.diasB ?? 1 },
    ];
  }
  return sorted.map((plano) => ({ plano, dias: 1 }));
}

function rotationBlocksToPayload(ativa, blocks, dataInicio) {
  const clean = blocks
    .map((b) => ({
      plano: normalizePlanoLetter(b.plano),
      dias: Math.min(14, Math.max(1, Math.floor(Number(b.dias) || 0))),
    }))
    .filter((b) => b.plano && b.dias >= 1);

  const blockA = clean.find((b) => b.plano === 'A');
  const blockB = clean.find((b) => b.plano === 'B');

  return {
    rotacao_ativa: ativa && clean.length > 0,
    rotacao_sequencia: ativa && clean.length > 0 ? clean : null,
    rotacao_dias_plano_a: ativa && blockA ? blockA.dias : null,
    rotacao_dias_plano_b: ativa && blockB ? blockB.dias : null,
    rotacao_plano_inicial: clean[0]?.plano ?? 'A',
    rotacao_data_inicio: ativa && dataInicio ? dataInicio : null,
  };
}

module.exports = {
  normalizePlanoLetter,
  normalizeRotationBlocks,
  formatRotationBlocksSummary,
  isRotationEnabled,
  buildRotationSequence,
  resolveRotationAnchor,
  getRotationForDate,
  getPlanoForToday: (config) => getRotationForDate(config)?.plano ?? null,
  inferRotationBlocksFromPlanos,
  rotationBlocksToPayload,
  APP_TIME_ZONE,
};
