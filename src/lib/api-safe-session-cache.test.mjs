/**
 * Cache em memória do useApiSafe deve limpar no logout.
 * Executar: node --test src/lib/api-safe-session-cache.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";
import os from "node:os";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function loadTs(entry) {
  const out = await build({
    entryPoints: [path.join(root, entry)],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    alias: { "@": path.join(root, "src") },
    logLevel: "silent",
  });
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "api-safe-")), "mod.mjs");
  fs.writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}

describe("api-safe-session-cache", () => {
  it("clearApiSafeSessionCaches esvazia o mapa e o throttle", async () => {
    const mod = await loadTs("src/lib/api-safe-session-cache.ts");
    mod.apiSafeNegativeErrorCache.set("/api/alunos", {
      status: 401,
      error: "Token inválido",
    });
    mod.apiSafeLogThrottle.add("x|401|AUTH");
    assert.equal(mod.apiSafeNegativeErrorCache.size, 1);
    mod.clearApiSafeSessionCaches();
    assert.equal(mod.apiSafeNegativeErrorCache.size, 0);
    assert.equal(mod.apiSafeLogThrottle.size, 0);
  });
});
