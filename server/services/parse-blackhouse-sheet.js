/**
 * Parser de planilha Black House (CSV / XLSX / grid tabular).
 * Layout: colunas C+ com cabeçalhos "PLANO ALIMENTAR", "Refeição N", "COMPLEMENTO".
 */

const FOOD_CATEGORY_PATTERNS = [
    /^Carnes e Prote[ií]nas$/i,
    /^Personalizado/i,
    /^P[aã]es e Variedades$/i,
    /^Vegetais\s+[AB]/i,
    /^Frutas?$/i,
    /^Leite e Derivados$/i,
    /^Cereais$/i,
    /^Oleaginosas$/i,
    /^Gorduras$/i,
    /^Bebidas$/i,
    /^[ÓO]leos e Gorduras$/i,
    /^Fibras\s+[AB]$/i,
];

const FORBIDDEN_FOOD_PATTERN = /^(ptn|cho|lip|kcal|g?lip\s*g?|g?ptn\s*g?|prote[ií]na|carboidrato|gordura)$/i;

const MESES = {
    janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5, junho: 6,
    julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

function cell(row, col) {
    if (!row || col < 0) return '';
    const v = row[col];
    if (v === null || v === undefined) return '';
    return String(v).trim();
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

function isFoodCategory(value) {
    return FOOD_CATEGORY_PATTERNS.some((pattern) => pattern.test(String(value || '').trim()));
}

function isValidFoodName(value) {
    const normalized = cleanFoodName(value);
    if (normalized.length < 2) return false;
    if (FORBIDDEN_FOOD_PATTERN.test(normalized)) return false;
    if (isFoodCategory(normalized)) return false;
    return !/^(g|ml|qtd|quantidade)$/i.test(normalized);
}

function formatQuantity(value) {
    if (value === null || value === undefined || value === '') return '';
    const s = String(value).trim();
    if (!s) return '';
    if (/g|ml|un|ui|mg|caps/i.test(s)) return s;
    const n = parseFloat(s.replace(',', '.'));
    if (Number.isFinite(n) && n > 0) {
        const rounded = Math.round(n * 10) / 10;
        return Number.isInteger(rounded) ? `${rounded}g` : `${rounded}g`;
    }
    return s;
}

function parseNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
}

function findCell(rows, predicate) {
    for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        for (let c = 0; c < row.length; c++) {
            const v = cell(row, c);
            if (v && predicate(v, r, c, row)) {
                return { row: r, col: c, value: v };
            }
        }
    }
    return null;
}

function findLabelValue(rows, labelRegex, valueOffset = 1) {
    const hit = findCell(rows, (v) => labelRegex.test(v));
    if (!hit) return null;
    const row = rows[hit.row];
    for (let c = hit.col + 1; c < row.length; c++) {
        const v = cell(row, c);
        if (v && !labelRegex.test(v) && !/Prote[ií]na total|Kcal\/Kg|Macros|Estrat[eé]gia/i.test(v)) {
            return v;
        }
    }
    return cell(row, hit.col + valueOffset) || null;
}

function findLabelValueSameRow(rows, labelRegex) {
    for (const row of rows) {
        for (let c = 0; c < row.length; c++) {
            if (!labelRegex.test(cell(row, c))) continue;
            for (let j = c + 1; j < row.length; j++) {
                const v = cell(row, j);
                if (!v || labelRegex.test(v)) continue;
                if (/Prote[ií]na total|Kcal|Macros|Estrat[eé]gia|GET|CHO|PTN|LIP/i.test(v)) continue;
                if (/^\d+([.,]\d+)?(\s*(g|%|kcal))?$/i.test(v)) continue;
                return v;
            }
            return null;
        }
    }
    return null;
}

