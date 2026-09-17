/**
 * Classificação de pose via Vision + normalização em lote.
 */
const logger = require('../utils/logger');
const engine = require('./foto-pose.engine');
const poseResolver = require('./foto-pose-resolver');
const { classifyProgressPhotoPose } = require('./progress-photo-pose.service');
const { resolveImageBufferFromUrl } = require('./progress-photo-pose.service');
const {
  classifyVisionError,
  isRetryableVisionError,
} = require('../utils/pose-vision-errors');

const BATCH_LIMIT = Number(process.env.POSE_JOB_BATCH_SIZE) || 2;
const MAX_ATTEMPTS = Number(process.env.POSE_JOB_MAX_ATTEMPTS) || 5;
const DAILY_CLASSIFY_LIMIT = Number(process.env.POSE_DAILY_CLASSIFY_LIMIT) || 18;
const STALE_PROCESSING_MS = Number(process.env.POSE_JOB_STALE_MS) || 10 * 60 * 1000;

const metrics = {
  classified: 0,
  unknown: 0,
  invalid: 0,
  failed: 0,
  transient_skipped: 0,
  cache_hit: 0,
  coach_override: 0,
};

function getMetrics() {
  return { ...metrics };
}

async function resetStaleProcessing(pool) {
  await pool.query(
    `UPDATE public.fotos_alunos
     SET pose_analysis_status = 'pending'
     WHERE pose_analysis_status = 'processing'
       AND pose_analyzed_at < now() - ($1::text || ' milliseconds')::interval`,
    [String(STALE_PROCESSING_MS)],
  );
}

async function claimPendingPhotos(pool, limit = BATCH_LIMIT) {
  const r = await pool.query(
    `SELECT id, aluno_id, url, descricao, pose_coach, pose_aluno, pose_analysis_attempts, content_hash
     FROM public.fotos_alunos
     WHERE pose_coach IS NULL
       AND (
         pose_analysis_status = 'pending'
         OR (pose_analysis_status = 'failed' AND pose_analysis_attempts < $2)
       )
     ORDER BY created_at ASC
     LIMIT $1
     FOR UPDATE SKIP LOCKED`,
    [limit, MAX_ATTEMPTS],
  );
  return r.rows;
}

async function markProcessing(pool, id) {
  await pool.query(
    `UPDATE public.fotos_alunos
     SET pose_analysis_status = 'processing',
         pose_analysis_attempts = pose_analysis_attempts + 1,
         pose_analyzed_at = now()
     WHERE id = $1`,
    [id],
  );
}

async function revertToPending(pool, id, reason) {
  metrics.transient_skipped += 1;
  await pool.query(
    `UPDATE public.fotos_alunos
     SET pose_analysis_status = 'pending',
         pose_analysis_attempts = GREATEST(0, pose_analysis_attempts - 1),
         pose_vision_reason = $2,
         pose_analyzed_at = now()
     WHERE id = $1`,
    [id, reason ? String(reason).slice(0, 500) : null],
  );
}

async function markFailed(pool, id, reason, errorKind = 'unknown') {
  metrics.failed += 1;
  const prefix = errorKind === 'permanent_config' ? '[config] ' : '';
  await pool.query(
    `UPDATE public.fotos_alunos
     SET pose_analysis_status = 'failed',
         pose_vision_reason = $2,
         pose_analyzed_at = now()
     WHERE id = $1`,
    [id, `${prefix}${reason ? String(reason).slice(0, 480) : ''}`],
  );
}

/**
 * Repõe fotos failed para pending (reprocessamento histórico).
 * @returns {Promise<{ reset: number }>}
 */
async function resetFailedPhotos(pool, { alunoId = null, dryRun = false } = {}) {
  const hasMeta = await poseResolver.hasPoseMetadataColumns(pool);
  if (!hasMeta) return { reset: 0, skipped: true };

  const params = [];
  let where = `pose_analysis_status = 'failed' AND pose_coach IS NULL`;
  if (alunoId) {
    params.push(alunoId);
    where += ` AND aluno_id = $${params.length}`;
  }

  if (dryRun) {
    const count = await pool.query(
      `SELECT COUNT(*)::int AS n FROM public.fotos_alunos WHERE ${where}`,
      params,
    );
    return { reset: count.rows[0]?.n || 0, dry_run: true };
  }

  const result = await pool.query(
    `UPDATE public.fotos_alunos
     SET pose_analysis_status = 'pending',
         pose_analysis_attempts = 0,
         pose_vision_reason = NULL,
         pose_analyzed_at = NULL
     WHERE ${where}`,
    params,
  );
  return { reset: result.rowCount || 0 };
}

