/**
 * Lista completa de substituição: agrupamento por categorias do profissional e busca.
 * Executar: node --test src/lib/food-categories.test.mjs
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
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cats-")), "mod.mjs");
  fs.writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}

const m = await loadTs("src/lib/food-categories.ts");

const foods = ["Arroz branco", "Batata-doce", "Pão francês", "Aveia em flocos", "Mandioca"].map((nome, i) => ({
  id: `f${i}`,
  nome,
}));
const cats = [
  { id: "c2", nome: "Pães", ordem: 1, alimento_ids: ["f2"] },
  { id: "c1", nome: "Tubérculos", ordem: 0, alimento_ids: ["f1", "f4", "ghost"] },
];

describe("groupByCategory", () => {
  it("respeita a ordem do profissional, põe 'Sem categoria' no fim e não duplica", () => {
    const sections = m.groupByCategory(foods, (f) => f.id, cats);
    assert.deepEqual(
      sections.map((s) => [s.nome, s.items.map((f) => f.id)]),
      [
        ["Tubérculos", ["f1", "f4"]],
        ["Pães", ["f2"]],
        ["Sem categoria", ["f0", "f3"]],
      ],
    );
    const total = sections.reduce((n, s) => n + s.items.length, 0);
    assert.equal(total, foods.length);
  });

  it("omite secções vazias, exceto com keepEmpty (gestão)", () => {
    const only = m.groupByCategory([foods[0]], (f) => f.id, cats);
    assert.deepEqual(only.map((s) => s.id), [m.UNCATEGORIZED_ID]);
    const all = m.groupByCategory([foods[0]], (f) => f.id, cats, { keepEmpty: true });
    assert.deepEqual(all.map((s) => s.id), ["c1", "c2", m.UNCATEGORIZED_ID]);
  });

  it("sem categorias tudo fica em 'Sem categoria'", () => {
    const sections = m.groupByCategory(foods, (f) => f.id, []);
    assert.equal(sections.length, 1);
    assert.equal(sections[0].items.length, 5);
  });
});

describe("matchesFoodSearch", () => {
  it("ignora acentos, maiúsculas e ordem das palavras; vazio casa tudo", () => {
    assert.ok(m.matchesFoodSearch("Pão francês", "pao fran"));
    assert.ok(m.matchesFoodSearch("Aveia em flocos", "FLOCOS aveia"));
    assert.ok(m.matchesFoodSearch("Arroz branco", ""));
    assert.ok(m.matchesFoodSearch("Arroz branco", "a"));
    assert.ok(!m.matchesFoodSearch("Arroz branco", "integral"));
  });
});

describe("moveFoodsLocally", () => {
  it("move sem duplicar e remove ao tirar da categoria", () => {
    const moved = m.moveFoodsLocally(cats, ["f2"], "c1");
    assert.deepEqual(moved.find((c) => c.id === "c2").alimento_ids, []);
    assert.deepEqual(moved.find((c) => c.id === "c1").alimento_ids, ["f1", "f4", "ghost", "f2"]);
    const removed = m.moveFoodsLocally(cats, ["f1"], null);
    assert.deepEqual(removed.find((c) => c.id === "c1").alimento_ids, ["f4", "ghost"]);
  });
});

describe("normalizeCategoriesResponse", () => {
  it("aceita a resposta da API e trata [] (rota indisponível) como sem categorias", () => {
    assert.deepEqual(m.normalizeCategoriesResponse([]), { categories: [], can_edit: false, unavailable: true });
    const ok = m.normalizeCategoriesResponse({ categories: [{ id: "a", nome: "A", ordem: 0 }], can_edit: true });
    assert.equal(ok.can_edit, true);
    assert.deepEqual(ok.categories[0].alimento_ids, []);
  });

  it("limpa o código de erro do api-client", () => {
    assert.equal(
      m.cleanApiErrorMessage("Já existe uma categoria com esse nome [NOME_DUPLICADO]", "x"),
      "Já existe uma categoria com esse nome",
    );
    assert.equal(m.cleanApiErrorMessage("", "Falhou"), "Falhou");
  });
});
