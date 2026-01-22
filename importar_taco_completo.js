// Script para importar dados completos da Tabela TACO
// Adaptado para usar PostgreSQL diretamente (sem Supabase)
// Data: 12 de Janeiro de 2026

const { Pool } = require('pg');
const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config();

// Configuração do PostgreSQL
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'blackhouse_db',
    user: process.env.DB_USER || 'app_user',
    password: process.env.DB_PASSWORD,
});

// Função para determinar origem da proteína
function determinarOrigemProteina(nomeAlimento) {
    const nome = nomeAlimento.toLowerCase();
    
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
    
    for (const palavra of animal) {
        if (nome.includes(palavra)) return 'Animal';
    }
    
    for (const palavra of vegetal) {
        if (nome.includes(palavra)) return 'Vegetal';
    }
    
    if (nome.includes('leite') || nome.includes('creme')) {
        return 'Mista';
    }
    
    return 'N/A';
}

// Função para determinar tipo do alimento
function determinarTipo(nomeAlimento, proteina, carboidrato, gordura) {
    const nome = nomeAlimento.toLowerCase();
    
    if (nome.includes('carne') || nome.includes('frango') || nome.includes('peixe') || 
        nome.includes('atum') || nome.includes('salmão') || nome.includes('camarão') ||
        nome.includes('ovo') || nome.includes('peru') || nome.includes('linguiça') ||
        nome.includes('presunto') || nome.includes('bacon') || nome.includes('feijão') ||
        nome.includes('lentilha') || nome.includes('grão') || proteina > 15) {
        return 'PROT';
    }
    
    if (nome.includes('leite') || nome.includes('queijo') || nome.includes('iogurte') || 
        nome.includes('requeijão') || nome.includes('ricota') || nome.includes('coalhada') ||
        nome.includes('manteiga')) {
        return 'LATIC';
    }
    
    if (nome.includes('alface') || nome.includes('couve') || nome.includes('espinafre') || 
        nome.includes('brócolis') || nome.includes('repolho') || nome.includes('agrião') ||
        nome.includes('rúcula') || nome.includes('acelga') || nome.includes('tomate') ||
        nome.includes('cebola') || nome.includes('pimentão') || nome.includes('cenoura') ||
        nome.includes('beterraba') || nome.includes('chuchu') || nome.includes('abobrinha') ||
        nome.includes('berinjela') || nome.includes('pepino') || (carboidrato < 10 && proteina < 5)) {
        return 'VEG';
    }
    
    if (nome.includes('óleo') || nome.includes('azeite') || nome.includes('margarina') || 
        nome.includes('castanha') || nome.includes('amendoim') || nome.includes('nozes') ||
        nome.includes('amêndoa') || nome.includes('semente') || nome.includes('abacate') ||
        gordura > 30) {
        return 'LIP';
    }
    
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
    
    return 'CARB';
}

