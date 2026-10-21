/**
 * Semana do check-in: segunda 00:00 (horário local do servidor) até domingo.
 */

function startOfCalendarWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekKeyFromDate(date) {
  return startOfCalendarWeek(new Date(date)).toISOString().slice(0, 10);
}

function hasCheckinThisWeek(rows, now = new Date()) {
  const weekStart = startOfCalendarWeek(now);
  return rows.some((c) => {
    if (!c.created_at) return false;
    const created = new Date(c.created_at);
    return !Number.isNaN(created.getTime()) && created >= weekStart;
  });
}

function startOfNextCalendarWeek(date = new Date()) {
  const start = startOfCalendarWeek(date);
  const next = new Date(start);
  next.setDate(next.getDate() + 7);
  return next;
}

module.exports = {
  startOfCalendarWeek,
  weekKeyFromDate,
  hasCheckinThisWeek,
  startOfNextCalendarWeek,
};
