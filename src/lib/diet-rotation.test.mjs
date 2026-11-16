/**
 * Rotação de cardápios: o portal (src/lib/diet-rotation.ts) tem de escolher o mesmo plano
 * que o servidor (server/utils/diet-rotation.js) em qualquer dia e fuso do navegador.
 * Executar: node --test src/lib/diet-rotation.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";
import os from "node:os";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const server = require(path.join(root, "server/utils/diet-rotation.js"));

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
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "rot-")), "mod.mjs");
  fs.writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}

const rot = await loadTs("src/lib/diet-rotation.ts");
const cal = await loadTs("src/lib/calendar-date.ts");

const configs = [
  { name: "3A·1B com início", rotacao_ativa: true, rotacao_dias_plano_a: 3, rotacao_dias_plano_b: 1, rotacao_plano_inicial: "A", rotacao_data_inicio: "2026-11-01" },
  { name: "A,B,C 2-1-1 JSON", rotacao_ativa: true, rotacao_sequencia: [{ plano: "A", dias: 2 }, { plano: "B", dias: 1 }, { plano: "C", dias: 1 }], rotacao_data_inicio: "2026-10-20" },
  // created_at às 01:30 UTC = 22:30 do dia anterior em Brasília
  { name: "âncora por created_at perto da meia-noite", rotacao_ativa: true, rotacao_dias_plano_a: 1, rotacao_dias_plano_b: 1, created_at: "2026-11-05T01:30:00.000Z" },
];

describe("calendar-date", () => {
  it("dia civil em Brasília independe do fuso do processo", () => {
    assert.equal(cal.civilDateKey(new Date("2026-11-10T02:30:00Z")), "2026-11-09");
    assert.equal(cal.civilDateKey(new Date("2026-11-10T03:30:00Z")), "2026-11-10");
  });
  it("soma e diferença de dias atravessam mês e ano", () => {
    assert.equal(cal.addDaysToKey("2026-12-31", 1), "2027-01-01");
    assert.equal(cal.addDaysToKey("2026-03-01", -1), "2026-02-28");
    assert.equal(cal.diffDateKeys("2026-11-09", "2026-11-10"), 1);
  });
  it("rótulos relativos", () => {
    assert.equal(cal.relativeDayLabel("2026-11-10", "2026-11-10"), "Hoje");
    assert.equal(cal.relativeDayLabel("2026-11-11", "2026-11-10"), "Amanhã");
    assert.equal(cal.relativeDayLabel("2026-11-09", "2026-11-10"), "Ontem");
  });
  it("rejeita datas inválidas no parâmetro da URL", () => {
    assert.equal(cal.isDateKey("2026-02-30"), false);
    assert.equal(cal.isDateKey("amanha"), false);
    assert.equal(cal.isDateKey("2026-11-10"), true);
  });
});

describe("rotação: portal = servidor", () => {
  for (const config of configs) {
    it(config.name, () => {
      for (let i = -10; i < 120; i++) {
        const key = cal.addDaysToKey("2026-11-01", i);
        // meio-dia em Brasília desse dia (15:00 UTC)
        const instant = new Date(`${key}T15:00:00Z`);
        const fromServer = server.getRotationForDate(config, instant);
        const fromPortal = rot.getRotationForDateKey(config, key);
        assert.equal(fromPortal?.plano, fromServer?.plano, `${config.name} ${key}`);
        assert.equal(Boolean(fromPortal?.beforeStart), Boolean(fromServer?.before_start), `beforeStart ${key}`);
        assert.equal(rot.getRotationForDate(config, instant)?.plano, fromServer?.plano, `getRotationForDate ${key}`);
      }
    });
  }

  it("à noite em Brasília (já outro dia em UTC) continua o plano do dia BRT", () => {
    const config = configs[0];
    // 2026-11-04 23:30 BRT = 2026-11-05 02:30 UTC
    const night = new Date("2026-11-05T02:30:00Z");
    assert.equal(rot.getRotationForDate(config, night)?.plano, rot.getRotationForDateKey(config, "2026-11-04")?.plano);
  });

  it("antes da data de início fica no 1º dia do ciclo (não volta ao fim do ciclo)", () => {
    const info = rot.getRotationForDateKey(configs[0], "2026-10-30");
    assert.equal(info.plano, "A");
    assert.equal(info.dayIndexInCycle, 1);
    assert.equal(info.beforeStart, true);
  });

  it("próximos dias seguem a sequência 3A·1B", () => {
    const planos = Array.from({ length: 8 }, (_, i) =>
      rot.getRotationForDateKey(configs[0], cal.addDaysToKey("2026-11-01", i)).plano,
    ).join("");
    assert.equal(planos, "AAABAAAB");
  });
});
