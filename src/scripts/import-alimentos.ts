import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// Configurações da API
const API_URL = process.env.VITE_API_URL || 'http://localhost:3001';
const API_EMAIL = process.env.API_EMAIL || '';
const API_PASSWORD = process.env.API_PASSWORD || '';

// Função para fazer login e obter token
async function obterToken(): Promise<string> {
  if (!API_EMAIL || !API_PASSWORD) {
    console.error('❌ API_EMAIL e API_PASSWORD devem ser configurados');
    console.log('Use: API_EMAIL=email API_PASSWORD=senha npx tsx src/scripts/import-alimentos.ts');
    process.exit(1);
  }

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: API_EMAIL, password: API_PASSWORD })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro ao fazer login' }));
      throw new Error(error.error || 'Erro ao fazer login');
    }

    const data = await response.json();
    return data.token;
  } catch (error: any) {
    console.error('❌ Erro ao obter token:', error.message);
    process.exit(1);
  }
}

// Função para fazer requisição autenticada
async function apiRequest(endpoint: string, options: RequestInit = {}, token: string) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers as Record<string, string>
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro na requisição' }));
    throw new Error(error.error || `Erro ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// Função para fazer UPSERT (INSERT ON CONFLICT DO UPDATE)
async function upsertRegistro(table: string, data: any, conflictColumn: string, token: string): Promise<any> {
  try {
    // Tentar buscar registro existente
    const existing = await apiRequest(
      `/rest/v1/${table}?${conflictColumn}.eq=${encodeURIComponent(data[conflictColumn])}&select=id`,
      { method: 'GET' },
      token
    );

    const existingRecord = Array.isArray(existing) ? existing[0] : existing;

    if (existingRecord && existingRecord.id) {
      // UPDATE
      return await apiRequest(
        `/rest/v1/${table}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ id: existingRecord.id, ...data })
        },
        token
      );
    } else {
      // INSERT
      return await apiRequest(
        `/rest/v1/${table}`,
        {
          method: 'POST',
          body: JSON.stringify(data)
        },
        token
      );
    }
  } catch (error: any) {
    // Se erro 404 ou 400, tentar INSERT direto
    if (error.message.includes('404') || error.message.includes('400')) {
      return await apiRequest(
        `/rest/v1/${table}`,
        {
          method: 'POST',
          body: JSON.stringify(data)
        },
        token
      );
    }
    throw error;
  }
}

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
  console.log('🚀 Iniciando importação de alimentos via API REST...\n');
  
  try {
    // Obter token de autenticação
    console.log('🔐 Autenticando...');
    const token = await obterToken();
    console.log('✅ Autenticação realizada\n');
    
    // Ler CSV
    const csvPath = path.join(__dirname, '../data/grupo_personalizado_cleaned.csv');
    if (!fs.existsSync(csvPath)) {
      console.error(`❌ Arquivo CSV não encontrado: ${csvPath}`);
      process.exit(1);
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const rows = parseCSV(csvContent);
    
    console.log(`📊 ${rows.length} alimentos encontrados no CSV\n`);
    
    // Primeiro, importar tipos de alimentos (com UPSERT)
    const tiposUnicos = [...new Set(rows.map(r => r['Tipo']).filter(Boolean))];
    console.log(`📁 Importando ${tiposUnicos.length} tipos de alimentos...`);
    
    const tiposMap = new Map<string, string>();
    
    for (const tipo of tiposUnicos) {
      try {
        const result = await upsertRegistro(
          'tipos_alimentos',
          { nome_tipo: tipo },
          'nome_tipo',
          token
        );
        
        if (result && result.id) {
          tiposMap.set(tipo, result.id);
          console.log(`✅ Tipo importado: ${tipo}`);
        }
      } catch (error: any) {
        console.error(`❌ Erro ao inserir tipo ${tipo}:`, error.message);
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
      
      try {
        // Tentar buscar se existe
        const existing = await apiRequest(
          `/rest/v1/alimentos?nome.eq=${encodeURIComponent(nomeAlimento)}&select=id`,
          { method: 'GET' },
          token
        ).catch(() => null);
        
        const existingRecord = Array.isArray(existing) ? existing[0] : existing;
        
        if (existingRecord && existingRecord.id) {
          // UPDATE
          await apiRequest(
            '/rest/v1/alimentos',
            {
              method: 'PATCH',
              body: JSON.stringify({ id: existingRecord.id, ...alimentoData })
            },
            token
          );
          console.log(`🔄 Atualizado: ${nomeAlimento}`);
          atualizados++;
        } else {
          // INSERT
          await apiRequest(
            '/rest/v1/alimentos',
            {
              method: 'POST',
              body: JSON.stringify(alimentoData)
            },
            token
          );
          console.log(`✅ ${nomeAlimento}`);
          importados++;
        }
      } catch (error: any) {
        if (error.message.includes('duplicate') || error.message.includes('23505')) {
          duplicatasIgnoradas++;
          console.warn(`⚠️  Duplicata ignorada: ${nomeAlimento}`);
        } else {
          console.error(`❌ Erro ao importar ${nomeAlimento}:`, error.message);
          erros++;
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
    
  } catch (error: any) {
    console.error('❌ Erro geral na importação:', error.message || error);
    process.exit(1);
  }
}

// Executar importação
importarAlimentos();