function detectComplementoMode(row) {
    for (let c = 0; c < row.length; c++) {
        const v = cell(row, c);
        const next = cell(row, c + 1);
        if (/^Dose$/i.test(v) && /Suplementa/i.test(next)) return 'suplementacao';
        if (/^Dose$/i.test(v) && /Fitoter[aá]picos/i.test(next)) return 'fitoterapicos';
        if (/^Dose$/i.test(v) && /F[aá]rmacos/i.test(next)) return 'farmacos';
        if (/^Dose$/i.test(v) && /Protocolos/i.test(next)) return 'protocolos';
        if (/^Dose\s+Suplementa/i.test(v)) return 'suplementacao';
        if (/^Dose\s+Fitoter[aá]picos/i.test(v)) return 'fitoterapicos';
        if (/^Dose\s+F[aá]rmacos/i.test(v)) return 'farmacos';
        if (/^Dose\s+Protocolos/i.test(v)) return 'protocolos';
    }
    return null;
}

function parseReturnFromFileName(fileName) {
    const base = String(fileName || '').replace(/\.[^.]+$/, '');
    const m = base.match(/Retorno\s+(\d{1,2})\s+de\s+(\w+)/i);
    if (!m) return { dietaNome: null, dataRetorno: null };
    const day = parseInt(m[1], 10);
    const monthKey = m[2].toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    const month = MESES[monthKey] || MESES[m[2].toLowerCase()];
    const year = new Date().getFullYear();
    const dietaNome = `Retorno ${m[1]} de ${m[2].charAt(0).toUpperCase()}${m[2].slice(1).toLowerCase()}`;
    if (!month || day < 1 || day > 31) return { dietaNome, dataRetorno: null };
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return { dietaNome, dataRetorno: `${year}-${mm}-${dd}` };
}

function parseComplementoGrid(rows, startRow) {
    const suplementos = [];
    const farmacos = [];
    let mode = null;
    const orientacoesLines = [];

    for (let r = startRow; r < rows.length; r++) {
        const row = rows[r];
        const joined = row.map((c) => String(c ?? '').trim()).filter(Boolean).join(' ');

        if (/^\*+\s*Tem que terminar/i.test(joined) || /^ORIENTA/i.test(joined)) {
            orientacoesLines.push(joined.replace(/^\*\s*/, '').trim());
            continue;
        }

        const modeFromRow = detectComplementoMode(row);
        if (modeFromRow) {
            mode = modeFromRow;
            continue;
        }

        const idx = cell(row, 1);
        const dose = cell(row, 2) || cell(row, 3);
        const nome = cell(row, 3) || cell(row, 4);
        const horario = cell(row, 8) || cell(row, 7) || cell(row, 6) || cell(row, 5);

        if (!mode || !idx || !/^\d+$/.test(idx)) continue;
        if (!nome || nome.length < 2) continue;
        if (/^Dose$/i.test(nome)) continue;

        const item = {
            nome: cleanFoodName(nome),
            dosagem: dose || 'Conforme ficha',
            horario: horario || null,
            observacao: horario ? null : undefined,
        };

        const hormone = /testosterona|enantato|cipionato|nandrolona|\bhcg\b|\bgh\b|oxandrolona/i;
        const toFarmaco = mode === 'farmacos' || mode === 'protocolos' || hormone.test(nome);

        if (toFarmaco) farmacos.push(item);
        else suplementos.push(item);
    }

    return {
        suplementos,
        farmacos,
        orientacoes: orientacoesLines.length ? orientacoesLines.join('\n') : null,
    };
}

function parseFoodRow(row) {
    const lineNum = cell(row, 1);
    if (!lineNum || !/^\d+$/.test(lineNum)) return null;

    const qty = cell(row, 3);
    const nome = cell(row, 4);
    if (!isValidFoodName(nome)) return null;

    const alimento = {
        nome: cleanFoodName(nome),
        quantidade: formatQuantity(qty) || '100g',
        alternativas: [],
    };

    const altPairs = [
        [5, 6],
        [7, 8],
        [9, 10],
    ];
    for (const [qCol, nCol] of altPairs) {
        const altNome = cell(row, nCol);
        if (!isValidFoodName(altNome)) continue;
        alimento.alternativas.push({
            nome: cleanFoodName(altNome),
            quantidade: formatQuantity(cell(row, qCol)) || alimento.quantidade,
        });
    }

    return alimento;
}

