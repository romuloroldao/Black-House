/**
 * Camada 4 — Validação contextual e correções automáticas.
 */

const {
    INVALID_STUDENT_NAME_PATTERNS,
    EXERCISE_KEYWORDS
} = require('./constants');
const { isHormoneOrErgo } = require('./entity-normalizer');

function stripAccents(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isPlausibleStudentName(name) {
    const n = String(name || '').trim();
    if (n.length < 3) return false;
    for (const p of INVALID_STUDENT_NAME_PATTERNS) {
        if (p.test(n)) return false;
    }
    // deve ter pelo menos 2 palavras com letras
    const words = n.split(/\s+/).filter((w) => /[A-Za-zÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç]{2,}/.test(w));
    if (words.length < 2) return false;
    // muitos dígitos → suspeito
    if ((n.match(/\d/g) || []).length > 2) return false;
    return true;
}

function extractNameFromHeaderText(text) {
    const chunk = String(text || '').slice(0, 4000);
    // Nome colado: "NomeJoão Silva" ou "Nome\tJoão Silva"
    const m1 = chunk.match(/\bNome\s*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][A-Za-zÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç]+(?:\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][A-Za-zÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç]+)+)/);
    if (m1 && isPlausibleStudentName(m1[1])) return m1[1].trim();

    const m2 = chunk.match(/\bNome\s+([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][^\n\t]{2,60}?)(?=\s*(?:Kcal|Objetivo|Peso|Altura|Idade|PLANO|$))/i);
    if (m2 && isPlausibleStudentName(m2[1])) return m2[1].trim();

    return null;
}

function normalizeBrazilPhone(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (digits.length === 11) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return raw ? String(raw).trim() : null;
}

function extractPhoneFromText(text) {
    const m = String(text || '').match(/(?:\(?\d{2}\)?\s*)?\d{4,5}[-\s]?\d{4}/);
    return m ? normalizeBrazilPhone(m[0]) : null;
}

function extractAgeFromText(text) {
    const m = String(text || '').match(/Idade\s*(?:\(anos\))?\s*[:.]?\s*(\d{1,3})/i);
    if (m) {
        const age = parseInt(m[1], 10);
        if (age >= 10 && age <= 120) return age;
    }
    return null;
}

function extractWeightFromText(text) {
    const m = String(text || '').match(/Peso\s*(?:\(kg\))?\s*[:.]?\s*(\d{2,3}[,.]?\d*)/i);
    if (m) {
        const w = parseFloat(m[1].replace(',', '.'));
        if (w >= 30 && w <= 300) return w;
    }
    return null;
}

function extractHeightFromText(text) {
    const m = String(text || '').match(/Altura\s*(?:\(cm\))?\s*[:.]?\s*(\d{2,3}[,.]?\d*)/i);
    if (m) {
        const h = parseFloat(m[1].replace(',', '.'));
        if (h >= 100 && h <= 250) return h;
    }
    return null;
}

function looksLikeExercise(foodName) {
    const n = stripAccents(foodName).toLowerCase();
    return EXERCISE_KEYWORDS.some((ex) => n.includes(stripAccents(ex).toLowerCase()));
}

