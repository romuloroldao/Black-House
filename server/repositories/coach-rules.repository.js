/**
 * Repository: coach_rules
 */

async function listByCoach(pool, coachId, { activeOnly = true, triggers = null, limit = 40 } = {}) {
  const params = [coachId];
  let sql = `
    SELECT id, coach_id, domain, trigger, priority, title, body, active, source, source_ref,
           created_at, updated_at
    FROM public.coach_rules
    WHERE coach_id = $1`;
  if (activeOnly) sql += ` AND active = true`;
  if (Array.isArray(triggers) && triggers.length > 0) {
    params.push(triggers);
    sql += ` AND trigger = ANY($${params.length}::text[])`;
  }
  params.push(Math.min(100, Math.max(1, Number(limit) || 40)));
  sql += ` ORDER BY priority ASC, created_at ASC LIMIT $${params.length}`;
  const r = await pool.query(sql, params);
  return r.rows;
}

async function getById(pool, id, coachId) {
  const r = await pool.query(
    `SELECT * FROM public.coach_rules WHERE id = $1 AND coach_id = $2 LIMIT 1`,
    [id, coachId],
  );
  return r.rows[0] || null;
}

async function insert(pool, row) {
  const r = await pool.query(
    `INSERT INTO public.coach_rules (
       coach_id, domain, trigger, priority, title, body, active, source, source_ref
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      row.coach_id,
      row.domain,
      row.trigger,
      row.priority ?? 100,
      row.title,
      row.body,
      row.active !== false,
      row.source || 'manual',
      row.source_ref || null,
    ],
  );
  return r.rows[0];
}

async function update(pool, id, coachId, patch) {
  const fields = [];
  const params = [];
  const map = {
    domain: 'domain',
    trigger: 'trigger',
    priority: 'priority',
    title: 'title',
    body: 'body',
    active: 'active',
    source: 'source',
    source_ref: 'source_ref',
  };
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) {
      params.push(patch[k]);
      fields.push(`${col} = $${params.length}`);
    }
  }
  if (!fields.length) return getById(pool, id, coachId);
  fields.push('updated_at = now()');
  params.push(id, coachId);
  const r = await pool.query(
    `UPDATE public.coach_rules
     SET ${fields.join(', ')}
     WHERE id = $${params.length - 1} AND coach_id = $${params.length}
     RETURNING *`,
    params,
  );
  return r.rows[0] || null;
}

async function remove(pool, id, coachId) {
  const r = await pool.query(
    `DELETE FROM public.coach_rules WHERE id = $1 AND coach_id = $2 RETURNING id`,
    [id, coachId],
  );
  return r.rows[0] || null;
}

module.exports = {
  listByCoach,
  getById,
  insert,
  update,
  remove,
};
