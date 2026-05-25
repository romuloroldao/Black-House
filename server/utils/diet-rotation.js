/** Espelho de src/lib/diet-rotation.ts para o backend Node. */

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

function isRotationEnabled(config) {
  if (!config?.rotacao_ativa) return false;
  const a = Number(config.rotacao_dias_plano_a) || 0;
  const b = Number(config.rotacao_dias_plano_b) || 0;
  return a >= 1 && b >= 1;
}

function buildRotationSequence(config) {
  const diasA = Math.max(0, Number(config.rotacao_dias_plano_a) || 0);
  const diasB = Math.max(0, Number(config.rotacao_dias_plano_b) || 0);
  const inicial = String(config.rotacao_plano_inicial || 'A').toUpperCase() === 'B' ? 'B' : 'A';
  const seq = [];
  if (inicial === 'A') {
    for (let i = 0; i < diasA; i++) seq.push('A');
    for (let i = 0; i < diasB; i++) seq.push('B');
  } else {
    for (let i = 0; i < diasB; i++) seq.push('B');
    for (let i = 0; i < diasA; i++) seq.push('A');
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

  const sequence = buildRotationSequence(config);
  if (sequence.length === 0) return null;

  const anchor =
    parseDateOnly(config.rotacao_data_inicio) ||
    parseDateOnly(config.created_at) ||
    startOfCalendarDay(date);

  const days = diffCalendarDays(anchor, date);
  const idx = ((days % sequence.length) + sequence.length) % sequence.length;
  const block = blockAtIndex(sequence, idx);

  const diasA = Number(config.rotacao_dias_plano_a) || 0;
  const diasB = Number(config.rotacao_dias_plano_b) || 0;

  return {
    plano: block.plano,
    cycle_summary: `${diasA} dia${diasA !== 1 ? 's' : ''} Plano A · ${diasB} dia${diasB !== 1 ? 's' : ''} Plano B`,
    today_label: `Hoje: Plano ${block.plano} (dia ${block.dayInBlock} de ${block.blockLength})`,
    day_in_block: block.dayInBlock,
    block_length: block.blockLength,
    cycle_length: sequence.length,
  };
}

module.exports = {
  isRotationEnabled,
  getRotationForDate,
  getPlanoForToday: (config) => getRotationForDate(config)?.plano ?? null,
};
