// AI Output Sanitizer
// Normaliza a resposta da IA antes da validação Zod para garantir compatibilidade com o schema canônico

const logger = require('../../utils/logger');

/**
 * Sanitiza a saída bruta da IA para garantir compatibilidade com o schema canônico
 * Remove campos desconhecidos, força arrays vazios quando ausentes, converte tipos
 * 
 * @param {Object} aiOutput - JSON bruto retornado pela IA
 * @param {string} requestId - ID da requisição para logging
 * @returns {Object} JSON sanitizado pronto para validação Zod
 */
function sanitizeAiOutput(aiOutput, requestId = 'unknown') {
    if (!aiOutput || typeof aiOutput !== 'object') {
        logger.warn('AI output não é um objeto válido', {
            requestId,
            type: typeof aiOutput,
            value: String(aiOutput).substring(0, 200)
        });
        return createEmptySchema();
    }

    try {
        const sanitized = {
            aluno: sanitizeAluno(aiOutput.aluno),
            dieta: sanitizeDieta(aiOutput.dieta),
            suplementos: sanitizeArray(aiOutput.suplementos, sanitizeSuplemento),
            farmacos: sanitizeArray(aiOutput.farmacos, sanitizeFarmaco),
            orientacoes: sanitizeString(aiOutput.orientacoes, 5000, true)
        };

        // O schema canônico trata dieta como opcional. Quando o PDF não contém
        // refeições válidas, omitimos o campo em vez de enviar null.
        if (sanitized.dieta === null) {
            delete sanitized.dieta;
        }

        // Remover campos extras que não estão no schema
        const allowedKeys = ['aluno', 'dieta', 'suplementos', 'farmacos', 'orientacoes'];
        Object.keys(sanitized).forEach(key => {
            if (!allowedKeys.includes(key)) {
                delete sanitized[key];
            }
        });

        logger.debug('AI output sanitizado', {
            requestId,
            hasAluno: !!sanitized.aluno,
            hasDieta: !!sanitized.dieta,
            suplementosCount: sanitized.suplementos.length,
            farmacosCount: sanitized.farmacos.length
        });

        return sanitized;
    } catch (error) {
        logger.error('Erro ao sanitizar AI output', {
            requestId,
            error: error.message,
            stack: error.stack,
            aiOutput: JSON.stringify(aiOutput).substring(0, 500)
        });
        // Retornar schema vazio em caso de erro crítico
        return createEmptySchema();
    }
}

/**
 * Sanitiza objeto aluno
 */
function sanitizeAluno(aluno) {
    if (!aluno || typeof aluno !== 'object') {
        return {
            nome: '',
            peso: null,
            altura: null,
            idade: null,
            objetivo: null
        };
    }

    const out = {
        nome: sanitizeString(aluno.nome, 255, false) || '',
        peso: sanitizePositiveNumber(aluno.peso, 500),
        altura: sanitizePositiveNumber(aluno.altura, 300),
        idade: sanitizePositiveInteger(aluno.idade, 150),
        objetivo: sanitizeString(aluno.objetivo, 1000, true)
    };
    const email = sanitizeString(aluno.email, 255, true);
    if (email) out.email = email;
    const telefone = sanitizeString(aluno.telefone, 40, true);
    if (telefone) out.telefone = telefone;
    const cpf = sanitizeString(aluno.cpf_cnpj, 20, true);
    if (cpf) out.cpf_cnpj = cpf;
    return out;
}

/**
 * Sanitiza objeto dieta
 */
function sanitizeDieta(dieta) {
    if (!dieta || typeof dieta !== 'object') {
        return null; // Dieta é opcional
    }

    const sanitized = {
        nome: sanitizeString(dieta.nome, 255, false) || 'Plano Alimentar Importado',
        objetivo: sanitizeString(dieta.objetivo, 1000, true),
        refeicoes: sanitizeArray(dieta.refeicoes, sanitizeRefeicao),
        macros: sanitizeMacros(dieta.macros)
    };

    // Se não há refeições válidas, retornar null
    if (!sanitized.refeicoes || sanitized.refeicoes.length === 0) {
        return null;
    }

    return sanitized;
}

/**
 * Sanitiza uma refeição (com campos opcionais para fichas complexas)
 */
