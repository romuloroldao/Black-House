#!/usr/bin/env node
/**
 * Copia o WASM do @mediapipe/tasks-vision e o modelo de pose para public/mediapipe/<versão>/
 * (servido pelo próprio domínio, com cache imutável no Nginx). A pasta não vai para o git.
 * Se o download do modelo falhar, o build segue: a detecção no celular fica indisponível e as
 * fotos vão para a fila de visão do servidor.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = join(root, "node_modules", "@mediapipe", "tasks-vision");
const version = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")).version;
const outDir = join(root, "public", "mediapipe", version);

const WASM_FILES = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const MODEL_SHA256 = "59929e1d1ee95287";

mkdirSync(join(outDir, "wasm"), { recursive: true });
for (const file of WASM_FILES) {
  const dest = join(outDir, "wasm", file);
  copyFileSync(join(pkgDir, "wasm", file), dest);
  // Pré-comprimido para gzip_static do Nginx (13 MB → ~4 MB no celular).
  writeFileSync(`${dest}.gz`, gzipSync(readFileSync(dest), { level: 9 }));
}

const modelPath = join(outDir, "pose_landmarker_lite.task");
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
if (!existsSync(modelPath) || !sha(readFileSync(modelPath)).startsWith(MODEL_SHA256)) {
  try {
    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!sha(buf).startsWith(MODEL_SHA256)) throw new Error("checksum do modelo não confere");
    writeFileSync(modelPath, buf);
  } catch (err) {
    console.warn(`[mediapipe] modelo de pose não copiado: ${err.message}`);
  }
}

console.log(`[mediapipe] assets ${version} em public/mediapipe/${version}`);
