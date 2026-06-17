const crypto = require('crypto');

const EXERCISE_FIELDS = [
  'nome',
  'series',
  'repeticoes',
  'peso',
  'descanso',
  'observacoes',
  'video_url',
  'ordem',
];

/** @param {unknown} value */
function stableJson(value) {
  return JSON.stringify(value ?? null);
}

/** @param {Record<string, unknown>} ex @param {number} index */
function normalizeExercise(ex, index) {
  const rawSlot = ex.slot_key ?? ex.id ?? null;
  let slotKey = rawSlot != null ? String(rawSlot).trim() : '';
  if (!slotKey || slotKey.length < 8) {
    slotKey = crypto.randomUUID();
  }
  return {
    slot_key: slotKey,
    nome: String(ex.nome ?? ex.name ?? '').trim(),
    series: Number(ex.series ?? ex.sets ?? 3) || 3,
    repeticoes: String(ex.repeticoes ?? ex.reps ?? '12'),
    peso: ex.peso != null ? String(ex.peso) : ex.weight != null ? String(ex.weight) : '',
    descanso: String(ex.descanso ?? ex.rest ?? '60s'),
    observacoes: String(ex.observacoes ?? ex.notes ?? ''),
    video_url:
      ex.video_url != null
        ? String(ex.video_url)
        : ex.videoUrl != null
          ? String(ex.videoUrl)
          : null,
    ordem: Number(ex.ordem ?? ex.order ?? index + 1) || index + 1,
  };
}

/** @param {unknown} raw */
function normalizeExerciseList(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((ex, index) => normalizeExercise(ex, index));
}

/** @param {ReturnType<typeof normalizeExercise>[]} exercises */
function exercisesToApiJson(exercises) {
  return exercises.map((ex) => ({
    slot_key: ex.slot_key,
    id: ex.slot_key,
    nome: ex.nome,
    series: ex.series,
    repeticoes: ex.repeticoes,
    peso: ex.peso,
    descanso: ex.descanso,
    observacoes: ex.observacoes,
    video_url: ex.video_url,
    ordem: ex.ordem,
  }));
}

/** @param {import('pg').Pool} pool @param {string} templateId */
async function ensureTemplateSlotKeys(pool, templateId) {
  const res = await pool.query('SELECT id, exercicios FROM public.treinos WHERE id = $1 LIMIT 1', [
    templateId,
  ]);
  const row = res.rows[0];
  if (!row) return null;

  const normalized = normalizeExerciseList(row.exercicios);
  const needsUpdate = normalized.some((ex, i) => {
    const orig = Array.isArray(row.exercicios) ? row.exercicios[i] : null;
    return !orig?.slot_key;
  });

  if (needsUpdate) {
    await pool.query(
      `UPDATE public.treinos
       SET exercicios = $1::jsonb,
           num_exercicios = $2,
           updated_at = now()
       WHERE id = $3`,
      [JSON.stringify(exercisesToApiJson(normalized)), normalized.length, templateId],
    );
  }

  return normalized;
}

/**
 * @param {ReturnType<typeof normalizeExercise>[]} baseExercises
 * @param {Map<string, Map<string, unknown>>} overrideMap slot_key -> campo -> valor
 * @param {Set<string>} removedSlots
 * @param {Array<{ slot_key: string, ordem: number, dados: Record<string, unknown> }>} added
 */
function mergeEffectiveExercises(baseExercises, overrideMap, removedSlots, added) {
  const result = [];

  for (const base of baseExercises) {
    if (removedSlots.has(base.slot_key)) continue;
    const fieldOverrides = overrideMap.get(base.slot_key);
    const merged = { ...base };
    if (fieldOverrides) {
      for (const [campo, valor] of fieldOverrides.entries()) {
        if (campo === 'ordem') merged.ordem = Number(valor) || merged.ordem;
        else if (campo === 'series') merged.series = Number(valor) || merged.series;
        else if (campo === 'nome') merged.nome = String(valor ?? '');
        else if (campo === 'repeticoes') merged.repeticoes = String(valor ?? '');
        else if (campo === 'peso') merged.peso = String(valor ?? '');
        else if (campo === 'descanso') merged.descanso = String(valor ?? '');
        else if (campo === 'observacoes') merged.observacoes = String(valor ?? '');
        else if (campo === 'video_url') merged.video_url = valor != null ? String(valor) : null;
      }
    }
    result.push(merged);
  }

  for (const item of added) {
    const dados = item.dados && typeof item.dados === 'object' ? item.dados : {};
    result.push(normalizeExercise({ ...dados, slot_key: item.slot_key, ordem: item.ordem }, result.length));
  }

  result.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
  return result;
}

