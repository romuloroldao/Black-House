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

        const structuredNutritionPlan = parseNutritionPlanText(text);
        if (structuredNutritionPlan && structuredNutritionPlan.dieta.refeicoes.length > 0) {
            console.log('Parser de plano alimentar estruturado aplicado:', {
                aluno: structuredNutritionPlan.aluno.nome,
                refeicoes: structuredNutritionPlan.dieta.refeicoes.length
            });
            return structuredNutritionPlan;
        }
        
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

const FOOD_CATEGORY_PATTERNS = [
    /^Carnes e Prote[ií]nas$/i,
    /^P[aã]es e Variedades$/i,
    /^Personalizado\s*-\s*(PROT|CARB|LIP)$/i,
    /^Feij[aã]o e Leguminosas$/i,
    /^Vegetais\s+[AB]/i,
    /^Frutas?$/i,
    /^Leite e Derivados$/i,
    /^Cereais$/i,
    /^Oleaginosas$/i,
    /^Gorduras$/i,
    /^Bebidas$/i,
    /^[ÓO]leos e Gorduras$/i,
    /^Fibras\s+[AB]$/i
];

const MACRO_LINE_PATTERN = /^(Kcal|CHO|PTN|LIP|TOTAL|Saldo cal[oó]rico|Kcal da dieta)\b/i;
const FORBIDDEN_FOOD_PATTERN = /^(ptn|cho|lip|kcal|g?lip\s*g?|g?ptn\s*g?|prote[ií]na|carboidrato|gordura)$/i;

function isFoodCategory(value) {
    return FOOD_CATEGORY_PATTERNS.some(pattern => pattern.test(value.trim()));
}

function isNoiseLine(line) {
    const normalized = line.trim();
    return !normalized ||
        MACRO_LINE_PATTERN.test(normalized) ||
        /^Alimentos substitutos/i.test(normalized) ||
        /^Qtd\s*\(g\/ml\)/i.test(normalized) ||
        /^Dose$/i.test(normalized) ||
        /^dose recomendada$/i.test(normalized) ||
        /^LISTA DE SUBSTITUI[cç][oó]ES?$/i.test(normalized) ||
        /^Grupo dos?\b/i.test(normalized) ||
        /^Grupo das?\b/i.test(normalized);
}

function cleanFoodName(value) {
    return String(value || '')
        .replace(/([A-Za-zÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç)])\d+[,.]?\d*(?=[A-Za-zÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç])[\s\S]*$/g, '$1')
        .replace(/([A-Za-zÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç)])\d+[,.]?\d*$/g, '$1')
        .replace(/\s+\d+[,.]?\d*\s+.+$/g, '')
        .replace(/\s+/g, ' ')
        .replace(/[;|]+$/g, '')
        .trim();
}

function isValidFoodName(value) {
    const normalized = cleanFoodName(value);
    if (normalized.length < 2) return false;
    if (FORBIDDEN_FOOD_PATTERN.test(normalized)) return false;
    if (isFoodCategory(normalized)) return false;
    return !/^(g|ml|qtd|quantidade)$/i.test(normalized);
}

/**
 * Extrai suplementos, fitoterápicos e fármacos da secção COMPLEMENTO (layout Black House).
 */
