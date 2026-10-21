/**
 * Normalização de entidades — sinónimos, abreviações, OCR imperfeito.
 */

const { HORMONE_ERGO_KEYWORDS, SUPPLEMENT_KEYWORDS } = require('./constants');

const ENTITY_ALIASES = {
    // Suplementos
    'whey protein': 'Whey Protein',
    '100% whey': 'Whey Protein',
    'whey': 'Whey Protein',
    'creatina monohidratada': 'Creatina',
    'creatina': 'Creatina',
    'glutamina': 'Glutamina',
    'pre treino': 'Pré-treino',
    'pré treino': 'Pré-treino',
    'pre-treino': 'Pré-treino',
    'pos treino': 'Pós-treino',
    'pós treino': 'Pós-treino',
    'omega 3': 'Ômega 3',
    'ômega 3': 'Ômega 3',
    'vit d3': 'Vitamina D3',
    'vitamina d3+k2': 'Vitamina D3+K2',
    // Hormônios / ergogênicos
    'dura': 'Durateston',
    'durateston': 'Durateston',
    'testo': 'Testosterona',
    'testosterona': 'Testosterona',
    'deca': 'Nandrolona (Deca)',
    'nandrolona': 'Nandrolona',
    'oxandro': 'Oxandrolona',
    'oxandrolona': 'Oxandrolona',
    'trembo': 'Trembolona',
    'trembolona': 'Trembolona',
    'winstrol': 'Stanozolol',
    'stanozolol': 'Stanozolol',
    'gh': 'GH (Hormônio do Crescimento)',
    'somatropina': 'GH (Hormônio do Crescimento)'
};

function normalizeKey(str) {
    return String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function resolveAlias(name) {
    const key = normalizeKey(name);
    if (ENTITY_ALIASES[key]) return ENTITY_ALIASES[key];
    // match parcial por token
    for (const [alias, canonical] of Object.entries(ENTITY_ALIASES)) {
        if (key === alias || key.startsWith(alias + ' ') || key.endsWith(' ' + alias)) {
            return canonical;
        }
    }
    return String(name || '').trim();
}

function containsKeyword(text, keywords) {
    const n = normalizeKey(text);
    return keywords.some((kw) => n.includes(normalizeKey(kw)));
}

function isHormoneOrErgo(name) {
    return containsKeyword(name, HORMONE_ERGO_KEYWORDS);
}

function isSupplement(name) {
    return containsKeyword(name, SUPPLEMENT_KEYWORDS);
}

function normalizeProtocolItem(item) {
    if (!item || !item.nome) return item;
    return {
        ...item,
        nome: resolveAlias(item.nome),
        dosagem: String(item.dosagem || '').trim() || item.dosagem
    };
}

function normalizeAlimento(alimento) {
    if (!alimento) return alimento;
    const out = {
        ...alimento,
        nome: String(alimento.nome || '').trim()
    };
    if (Array.isArray(alimento.alternativas)) {
        out.alternativas = alimento.alternativas.map((alt) => ({
            nome: String(alt.nome || '').trim(),
            quantidade: String(alt.quantidade || alimento.quantidade || '').trim()
        })).filter((a) => a.nome);
    }
    return out;
}

/**
 * Reclassifica itens entre suplementos e fármacos com base em léxico contextual.
 */
function reclassifyProtocol(suplementos = [], farmacos = []) {
    const supOut = [];
    const farmOut = [];

    for (const raw of suplementos) {
        const item = normalizeProtocolItem(raw);
        if (isHormoneOrErgo(item.nome) && !isSupplement(item.nome)) {
            farmOut.push(item);
        } else {
            supOut.push(item);
        }
    }

    for (const raw of farmacos) {
        const item = normalizeProtocolItem(raw);
        if (isSupplement(item.nome) && !isHormoneOrErgo(item.nome)) {
            supOut.push(item);
        } else {
            farmOut.push(item);
        }
    }

    return {
        suplementos: dedupeByName(supOut),
        farmacos: dedupeByName(farmOut)
    };
}

function dedupeByName(items) {
    const seen = new Set();
    return items.filter((item) => {
        const k = normalizeKey(item.nome);
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
    });
}

function normalizeExtractedData(data) {
    if (!data || typeof data !== 'object') return data;

    const aluno = data.aluno || {};
    const protocol = reclassifyProtocol(data.suplementos || [], data.farmacos || []);

    const dieta = data.dieta ? {
        ...data.dieta,
        refeicoes: (data.dieta.refeicoes || []).map((ref) => ({
            ...ref,
            alimentos: (ref.alimentos || []).map(normalizeAlimento)
        }))
    } : data.dieta;

    return {
        ...data,
        aluno: { ...aluno },
        dieta,
        suplementos: protocol.suplementos,
        farmacos: protocol.farmacos
    };
}

module.exports = {
    normalizeExtractedData,
    resolveAlias,
    isHormoneOrErgo,
    isSupplement,
    reclassifyProtocol
};