function sanitizeRefeicao(refeicao) {
    if (!refeicao || typeof refeicao !== 'object') {
        return null;
    }

    const nome = sanitizeString(refeicao.nome, 255, false);
    if (!nome) {
        return null; // Nome é obrigatório
    }

    const alimentos = sanitizeArray(refeicao.alimentos, sanitizeAlimento);

    // Filtrar alimentos inválidos
    const alimentosValidos = alimentos.filter(a => a && a.nome && a.quantidade);

    // Se não há alimentos válidos, retornar null
    if (alimentosValidos.length === 0) {
        return null;
    }

    const result = {
        nome,
        alimentos: alimentosValidos
    };

    // Campos opcionais — incluídos apenas quando presentes para preservar
    // compatibilidade com fichas simples.
    const horario = sanitizeString(refeicao.horario, 50, true);
    if (horario) result.horario = horario;

    const observacao = sanitizeString(refeicao.observacao, 1000, true);
    if (observacao) result.observacao = observacao;

    const diaSemana = sanitizeDiaSemana(refeicao.dia_semana);
    if (diaSemana) result.dia_semana = diaSemana;

    const plano = sanitizeString(refeicao.plano, 100, true);
    if (plano) result.plano = plano;

    const macros = sanitizeMacros(refeicao.macros);
    if (macros) result.macros = macros;

    return result;
}

/**
 * Sanitiza dia da semana (normaliza variações comuns).
 */
function sanitizeDiaSemana(value) {
    const raw = sanitizeString(value, 50, true);
    if (!raw) return null;

    const normalized = raw.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\bfeira\b/g, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const map = {
        'segunda': 'Segunda',
        'terca': 'Terça',
        'quarta': 'Quarta',
        'quinta': 'Quinta',
        'sexta': 'Sexta',
        'sabado': 'Sábado',
        'domingo': 'Domingo',
        'todos': 'Todos os dias',
        'todos os dias': 'Todos os dias',
        'todos dias': 'Todos os dias',
        'dia 1': 'Dia 1', 'dia 2': 'Dia 2', 'dia 3': 'Dia 3',
        'dia 4': 'Dia 4', 'dia 5': 'Dia 5', 'dia 6': 'Dia 6', 'dia 7': 'Dia 7'
    };

    return map[normalized] || raw.substring(0, 50);
}

/**
 * Sanitiza um alimento (com alternativas opcionais)
 */
function sanitizeAlimento(alimento) {
    if (!alimento || typeof alimento !== 'object') {
        return null;
    }

    const nome = sanitizeString(alimento.nome, 255, false);
    const quantidade = sanitizeString(alimento.quantidade, 100, false);

    if (!nome || !quantidade) {
        return null; // Ambos são obrigatórios
    }

    if (isForbiddenFoodName(nome)) {
        return null;
    }

    const result = { nome, quantidade };

    // Alternativas (substitutos da mesma linha)
    if (Array.isArray(alimento.alternativas)) {
        const alternativas = alimento.alternativas
            .map(alt => {
                if (!alt || typeof alt !== 'object') return null;
                const altNome = sanitizeString(alt.nome, 255, false);
                const altQtd = sanitizeString(alt.quantidade, 100, true) || quantidade;
                if (!altNome || isForbiddenFoodName(altNome)) return null;
                if (altNome.toLowerCase() === nome.toLowerCase()) return null;
                return { nome: altNome, quantidade: altQtd };
            })
            .filter(Boolean);
        if (alternativas.length > 0) {
            result.alternativas = alternativas;
        }
    }

    return result;
}

