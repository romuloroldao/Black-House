/**
 * Limpeza no logout (LGPD): caches de runtime, IndexedDB e todo dado do usuário em localStorage/sessionStorage.
 * Ficam só preferências do aparelho, sem dado pessoal, e o precache dos arquivos do build.
 */
const KEEP_LOCAL_KEYS = new Set(["bh-theme", "bh-student-nav-mode", "bh-compare-slider-hint-dismissed"]);
const KEEP_PREFIX = "bh-pwa-";
const PRECACHE_PREFIX = "workbox-precache";
const MAX_WAIT_MS = 1500;

function clearStorage(storage: Storage, keep: (key: string) => boolean): void {
  for (let i = storage.length - 1; i >= 0; i--) {
    const key = storage.key(i);
    if (key && !keep(key)) storage.removeItem(key);
  }
}

async function clearRuntimeCaches(): Promise<void> {
  if (!("caches" in window)) return;
  const names = await caches.keys();
  await Promise.all(names.filter((n) => !n.startsWith(PRECACHE_PREFIX)).map((n) => caches.delete(n)));
}

async function clearIndexedDb(): Promise<void> {
  if (!("indexedDB" in window) || typeof indexedDB.databases !== "function") return;
  const dbs = await indexedDB.databases();
  for (const db of dbs) {
    if (db.name && !db.name.startsWith("workbox-")) indexedDB.deleteDatabase(db.name);
  }
}

export async function clearUserDataOnLogout(): Promise<void> {
  try {
    clearStorage(localStorage, (k) => KEEP_LOCAL_KEYS.has(k) || k.startsWith(KEEP_PREFIX));
  } catch {
    /* storage indisponível */
  }
  try {
    clearStorage(sessionStorage, (k) => k.startsWith(KEEP_PREFIX));
  } catch {
    /* storage indisponível */
  }
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, MAX_WAIT_MS));
  await Promise.race([
    Promise.allSettled([clearRuntimeCaches(), clearIndexedDb()]).then(() => undefined),
    timeout,
  ]);
}
