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

    return {
        nome: sanitizeString(aluno.nome, 255, false) || '',
        peso: sanitizeNumber(aluno.peso, 0, 500, true),
        altura: sanitizeNumber(aluno.altura, 0, 300, true),
        idade: sanitizeInteger(aluno.idade, 0, 150, true),
        objetivo: sanitizeString(aluno.objetivo, 1000, true)
    };
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
 * Sanitiza uma refeição
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

    return {
        nome,
        alimentos: alimentosValidos
    };
}

/**
 * Sanitiza um alimento
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

    return {
        nome,
        quantidade
    };
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
 * Sanitiza suplemento
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

    return {
        nome,
        dosagem,
        observacao: sanitizeString(suplemento.observacao, 1000, true)
    };
}

/**
 * Sanitiza fármaco
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

    return {
        nome,
        dosagem,
        observacao: sanitizeString(farmaco.observacao, 1000, true)
    };
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
