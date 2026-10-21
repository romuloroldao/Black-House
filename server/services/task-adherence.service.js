/**
 * Métricas de aderência a tarefas (lembretes inteligentes).
 */

async function tableExists(pool) {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'task_adherence_events'`,
  );
  return r.rows.length > 0;
}

async function getAdherenceSummary(pool, alunoId, { days = 90 } = {}) {
  if (!(await tableExists(pool))) {
    return {
      aluno_id: alunoId,
      period_days: days,
      totals: { completed: 0, missed: 0, cancelled: 0 },
      completion_rate: null,
      by_domain: [],
      recent: [],
      available: false,
    };
  }

  const since = new Date();
  since.setDate(since.getDate() - days);

  const summaryRes = await pool.query(
    `SELECT domain::text AS domain,
            outcome,
            COUNT(*)::int AS total
     FROM public.task_adherence_events
     WHERE aluno_id = $1
       AND occurred_at >= $2::timestamptz
     GROUP BY domain, outcome
     ORDER BY domain, outcome`,
    [alunoId, since.toISOString()],
  );

  const recentRes = await pool.query(
    `SELECT domain::text AS domain, outcome, occurred_at, metadata
     FROM public.task_adherence_events
     WHERE aluno_id = $1
     ORDER BY occurred_at DESC
     LIMIT 20`,
    [alunoId],
  );

  const dispatchesRes = await pool.query(
    `SELECT milestone::text AS milestone, status::text AS status, COUNT(*)::int AS total
     FROM public.task_reminder_dispatches
     WHERE aluno_id = $1
       AND created_at >= $2::timestamptz
     GROUP BY milestone, status
     ORDER BY milestone, status`,
    [alunoId, since.toISOString()],
  );

  const totals = { completed: 0, missed: 0, cancelled: 0 };
  const byDomainMap = new Map();

  for (const row of summaryRes.rows) {
    totals[row.outcome] = (totals[row.outcome] || 0) + row.total;
    if (!byDomainMap.has(row.domain)) {
      byDomainMap.set(row.domain, { domain: row.domain, completed: 0, missed: 0, cancelled: 0 });
    }
    const entry = byDomainMap.get(row.domain);
    entry[row.outcome] = row.total;
  }

  const by_domain = [...byDomainMap.values()].map((d) => {
    const denom = (d.completed || 0) + (d.missed || 0);
    return {
      ...d,
      completion_rate: denom > 0 ? Math.round((d.completed / denom) * 100) : null,
    };
  });

  const denom = totals.completed + totals.missed;

  return {
    aluno_id: alunoId,
    period_days: days,
    totals,
    completion_rate: denom > 0 ? Math.round((totals.completed / denom) * 100) : null,
    by_domain,
    reminder_dispatches: dispatchesRes.rows,
    recent: recentRes.rows,
    available: true,
  };
}

module.exports = {
  getAdherenceSummary,
};