function validateAndFix(data, context = {}) {
    const issues = [];
    const fixes = [];
    const out = JSON.parse(JSON.stringify(data || {}));
    const headerText = context.sections?.dados_pessoais?.join('\n') || context.fullText || '';

    // --- Aluno ---
    out.aluno = out.aluno || {};

    if (!isPlausibleStudentName(out.aluno.nome)) {
        const recovered = extractNameFromHeaderText(headerText) || extractNameFromHeaderText(context.fullText);
        if (recovered) {
            fixes.push(`Nome corrigido: "${out.aluno.nome}" → "${recovered}"`);
            out.aluno.nome = recovered;
        } else {
            issues.push('Nome do aluno inválido ou ausente — revisão manual necessária.');
            if (!out.aluno.nome) out.aluno.nome = '';
        }
    }

    if (out.aluno.idade != null && (out.aluno.idade < 10 || out.aluno.idade > 120)) {
        issues.push(`Idade implausível: ${out.aluno.idade}`);
        const recovered = extractAgeFromText(headerText);
        if (recovered) {
            fixes.push(`Idade corrigida para ${recovered}`);
            out.aluno.idade = recovered;
        } else {
            out.aluno.idade = null;
        }
    } else if (out.aluno.idade == null) {
        const recovered = extractAgeFromText(headerText);
        if (recovered) {
            fixes.push(`Idade recuperada do cabeçalho: ${recovered}`);
            out.aluno.idade = recovered;
        }
    }

    if (out.aluno.peso != null && (out.aluno.peso < 30 || out.aluno.peso > 300)) {
        issues.push(`Peso implausível: ${out.aluno.peso}`);
        const recovered = extractWeightFromText(headerText);
        out.aluno.peso = recovered;
        if (recovered) fixes.push(`Peso corrigido para ${recovered}`);
    } else if (out.aluno.peso == null) {
        const recovered = extractWeightFromText(headerText);
        if (recovered) {
            fixes.push(`Peso recuperado: ${recovered}`);
            out.aluno.peso = recovered;
        }
    }

    if (out.aluno.altura != null && (out.aluno.altura < 100 || out.aluno.altura > 250)) {
        const recovered = extractHeightFromText(headerText);
        out.aluno.altura = recovered;
        if (recovered) fixes.push(`Altura corrigida para ${recovered}`);
    } else if (out.aluno.altura == null) {
        const recovered = extractHeightFromText(headerText);
        if (recovered) {
            fixes.push(`Altura recuperada: ${recovered}`);
            out.aluno.altura = recovered;
        }
    }

    if (out.aluno.telefone) {
        const normalized = normalizeBrazilPhone(out.aluno.telefone);
        if (normalized) out.aluno.telefone = normalized;
        const digits = String(out.aluno.telefone).replace(/\D/g, '');
        if (digits.length < 10 || digits.length > 11) {
            issues.push('Telefone com formato inválido.');
        }
    } else {
        const recovered = extractPhoneFromText(headerText);
        if (recovered) {
            fixes.push(`Telefone recuperado: ${recovered}`);
            out.aluno.telefone = recovered;
        }
    }

    // Objetivo não deve conter lixo de cabeçalho nutricional
    if (out.aluno.objetivo) {
        const obj = String(out.aluno.objetivo);
        if (/\b(GET|Kcal\/Kg|ingest[aã]o de [aá]gua|mL\b)/i.test(obj)) {
            const cleaned = obj
                .replace(/\b\d+\s*mL\b/gi, '')
                .replace(/\bKcal\/Kg\b[^.]*/gi, '')
                .replace(/\bGET\s+v[\d,.]+/gi, '')
                .replace(/\s+/g, ' ')
                .trim();
            if (cleaned.length > 5 && cleaned.length < obj.length) {
                fixes.push('Objetivo limpo de ruído de cabeçalho nutricional');
                out.aluno.objetivo = cleaned;
            }
        }
    }

    // --- Dieta: remover alimentos que são exercícios ---
    if (out.dieta?.refeicoes) {
        for (const ref of out.dieta.refeicoes) {
            if (!ref.alimentos) continue;
            const before = ref.alimentos.length;
            ref.alimentos = ref.alimentos.filter((a) => {
                if (looksLikeExercise(a.nome)) {
                    issues.push(`Possível confusão treino/dieta: "${a.nome}" removido de refeição "${ref.nome}"`);
                    return false;
                }
                return true;
            });
            if (ref.alimentos.length < before) {
                fixes.push(`Removidos ${before - ref.alimentos.length} item(ns) de exercício em "${ref.nome}"`);
            }
        }
        out.dieta.refeicoes = out.dieta.refeicoes.filter((r) => r.alimentos?.length > 0);
    }

    // --- Protocolo: dosagem obrigatória ---
    for (const list of ['suplementos', 'farmacos']) {
        if (!Array.isArray(out[list])) continue;
        out[list] = out[list].filter((item) => {
            if (!item?.nome?.trim()) return false;
            if (!item.dosagem?.trim()) {
                issues.push(`${list}: "${item.nome}" sem dosagem — revisar`);
                item.dosagem = 'Conforme ficha';
            }
            return true;
        });
    }

    // Hormônios em suplementos → mover
    if (Array.isArray(out.suplementos)) {
        const stay = [];
        for (const s of out.suplementos) {
            if (isHormoneOrErgo(s.nome)) {
                out.farmacos = out.farmacos || [];
                out.farmacos.push(s);
                fixes.push(`"${s.nome}" reclassificado de suplemento para fármaco/hormônio`);
            } else {
                stay.push(s);
            }
        }
        out.suplementos = stay;
    }

    // treino não persiste no schema canónico ainda — guardar em _meta se existir
    if (out.treino) {
        out._extracted_treino = out.treino;
        delete out.treino;
    }

    delete out._confidence_notes;
    delete out.sexo;
    delete out.aluno?.sexo;
    delete out.aluno?.restricoes;

    return {
        data: out,
        issues,
        fixes,
        valid: issues.filter((i) => /revisão manual|inválido/i.test(i)).length === 0
    };
}

module.exports = {
    validateAndFix,
    isPlausibleStudentName,
    normalizeBrazilPhone
};
