/**
 * Dados corporais: peso, altura, histórico e indicadores (TMB Harris-Benedict).
 */

const { parsePesoKg, MIN_KG, MAX_KG } = require('../utils/checkin-peso');

const MIN_ALTURA_CM = 100;
const MAX_ALTURA_CM = 250;
const MIN_AGE = 14;
const MAX_AGE = 100;

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function isValidPhoneBR(raw) {
  const digits = onlyDigits(raw);
  return digits.length >= 10 && digits.length <= 13;
}

function calcAgeFromBirthDate(dataNascimento) {
  if (!dataNascimento) return null;
  const birth = new Date(dataNascimento);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  if (age < MIN_AGE || age > MAX_AGE) return null;
  return age;
}

function getEffectivePesoKg(aluno) {
  if (aluno?.peso_kg != null && aluno.peso_kg !== '') {
    const n = Number(aluno.peso_kg);
    if (Number.isFinite(n) && n >= MIN_KG && n <= MAX_KG) return Math.round(n * 100) / 100;
  }
  if (aluno?.peso != null && aluno.peso !== '') {
    const n = Number(aluno.peso);
    if (Number.isFinite(n) && n >= MIN_KG && n <= MAX_KG) return Math.round(n * 100) / 100;
  }
  return null;
}

function getEffectiveAlturaCm(aluno) {
  const raw = aluno?.altura_cm ?? aluno?.altura;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < MIN_ALTURA_CM || n > MAX_ALTURA_CM) return null;
  return Math.round(n * 100) / 100;
}

function parseAlturaCm(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < MIN_ALTURA_CM || n > MAX_ALTURA_CM) return null;
  return Math.round(n * 100) / 100;
}

function parseSexo(raw) {
  const v = String(raw ?? '').trim().toUpperCase();
  if (v === 'M' || v === 'MASCULINO' || v === 'MALE') return 'M';
  if (v === 'F' || v === 'FEMININO' || v === 'FEMALE') return 'F';
  return null;
}

/**
 * Harris-Benedict (kcal/dia).
 */
function calcTmbKcal({ sexo, pesoKg, alturaCm, idadeAnos }) {
  const w = Number(pesoKg);
  const h = Number(alturaCm);
  const a = Number(idadeAnos);
  if (!sexo || !Number.isFinite(w) || !Number.isFinite(h) || !Number.isFinite(a)) return null;
  let tmb;
  if (sexo === 'F') {
    tmb = 655.1 + 9.563 * w + 1.85 * h - 4.676 * a;
  } else if (sexo === 'M') {
    tmb = 66.5 + 13.75 * w + 5.003 * h - 6.75 * a;
  } else {
    return null;
  }
  return Math.round(tmb);
}

function buildTmbInputs(aluno) {
  const sexo = parseSexo(aluno?.sexo);
  const pesoKg = getEffectivePesoKg(aluno);
  const alturaCm = getEffectiveAlturaCm(aluno);
  const idadeAnos = calcAgeFromBirthDate(aluno?.data_nascimento);
  if (!sexo || pesoKg == null || alturaCm == null || idadeAnos == null) return null;
  return { sexo, pesoKg, alturaCm, idadeAnos };
}

async function recordPesoHistorico(client, { alunoId, pesoKg, origem, origemId, registradoEm }) {
  await client.query(
    `INSERT INTO public.aluno_peso_historico (aluno_id, peso_kg, origem, origem_id, registrado_em)
     VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()))`,
    [alunoId, pesoKg, origem, origemId || null, registradoEm || null],
  );
}

async function upsertTmbIndicator(client, alunoId, alunoRow) {
  const inputs = buildTmbInputs(alunoRow);
  if (!inputs) {
    await client.query(
      `DELETE FROM public.aluno_indicadores_saude WHERE aluno_id = $1 AND codigo = 'tmb_kcal'`,
      [alunoId],
    );
    return null;
  }
  const tmb = calcTmbKcal(inputs);
  await client.query(
    `INSERT INTO public.aluno_indicadores_saude (aluno_id, codigo, valor, unidade, formula, inputs)
     VALUES ($1, 'tmb_kcal', $2, 'kcal/dia', 'harris_benedict', $3::jsonb)
     ON CONFLICT (aluno_id, codigo) DO UPDATE SET
       valor = EXCLUDED.valor,
       inputs = EXCLUDED.inputs,
       calculado_em = now()`,
    [alunoId, tmb, JSON.stringify(inputs)],
  );
  return tmb;
}

