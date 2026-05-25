// Schema Canônico Rígido para Importação de Fichas
// Usa Zod para validação estrita - rejeita qualquer campo fora do schema.
//
// IMPRECISÃO-003: Aceita campos opcionais novos para fichas complexas
//   - refeicao.horario, refeicao.observacao, refeicao.dia_semana,
//     refeicao.plano, refeicao.macros (macros por refeição)
//   - alimento.alternativas (substitutos da mesma linha)
//   - suplementos/farmacos.horario

const { z } = require('zod');

/** Trata 0 / '' / null como “não informado” para campos opcionais numéricos. */
function optionalPositiveNumber(max) {
    return z.preprocess((val) => {
        if (val === null || val === undefined || val === '') return undefined;
        const n = Number(val);
        if (!Number.isFinite(n) || n <= 0) return undefined;
        return n;
    }, z.number().positive().max(max).optional());
}

function optionalPositiveInt(max) {
    return z.preprocess((val) => {
        if (val === null || val === undefined || val === '') return undefined;
        const n = Number(val);
        if (!Number.isFinite(n) || n <= 0) return undefined;
        return Math.floor(n);
    }, z.number().int().positive().max(max).optional());
}

const MacroBlockSchema = z.object({
    proteina: z.number().nonnegative().nullable().optional(),
    carboidrato: z.number().nonnegative().nullable().optional(),
    gordura: z.number().nonnegative().nullable().optional(),
    calorias: z.number().nonnegative().nullable().optional()
}).strict();

const DietRotationImportFields = {
    rotacao_ativa: z.boolean().optional(),
    rotacao_dias_plano_a: optionalPositiveInt(30).nullable().optional(),
    rotacao_dias_plano_b: optionalPositiveInt(30).nullable().optional(),
    rotacao_plano_inicial: z.enum(['A', 'B']).optional(),
    rotacao_data_inicio: z
        .union([
            z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            z.literal(''),
            z.null(),
        ])
        .optional(),
};

/** Campos opcionais enviados pelo importador ao vincular alimentos ao catálogo. */
const CatalogLinkFields = {
    alimento_id: z.string().uuid().nullable().optional(),
    tipo_id: z.string().uuid().nullable().optional(),
    tipo_nome: z.string().max(255).nullable().optional(),
};

const AlternativaSchema = z.object({
    nome: z.string().min(1).max(255),
    quantidade: z.string().min(1).max(100),
    ...CatalogLinkFields,
}).strict();

const AlimentoSchema = z.object({
    nome: z.string().min(1, 'Nome do alimento é obrigatório').max(255),
    quantidade: z.string().min(1, 'Quantidade é obrigatória').max(100),
    alternativas: z.array(AlternativaSchema).optional().default([]),
    ...CatalogLinkFields,
}).strict();

const RefeicaoSchema = z.object({
    nome: z.string().min(1, 'Nome da refeição é obrigatório').max(255),
    horario: z.string().max(50).nullable().optional(),
    observacao: z.string().max(1000).nullable().optional(),
    dia_semana: z.string().max(50).nullable().optional(),
    plano: z.string().max(100).nullable().optional(),
    macros: MacroBlockSchema.nullable().optional(),
    alimentos: z.array(AlimentoSchema).min(1, 'Refeição deve ter pelo menos um alimento')
}).strict();

const ImportSchema = z.object({
    aluno: z.object({
        nome: z.string().min(1, 'Nome do aluno é obrigatório').max(255),
        peso: optionalPositiveNumber(500),
        altura: optionalPositiveNumber(300),
        idade: optionalPositiveInt(150),
        objetivo: z.string().max(1000).nullable().optional(),
        // Campos opcionais da ficha / UI — não são obrigatórios para importar
        email: z.string().max(255).nullable().optional(),
        cpf_cnpj: z.string().max(20).nullable().optional(),
        telefone: z.string().max(40).nullable().optional()
    }).strict(),

    dieta: z.object({
        nome: z.string().min(1).max(255).default('Plano Alimentar Importado'),
        objetivo: z.string().max(1000).nullable().optional(),
        data_retorno: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        refeicoes: z.array(RefeicaoSchema).min(0).refine(
            (refeicoes) => refeicoes.every(ref => ref.alimentos && ref.alimentos.length > 0),
            { message: 'Todas as refeições devem ter pelo menos um alimento' }
        ),
        macros: MacroBlockSchema.nullable().optional(),
        ...DietRotationImportFields,
    }).strict().optional(),

    suplementos: z.array(
        z.object({
            nome: z.string().min(1, 'Nome do suplemento é obrigatório').max(255),
            dosagem: z.string().min(1, 'Dosagem é obrigatória').max(255),
            horario: z.string().max(100).nullable().optional(),
            observacao: z.string().max(1000).nullable().optional()
        }).strict()
    ).default([]),

    farmacos: z.array(
        z.object({
            nome: z.string().min(1, 'Nome do fármaco é obrigatório').max(255),
            dosagem: z.string().min(1, 'Dosagem é obrigatória').max(255),
            horario: z.string().max(100).nullable().optional(),
            observacao: z.string().max(1000).nullable().optional()
        }).strict()
    ).default([]),

    orientacoes: z.string().max(5000).nullable().optional()
}).strict();

/** Reimportação só da dieta para aluno já cadastrado (recuperação pós-migração). */
const DietOnlyImportSchema = z.object({
    aluno_id: z.string().uuid('aluno_id inválido'),
    dieta: z.object({
        nome: z.string().min(1).max(255).default('Plano Alimentar Importado'),
        objetivo: z.string().max(1000).nullable().optional(),
        refeicoes: z.array(RefeicaoSchema).min(1, 'Informe ao menos uma refeição com alimentos'),
        macros: MacroBlockSchema.nullable().optional(),
        ...DietRotationImportFields,
    }).strict(),
    suplementos: ImportSchema.shape.suplementos,
    farmacos: ImportSchema.shape.farmacos,
}).strict();

/**
 * Valida dados contra o schema canônico
 * @param {Object} data
 * @returns {Object} { success, data?, errors? }
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
            const issues = error.errors || error.issues || [];
            const formattedErrors = issues.map(err => ({
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
 * Versão segura (não lança).
 */
function validateDietOnlySchema(data) {
    try {
        const validated = DietOnlyImportSchema.parse(data);
        return { success: true, data: validated };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const issues = error.errors || error.issues || [];
            return {
                success: false,
                errors: issues.map((err) => ({
                    path: err.path.join('.'),
                    message: err.message,
                    code: err.code,
                })),
            };
        }
        throw error;
    }
}

function safeValidateDietOnly(data) {
    try {
        return validateDietOnlySchema(data);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const issues = error.errors || error.issues || [];
            return {
                success: false,
                errors: issues.map((err) => ({
                    path: err.path.join('.') || 'root',
                    message: err.message,
                    code: err.code,
                })),
            };
        }
        return {
            success: false,
            errors: [{ path: 'root', message: error.message || 'Erro na validação' }],
        };
    }
}

function safeValidate(data) {
    try {
        return validateCanonicalSchema(data);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const issues = error.errors || error.issues || [];
            const formattedErrors = issues.map(err => ({
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

        return {
            success: false,
            errors: [{ path: 'root', message: error.message || 'Erro desconhecido na validação' }]
        };
    }
}

module.exports = {
    ImportSchema,
    DietOnlyImportSchema,
    validateCanonicalSchema,
    validateDietOnlySchema,
    safeValidate,
    safeValidateDietOnly,
};