function parseComplementoSection(text) {
    const suplementos = [];
    const farmacos = [];
    if (!text || !/COMPLEMENTO/i.test(text)) {
        return { suplementos, farmacos, orientacoes: null };
    }

    const complementoIdx = text.search(/COMPLEMENTO/i);
    const orientIdx = text.search(/ORIENTA[cç][ÕO]ES/i);
    const chunk = text.slice(complementoIdx, orientIdx > complementoIdx ? orientIdx : complementoIdx + 8000);

    // Normaliza ruído do OCR layer ([TABELA], cabeçalhos colados)
    const normalizedChunk = chunk
        .replace(/\[TABELA\]\t?/gi, '')
        .replace(/(Pré cama|intra treino|refeição)\s+Dose\t/gi, '$1\nDose\t')
        .replace(/COMPLEMENTO\s+Dose/gi, 'COMPLEMENTO\nDose');

    const lines = normalizedChunk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    let mode = null; // 'suplementacao' | 'fitoterapicos' | 'farmacos' | 'protocolos'

    const hormonePattern = /testosterona|enantato|cipionato|sustanon|nandrolona|\bnpp\b|\bhcg\b|\bgh\b|insulina|trembolona|oxandrolona|stanozolol|somatropina/i;

    const pushItem = (item, targetMode) => {
        if (!item?.nome || item.nome.length < 2) return;
        const isHormone = hormonePattern.test(item.nome) ||
            hormonePattern.test(item.dosagem) ||
            targetMode === 'protocolos';
        if (isHormone || targetMode === 'protocolos' || targetMode === 'farmacos') {
            farmacos.push(item);
        } else {
            suplementos.push(item);
        }
    };

    for (let line of lines) {
        if (/^Dose\s+Suplementa/i.test(line)) { mode = 'suplementacao'; continue; }
        if (/^Dose\s+Fitoter[aá]picos/i.test(line)) { mode = 'fitoterapicos'; continue; }
        if (/^Dose\s+F[aá]rmacos/i.test(line)) { mode = 'farmacos'; continue; }
        if (/^Dose\s+Protocolos/i.test(line)) { mode = 'protocolos'; continue; }
        if (/^ORIENTA/i.test(line)) break;
        if (!mode || /^COMPLEMENTO$/i.test(line)) continue;

        // Linha pode ter sub-cabeçalho colado: "...Dose\tFitoterápicos\tHorário"
        if (/\tDose\t/i.test(line)) {
            const parts = line.split(/\tDose\t/);
            line = parts[parts.length - 1];
            if (/Fitoter[aá]picos/i.test(line)) { mode = 'fitoterapicos'; continue; }
            if (/F[aá]rmacos/i.test(line)) { mode = 'farmacos'; continue; }
            if (/Protocolos/i.test(line)) { mode = 'protocolos'; continue; }
        }

        const cols = line.split('\t').map((c) => c.trim()).filter(Boolean);
        if (cols.length < 2) continue;
        if (/^Dose$/i.test(cols[0]) && cols.length < 3) continue;

        let dosagem;
        let nome;
        let horario = null;

        // Detecta se col0 é dosagem (começa com dígito) ou nome invertido
        const col0IsDose = /^[\d~]/.test(cols[0]) || /^(mg|g|ml|ui|mil)/i.test(cols[0]);

        if (cols.length >= 3 && col0IsDose) {
            dosagem = cols[0];
            nome = cols[1];
            horario = cols[2];
        } else if (cols.length === 2) {
            if (col0IsDose) {
                dosagem = cols[0];
                nome = cols[1];
                horario = /refeição|treino|cama|segunda|domingo/i.test(cols[1]) ? cols[1] : null;
                if (horario) {
                    // "2g + vitamina...\t1° refeição" — nome na dosagem
                    const doseName = cols[0];
                    if (doseName.length > 15 && !horario) {
                        nome = doseName;
                        dosagem = 'Conforme ficha';
                    } else if (/refeição|treino|cama/i.test(cols[1])) {
                        nome = cols[0].replace(/\t.*$/, '');
                        dosagem = nome.match(/^[\d~].+?(?= [A-Za-zÁÀÂÃ])/)?.[0] || cols[0];
                        horario = cols[1];
                        // "2g + 15~20mg Vitamina C...\t1° refeição"
                        const m = cols[0].match(/^(.+?)\s+(\d)/);
                        if (m && cols[0].length > 20) {
                            dosagem = cols[0];
                            nome = cols[0].includes('Vitamina') ? 'Vitamina C + Zinco' :
                                cols[0].includes('D3') ? 'Vitamina D3 + K2' :
                                cols[0].includes('Magnésio') ? 'Magnésio Treonato' : cols[0].slice(0, 80);
                        }
                    }
                }
            } else {
                dosagem = cols[1];
                nome = cols[0];
            }
        } else {
            dosagem = cols[0];
            nome = cols[1];
        }

        // Corrige linhas fitoterápicos com dosagem+nome fundidos na col0
        if (nome && /^[\d~]/.test(nome) && dosagem && dosagem.length > 10) {
            const tmp = dosagem;
            dosagem = tmp;
            if (/vitamina\s+c/i.test(tmp)) nome = 'Vitamina C efervescente + Zinco';
            else if (/vitamina\s+d3/i.test(tmp)) nome = 'Vitamina D3 + K2';
            else if (/magn[eé]sio/i.test(tmp)) nome = 'Magnésio Treonato';
            else if (/complexo\s+b/i.test(tmp)) nome = 'Complexo B';
            else nome = tmp.slice(0, 100);
        }

        if (nome && /^\d+[°º]?\s*refeição/i.test(nome) && dosagem) {
            horario = nome;
            nome = dosagem.includes('Vitamina') ? dosagem : 'Suplemento';
        }

        pushItem({ nome: String(nome).trim(), dosagem: String(dosagem || 'Conforme ficha').trim(), horario, observacao: null }, mode);
    }

    let orientacoes = null;
    if (orientIdx >= 0) {
        orientacoes = text.slice(orientIdx)
            .replace(/^ORIENTA[cç][ÕO]ES\s*/i, '')
            .trim()
            .slice(0, 5000) || null;
    }

    return { suplementos, farmacos, orientacoes };
}