async function importarTacoCompleto() {
    console.log('🚀 Iniciando importação completa da TACO...\n');
    
    try {
        // Caminho do arquivo Excel
        const excelPath = path.join(__dirname, 'public/data/tabela-alimentos-taco.xlsx');
        
        if (!require('fs').existsSync(excelPath)) {
            console.error('❌ Arquivo Excel não encontrado:', excelPath);
            console.log('💡 Verifique se o arquivo existe ou use o script SQL básico.');
            process.exit(1);
        }
        
        // Ler arquivo Excel
        console.log('📄 Lendo arquivo Excel...');
        const workbook = XLSX.readFile(excelPath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        console.log(`📊 ${data.length} alimentos encontrados no Excel\n`);
        
        // Criar tipos de alimentos
        const tiposUnicos = new Set();
        for (const row of data) {
            const nome = row['Alimento'] || row['alimento'] || row['Nome'] || '';
            const kcal = parseFloat(row['Calorias'] || row['kcal'] || row['Kcal'] || 0);
            const prot = parseFloat(row['Proteína'] || row['proteina'] || row['PTN'] || 0);
            const carb = parseFloat(row['Carboidrato'] || row['carboidrato'] || row['CHO'] || 0);
            const lip = parseFloat(row['Gordura'] || row['gordura'] || row['LIP'] || 0);
            
            if (nome) {
                const tipo = determinarTipo(nome, prot, carb, lip);
                tiposUnicos.add(tipo);
            }
        }
        
        console.log(`📁 Criando ${tiposUnicos.size} tipos de alimentos...`);
        const tiposMap = new Map();
        
        for (const tipo of Array.from(tiposUnicos)) {
            const result = await pool.query(
                `INSERT INTO public.tipos_alimentos (nome_tipo) 
                 VALUES ($1) 
                 ON CONFLICT (nome_tipo) DO UPDATE SET nome_tipo = EXCLUDED.nome_tipo
                 RETURNING id`,
                [tipo]
            );
            tiposMap.set(tipo, result.rows[0].id);
            console.log(`✅ Tipo: ${tipo}`);
        }
        
        console.log('\n📦 Importando alimentos...\n');
        
        let importados = 0;
        let atualizados = 0;
        let erros = 0;
        
        for (const row of data) {
            try {
                const nome = (row['Alimento'] || row['alimento'] || row['Nome'] || '').trim();
                if (!nome) continue;
                
                const gramagem = parseFloat(row['Gramagem'] || row['gramagem'] || row['Quantidade (g/ml)'] || 100);
                const kcal = parseFloat(row['Calorias'] || row['kcal'] || row['Kcal'] || 0);
                const prot = parseFloat(row['Proteína'] || row['proteina'] || row['PTN'] || 0);
                const carb = parseFloat(row['Carboidrato'] || row['carboidrato'] || row['CHO'] || 0);
                const lip = parseFloat(row['Gordura'] || row['gordura'] || row['LIP'] || 0);
                
                if (kcal === 0) continue; // Pular linhas sem dados válidos
                
                const origem_ptn = determinarOrigemProteina(nome);
                const tipo = determinarTipo(nome, prot, carb, lip);
                const tipo_id = tiposMap.get(tipo);
                
                const result = await pool.query(
                    `INSERT INTO public.alimentos (
                        nome, quantidade_referencia_g, kcal_por_referencia, 
                        cho_por_referencia, ptn_por_referencia, lip_por_referencia,
                        origem_ptn, tipo_id, info_adicional, autor
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    ON CONFLICT (nome) DO UPDATE SET
                        quantidade_referencia_g = EXCLUDED.quantidade_referencia_g,
                        kcal_por_referencia = EXCLUDED.kcal_por_referencia,
                        cho_por_referencia = EXCLUDED.cho_por_referencia,
                        ptn_por_referencia = EXCLUDED.ptn_por_referencia,
                        lip_por_referencia = EXCLUDED.lip_por_referencia,
                        origem_ptn = EXCLUDED.origem_ptn,
                        tipo_id = EXCLUDED.tipo_id,
                        info_adicional = EXCLUDED.info_adicional
                    RETURNING id`,
                    [nome, gramagem, kcal, carb, prot, lip, origem_ptn, tipo_id, 'Fonte: TACO 4ª edição', 'TACO']
                );
                
                importados++;
                if (importados % 50 === 0) {
                    console.log(`✅ Progresso: ${importados}/${data.length}`);
                }
            } catch (error) {
                if (error.code !== '23505') { // Ignorar duplicatas
                    console.error(`❌ Erro ao importar ${row['Alimento'] || 'desconhecido'}:`, error.message);
                    erros++;
                }
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMO DA IMPORTAÇÃO');
        console.log('='.repeat(60));
        console.log(`✅ Alimentos importados: ${importados}`);
        console.log(`❌ Erros: ${erros}`);
        console.log('='.repeat(60));
        console.log('\n✨ Importação concluída!');
        
        // Verificar total
        const totalResult = await pool.query(
            "SELECT COUNT(*) as total FROM public.alimentos WHERE autor = 'TACO'"
        );
        console.log(`\n📊 Total de alimentos TACO no banco: ${totalResult.rows[0].total}`);
        
    } catch (error) {
        console.error('❌ Erro geral na importação:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Executar importação
importarTacoCompleto();
