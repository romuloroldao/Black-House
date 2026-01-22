// Schema Canônico Rígido para Importação de Fichas
// Usa Zod para validação estrita - rejeita qualquer campo fora do schema

const { z } = require('zod');

/**
 * Schema canônico rígido para importação de fichas de alunos
 * Qualquer campo fora deste schema será rejeitado
 */
const ImportSchema = z.object({
    aluno: z.object({
        nome: z.string().min(1, 'Nome do aluno é obrigatório').max(255),
        peso: z.number().positive().max(500).nullable().optional(),
        altura: z.number().positive().max(300).nullable().optional(),
        idade: z.number().int().positive().max(150).nullable().optional(),
        objetivo: z.string().max(1000).nullable().optional()
    }).strict(), // Rejeita campos extras
    
    dieta: z.object({
        nome: z.string().min(1).max(255).default('Plano Alimentar Importado'),
        objetivo: z.string().max(1000).nullable().optional(),
        refeicoes: z.array(
            z.object({
                nome: z.string().min(1, 'Nome da refeição é obrigatório').max(255),
                alimentos: z.array(
                    z.object({
                        nome: z.string().min(1, 'Nome do alimento é obrigatório').max(255),
                        quantidade: z.string().min(1, 'Quantidade é obrigatória').max(100)
                    }).strict()
                ).min(1, 'Refeição deve ter pelo menos um alimento')
            }).strict()
        ).min(0).refine(
            (refeicoes) => refeicoes.every(ref => ref.alimentos && ref.alimentos.length > 0),
            { message: 'Todas as refeições devem ter pelo menos um alimento' }
        ),
        macros: z.object({
            proteina: z.number().nonnegative().nullable().optional(),
            carboidrato: z.number().nonnegative().nullable().optional(),
            gordura: z.number().nonnegative().nullable().optional(),
            calorias: z.number().nonnegative().nullable().optional()
        }).strict().optional()
    }).strict().optional(),
    
    suplementos: z.array(
        z.object({
            nome: z.string().min(1, 'Nome do suplemento é obrigatório').max(255),
            dosagem: z.string().min(1, 'Dosagem é obrigatória').max(255),
            observacao: z.string().max(1000).nullable().optional()
        }).strict()
    ).default([]),
    
    farmacos: z.array(
        z.object({
            nome: z.string().min(1, 'Nome do fármaco é obrigatório').max(255),
            dosagem: z.string().min(1, 'Dosagem é obrigatória').max(255),
            observacao: z.string().max(1000).nullable().optional()
        }).strict()
    ).default([]),
    
    orientacoes: z.string().max(5000).nullable().optional()
}).strict(); // Rejeita campos extras no nível raiz

/**
 * Valida dados contra o schema canônico
 * @param {Object} data - Dados a serem validados
 * @returns {Object} { success: boolean, data?: Object, errors?: z.ZodError }
 */
function validateCanonicalSchema(data) {
    try {
        const validated = ImportSchema.parse(data);
        return {
            success: true,
            data: validated
        };
    } catch (error) {
        if (error instanceof z.ZodError) {
            // Formatar erros de forma legível
            const formattedErrors = error.errors.map(err => ({
                path: err.path.join('.'),
                message: err.message,
                code: err.code
            }));
            
            return {
                success: false,
                errors: formattedErrors,
                rawError: error
            };
        }
        throw error;
    }
}

/**
 * Valida dados de forma segura (não lança exceção)
 * @param {Object} data - Dados a serem validados
 * @returns {Object} { success: boolean, data?: Object, errors?: Array }
 */
function safeValidate(data) {
    try {
        return validateCanonicalSchema(data);
    } catch (error) {
        // Se for ZodError, formatar erros
        if (error instanceof z.ZodError) {
            const formattedErrors = error.errors.map(err => ({
                path: err.path.join('.') || 'root',
                message: err.message,
                code: err.code
            }));
            
            return {
                success: false,
                errors: formattedErrors,
                rawError: error
            };
        }
        
        // Para outros erros, retornar mensagem genérica
        return {
            success: false,
            errors: [{ path: 'root', message: error.message || 'Erro desconhecido na validação' }]
        };
    }
}

module.exports = {
    ImportSchema,
    validateCanonicalSchema,
    safeValidate
};