/**
 * Parseia linha tabular de alimento: "Categoria\t40 Nome" ou "Cat\t40 Nome\t40 Alt1".
 */
function parseTabularFoodLine(line) {
    if (!line.includes('\t')) return null;

    const cols = line.split('\t').map((c) => c.trim()).filter((c) => c.length > 0);
    if (cols.length < 2) return null;

    const category = cols[0];
    if (!isFoodCategory(category) && !/^Personalizado\s*-/i.test(category)) return null;

    const items = [];
    for (let i = 1; i < cols.length; i++) {
        const col = cols[i];
        const m = col.match(/^(\d+[,.]?\d*)\s+(.+)$/);
        if (!m) continue;
        const qty = `${m[1].replace(',', '.')}g`;
        const nome = cleanFoodName(m[2]);
        if (!isValidFoodName(nome)) continue;
        const food = { nome, quantidade: qty };
        if (i === 1) {
            items.push({ main: food, alternativas: [] });
        } else if (items.length > 0) {
            items[0].alternativas.push({ nome, quantidade: qty });
        }
    }

    if (items.length === 0) {
        // "Carnes e Proteínas\t90\t163 Peito de peru\t112 Peito de frango"
        const complex = cols.slice(1);
        let main = null;
        const alternativas = [];
        for (const col of complex) {
            const m2 = col.match(/^(\d+[,.]?\d*)\s+(.+)$/);
            if (m2) {
                const entry = { nome: cleanFoodName(m2[2]), quantidade: `${m2[1].replace(',', '.')}g` };
                if (!isValidFoodName(entry.nome)) continue;
                if (!main) main = entry;
                else alternativas.push(entry);
            } else if (/^\d+[,.]?\d*$/.test(col) && main) {
                // qty only column before name in next col — handled in next iteration
            }
        }
        if (main) items.push({ main, alternativas });
    }

    return items.length > 0 ? items : null;
}