async function updateAlunoPeso(client, alunoId, pesoKg, origem, origemId) {
  const parsed = parsePesoKg(pesoKg);
  if (parsed == null) {
    throw Object.assign(new Error(`Peso inválido (${MIN_KG}–${MAX_KG} kg)`), { code: 'INVALID_PESO' });
  }
  await client.query(
    `UPDATE public.alunos SET peso_kg = $1, peso = $2, updated_at = now() WHERE id = $3`,
    [parsed, Math.round(parsed), alunoId],
  );
  await recordPesoHistorico(client, {
    alunoId,
    pesoKg: parsed,
    origem,
    origemId,
  });
  return parsed;
}

async function syncIndicatorsForAluno(client, alunoRow) {
  await upsertTmbIndicator(client, alunoRow.id, alunoRow);
}

async function tableExists(pool, tableName) {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    [tableName],
  );
  return r.rows.length > 0;
}

function buildMetricsFromAlunoRow(aluno, { indicadores = [], pesoHistorico = [] } = {}) {
  const pesoKg = getEffectivePesoKg(aluno);
  const alturaCm = getEffectiveAlturaCm(aluno);
  const idade = calcAgeFromBirthDate(aluno.data_nascimento);
  const sexo = parseSexo(aluno.sexo);
  let tmbKcal = null;
  const tmbRow = indicadores.find((r) => r.codigo === 'tmb_kcal');
  if (tmbRow) {
    tmbKcal = Number(tmbRow.valor);
  } else {
    const inputs = buildTmbInputs(aluno);
    if (inputs) tmbKcal = calcTmbKcal(inputs);
  }

  return {
    peso_kg: pesoKg,
    altura_cm: alturaCm,
    altura_m: alturaCm != null ? Math.round((alturaCm / 100) * 100) / 100 : null,
    idade_anos: idade,
    sexo,
    data_nascimento: aluno.data_nascimento,
    tmb_kcal: tmbKcal,
    tmb_calculado_em: tmbRow?.calculado_em ?? null,
    indicadores,
    peso_historico: pesoHistorico,
  };
}

async function getBodyMetricsForAluno(pool, alunoId) {
  const alunoRes = await pool.query(`SELECT * FROM public.alunos WHERE id = $1 LIMIT 1`, [alunoId]);
  const aluno = alunoRes.rows[0];
  if (!aluno) return null;

  let indicadores = [];
  let pesoHistorico = [];

  if (await tableExists(pool, 'aluno_indicadores_saude')) {
    try {
      const indRes = await pool.query(
        `SELECT codigo, valor, unidade, formula, inputs, calculado_em
         FROM public.aluno_indicadores_saude WHERE aluno_id = $1`,
        [alunoId],
      );
      indicadores = indRes.rows;
    } catch {
      indicadores = [];
    }
  }

  if (await tableExists(pool, 'aluno_peso_historico')) {
    try {
      const histRes = await pool.query(
        `SELECT id, peso_kg, registrado_em, origem, origem_id
         FROM public.aluno_peso_historico
         WHERE aluno_id = $1
         ORDER BY registrado_em DESC
         LIMIT 52`,
        [alunoId],
      );
      pesoHistorico = histRes.rows;
    } catch {
      pesoHistorico = [];
    }
  } else {
    try {
      const wcRes = await pool.query(
        `SELECT id, peso_kg, created_at AS registrado_em
         FROM public.weekly_checkins
         WHERE aluno_id = $1 AND peso_kg IS NOT NULL
         ORDER BY created_at DESC
         LIMIT 52`,
        [alunoId],
      );
      pesoHistorico = wcRes.rows.map((row) => ({
        id: row.id,
        peso_kg: row.peso_kg,
        registrado_em: row.registrado_em,
        origem: 'weekly_checkin',
        origem_id: row.id,
      }));
    } catch {
      pesoHistorico = [];
    }
  }

  return buildMetricsFromAlunoRow(aluno, { indicadores, pesoHistorico });
}

module.exports = {
  MIN_KG,
  MAX_KG,
  MIN_ALTURA_CM,
  MAX_ALTURA_CM,
  isValidPhoneBR,
  calcAgeFromBirthDate,
  getEffectivePesoKg,
  getEffectiveAlturaCm,
  parseAlturaCm,
  parseSexo,
  parsePesoKg,
  calcTmbKcal,
  buildTmbInputs,
  recordPesoHistorico,
  upsertTmbIndicator,
  updateAlunoPeso,
  syncIndicatorsForAluno,
  getBodyMetricsForAluno,
};