/** @param {import('pg').Pool} pool @param {string} sql @param {unknown[]} params */
async function safeQuery(pool, sql, params = []) {
  try {
    return await pool.query(sql, params);
  } catch (err) {
    if (err.code === '42P01') return { rows: [] };
    throw err;
  }
}

/** @param {import('pg').Pool} pool @param {string} alunoTreinoId */
async function loadOverrideLayers(pool, alunoTreinoId) {
  const [overridesRes, addedRes, removedRes] = await Promise.all([
    safeQuery(
      pool,
      `SELECT slot_key, campo, valor FROM public.atribuicao_overrides WHERE aluno_treino_id = $1`,
      [alunoTreinoId],
    ),
    safeQuery(
      pool,
      `SELECT slot_key, ordem, dados FROM public.atribuicao_exercicios_adicionados
       WHERE aluno_treino_id = $1 ORDER BY ordem ASC`,
      [alunoTreinoId],
    ),
    safeQuery(
      pool,
      `SELECT slot_key FROM public.atribuicao_exercicios_removidos WHERE aluno_treino_id = $1`,
      [alunoTreinoId],
    ),
  ]);

  /** @type {Map<string, Map<string, unknown>>} */
  const overrideMap = new Map();
  for (const row of overridesRes.rows) {
    if (!row.slot_key) continue;
    const slotKey = String(row.slot_key);
    if (!overrideMap.has(slotKey)) overrideMap.set(slotKey, new Map());
    overrideMap.get(slotKey).set(String(row.campo), row.valor);
  }

  const removedSlots = new Set(removedRes.rows.map((r) => String(r.slot_key)));
  const added = addedRes.rows.map((r) => ({
    slot_key: String(r.slot_key),
    ordem: Number(r.ordem) || 1,
    dados: r.dados,
  }));

  return { overrideMap, removedSlots, added };
}