function parseNutritionPlanText(text) {
    if (!text || !/PLANO ALIMENTAR/i.test(text) || !/Refei[cç][aã]o\s+\d+/i.test(text)) {
        return null;
    }

    const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const lines = rawLines.map((line) => {
        if (line.includes('\t')) return line;
        return line.replace(/\s+/g, ' ').trim();
    });

    const result = {
        aluno: {
            nome: extractStudentNameFromPlan(lines),
            peso: extractNumberAfterLabel(text, /Peso\s*\(kg\)/i),
            altura: extractNumberAfterLabel(text, /Altura\s*\(cm\)/i),
            idade: extractNumberAfterLabel(text, /Idade\s*\(anos\)/i),
            objetivo: null
        },
        dieta: {
            nome: 'Plano Alimentar Importado',
            objetivo: null,
            refeicoes: [],
            macros: extractDietMacros(text)
        },
        suplementos: [],
        farmacos: [],
        orientacoes: null
    };

    const complemento = parseComplementoSection(text);
    result.suplementos = complemento.suplementos;
    result.farmacos = complemento.farmacos;
    result.orientacoes = complemento.orientacoes;

    let currentMeal = null;
    let currentFood = null;
    let pendingCategory = null;
    let planIndex = 0;
    const mealOccurrences = new Map();
    const seenByMeal = new Map();

    const pushCurrentFood = () => {
        if (!currentMeal || !currentFood) return;
        currentFood.nome = cleanFoodName(currentFood.nome);
        if (!isValidFoodName(currentFood.nome)) {
            currentFood = null;
            return;
        }

        const key = `${currentFood.nome.toLowerCase()}|${currentFood.quantidade}`;
        const seen = seenByMeal.get(currentMeal.nome) || new Set();
        if (!seen.has(key)) {
            currentMeal.alimentos.push(currentFood);
            seen.add(key);
            seenByMeal.set(currentMeal.nome, seen);
        }
        currentFood = null;
    };

    for (const line of lines) {
        const mealMatch = line.match(/^Refei[cç][aã]o\s+(\d+)/i);
        if (mealMatch) {
            pushCurrentFood();
            const mealNumber = mealMatch[1];
            if (mealNumber === '1') {
                planIndex += 1;
            }
            const occurrenceCount = (mealOccurrences.get(mealNumber) || 0) + 1;
            mealOccurrences.set(mealNumber, occurrenceCount);
            const planLetter =
                planIndex > 1 || occurrenceCount > 1
                    ? String.fromCharCode(64 + Math.max(planIndex, 1))
                    : 'A';
            const planPrefix = planLetter !== 'A' ? `Plano ${planLetter} - ` : '';
            currentMeal = {
                nome: `${planPrefix}Refeição ${mealNumber}`,
                plano: planLetter,
                alimentos: [],
            };
            result.dieta.refeicoes.push(currentMeal);
            pendingCategory = null;
            continue;
        }

        if (MACRO_LINE_PATTERN.test(line) || /^Alimentos substitutos/i.test(line)) {
            pushCurrentFood();
            currentMeal = null;
            pendingCategory = null;
            continue;
        }

        if (!currentMeal || isNoiseLine(line)) {
            continue;
        }

        // Linha tabular completa: Categoria + alimento(s) + substitutos
        const tabFoods = parseTabularFoodLine(line);
        if (tabFoods) {
            pushCurrentFood();
            pendingCategory = null;
            for (const { main, alternativas } of tabFoods) {
                if (alternativas?.length) main.alternativas = alternativas;
                const key = `${main.nome.toLowerCase()}|${main.quantidade}`;
                const seen = seenByMeal.get(currentMeal.nome) || new Set();
                if (!seen.has(key)) {
                    currentMeal.alimentos.push(main);
                    seen.add(key);
                    seenByMeal.set(currentMeal.nome, seen);
                }
            }
            continue;
        }

        if (isFoodCategory(line)) {
            pushCurrentFood();
            pendingCategory = line;
            continue;
        }

        if (pendingCategory) {
            const quantityMatch = line.match(/^(\d+[,.]?\d*)\s*(.*)$/);
            if (quantityMatch) {
                pushCurrentFood();
                currentFood = {
                    nome: cleanFoodName(quantityMatch[2]),
                    quantidade: `${quantityMatch[1].replace(',', '.')}g`
                };
                pendingCategory = null;

                if (currentFood.nome && !/[,(]$/.test(currentFood.nome) && !/\bou$/i.test(currentFood.nome)) {
                    pushCurrentFood();
                }
                continue;
            }
        }

        const itemMatch = line.match(/^(.+?)\s+(\d+[,.]?\d*)\s*(.*)$/);
        if (itemMatch && isFoodCategory(itemMatch[1])) {
            pushCurrentFood();
            const foodName = cleanFoodName(itemMatch[3]);
            currentFood = {
                nome: foodName,
                quantidade: `${itemMatch[2].replace(',', '.')}g`
            };

            if (currentFood.nome && !/[()]$/.test(currentFood.nome)) {
                pushCurrentFood();
            }
            continue;
        }

        if (currentFood && !isNoiseLine(line)) {
            currentFood.nome = cleanFoodName(`${currentFood.nome} ${line}`);
            if (/[)]$/.test(currentFood.nome)) {
                pushCurrentFood();
            }
        }
    }

    pushCurrentFood();

    result.dieta.refeicoes = result.dieta.refeicoes.filter(refeicao => refeicao.alimentos.length > 0);

    return result.dieta.refeicoes.length > 0 ? result : null;
}

