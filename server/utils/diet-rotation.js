/** Espelho de src/lib/diet-rotation.ts + diet-plano para o backend Node. */

const PLANO_LETTER_RE = /^[A-Z]$/;

function normalizePlanoLetter(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim().toUpperCase();
  if (!PLANO_LETTER_RE.test(s)) return null;
  return s;
}

function parseDateOnly(value) {
  if (!value) return null;
  const iso = String(value).slice(0, 10);
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfCalendarDay(date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

function diffCalendarDays(from, to) {
  const a = startOfCalendarDay(from).getTime();
  const b = startOfCalendarDay(to).getTime();
  return Math.round((b - a) / 86400000);
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

function getRotationForDate(config, date = new Date()) {
  if (!isRotationEnabled(config)) return null;

  const blocks = normalizeRotationBlocks(config);
  const sequence = buildRotationSequence(config);
  if (sequence.length === 0) return null;

  const anchor =
    parseDateOnly(config.rotacao_data_inicio) ||
    parseDateOnly(config.created_at) ||
    startOfCalendarDay(date);

  const days = diffCalendarDays(anchor, date);
  const idx = ((days % sequence.length) + sequence.length) % sequence.length;
  const block = blockAtIndex(sequence, idx);

  return {
    plano: block.plano,
    cycle_summary: formatRotationBlocksSummary(blocks),
    today_label: `Hoje: Plano ${block.plano} (dia ${block.dayInBlock} de ${block.blockLength})`,
    day_in_block: block.dayInBlock,
    block_length: block.blockLength,
    cycle_length: sequence.length,
    blocks,
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
  getRotationForDate,
  getPlanoForToday: (config) => getRotationForDate(config)?.plano ?? null,
  inferRotationBlocksFromPlanos,
  rotationBlocksToPayload,
};
