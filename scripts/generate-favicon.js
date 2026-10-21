#!/usr/bin/env node
/**
 * DESIGN-FAVICON-REUSE-LOGO-014: Gerador de favicon a partir do logo existente
 * 
 * Este script gera favicons (favicon.ico, favicon-32x32.png, favicon-16x16.png)
 * a partir do logo existente em src/assets/logo-black-house.png
 * 
 * Requisitos:
 * - npm install sharp (ou usar ImageMagick/Inkscape manualmente)
 * 
 * Uso:
 *   node scripts/generate-favicon.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logoPath = path.join(__dirname, '../src/assets/logo-black-house.png');
const publicDir = path.join(__dirname, '../public');

// Verificar se o logo existe
if (!fs.existsSync(logoPath)) {
  console.error('❌ Logo não encontrado:', logoPath);
  console.error('   Verifique se src/assets/logo-black-house.png existe');
  process.exit(1);
}

console.log('📦 DESIGN-FAVICON-REUSE-LOGO-014: Gerando favicons a partir do logo...');
console.log('   Logo fonte:', logoPath);

  // Tentar usar sharp se disponível
try {
  const sharp = (await import('sharp')).default;
  
  console.log('✅ Usando sharp para gerar favicons...');
  
  const generateFavicon = async () => {
    // Ler o logo
    const logo = sharp(logoPath);
    const metadata = await logo.metadata();
    
    console.log(`   Logo original: ${metadata.width}x${metadata.height}`);
    
    // Gerar favicon.ico (32x32)
    await logo
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toFile(path.join(publicDir, 'favicon-32x32.png'));
    
    console.log('   ✅ favicon-32x32.png gerado');
    
    // Gerar favicon-16x16.png
    await logo
      .resize(16, 16, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toFile(path.join(publicDir, 'favicon-16x16.png'));
    
    console.log('   ✅ favicon-16x16.png gerado');
    
    // Gerar favicon.ico (usar 32x32 como base)
    // Nota: favicon.ico pode conter múltiplos tamanhos, mas vamos usar 32x32
    await logo
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toFile(path.join(publicDir, 'favicon.ico'));
    
    console.log('   ✅ favicon.ico gerado');
    
    console.log('\n✅ Favicons gerados com sucesso!');
    console.log('   Arquivos criados em:', publicDir);
    console.log('   - favicon.ico');
    console.log('   - favicon-32x32.png');
    console.log('   - favicon-16x16.png');
  };
  
  generateFavicon().catch(err => {
    console.error('❌ Erro ao gerar favicons:', err.message);
    process.exit(1);
  });
  
} catch (err) {
  // Sharp não disponível - fornecer instruções manuais
  console.log('⚠️  Sharp não está instalado.');
  console.log('\n📋 Instruções para gerar favicons manualmente:');
  console.log('\n1. Instalar sharp:');
  console.log('   npm install --save-dev sharp');
  console.log('\n2. Executar este script novamente:');
  console.log('   node scripts/generate-favicon.js');
  console.log('\n--- OU ---\n');
  console.log('Usar ImageMagick (se instalado):');
  console.log(`   convert ${logoPath} -resize 32x32 ${publicDir}/favicon-32x32.png`);
  console.log(`   convert ${logoPath} -resize 16x16 ${publicDir}/favicon-16x16.png`);
  console.log(`   convert ${logoPath} -resize 32x32 ${publicDir}/favicon.ico`);
  console.log('\n--- OU ---\n');
  console.log('Usar Inkscape (se instalado):');
  console.log(`   inkscape ${logoPath} --export-width=32 --export-height=32 --export-filename=${publicDir}/favicon-32x32.png`);
  console.log(`   inkscape ${logoPath} --export-width=16 --export-height=16 --export-filename=${publicDir}/favicon-16x16.png`);
  console.log(`   inkscape ${logoPath} --export-width=32 --export-height=32 --export-filename=${publicDir}/favicon.ico`);
  process.exit(1);
}
