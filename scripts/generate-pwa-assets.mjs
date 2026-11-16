#!/usr/bin/env node
/**
 * Gera ícones e telas de abertura do app instalável a partir do logo oficial (src/assets/logo-white.svg).
 * Executar: node scripts/generate-pwa-assets.mjs  (saída em public/pwa/; as tags <link> das telas de abertura
 * vão para um arquivo temporário e devem ser coladas no <head> do index.html se a lista de aparelhos mudar)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOGO = path.join(root, "src/assets/logo-white.svg");
const OUT = path.join(root, "public/pwa");
const APP_BACKGROUND = "#0a0a0a";

fs.mkdirSync(path.join(OUT, "startup"), { recursive: true });

/** Logo recortado à área desenhada (o SVG tem 1920×1080 com margens vazias). */
const masterLogo = await sharp(LOGO, { density: 240 }).trim({ threshold: 1 }).png().toBuffer();

async function trimmedLogo(width) {
  return sharp(masterLogo).resize({ width, fit: "inside" }).png().toBuffer();
}

async function square(size, logoWidthRatio, file) {
  const logo = await trimmedLogo(Math.round(size * logoWidthRatio));
  await sharp({ create: { width: size, height: size, channels: 4, background: APP_BACKGROUND } })
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, file));
}

// Ícones "any": logo ocupa 84% da largura. Maskable: 60% (margem de segurança de 20% em cada lado).
await square(192, 0.84, "icon-192.png");
await square(512, 0.84, "icon-512.png");
await square(512, 0.6, "icon-512-maskable.png");
await square(180, 0.8, "apple-touch-icon-180.png");
await sharp(await trimmedLogo(480)).png({ compressionLevel: 9 }).toFile(path.join(OUT, "splash-logo.png"));

// iPhone e iPad atuais (pontos CSS em pé, densidade).
const DEVICES = [
  ["iPhone 16/17 Pro Max", 440, 956, 3],
  ["iPhone 15/16 Plus, 14/15 Pro Max", 430, 932, 3],
  ["iPhone 12/13 Pro Max, 14 Plus", 428, 926, 3],
  ["iPhone Air", 420, 912, 3],
  ["iPhone 16/17 Pro, 17", 402, 874, 3],
  ["iPhone 14 Pro, 15, 15 Pro, 16", 393, 852, 3],
  ["iPhone 12/13/14, 12/13 Pro", 390, 844, 3],
  ["iPhone XS Max, 11 Pro Max", 414, 896, 3],
  ["iPhone XR, 11", 414, 896, 2],
  ["iPhone X/XS, 11 Pro, 12/13 mini", 375, 812, 3],
  ["iPhone 8 Plus", 414, 736, 3],
  ["iPhone SE 2/3, 8", 375, 667, 2],
  ["iPhone SE 1", 320, 568, 2],
  ["iPad Pro 13 (M4)", 1032, 1376, 2],
  ["iPad Pro 12.9, iPad Air 13", 1024, 1366, 2],
  ["iPad Pro 11 (M4)", 834, 1210, 2],
  ["iPad Pro 11", 834, 1194, 2],
  ["iPad Air 10.9/11, iPad 10/A16", 820, 1180, 2],
  ["iPad Air 3, iPad Pro 10.5", 834, 1112, 2],
  ["iPad 7/8/9", 810, 1080, 2],
  ["iPad mini 6/7", 744, 1133, 2],
  ["iPad mini 5, iPad 9.7", 768, 1024, 2],
];

const links = [];
for (const [label, w, h, dpr] of DEVICES) {
  for (const orientation of ["portrait", "landscape"]) {
    const pw = (orientation === "portrait" ? w : h) * dpr;
    const ph = (orientation === "portrait" ? h : w) * dpr;
    const file = `startup/apple-splash-${pw}x${ph}.png`;
    const logo = await trimmedLogo(Math.round(Math.min(pw, ph) * 0.5));
    await sharp({ create: { width: pw, height: ph, channels: 4, background: APP_BACKGROUND } })
      .composite([{ input: logo, gravity: "center" }])
      .png({ compressionLevel: 9, palette: true })
      .toFile(path.join(OUT, file));
    links.push(
      `<!-- ${label} (${orientation}) -->\n` +
        `<link rel="apple-touch-startup-image" href="/pwa/${file}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${orientation})" />`,
    );
  }
}
const linksFile = path.join(os.tmpdir(), "pwa-startup-links.html");
fs.writeFileSync(linksFile, links.join("\n") + "\n");
console.log(`ícones + ${links.length} telas de abertura em public/pwa/; tags em ${linksFile}`);