/**
 * Cabeçalho típico (pdf layout-aware): "Nome Armando Jr Kcal da dietaObjetivo"
 * ou com quebras — o nome fica colado entre "Nome" e "Kcal"/"Objetivo"/"Peso (kg)".
 */
function extractNameFromNomeHeader(chunk) {
    if (!chunk || typeof chunk !== 'string') return null;
    const m = chunk.match(/Nome\s+(.+?)(?=\s+Kcal\b|\s+Objetivo\b|\s+Peso\s*\(kg\))/iu);
    if (!m) return null;
    let name = m[1].replace(/\s+/g, ' ').trim();
    if (name.length < 2) return null;
    if (/^lista\s+de\b/i.test(name) || /substitui[cç]/i.test(name)) return null;
    if (/^(kcal|objetivo|peso|idade)\b/i.test(name)) return null;
    return name.length > 255 ? name.slice(0, 255) : name;
}

/** Linhas que passam no regex "nome próprio" mas não são o aluno (listas, grupos, PDF colado). */
function isFalsePositiveNameLine(line) {
    const t = String(line || '').trim();
    if (!t) return true;
    if (/^LISTA\s+DE\s+SUBSTIT/i.test(t)) return true;
    if (/SUBSTITUI[cç][oó]ES?$/i.test(t) || /substitui[cç][oó]es\b/i.test(t)) return true;
    if (/^Livre[A-ZÀ-ŸÁÂÃÉÍÓÔÕÚÇ]/i.test(t)) return true;
    if (/^Grupo\s+dos?\b/i.test(t) || /^Grupo\s+das?\b/i.test(t)) return true;
    if (/alimentos\s+de\s+prefer/i.test(t)) return true;
    return false;
}

function extractStudentNameFromPlan(lines) {
    const blocked = /^(PLANO ALIMENTAR|Nome Objetivo|Refei[cç][aã]o|Kcal|TOTAL|Dose|Alimentos|LISTA\s+DE\s+SUBSTIT)/i;

    const headerChunk = lines.slice(0, 45).join('\n');
    const fromHeader = extractNameFromNomeHeader(headerChunk);
    if (fromHeader) return fromHeader;

    const planIndex = lines.findIndex(line => /^PLANO ALIMENTAR/i.test(line));
    if (planIndex >= 0 && lines[planIndex + 1]) {
        const fromNext = extractNameFromNomeHeader(lines[planIndex + 1]);
        if (fromNext) return fromNext;
    }

    if (planIndex > 0) {
        for (let index = planIndex - 1; index >= Math.max(0, planIndex - 8); index -= 1) {
            const line = lines[index];
            if (isPersonNameCandidate(line) && !blocked.test(line) && !isFalsePositiveNameLine(line)) {
                return line;
            }
        }
    }

    if (planIndex === 0) {
        const firstMealIdx = lines.findIndex((l, i) => i > 0 && /^Refei[cç][aã]o\s+\d+/i.test(l));
        const end = firstMealIdx === -1 ? Math.min(lines.length, planIndex + 25) : firstMealIdx;
        for (let i = planIndex + 1; i < end; i++) {
            const line = lines[i];
            if (isPersonNameCandidate(line) && !blocked.test(line) && !isFalsePositiveNameLine(line)) {
                return line;
            }
        }
    }

    const candidate = lines.find(
        (line) => isPersonNameCandidate(line) && !blocked.test(line) && !isFalsePositiveNameLine(line)
    );

    return candidate || 'Aluno Importado';
}

function isPersonNameCandidate(line) {
    return /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][A-Za-zÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç]+(?:\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][A-Za-zÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç]+)+$/.test(line) &&
        !/(Whey|Protein|Margarina|Becel|Arroz|Feij[aã]o|Frango|Carne|Ovo|P[aã]o|Requeij[aã]o|Mussarela|Banana|Abobrinha|Cenoura)/i.test(line);
}

