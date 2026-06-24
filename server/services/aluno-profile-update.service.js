/**
 * Actualização centralizada do perfil do aluno (dados corporais + indicadores).
 */

const {
  parsePesoKg,
  parseAlturaCm,
  parseSexo,
  updateAlunoPeso,
  syncIndicatorsForAluno,
} = require('./body-metrics.service');
const { refreshProfileState } = require('./profile-completeness.service');

const ALLOWED_FIELDS = new Set([
  'nome',
  'email',
  'telefone',
  'cpf_cnpj',
  'data_nascimento',
  'peso',
  'peso_kg',
  'altura',
  'altura_cm',
  'sexo',
  'objetivo',
  'plano',
  'status',
]);

async function applyAlunoProfileUpdate(pool, aluno, body, { pesoOrigem = 'profile_edit' } = {}) {
  const updateData = { ...body };
  delete updateData.aluno_id;
  delete updateData.user_id;
  delete updateData.coach_id;

  const fields = [];
  const values = [];
  let idx = 1;
  let pesoToRecord = null;

  for (const [key, raw] of Object.entries(updateData)) {
    if (!ALLOWED_FIELDS.has(key) || raw === undefined) continue;

    if (key === 'peso_kg' || key === 'peso') {
      const parsed = parsePesoKg(raw);
      if (parsed == null && raw !== null && raw !== '') {
        throw Object.assign(new Error('Peso inválido'), { code: 'INVALID_PESO', status: 400 });
      }
      if (parsed != null) pesoToRecord = parsed;
      continue;
    }

    if (key === 'altura_cm' || key === 'altura') {
      const parsed = parseAlturaCm(raw);
      if (parsed == null && raw !== null && raw !== '') {
        throw Object.assign(new Error('Altura inválida (100–250 cm)'), {
          code: 'INVALID_ALTURA',
          status: 400,
        });
      }
      fields.push(`altura_cm = $${idx}`, `altura = $${idx + 1}`);
      values.push(parsed, parsed);
      idx += 2;
      continue;
    }

    if (key === 'sexo') {
      const parsed = parseSexo(raw);
      if (!parsed && raw != null && raw !== '') {
        throw Object.assign(new Error('Sexo inválido (M ou F)'), { code: 'INVALID_SEXO', status: 400 });
      }
      fields.push(`sexo = $${idx}`);
      values.push(parsed);
      idx += 1;
      continue;
    }

    fields.push(`${key} = $${idx}`);
    values.push(raw === '' ? null : raw);
    idx += 1;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (fields.length === 0 && pesoToRecord == null) {
      throw Object.assign(new Error('Nenhum campo para atualizar'), { code: 'NO_FIELDS', status: 400 });
    }

    let updatedRow;
    if (fields.length > 0) {
      fields.push('updated_at = now()');
      values.push(aluno.id);
      const q = `UPDATE public.alunos SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
      const result = await client.query(q, values);
      updatedRow = result.rows[0];
    } else {
      const result = await client.query(`SELECT * FROM public.alunos WHERE id = $1`, [aluno.id]);
      updatedRow = result.rows[0];
    }

    if (pesoToRecord != null) {
      const current = Number(updatedRow.peso_kg ?? updatedRow.peso);
      if (!Number.isFinite(current) || Math.abs(current - pesoToRecord) >= 0.01) {
        await updateAlunoPeso(client, aluno.id, pesoToRecord, pesoOrigem, null);
        const r = await client.query(`SELECT * FROM public.alunos WHERE id = $1`, [aluno.id]);
        updatedRow = r.rows[0];
      }
    }

    await syncIndicatorsForAluno(client, updatedRow);
    await client.query('COMMIT');

    const profileStatus = await refreshProfileState(pool, updatedRow);
    return { aluno: updatedRow, profile_status: profileStatus };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { applyAlunoProfileUpdate, ALLOWED_FIELDS };
