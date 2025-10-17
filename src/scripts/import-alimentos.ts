import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Configurações do Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cghzttbggklhuyqxzabq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

if (!SUPABASE_KEY) {
  console.error('❌ SUPABASE_KEY não configurada');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface CSVRow {
  'Nome do alimento': string;
  'Quantidade (g/ml)': string;
  'Kcal': string;
  'CHO': string;
  'PTN': string;
  'LIP': string;
  'Origem da PTN': string;
  'Tipo': string;
  'Info Adicional'?: string;
  'Autor'?: string;
}

// Função para validar e limpar dados
function validarAlimento(row: CSVRow): boolean {
  if (!row['Nome do alimento'] || row['Nome do alimento'].trim() === '') {
    return false;
  }
  
  const kcal = parseFloat(row['Kcal']);
  const cho = parseFloat(row['CHO']);
  const ptn = parseFloat(row['PTN']);
  const lip = parseFloat(row['LIP']);
  
  // Validar se são números válidos
  if (isNaN(kcal) || isNaN(cho) || isNaN(ptn) || isNaN(lip)) {
    console.warn(`⚠️  Valores inválidos para ${row['Nome do alimento']}`);
    return false;
  }
  
  // Validar se a origem da proteína é válida
  const origensValidas = ['Vegetal', 'Animal', 'Mista', 'N/A'];
  if (!origensValidas.includes(row['Origem da PTN'])) {
    console.warn(`⚠️  Origem de PTN inválida para ${row['Nome do alimento']}: ${row['Origem da PTN']}`);
    return false;
  }
  
  return true;
}

// Função para parsear CSV simples
function parseCSV(content: string): CSVRow[] {
  const lines = content.split('\n');
  const headers = lines[0].split(',');
  const rows: CSVRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const values = lines[i].split(',');
    const row: any = {};
    
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || '';
    });
    
    rows.push(row as CSVRow);
  }
  
  return rows;
}

async function importarAlimentos() {
  console.log('🚀 Iniciando importação de alimentos...\n');
  
  try {
    // Ler CSV
    const csvPath = path.join(__dirname, '../data/grupo_personalizado_cleaned.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const rows = parseCSV(csvContent);
    
    console.log(`📊 ${rows.length} alimentos encontrados no CSV\n`);
    
    // Primeiro, importar tipos de alimentos (com UPSERT)
    const tiposUnicos = [...new Set(rows.map(r => r['Tipo']).filter(Boolean))];
    console.log(`📁 Importando ${tiposUnicos.length} tipos de alimentos...`);
    
    const tiposMap = new Map<string, string>();
    
    for (const tipo of tiposUnicos) {
      const { data, error } = await supabase
        .from('tipos_alimentos')
        .upsert(
          { nome_tipo: tipo },
          { onConflict: 'nome_tipo' }
        )
        .select()
        .single();
      
      if (error) {
        console.error(`❌ Erro ao inserir tipo ${tipo}:`, error.message);
      } else if (data) {
        tiposMap.set(tipo, data.id);
        console.log(`✅ Tipo importado: ${tipo}`);
      }
    }
    
    console.log('\n📦 Importando alimentos...\n');
    
    let importados = 0;
    let atualizados = 0;
    let duplicatasIgnoradas = 0;
    let erros = 0;
    
    // Rastrear alimentos já processados para detectar duplicatas no CSV
    const alimentosProcessados = new Set<string>();
    
    for (const row of rows) {
      // Validar dados
      if (!validarAlimento(row)) {
        erros++;
        continue;
      }
      
      const nomeAlimento = row['Nome do alimento'].trim();
      
      // Detectar duplicata no CSV
      if (alimentosProcessados.has(nomeAlimento)) {
        console.warn(`⚠️  Duplicata ignorada: ${nomeAlimento}`);
        duplicatasIgnoradas++;
        continue;
      }
      
      alimentosProcessados.add(nomeAlimento);
      
      const tipoId = tiposMap.get(row['Tipo']);
      
      const alimentoData = {
        nome: nomeAlimento,
        quantidade_referencia_g: parseFloat(row['Quantidade (g/ml)']),
        kcal_por_referencia: parseFloat(row['Kcal']),
        cho_por_referencia: parseFloat(row['CHO']),
        ptn_por_referencia: parseFloat(row['PTN']),
        lip_por_referencia: parseFloat(row['LIP']),
        origem_ptn: row['Origem da PTN'],
        tipo_id: tipoId || null,
        info_adicional: row['Info Adicional'] || null,
        autor: row['Autor'] || null
      };
      
      // UPSERT: inserir ou atualizar se já existir
      const { data, error } = await supabase
        .from('alimentos')
        .upsert(alimentoData, { onConflict: 'nome' })
        .select();
      
      if (error) {
        console.error(`❌ Erro ao importar ${nomeAlimento}:`, error.message);
        erros++;
      } else {
        // Verificar se foi INSERT ou UPDATE
        const { count } = await supabase
          .from('alimentos')
          .select('*', { count: 'exact', head: true })
          .eq('nome', nomeAlimento);
        
        if (count === 1) {
          console.log(`✅ ${nomeAlimento}`);
          importados++;
        } else {
          console.log(`🔄 Atualizado: ${nomeAlimento}`);
          atualizados++;
        }
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DA IMPORTAÇÃO');
    console.log('='.repeat(60));
    console.log(`✅ Alimentos importados: ${importados}`);
    console.log(`🔄 Alimentos atualizados: ${atualizados}`);
    console.log(`⚠️  Duplicatas ignoradas: ${duplicatasIgnoradas}`);
    console.log(`❌ Erros: ${erros}`);
    console.log('='.repeat(60));
    
    // Validar cálculos
    console.log('\n🧮 Testando função calcular_nutrientes...');
    
    const { data: alimentoTeste } = await supabase
      .from('alimentos')
      .select('*')
      .eq('nome', 'Arroz branco')
      .single();
    
    if (alimentoTeste) {
      const { data: resultado, error } = await supabase.rpc('calcular_nutrientes', {
        alimento_id: alimentoTeste.id,
        quantidade_consumida_g: 150
      });
      
      if (error) {
        console.error('❌ Erro ao testar cálculo:', error.message);
      } else if (resultado && resultado.length > 0) {
        console.log('✅ Função calcular_nutrientes OK');
        console.log(`   Teste: 150g de ${resultado[0].nome_alimento}`);
        console.log(`   Resultado: ${resultado[0].kcal}kcal, ${resultado[0].cho}g CHO, ${resultado[0].ptn}g PTN, ${resultado[0].lip}g LIP`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral na importação:', error);
    process.exit(1);
  }
}

// Executar importação
importarAlimentos();