function extractNumberAfterLabel(text, labelPattern) {
    const match = text.match(new RegExp(`${labelPattern.source}[^\\d]*(\\d+[,.]?\\d*)`, 'i'));
    return match ? parseFloat(match[1].replace(',', '.')) : null;
}

function extractDietMacros(text) {
    const macros = {};
    const calories = text.match(/Kcal da dieta\s+[\s\S]{0,40}?(\d+[,.]?\d*)/i);
    if (calories) macros.calorias = parseFloat(calories[1].replace(',', '.'));
    return macros;
}

// IMPRECISÃO-007: Removidas listas hardcoded de fármacos/suplementos
// (Glifage XR, Clenbuterol, Testosterona, Complexo B, Magnésio treonato,
// Pré Treino, Vitamina C, Ômega 3, Vitamina D3+K2, Creatina). Essas listas
// estavam injetando itens em TODA importação cujo PDF tivesse o cabeçalho
// "PLANO ALIMENTAR", criando dados fantasmas na ficha do aluno.
//
// Quando a IA não está disponível, o fallback local agora só devolve o que
// efetivamente conseguiu extrair via regex genérica das seções de
// "Suplementos" e "Fármacos" do texto (ver `extrairSuplementosFarmacos`).
function extractFarmacosFromPlan() {
    return [];
}

function extractSupplementosFromPlan() {
    return [];
}

// Mantida por compatibilidade interna — não usada após a correção acima.
function pushKnownProtocolItem(items, lines, name, dosagem, observacao = null) {
    const lineIndex = lines.findIndex(line => line.toLowerCase().startsWith(name.toLowerCase()));
    if (lineIndex === -1) return;

    items.push({
        nome: name,
        dosagem: dosagem || 'Conforme ficha',
        observacao: observacao || findNextLikelyObservation(lines, lineIndex)
    });
}

function isDoseValue(line) {
    return /^(\d+[,.]?\d*\s*(mcg|mg|g|ml|ui)|\d+mil ui|\d+ml|\d+g|\d+mg|dose recomendada)/i.test(line.trim());
}

function nextContentLine(lines, anchor, options = {}) {
    const index = lines.findIndex(line => line.toLowerCase().startsWith(anchor.toLowerCase()));
    if (index === -1) return null;

    for (let cursor = index + 1; cursor < Math.min(lines.length, index + 6); cursor += 1) {
        const line = lines[cursor];
        if (!line) continue;
        if (options.skipHorario && /^Horário$/i.test(line)) continue;
        if (isDoseValue(line) || /^(Dose|Horário|FármacosHorário|ProtocolosHorário|FitoterápicosHorário|Suplementação|COMPLEMENTO)$/i.test(line)) continue;
        if (/^\*/.test(line)) continue;
        return line;
    }

    return null;
}

function extractInlineOrNextObservation(lines, anchor) {
    const index = lines.findIndex(line => line.toLowerCase().startsWith(anchor.toLowerCase()));
    if (index === -1) return null;

    const line = lines[index];
    const inline = line.slice(anchor.length).trim();
    if (inline) return inline;

    return nextContentLine(lines, anchor);
}

function findNextLikelyObservation(lines, index) {
    for (let cursor = index + 1; cursor < Math.min(lines.length, index + 4); cursor += 1) {
        const line = lines[cursor];
        if (!line || /^(Dose|Horário|Fármacos|Suplementação|Fitoterápicos|Protocolos|COMPLEMENTO)$/i.test(line)) continue;
        if (isDoseValue(line)) continue;
        if (/^\*/.test(line)) continue;
        return line;
    }

    return null;
}

function dedupeProtocolItems(items) {
    const seen = new Set();
    return items.filter(item => {
        const key = item.nome.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
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
    
    // IMPRECISÃO-008: Removido fallback de "alimentos comuns" hardcoded
    // (`arroz, feijão, frango, ovo, ...`) que era adicionado quando o regex
    // não encontrava nada. Isso gerava alimentos genéricos a 100g em fichas
    // que apenas mencionavam essas palavras em outro contexto. Agora,
    // se a regex não encontra alimentos válidos, devolvemos lista vazia e
    // o coach revisa/adiciona manualmente.
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

module.exports = {
    parseStudentPDF,
    parseNutritionPlanText,
    parseComplementoSection
};
