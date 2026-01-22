// Módulo local para parse de PDF sem dependências externas
// Usa pdf-parse (versão antiga compatível) para extrair texto e regex para estruturar dados

const pdfParse = require('pdf-parse');

/**
 * Extrai dados estruturados de um PDF de ficha de aluno
 * @param {Buffer} pdfBuffer - Buffer do PDF
 * @returns {Object} Dados estruturados do aluno
 */
async function parseStudentPDF(pdfBuffer) {
    try {
        // Extrair texto do PDF
        const data = await pdfParse(pdfBuffer);
        const text = data.text;
        
        console.log('Texto extraído do PDF (primeiros 2000 chars):', text.substring(0, 2000));
        
        // Estrutura de saída
        const result = {
            aluno: {},
            dieta: {
                nome: 'Plano Alimentar Importado',
                objetivo: null,
                refeicoes: [],
                macros: {}
            },
            suplementos: [],
            farmacos: [],
            orientacoes: null
        };
        
        // Extrair nome do aluno
        const nomeMatch = text.match(/(?:nome|paciente|aluno)[\s:]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
        if (nomeMatch) {
            result.aluno.nome = nomeMatch[1].trim();
        } else {
            // Tentar padrão mais simples
            const nomeMatch2 = text.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
            if (nomeMatch2) {
                result.aluno.nome = nomeMatch2[1].trim();
            } else {
                result.aluno.nome = 'Aluno Importado';
            }
        }
        
        // Extrair peso
        const pesoMatch = text.match(/(?:peso|weight)[\s:]*(\d+[.,]?\d*)\s*(?:kg|kilogramas?)?/i);
        if (pesoMatch) {
            result.aluno.peso = parseFloat(pesoMatch[1].replace(',', '.'));
        }
        
        // Extrair altura
        const alturaMatch = text.match(/(?:altura|height)[\s:]*(\d+[.,]?\d*)\s*(?:cm|metros?|m)?/i);
        if (alturaMatch) {
            result.aluno.altura = parseFloat(alturaMatch[1].replace(',', '.'));
        }
        
        // Extrair objetivo
        const objetivoMatch = text.match(/(?:objetivo|goal|meta)[\s:]*([^\n]+)/i);
        if (objetivoMatch) {
            result.aluno.objetivo = objetivoMatch[1].trim();
            result.dieta.objetivo = objetivoMatch[1].trim();
        }
        
        // Extrair refeições - padrões comuns
        const refeicoesPatterns = [
            /(?:refeição|refeicao|ref)\s*(\d+)[\s\S]*?(?=(?:refeição|refeicao|ref)\s*\d+|$)/gi,
            /(?:café\s+da\s+manhã|cafe\s+da\s+manha|breakfast)[\s\S]*?(?=(?:lanche|almoço|jantar|$))/gi,
            /(?:lanche\s+da\s+manhã|lanche\s+da\s+manha|morning\s+snack)[\s\S]*?(?=(?:almoço|lanche|jantar|$))/gi,
            /(?:almoço|almoco|lunch)[\s\S]*?(?=(?:lanche|jantar|$))/gi,
            /(?:lanche\s+da\s+tarde|afternoon\s+snack)[\s\S]*?(?=(?:jantar|$))/gi,
            /(?:jantar|dinner)[\s\S]*?(?=(?:ceia|$))/gi,
            /(?:ceia|supper)[\s\S]*?$/gi
        ];
        
        const refeicoesEncontradas = new Set();
        
        // Buscar refeições numeradas
        let refeicaoMatch;
        const refeicaoRegex = /(?:refeição|refeicao|ref)\s*(\d+)[\s:]*([\s\S]*?)(?=(?:refeição|refeicao|ref)\s*\d+|$)/gi;
        while ((refeicaoMatch = refeicaoRegex.exec(text)) !== null) {
            const numero = refeicaoMatch[1];
            const conteudo = refeicaoMatch[2];
            
            if (!refeicoesEncontradas.has(numero)) {
                refeicoesEncontradas.add(numero);
                
                const alimentos = extrairAlimentos(conteudo);
                if (alimentos.length > 0) {
                    result.dieta.refeicoes.push({
                        nome: `Refeição ${numero}`,
                        alimentos: alimentos
                    });
                }
            }
        }
        
        // Buscar refeições por nome
        const nomesRefeicoes = [
            { pattern: /(?:café\s+da\s+manhã|cafe\s+da\s+manha|breakfast)/i, nome: 'Café da Manhã' },
            { pattern: /(?:lanche\s+da\s+manhã|lanche\s+da\s+manha|morning\s+snack)/i, nome: 'Lanche da Manhã' },
            { pattern: /(?:almoço|almoco|lunch)/i, nome: 'Almoço' },
            { pattern: /(?:lanche\s+da\s+tarde|afternoon\s+snack)/i, nome: 'Lanche da Tarde' },
            { pattern: /(?:jantar|dinner)/i, nome: 'Jantar' },
            { pattern: /(?:ceia|supper)/i, nome: 'Ceia' }
        ];
        
        for (const { pattern, nome } of nomesRefeicoes) {
            const match = text.match(new RegExp(`${pattern.source}[\\s\\S]*?(?=(?:${pattern.source}|refeição|refeicao|ref|$))`, 'i'));
            if (match) {
                const conteudo = match[0];
                const alimentos = extrairAlimentos(conteudo);
                if (alimentos.length > 0) {
                    // Verificar se já não existe uma refeição com esse nome
                    const existe = result.dieta.refeicoes.some(r => r.nome.toLowerCase() === nome.toLowerCase());
                    if (!existe) {
                        result.dieta.refeicoes.push({
                            nome: nome,
                            alimentos: alimentos
                        });
                    }
                }
            }
        }
        
        // Extrair suplementos
        const suplementosSection = text.match(/(?:suplementos?|supplements?)[\s\S]*?(?=(?:fármacos?|medicamentos?|orientações?|$))/i);
        if (suplementosSection) {
            result.suplementos = extrairSuplementosFarmacos(suplementosSection[0]);
        }
        
        // Extrair fármacos
        const farmacosSection = text.match(/(?:fármacos?|farmacos?|medicamentos?)[\s\S]*?(?=(?:orientações?|$))/i);
        if (farmacosSection) {
            result.farmacos = extrairSuplementosFarmacos(farmacosSection[0]);
        }
        
        // Extrair orientações
        const orientacoesMatch = text.match(/(?:orientações?|observações?|notes?|observations?)[\s:]*([\s\S]+?)(?=(?:fármacos?|medicamentos?|$))/i);
        if (orientacoesMatch) {
            result.orientacoes = orientacoesMatch[1].trim();
        }
        
        // Validar e ajustar
        if (!result.aluno.nome || result.aluno.nome === 'Aluno Importado') {
            // Tentar pegar primeiro nome encontrado no início do documento
            const primeiroNome = text.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
            if (primeiroNome) {
                result.aluno.nome = primeiroNome[1].trim();
            }
        }
        
        // Se não encontrou refeições, tentar busca mais ampla
        if (result.dieta.refeicoes.length === 0) {
            // Buscar qualquer tabela ou lista de alimentos
            const alimentosGerais = extrairAlimentos(text);
            if (alimentosGerais.length > 0) {
                result.dieta.refeicoes.push({
                    nome: 'Refeição 1',
                    alimentos: alimentosGerais
                });
            }
        }
        
        console.log('Dados extraídos:', {
            aluno: result.aluno.nome,
            refeicoes: result.dieta.refeicoes.length,
            suplementos: result.suplementos.length,
            farmacos: result.farmacos.length
        });
        
        return result;
        
    } catch (error) {
        console.error('Erro ao processar PDF:', error);
        throw new Error('Erro ao processar PDF: ' + error.message);
    }
}

/**
 * Extrai alimentos de um texto
 */
function extrairAlimentos(texto) {
    const alimentos = [];
    
    // Padrões comuns de alimentos com quantidades
    const padroes = [
        // Formato: "150g arroz branco" ou "arroz branco 150g"
        /(\d+[.,]?\d*)\s*(?:g|ml|gramas?|mililitros?|unidades?|un\.?)\s+([a-záàâãéêíóôõúç\s]+)/gi,
        // Formato: "arroz branco: 150g"
        /([a-záàâãéêíóôõúç\s]+)[\s:]+(\d+[.,]?\d*)\s*(?:g|ml|gramas?|mililitros?|unidades?|un\.?)/gi,
        // Formato: "2 unidades de ovo"
        /(\d+)\s+unidades?\s+(?:de\s+)?([a-záàâãéêíóôõúç\s]+)/gi
    ];
    
    const alimentosEncontrados = new Set();
    
    for (const padrao of padroes) {
        let match;
        while ((match = padrao.exec(texto)) !== null) {
            const quantidade = match[1] || match[2];
            const nome = (match[2] || match[1]).trim().toLowerCase();
            
            // Filtrar palavras comuns que não são alimentos
            if (nome.length < 3 || 
                /^(qtd|quantidade|g|ml|gramas?|mililitros?|unidades?|de|da|do|dos|das|em|com|sem)$/i.test(nome)) {
                continue;
            }
            
            // Normalizar nome
            const nomeNormalizado = nome
                .replace(/\s+/g, ' ')
                .trim();
            
            if (nomeNormalizado.length > 2 && !alimentosEncontrados.has(nomeNormalizado)) {
                alimentosEncontrados.add(nomeNormalizado);
                
                // Determinar unidade
                let unidade = 'g';
                if (match[0].toLowerCase().includes('ml') || match[0].toLowerCase().includes('mililitro')) {
                    unidade = 'ml';
                } else if (match[0].toLowerCase().includes('unidade')) {
                    unidade = 'unidades';
                }
                
                alimentos.push({
                    nome: nomeNormalizado,
                    quantidade: `${quantidade}${unidade === 'unidades' ? ' unidades' : unidade}`
                });
            }
        }
    }
    
    // Se não encontrou com padrões, tentar buscar palavras-chave comuns
    if (alimentos.length === 0) {
        const alimentosComuns = [
            'arroz', 'feijão', 'frango', 'ovo', 'banana', 'batata', 'macarrão',
            'pão', 'leite', 'queijo', 'iogurte', 'aveia', 'whey', 'creatina',
            'peixe', 'carne', 'salada', 'tomate', 'cenoura', 'brócolis'
        ];
        
        for (const alimento of alimentosComuns) {
            if (texto.toLowerCase().includes(alimento)) {
                alimentos.push({
                    nome: alimento,
                    quantidade: '100g'
                });
            }
        }
    }
    
    return alimentos;
}

/**
 * Extrai suplementos ou fármacos de um texto
 */
function extrairSuplementosFarmacos(texto) {
    const itens = [];
    
    // Padrão: "nome: dosagem observação" ou "nome - dosagem"
    const padrao = /([a-záàâãéêíóôõúç\s]+)[\s:]+(\d+[.,]?\d*\s*(?:mg|g|ml|unidades?|un\.?|capsulas?|comprimidos?)?)[\s]*(?:[\-–—]|observação|obs\.?)?[\s]*([^\n]*)/gi;
    
    let match;
    while ((match = padrao.exec(texto)) !== null) {
        const nome = match[1].trim();
        const dosagem = match[2].trim();
        const observacao = (match[3] || '').trim();
        
        if (nome.length > 2) {
            itens.push({
                nome: nome,
                dosagem: dosagem,
                observacao: observacao || null
            });
        }
    }
    
    return itens;
}

module.exports = { parseStudentPDF };
