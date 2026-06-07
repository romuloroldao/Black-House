/** Valida peso (kg) para check-in semanal. */

const MIN_KG = 30;
const MAX_KG = 350;

function parsePesoKg(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const normalized = String(raw).trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < MIN_KG || n > MAX_KG) return null;
  return Math.round(n * 100) / 100;
}

module.exports = { parsePesoKg, MIN_KG, MAX_KG };
