/**
 * Persistência e leitura de metadados de pose em fotos_alunos.
 */
const crypto = require('crypto');
const engine = require('./foto-pose.engine');

const FOTO_POSE_COLUMNS = `
  f.pose_aluno,
  f.pose_vision,
  f.pose_vision_confidence,
  f.pose_vision_reason,
  f.pose_coach,
  f.pose_source,
  f.pose_efetiva,
  f.pose_quality,
  f.pose_analysis_status,
  f.pose_analyzed_at,
  f.content_hash,
  f.pose_analysis_attempts
`;

const FOTO_BASE_COLUMNS = `
  f.id,
  f.aluno_id,
  f.url,
  f.descricao,
  f.weekly_checkin_id,
  f.created_at
`;

async function hasPoseMetadataColumns(pool) {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'fotos_alunos' AND column_name = 'pose_efetiva'
     LIMIT 1`,
  );
  return r.rows.length > 0;
}

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function findCachedByHash(pool, contentHash, excludeId = null) {
  if (!contentHash) return null;
  const params = [contentHash];
  let sql = `
    SELECT id, pose_vision, pose_vision_confidence, pose_vision_reason, pose_quality,
           pose_coach, pose_efetiva, pose_source, content_hash
    FROM public.fotos_alunos
    WHERE content_hash = $1 AND pose_analysis_status = 'classified'`;
  if (excludeId) {
    params.push(excludeId);
    sql += ` AND id <> $2`;
  }
  sql += ` ORDER BY pose_analyzed_at DESC NULLS LAST LIMIT 1`;
  const r = await pool.query(sql, params);
  return r.rows[0] || null;
}

async function applyEffectivePoseUpdate(pool, fotoId, patch) {
  const row = {
    pose_coach: patch.pose_coach,
    pose_vision: patch.pose_vision,
    pose_vision_confidence: patch.pose_vision_confidence,
    pose_vision_reason: patch.pose_vision_reason,
    pose_quality: patch.pose_quality,
    descricao: patch.descricao,
    pose_analysis_status: patch.pose_analysis_status,
  };
  const effective = engine.resolveEffectivePose({
    ...row,
    pose_coach: patch.pose_coach ?? patch.pose_coach,
    pose_vision: patch.pose_vision,
    pose_vision_confidence: patch.pose_vision_confidence,
    pose_analysis_status: patch.pose_analysis_status || 'classified',
  });

  const poseEfetiva = patch.pose_efetiva ?? effective.pose;
  const poseSource = patch.pose_source ?? effective.source;
  const descricao = patch.descricao ?? (engine.isComparablePose(poseEfetiva) ? poseEfetiva : poseEfetiva);

  const r = await pool.query(
    `UPDATE public.fotos_alunos SET
       pose_coach = COALESCE($2, pose_coach),
       pose_vision = COALESCE($3, pose_vision),
       pose_vision_confidence = COALESCE($4, pose_vision_confidence),
       pose_vision_reason = COALESCE($5, pose_vision_reason),
       pose_quality = COALESCE($6::jsonb, pose_quality),
       pose_efetiva = $7,
       pose_source = $8,
       descricao = $9,
       pose_analysis_status = COALESCE($10, pose_analysis_status),
       pose_analyzed_at = COALESCE($11, pose_analyzed_at, now()),
       content_hash = COALESCE($12, content_hash),
       pose_analysis_attempts = COALESCE($13, pose_analysis_attempts)
     WHERE id = $1
     RETURNING *`,
    [
      fotoId,
      patch.pose_coach ?? null,
      patch.pose_vision ?? null,
      patch.pose_vision_confidence ?? null,
      patch.pose_vision_reason ?? null,
      patch.pose_quality ? JSON.stringify(patch.pose_quality) : null,
      poseEfetiva,
      poseSource,
      descricao,
      patch.pose_analysis_status ?? 'classified',
      patch.pose_analyzed_at ?? new Date().toISOString(),
      patch.content_hash ?? null,
      patch.pose_analysis_attempts ?? null,
    ],
  );
  return r.rows[0];
}

async function setCoachPose(pool, fotoId, pose) {
  const normalized = engine.normalizePose(pose);
  if (!engine.ALL_POSES.includes(normalized)) {
    const err = new Error(`pose inválida: ${pose}`);
    err.statusCode = 400;
    throw err;
  }
  return applyEffectivePoseUpdate(pool, fotoId, {
    pose_coach: normalized,
    pose_source: 'coach',
    pose_efetiva: normalized,
    pose_analysis_status: 'classified',
  });
}

async function insertCheckinPhoto(pool, client, { alunoId, url, poseAluno, weeklyCheckinId }) {
  const db = client || pool;
  const hasMeta = await hasPoseMetadataColumns(pool);
  if (!hasMeta) {
    const r = await db.query(
      `INSERT INTO public.fotos_alunos (aluno_id, url, descricao, weekly_checkin_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [alunoId, url, poseAluno || null, weeklyCheckinId],
    );
    return r.rows[0];
  }
  const r = await db.query(
    `INSERT INTO public.fotos_alunos (
       aluno_id, url, descricao, weekly_checkin_id,
       pose_aluno, pose_analysis_status, pose_source, pose_efetiva
     ) VALUES ($1, $2, $3, $4, $5, 'pending', 'unknown', 'desconhecido')
     RETURNING id`,
    [alunoId, url, null, weeklyCheckinId, poseAluno || null],
  );
  return r.rows[0];
}

function buildFotoListSql(includePose) {
  const poseCols = includePose ? `,\n               ${FOTO_POSE_COLUMNS.replace(/\n/g, '\n               ')}` : '';
  return `SELECT
               f.id,
               f.aluno_id,
               a.coach_id,
               f.url,
               f.descricao,
               f.weekly_checkin_id,
               f.created_at,
               wc.created_at AS checkin_created_at,
               wc.peso_kg${poseCols}
             FROM public.fotos_alunos f
             LEFT JOIN public.alunos a ON a.id = f.aluno_id
             LEFT JOIN public.weekly_checkins wc ON wc.id = f.weekly_checkin_id
             WHERE f.aluno_id = $1
             ORDER BY COALESCE(wc.created_at, f.created_at) DESC NULLS LAST, f.created_at ASC NULLS LAST`;
}

module.exports = {
  FOTO_POSE_COLUMNS,
  FOTO_BASE_COLUMNS,
  hasPoseMetadataColumns,
  hashBuffer,
  findCachedByHash,
  applyEffectivePoseUpdate,
  setCoachPose,
  insertCheckinPhoto,
  buildFotoListSql,
};
