import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Configurações do Supabase
const SUPABASE_URL = 'https://cghzttbggklhuyqxzabq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

if (!SUPABASE_KEY) {
  console.error('❌ SUPABASE_KEY não configurada');
  console.log('Use: SUPABASE_KEY=sua_chave npm run import-taco');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface TacoFood {
  alimento: string;
  gramagem: string;
  calorias: number;
  proteina: number;
  carboidrato: number;
  gordura: number;
  fibra: number | null;
}

// Função para determinar a origem da proteína baseado no nome do alimento
function determinarOrigemProteina(nomeAlimento: string): string {
  const nome = nomeAlimento.toLowerCase();
  
  // Proteína Animal
  const animal = [
    'carne', 'boi', 'bovina', 'frango', 'galinha', 'peru', 'pato', 'peixe', 
    'atum', 'salmão', 'sardinha', 'bacalhau', 'camarão', 'lula', 'polvo', 
    'ovo', 'leite', 'queijo', 'iogurte', 'requeijão', 'ricota', 'coalhada',
    'linguiça', 'presunto', 'bacon', 'mortadela', 'salsicha', 'hambúrguer',
    'cordeiro', 'porco', 'suína', 'vitela', 'fígado', 'coração', 'moela',
    'língua', 'rim', 'miúdos', 'buchada', 'cabrito', 'manteiga', 'mozarela',
    'mussarela', 'parmesão', 'cottage', 'chantilly', 'cupim', 'maminha',
    'picanha', 'alcatra', 'patinho', 'lagarto', 'músculo', 'acém', 'costela',
    'toucinho', 'pernil', 'lombo'
  ];
  
  // Proteína Vegetal
  const vegetal = [
    'feijão', 'lentilha', 'grão', 'ervilha', 'soja', 'tofu', 'amendoim',
    'castanha', 'nozes', 'amêndoa', 'pistache', 'avelã', 'semente', 'gergelim',
    'linhaça', 'chia', 'quinoa', 'arroz', 'trigo', 'aveia', 'centeio',
    'cevada', 'milho', 'mandioca', 'batata', 'inhame', 'cará', 'polvilho',
    'farinha', 'macarrão', 'pão', 'bolo', 'biscoito', 'vegetal', 'verdura',
    'legume', 'frutas', 'abóbora', 'chuchu', 'abobrinha', 'berinjela',
    'pimentão', 'tomate', 'alface', 'couve', 'espinafre', 'brócolis',
    'tapioca', 'granola', 'cereal', 'abacate', 'coco'
  ];
  
  // Verifica se é animal
  for (const palavra of animal) {
    if (nome.includes(palavra)) {
      return 'Animal';
    }
  }
  
  // Verifica se é vegetal
  for (const palavra of vegetal) {
    if (nome.includes(palavra)) {
      return 'Vegetal';
    }
  }
  
  // Se tiver tanto leite quanto algo vegetal (ex: mingau, curau)
  if (nome.includes('leite') || nome.includes('creme')) {
    return 'Mista';
  }
  
  // Default para alimentos processados ou indefinidos
  return 'N/A';
}

// Função para determinar o tipo do alimento
function determinarTipo(nomeAlimento: string, proteina: number, carboidrato: number, gordura: number): string {
  const nome = nomeAlimento.toLowerCase();
  
  // Proteínas (carnes, ovos, leguminosas)
  if (nome.includes('carne') || nome.includes('frango') || nome.includes('peixe') || 
      nome.includes('atum') || nome.includes('salmão') || nome.includes('camarão') ||
      nome.includes('ovo') || nome.includes('peru') || nome.includes('linguiça') ||
      nome.includes('presunto') || nome.includes('bacon') || nome.includes('feijão') ||
      nome.includes('lentilha') || nome.includes('grão') || proteina > 15) {
    return 'PROT';
  }
  
  // Laticínios
  if (nome.includes('leite') || nome.includes('queijo') || nome.includes('iogurte') || 
      nome.includes('requeijão') || nome.includes('ricota') || nome.includes('coalhada') ||
      nome.includes('manteiga')) {
    return 'LATIC';
  }
  
  // Vegetais (verduras e legumes)
  if (nome.includes('alface') || nome.includes('couve') || nome.includes('espinafre') || 
      nome.includes('brócolis') || nome.includes('repolho') || nome.includes('agrião') ||
      nome.includes('rúcula') || nome.includes('acelga') || nome.includes('tomate') ||
      nome.includes('cebola') || nome.includes('pimentão') || nome.includes('cenoura') ||
      nome.includes('beterraba') || nome.includes('chuchu') || nome.includes('abobrinha') ||
      nome.includes('berinjela') || nome.includes('pepino') || (carboidrato < 10 && proteina < 5)) {
    return 'VEG';
  }
  
  // Lipídios (óleos, gorduras, oleaginosas)
  if (nome.includes('óleo') || nome.includes('azeite') || nome.includes('margarina') || 
      nome.includes('castanha') || nome.includes('amendoim') || nome.includes('nozes') ||
      nome.includes('amêndoa') || nome.includes('semente') || nome.includes('abacate') ||
      gordura > 30) {
    return 'LIP';
  }
  
  // Carboidratos (arroz, pães, massas, frutas, tubérculos)
  if (nome.includes('arroz') || nome.includes('pão') || nome.includes('macarrão') || 
      nome.includes('batata') || nome.includes('mandioca') || nome.includes('inhame') ||
      nome.includes('cará') || nome.includes('polenta') || nome.includes('farinha') ||
      nome.includes('tapioca') || nome.includes('aveia') || nome.includes('granola') ||
      nome.includes('cereal') || nome.includes('biscoito') || nome.includes('bolo') ||
      nome.includes('fruta') || nome.includes('banana') || nome.includes('maçã') ||
      nome.includes('laranja') || nome.includes('mamão') || nome.includes('manga') ||
      nome.includes('abacaxi') || nome.includes('melancia') || nome.includes('melão') ||
      nome.includes('uva') || nome.includes('morango') || carboidrato > 20) {
    return 'CARB';
  }
  
  // Default
  return 'CARB';
}

async function importarTacoFoods() {
  console.log('🚀 Iniciando importação de alimentos da TACO...\n');
  
  try {
    // Procurar o arquivo parseado mais recente
    const toolResultsDir = path.join(__dirname, '../../tool-results/document--parse_document');
    let parsedContent = '';
    
    if (fs.existsSync(toolResultsDir)) {
      const files = fs.readdirSync(toolResultsDir);
      if (files.length > 0) {
        // Pegar o arquivo mais recente
        const latestFile = files.sort().reverse()[0];
        const parsedPath = path.join(toolResultsDir, latestFile);
        console.log(`📄 Usando arquivo: ${latestFile}\n`);
        parsedContent = fs.readFileSync(parsedPath, 'utf-8');
      } else {
        console.error('❌ Nenhum arquivo parseado encontrado em tool-results');
        process.exit(1);
      }
    } else {
      console.error('❌ Diretório tool-results não encontrado.');
      console.log('💡 Execute o parse do documento Excel primeiro ou use os dados inline.');
      process.exit(1);
    }
    const lines = parsedContent.split('\n');
    
    // Processar as linhas da tabela
    const foods: TacoFood[] = [];
    let inTable = false;
    
    for (const line of lines) {
      // Detectar início de tabela
      if (line.includes('|Alimento|Gramagem|Calorias')) {
        inTable = true;
        continue;
      }
      
      // Pular linhas de separador
      if (line.includes('|-|-|-')) {
        continue;
      }
      
      // Detectar fim de tabela (linha vazia ou nova seção)
      if (inTable && (line.trim() === '' || line.startsWith('##'))) {
        inTable = false;
        continue;
      }
      
      // Processar linha de dados
      if (inTable && line.startsWith('|') && !line.includes('Teores alcoólicos')) {
        const parts = line.split('|').map(p => p.trim()).filter(p => p !== '');
        
        if (parts.length >= 6) {
          const alimento = parts[0];
          const calorias = parseFloat(parts[2]) || 0;
          const proteina = parseFloat(parts[3]) || 0;
          const carboidrato = parseFloat(parts[4]) || 0;
          const gordura = parseFloat(parts[5]) || 0;
          const fibra = parts.length > 6 ? (parseFloat(parts[6]) || null) : null;
          
          // Validar que tem dados válidos
          if (alimento && calorias > 0 && !alimento.includes('Alimento')) {
            foods.push({
              alimento,
              gramagem: '100g',
              calorias,
              proteina,
              carboidrato,
              gordura,
              fibra
            });
          }
        }
      }
    }
    
    console.log(`📊 ${foods.length} alimentos encontrados para importação\n`);
    
    // Primeiro, garantir que os tipos existem
    const tiposUnicos = new Set<string>();
    for (const food of foods) {
      const tipo = determinarTipo(food.alimento, food.proteina, food.carboidrato, food.gordura);
      tiposUnicos.add(tipo);
    }
    
    console.log(`📁 Importando ${tiposUnicos.size} tipos de alimentos...`);
    const tiposMap = new Map<string, string>();
    
    for (const tipo of Array.from(tiposUnicos)) {
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
        console.log(`✅ Tipo: ${tipo}`);
      }
    }
    
    console.log('\n📦 Importando alimentos...\n');
    
    let importados = 0;
    let atualizados = 0;
    let erros = 0;
    let duplicatasIgnoradas = 0;
    
    // Processar em lotes de 50 para não sobrecarregar
    const batchSize = 50;
    for (let i = 0; i < foods.length; i += batchSize) {
      const batch = foods.slice(i, i + batchSize);
      
      for (const food of batch) {
        const origem_ptn = determinarOrigemProteina(food.alimento);
        const tipo = determinarTipo(food.alimento, food.proteina, food.carboidrato, food.gordura);
        const tipo_id = tiposMap.get(tipo);
        
        const alimentoData = {
          nome: food.alimento,
          quantidade_referencia_g: 100,
          kcal_por_referencia: food.calorias,
          cho_por_referencia: food.carboidrato,
          ptn_por_referencia: food.proteina,
          lip_por_referencia: food.gordura,
          origem_ptn,
          tipo_id: tipo_id || null,
          info_adicional: food.fibra ? `Fibra: ${food.fibra}g | Fonte: TACO` : 'Fonte: TACO',
          autor: null // Será preenchido automaticamente pelo sistema
        };
        
        try {
          const { error } = await supabase
            .from('alimentos')
            .upsert(alimentoData, { onConflict: 'nome' })
            .select();
          
          if (error) {
            if (error.message.includes('duplicate key')) {
              duplicatasIgnoradas++;
            } else {
              console.error(`❌ Erro ao importar ${food.alimento}:`, error.message);
              erros++;
            }
          } else {
            importados++;
            if ((importados + atualizados) % 50 === 0) {
              console.log(`✅ Progresso: ${importados + atualizados}/${foods.length}`);
            }
          }
        } catch (err) {
          console.error(`❌ Exceção ao importar ${food.alimento}:`, err);
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
    console.log('\n✨ Importação concluída!');
    
  } catch (error) {
    console.error('❌ Erro geral na importação:', error);
    process.exit(1);
  }
}

// Executar importação
importarTacoFoods();