/** @param {import('pg').Pool} pool @param {string} alunoTreinoId */
async function countCustomizations(pool, alunoTreinoId) {
  try {
    const res = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM public.atribuicao_overrides WHERE aluno_treino_id = $1) AS overrides,
         (SELECT COUNT(*)::int FROM public.atribuicao_exercicios_adicionados WHERE aluno_treino_id = $1) AS adicionados,
         (SELECT COUNT(*)::int FROM public.atribuicao_exercicios_removidos WHERE aluno_treino_id = $1) AS removidos`,
      [alunoTreinoId],
    );
    const row = res.rows[0] || { overrides: 0, adicionados: 0, removidos: 0 };
    return Number(row.overrides) + Number(row.adicionados) + Number(row.removidos);
  } catch (err) {
    if (err.code === '42P01') return 0;
    throw err;
  }
}

/** @param {import('pg').Pool} pool @param {string} alunoTreinoId */
async function resolveEffectiveWorkout(pool, alunoTreinoId) {
  const linkRes = await pool.query(
    `SELECT at.id AS aluno_treino_id, at.aluno_id, at.treino_id, at.ativo,
            at.data_inicio, at.data_expiracao, at.data_retorno,
            t.*, t.aluno_id AS treino_aluno_id
     FROM public.alunos_treinos at
     INNER JOIN public.treinos t ON t.id = at.treino_id
     WHERE at.id = $1
     LIMIT 1`,
    [alunoTreinoId],
  );
  const link = linkRes.rows[0];
  if (!link) return null;

  // Cópia legada (pré-migração): devolver registo completo sem merge
  if (link.treino_aluno_id) {
    return {
      ...link,
      id: link.treino_id,
      aluno_treino_id: link.aluno_treino_id,
      template_id: link.template_origem_id || link.treino_id,
      template_versao: link.template_versao ?? 1,
      personalizacoes: 0,
      resolved_from: 'legacy_copy',
      exercicios: Array.isArray(link.exercicios) ? link.exercicios : [],
    };
  }

  const baseExercises = (await ensureTemplateSlotKeys(pool, link.treino_id)) || [];
  const { overrideMap, removedSlots, added } = await loadOverrideLayers(pool, alunoTreinoId);
  const effectiveExercises = mergeEffectiveExercises(baseExercises, overrideMap, removedSlots, added);
  const personalizacoes = await countCustomizations(pool, alunoTreinoId);

  return {
    id: link.treino_id,
    nome: link.nome,
    descricao: link.descricao,
    duracao: link.duracao,
    dificuldade: link.dificuldade,
    categoria: link.categoria,
    num_exercicios: effectiveExercises.length,
    is_template: false,
    tags: link.tags,
    coach_id: link.coach_id,
    aluno_id: link.aluno_id,
    template_origem_id: link.treino_id,
    template_id: link.treino_id,
    template_versao: link.template_versao ?? link.versao ?? 1,
    versao: link.versao ?? 1,
    exercicios: exercisesToApiJson(effectiveExercises),
    aluno_treino_id: link.aluno_treino_id,
    personalizacoes,
    resolved_from: 'template_overrides',
    created_at: link.created_at,
    updated_at: link.updated_at,
  };
}

/** @param {import('pg').Pool} pool @param {string} templateId @param {string} alunoId */
async function findActiveAssignmentForTemplate(pool, templateId, alunoId) {
  const res = await pool.query(
    `SELECT id FROM public.alunos_treinos
     WHERE aluno_id = $1 AND treino_id = $2 AND COALESCE(ativo, true) = true
     ORDER BY created_at DESC NULLS LAST
     LIMIT 1`,
    [alunoId, templateId],
  );
  return res.rows[0]?.id || null;
}

/**
 * Calcula diff entre template base e exercícios desejados; persiste overrides.
 * @param {import('pg').Pool} pool
 * @param {string} alunoTreinoId
 * @param {unknown[]} desiredExercisesRaw
 */
async function savePersonalizationFromExercises(pool, alunoTreinoId, desiredExercisesRaw) {
  const linkRes = await pool.query(
    `SELECT at.id, at.treino_id, t.exercicios, t.aluno_id AS treino_aluno_id
     FROM public.alunos_treinos at
     INNER JOIN public.treinos t ON t.id = at.treino_id
     WHERE at.id = $1
     LIMIT 1`,
    [alunoTreinoId],
  );
  const link = linkRes.rows[0];
  if (!link) {
    const err = new Error('Atribuição não encontrada');
    err.code = 'ATRIBUICAO_NOT_FOUND';
    throw err;
  }

  if (link.treino_aluno_id) {
    const err = new Error('Atribuição legada (cópia); migre antes de usar overrides');
    err.code = 'LEGACY_COPY';
    throw err;
  }

  const baseExercises = (await ensureTemplateSlotKeys(pool, link.treino_id)) || [];
  const baseBySlot = new Map(baseExercises.map((ex) => [ex.slot_key, ex]));
  const desired = normalizeExerciseList(desiredExercisesRaw);

  /** @type {Map<string, ReturnType<typeof normalizeExercise>>} */
  const desiredBySlot = new Map();
  /** @type {ReturnType<typeof normalizeExercise>[]} */
  const desiredAdded = [];

  for (const ex of desired) {
    if (baseBySlot.has(ex.slot_key)) {
      desiredBySlot.set(ex.slot_key, ex);
    } else {
      desiredAdded.push(ex);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`DELETE FROM public.atribuicao_overrides WHERE aluno_treino_id = $1`, [
      alunoTreinoId,
    ]);
    await client.query(`DELETE FROM public.atribuicao_exercicios_adicionados WHERE aluno_treino_id = $1`, [
      alunoTreinoId,
    ]);
    await client.query(`DELETE FROM public.atribuicao_exercicios_removidos WHERE aluno_treino_id = $1`, [
      alunoTreinoId,
    ]);

    for (const base of baseExercises) {
      const wanted = desiredBySlot.get(base.slot_key);
      if (!wanted) {
        await client.query(
          `INSERT INTO public.atribuicao_exercicios_removidos (aluno_treino_id, slot_key)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [alunoTreinoId, base.slot_key],
        );
        continue;
      }

      for (const campo of EXERCISE_FIELDS) {
        const baseVal = base[campo];
        const wantedVal = wanted[campo];
        if (stableJson(baseVal) !== stableJson(wantedVal)) {
          await client.query(
            `INSERT INTO public.atribuicao_overrides (aluno_treino_id, slot_key, campo, valor, updated_at)
             VALUES ($1, $2, $3, $4::jsonb, now())`,
            [alunoTreinoId, base.slot_key, campo, JSON.stringify(wantedVal)],
          );
        }
      }
    }

    for (const ex of desiredAdded) {
      await client.query(
        `INSERT INTO public.atribuicao_exercicios_adicionados (aluno_treino_id, slot_key, ordem, dados)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [alunoTreinoId, ex.slot_key, ex.ordem, JSON.stringify(exercisesToApiJson([ex])[0])],
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return resolveEffectiveWorkout(pool, alunoTreinoId);
}

/** @param {import('pg').Pool} pool @param {string} templateId */
async function getTemplateAssignmentStats(pool, templateId) {
  try {
    const res = await pool.query(
      `SELECT
         at.id,
         at.aluno_id,
         at.ativo,
         at.data_inicio,
         a.nome AS aluno_nome,
         COALESCE(o.cnt, 0) + COALESCE(ad.cnt, 0) + COALESCE(rm.cnt, 0) AS personalizacoes
       FROM public.alunos_treinos at
       INNER JOIN public.alunos a ON a.id = at.aluno_id
       LEFT JOIN (
         SELECT aluno_treino_id, COUNT(*)::int AS cnt
         FROM public.atribuicao_overrides GROUP BY aluno_treino_id
       ) o ON o.aluno_treino_id = at.id
       LEFT JOIN (
         SELECT aluno_treino_id, COUNT(*)::int AS cnt
         FROM public.atribuicao_exercicios_adicionados GROUP BY aluno_treino_id
       ) ad ON ad.aluno_treino_id = at.id
       LEFT JOIN (
         SELECT aluno_treino_id, COUNT(*)::int AS cnt
         FROM public.atribuicao_exercicios_removidos GROUP BY aluno_treino_id
       ) rm ON rm.aluno_treino_id = at.id
       INNER JOIN public.treinos t ON t.id = at.treino_id
       WHERE at.treino_id = $1 AND t.aluno_id IS NULL AND COALESCE(at.ativo, true) = true
       ORDER BY a.nome ASC`,
      [templateId],
    );
    return res.rows.map((row) => ({ ...row, template_versao: null }));
  } catch (err) {
    if (err.code !== '42P01') throw err;
    const res = await pool.query(
      `SELECT at.id, at.aluno_id, at.ativo, at.data_inicio, a.nome AS aluno_nome, 0 AS personalizacoes
       FROM public.alunos_treinos at
       INNER JOIN public.alunos a ON a.id = at.aluno_id
       INNER JOIN public.treinos t ON t.id = at.treino_id
       WHERE at.treino_id = $1 AND t.aluno_id IS NULL AND COALESCE(at.ativo, true) = true
       ORDER BY a.nome ASC`,
      [templateId],
    );
    return res.rows.map((row) => ({ ...row, template_versao: null }));
  }
}

/**
 * Migra uma cópia legada (treinos.aluno_id preenchido) para atribuição por referência.
 * @param {import('pg').Pool} pool
 * @param {string} linkId alunos_treinos.id
 */
async function migrateLegacyCopyToOverrides(pool, linkId) {
  const linkRes = await pool.query(
    `SELECT at.id, at.aluno_id, at.treino_id,
            t.exercicios AS copy_exercicios, t.template_origem_id, t.aluno_id AS copy_aluno_id
     FROM public.alunos_treinos at
     INNER JOIN public.treinos t ON t.id = at.treino_id
     WHERE at.id = $1
     LIMIT 1`,
    [linkId],
  );
  const link = linkRes.rows[0];
  if (!link || !link.copy_aluno_id) return { migrated: false, reason: 'not_a_copy' };

  const templateId = link.template_origem_id || link.treino_id;
  const copyId = link.treino_id;
  const copyExercises = link.copy_exercicios;

  const templateRes = await pool.query('SELECT id, versao FROM public.treinos WHERE id = $1 LIMIT 1', [
    templateId,
  ]);
  const template = templateRes.rows[0];
  if (!template) return { migrated: false, reason: 'template_missing' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    try {
      await client.query(
        `UPDATE public.alunos_treinos
         SET treino_id = $1,
             template_versao = COALESCE(template_versao, $2)
         WHERE id = $3`,
        [templateId, template.versao ?? 1, linkId],
      );
    } catch (err) {
      if (err.code !== '42703') throw err;
      await client.query(`UPDATE public.alunos_treinos SET treino_id = $1 WHERE id = $2`, [
        templateId,
        linkId,
      ]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  try {
    await savePersonalizationFromExercises(pool, linkId, copyExercises);
  } catch (err) {
    if (err.code !== '42P01') throw err;
  }

  await pool.query('DELETE FROM public.treinos WHERE id = $1 AND aluno_id IS NOT NULL', [copyId]);

  return { migrated: true, templateId };
}

/** @param {import('pg').Pool} pool */
async function migrateAllLegacyCopies(pool) {
  const res = await pool.query(
    `SELECT at.id
     FROM public.alunos_treinos at
     INNER JOIN public.treinos t ON t.id = at.treino_id
     WHERE t.aluno_id IS NOT NULL`,
  );
  let migrated = 0;
  let failed = 0;
  for (const row of res.rows) {
    try {
      const result = await migrateLegacyCopyToOverrides(pool, row.id);
      if (result.migrated) migrated += 1;
    } catch {
      failed += 1;
    }
  }
  return { migrated, failed, total: res.rows.length };
}

module.exports = {
  EXERCISE_FIELDS,
  normalizeExercise,
  normalizeExerciseList,
  exercisesToApiJson,
  ensureTemplateSlotKeys,
  resolveEffectiveWorkout,
  findActiveAssignmentForTemplate,
  savePersonalizationFromExercises,
  getTemplateAssignmentStats,
  migrateLegacyCopyToOverrides,
  migrateAllLegacyCopies,
  countCustomizations,
};
