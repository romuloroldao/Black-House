/**
 * Verifica se a API responde em /health (Node 18+).
 * Uso: node scripts/verify-api-health.mjs [URL]
 */
const base = process.argv[2] || "http://localhost:3001";
const url = `${base.replace(/\/$/, "")}/health`;

try {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  console.log(`HTTP ${res.status} — ${url}`);
  console.log(JSON.stringify(body, null, 2));
  process.exit(res.ok ? 0 : 1);
} catch (e) {
  console.error("❌ Não foi possível contactar a API:", e.message);
  console.error("   Confirme que o servidor está a correr (cd server && npm start).");
  process.exit(1);
}