function isBlackHousePlanGrid(rows) {
    if (!rows?.length) return false;
    const hasPlan = findCell(rows, (v) => /PLANO ALIMENTAR/i.test(v));
    const hasMeal = findCell(rows, (v) => /^Refei[cç][aã]o\s+\d+/i.test(v));
    return !!(hasPlan || hasMeal);
}

/**
 * @param {string[][]} rows
 * @param {{ fileName?: string }} options
 */
function parseBlackHouseGrid(rows, options = {}) {
    const { fileName = '' } = options;

    if (!rows?.length) {
        throw new Error('Planilha vazia ou ilegível');
    }

    if (!isBlackHousePlanGrid(rows)) {
        throw new Error(
            'Formato de planilha não reconhecido. Use o modelo Black House (aba A, B, etc.) em CSV ou XLSX.'
        );
    }

    const planHit = findCell(rows, (v) => /PLANO ALIMENTAR\s*-?\s*([A-Z0-9]+)?/i.test(v));
    const planLabel = planHit?.value?.match(/PLANO ALIMENTAR\s*-?\s*([A-Z0-9]+)?/i);
    const planSuffix = planLabel?.[1] ? ` - Plano ${planLabel[1]}` : '';

    const { dietaNome: nomeFromFile, dataRetorno } = parseReturnFromFileName(fileName);

    const aluno = {
        nome: findLabelValue(rows, /^Nome\s*$/i) || 'Aluno Importado',
        peso: parseNumber(findLabelValue(rows, /Peso\s*\(kg\)/i)),
        altura: parseNumber(findLabelValue(rows, /Altura\s*\(cm\)/i)),
        idade: parseNumber(findLabelValue(rows, /Idade\s*\(anos\)/i)),
        objetivo: findLabelValueSameRow(rows, /Objetivo/i) || null,
    };

    const refeicoes = [];
    let currentMeal = null;
    let complementoStart = rows.length;

    for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        let mealMatch = null;
        for (let c = 0; c < row.length; c++) {
            const m = cell(row, c).match(/^Refei[cç][aã]o\s+(\d+)/i);
            if (m) {
                mealMatch = m[1];
                break;
            }
        }

        if (cell(row, 2) === 'COMPLEMENTO' || /^COMPLEMENTO$/i.test(cell(row, 2))) {
            complementoStart = r;
            break;
        }

        if (mealMatch) {
            currentMeal = {
                nome: `Refeição ${mealMatch}${planSuffix}`,
                plano: planSuffix ? planSuffix.replace(/^\s*-\s*/, '') : null,
                alimentos: [],
            };
            refeicoes.push(currentMeal);
            continue;
        }

        if (!currentMeal) continue;

        const food = parseFoodRow(row);
        if (food) currentMeal.alimentos.push(food);
    }

    const complemento = parseComplementoGrid(rows, complementoStart);

    const dietaNome =
        (nomeFromFile ? `${nomeFromFile}${planSuffix}` : null) ||
        (planHit?.value ? planHit.value.trim() : 'Plano Alimentar Importado');

    const result = {
        aluno,
        dieta: {
            nome: dietaNome,
            objetivo: aluno.objetivo,
            refeicoes: refeicoes.filter((ref) => ref.alimentos.length > 0),
            macros: {},
        },
        suplementos: complemento.suplementos,
        farmacos: complemento.farmacos,
        orientacoes: complemento.orientacoes,
    };

    if (dataRetorno) {
        result.dieta.data_retorno = dataRetorno;
    }

    if (!result.dieta.refeicoes.length) {
        throw new Error('Nenhuma refeição com alimentos encontrada. Verifique se a aba do plano (ex.: A ou B) está correcta.');
    }

    return result;
}

module.exports = {
    parseBlackHouseGrid,
    isBlackHousePlanGrid,
    parseReturnFromFileName,
    cleanFoodName,
    isValidFoodName,
    formatQuantity,
};