async function classifyAndPersistPhoto(pool, row) {
  const hasMeta = await poseResolver.hasPoseMetadataColumns(pool);
  if (!hasMeta) return null;

  const started = Date.now();

  if (row.pose_coach) {
    metrics.coach_override += 1;
    return poseResolver.setCoachPose(pool, row.id, row.pose_coach);
  }

  let buffer;
  try {
    buffer = await resolveImageBufferFromUrl(row.url);
  } catch (err) {
    await markFailed(pool, row.id, err.message, 'permanent');
    return null;
  }

  const contentHash = poseResolver.hashBuffer(buffer);
  const cached = await poseResolver.findCachedByHash(pool, contentHash, row.id);
  if (cached && cached.pose_vision) {
    metrics.cache_hit += 1;
    const patch = engine.buildPoseRecordFromVision(
      {
        pose: cached.pose_vision,
        confidence: cached.pose_vision_confidence,
        reason: cached.pose_vision_reason,
        people_count: cached.pose_quality?.people_count,
        body_visible: cached.pose_quality?.body_visible,
        suitable_for_compare: cached.pose_quality?.suitable_for_compare,
      },
      row,
    );
    return poseResolver.applyEffectivePoseUpdate(pool, row.id, {
      ...patch,
      content_hash: contentHash,
    });
  }

  const existing = await pool.query(
    `SELECT pose_analysis_status, content_hash FROM public.fotos_alunos WHERE id = $1`,
    [row.id],
  );
  if (
    existing.rows[0]?.pose_analysis_status === 'classified' &&
    existing.rows[0]?.content_hash === contentHash
  ) {
    metrics.cache_hit += 1;
    return existing.rows[0];
  }

  let vision;
  try {
    vision = await classifyProgressPhotoPose({ imageBuffer: buffer, url: row.url });
  } catch (err) {
    const kind = classifyVisionError(err);
    logger.warn('pose_classify_error', {
      foto_id: row.id,
      kind,
      error: err.message,
      duration_ms: Date.now() - started,
      model: process.env.AI_VISION_MODEL,
    });
    if (isRetryableVisionError(err)) {
      await revertToPending(pool, row.id, err.message);
      return null;
    }
    await markFailed(pool, row.id, err.message, kind);
    return null;
  }

  const patch = engine.buildPoseRecordFromVision(vision, row);
  const saved = await poseResolver.applyEffectivePoseUpdate(pool, row.id, {
    ...patch,
    content_hash: contentHash,
  });

  const pose = engine.normalizePose(saved?.pose_efetiva);
  if (pose === 'invalido') metrics.invalid += 1;
  else if (pose === 'desconhecido') metrics.unknown += 1;
  else metrics.classified += 1;

  logger.info('pose_normalized', {
    foto_id: row.id,
    pose_efetiva: saved?.pose_efetiva,
    pose_source: saved?.pose_source,
    confidence: saved?.pose_vision_confidence,
    cache_hit: false,
    duration_ms: Date.now() - started,
  });

  return saved;
}

async function getTodayClassifiedCount(pool) {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n
     FROM public.fotos_alunos
     WHERE pose_analyzed_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
       AND pose_analysis_status = 'classified'
       AND pose_source = 'vision'`,
  );
  return r.rows[0]?.n || 0;
}

async function processBatch(pool) {
  const hasMeta = await poseResolver.hasPoseMetadataColumns(pool);
  if (!hasMeta) return { processed: 0, skipped: true };

  const todayCount = await getTodayClassifiedCount(pool);
  if (todayCount >= DAILY_CLASSIFY_LIMIT) {
    logger.info('pose_batch_skipped_daily_limit', {
      todayCount,
      limit: DAILY_CLASSIFY_LIMIT,
    });
    return { processed: 0, total: 0, skipped_daily_limit: true };
  }

  const batchCap = Math.max(0, Math.min(BATCH_LIMIT, DAILY_CLASSIFY_LIMIT - todayCount));
  if (batchCap === 0) {
    return { processed: 0, total: 0, skipped_daily_limit: true };
  }

  await resetStaleProcessing(pool);
  const rows = await claimPendingPhotos(pool, batchCap);
  let processed = 0;
  let transient = 0;
  for (const row of rows) {
    await markProcessing(pool, row.id);
    const beforeStatus = row.pose_analysis_status;
    const result = await classifyAndPersistPhoto(pool, row);
    if (result) {
      processed += 1;
    } else {
      const check = await pool.query(
        `SELECT pose_analysis_status FROM public.fotos_alunos WHERE id = $1`,
        [row.id],
      );
      if (
        check.rows[0]?.pose_analysis_status === 'pending' &&
        beforeStatus !== 'pending'
      ) {
        transient += 1;
      }
    }
  }

  if (processed > 0 || transient > 0) {
    logger.info('pose_batch_complete', {
      processed,
      total: rows.length,
      transient_deferred: transient,
      metrics: getMetrics(),
    });
  }

  return { processed, total: rows.length, transient_deferred: transient };
}

async function getInventory(pool) {
  const hasMeta = await poseResolver.hasPoseMetadataColumns(pool);
  if (!hasMeta) {
    const total = await pool.query(`SELECT COUNT(*)::int AS n FROM public.fotos_alunos`);
    return { total: total.rows[0]?.n || 0, metadata_ready: false };
  }
  const r = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE pose_analysis_status = 'pending')::int AS pending,
       COUNT(*) FILTER (WHERE pose_analysis_status = 'classified')::int AS classified,
       COUNT(*) FILTER (WHERE pose_analysis_status = 'failed')::int AS failed,
       COUNT(*) FILTER (WHERE pose_analysis_status = 'processing')::int AS processing,
       COUNT(*) FILTER (WHERE pose_efetiva = 'desconhecido')::int AS unknown,
       COUNT(*) FILTER (WHERE pose_efetiva = 'invalido')::int AS invalid,
       COUNT(*) FILTER (WHERE pose_coach IS NOT NULL)::int AS coach_corrected
     FROM public.fotos_alunos`,
  );
  return { ...r.rows[0], metadata_ready: true };
}

module.exports = {
  processBatch,
  classifyAndPersistPhoto,
  getInventory,
  getMetrics,
  resetFailedPhotos,
  BATCH_LIMIT,
  MAX_ATTEMPTS,
};