function isForbiddenFoodName(nome) {
    const normalized = String(nome || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    if (!normalized) return true;

    return /^(ptn|cho|lip|kcal|glip|g lip|gptn|g ptn|proteina|carboidrato|gordura)$/.test(normalized) ||
        /^personalizado\s*-/.test(normalized) ||
        /^lista de substit/i.test(normalized) ||
        /^grupo dos?\b/.test(normalized) ||
        /^grupo das?\b/.test(normalized) ||
        /^(carnes e proteinas|paes e variedades|feijao e leguminosas|vegetais [ab]|leite e derivados|frutas?|cereais|bebidas|gorduras|oleaginosas|oleos e gorduras|fibras [ab])$/.test(normalized);
}

/**
 * Sanitiza macros
 */
function sanitizeMacros(macros) {
    if (!macros || typeof macros !== 'object') {
        return null;
    }

    return {
        proteina: sanitizeNumber(macros.proteina, 0, null, true),
        carboidrato: sanitizeNumber(macros.carboidrato, 0, null, true),
        gordura: sanitizeNumber(macros.gordura, 0, null, true),
        calorias: sanitizeNumber(macros.calorias, 0, null, true)
    };
}

/**
 * Sanitiza suplemento (com horário opcional)
 */
function sanitizeSuplemento(suplemento) {
    if (!suplemento || typeof suplemento !== 'object') {
        return null;
    }

    const nome = sanitizeString(suplemento.nome, 255, false);
    const dosagem = sanitizeString(suplemento.dosagem, 255, false);

    if (!nome || !dosagem) {
        return null;
    }

    const result = {
        nome,
        dosagem,
        observacao: sanitizeString(suplemento.observacao, 1000, true)
    };

    const horario = sanitizeString(suplemento.horario, 100, true);
    if (horario) result.horario = horario;

    return result;
}

/**
 * Sanitiza fármaco (com horário opcional)
 */
function sanitizeFarmaco(farmaco) {
    if (!farmaco || typeof farmaco !== 'object') {
        return null;
    }

    const nome = sanitizeString(farmaco.nome, 255, false);
    const dosagem = sanitizeString(farmaco.dosagem, 255, false);

    if (!nome || !dosagem) {
        return null;
    }

    const result = {
        nome,
        dosagem,
        observacao: sanitizeString(farmaco.observacao, 1000, true)
    };

    const horario = sanitizeString(farmaco.horario, 100, true);
    if (horario) result.horario = horario;

    return result;
}

/**
 * Sanitiza array genérico
 */
function sanitizeArray(array, itemSanitizer) {
    if (!Array.isArray(array)) {
        return [];
    }

    return array
        .map(item => itemSanitizer(item))
        .filter(item => item !== null && item !== undefined);
}

/**
 * Sanitiza string
 */
function sanitizeString(value, maxLength, nullable) {
    if (value === null || value === undefined) {
        return nullable ? null : '';
    }

    if (typeof value !== 'string') {
        // Tentar converter para string
        const str = String(value).trim();
        if (str === '' || str === 'null' || str === 'undefined') {
            return nullable ? null : '';
        }
        return str.substring(0, maxLength);
    }

    const trimmed = value.trim();
    if (trimmed === '') {
        return nullable ? null : '';
    }

    return trimmed.substring(0, maxLength);
}

/**
 * Sanitiza número
 */
function sanitizeNumber(value, min, max, nullable) {
    if (value === null || value === undefined) {
        return nullable ? null : null;
    }

    if (typeof value === 'number') {
        if (isNaN(value) || !isFinite(value)) {
            return nullable ? null : null;
        }
        if (min !== null && value < min) return nullable ? null : null;
        if (max !== null && value > max) return nullable ? null : null;
        return value;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
            return nullable ? null : null;
        }
        const parsed = parseFloat(trimmed);
        if (isNaN(parsed) || !isFinite(parsed)) {
            return nullable ? null : null;
        }
        if (min !== null && parsed < min) return nullable ? null : null;
        if (max !== null && parsed > max) return nullable ? null : null;
        return parsed;
    }

    return nullable ? null : null;
}

/**
 * Sanitiza inteiro
 */
function sanitizeInteger(value, min, max, nullable) {
    const num = sanitizeNumber(value, min, max, nullable);
    if (num === null) return null;
    return Math.floor(num);
}

function sanitizePositiveNumber(value, max) {
    const num = sanitizeNumber(value, 0, max, true);
    return num && num > 0 ? num : null;
}

function sanitizePositiveInteger(value, max) {
    const num = sanitizeInteger(value, 0, max, true);
    return num && num > 0 ? num : null;
}

/**
 * Cria schema vazio válido
 */
function createEmptySchema() {
    return {
        aluno: {
            nome: '',
            peso: null,
            altura: null,
            idade: null,
            objetivo: null
        },
        dieta: null,
        suplementos: [],
        farmacos: [],
        orientacoes: null
    };
}

module.exports = {
    sanitizeAiOutput
};
