// Alimento Repository
// Acesso ao banco de dados para alimentos

const { assertQueryable } = require('../shared/db-guards');
const logger = require('../utils/logger');

class AlimentoRepository {
    constructor(pool) {
        // STEP-16: Validar argumentos recebidos no constructor
        // STEP-17: Logar stack trace no momento da instanciação
        const stack = new Error().stack;
        logger.info('STEP-17: AlimentoRepository sendo instanciado', {
            poolType: typeof pool,
            poolIsNull: pool === null,
            poolIsUndefined: pool === undefined,
            hasQuery: typeof pool?.query === 'function',
            stack: stack ? stack.split('\n').slice(2, 8).join('\n') : 'Stack não disponível'
        });
        
        // STEP-16: Abortar se db/client não for passado
        if (pool === null || pool === undefined) {
            const error = new Error('STEP-16: AlimentoRepository recebeu db undefined');
            error.stack = stack;
            logger.error(error.message, {
                poolType: typeof pool,
                poolIsNull: pool === null,
                poolIsUndefined: pool === undefined,
                stack: stack ? stack.split('\n').slice(2, 10).join('\n') : 'Stack não disponível'
            });
            throw error;
        }
        
        // STEP-15: Validar que pool é queryable no constructor
        assertQueryable(pool, 'AlimentoRepository.db', 'constructor');
        
        // STEP-18: Bloquear defaults perigosos - falhar explicitamente se db não existir
        // Removido fallback tipo this.db = db || pool
        // Suporta tanto pool quanto client de transação
        if (typeof pool.query === 'function') {
            this.query = pool.query.bind(pool);
        } else {
            const error = new Error('STEP-18: AlimentoRepository: pool.query não é função');
            error.stack = stack;
            logger.error(error.message, {
                poolType: typeof pool,
                hasQuery: typeof pool.query,
                poolKeys: Object.keys(pool).slice(0, 10),
                stack: stack ? stack.split('\n').slice(2, 10).join('\n') : 'Stack não disponível'
            });
            throw error;
        }
    }

    /**
     * Busca alimento por nome exato (case-insensitive, trim)
     * Suporta busca com nome original ou normalizado
     */
    async findAlimentoByNomeExato(nome) {
        // STEP-15: Validar antes de usar this.query
        if (!this.query || typeof this.query !== 'function') {
            const error = new Error('STEP-15: AlimentoRepository.db.query é undefined no find()');
            error.stack = new Error().stack;
            logger.error(error.message, {
                repositoryName: 'AlimentoRepository.db',
                methodName: 'find',
                queryType: typeof this.query,
                queryIsUndefined: this.query === undefined,
                queryIsNull: this.query === null,
                stack: error.stack
            });
            throw error;
        }
        
        const query = `
            SELECT id, nome, tipo_id, origem_ptn, quantidade_referencia_g,
                   kcal_por_referencia, ptn_por_referencia, cho_por_referencia, lip_por_referencia
            FROM public.alimentos
            WHERE LOWER(TRIM(nome)) = LOWER(TRIM($1))
            LIMIT 1
        `;
        
        const result = await this.query(query, [nome]);
        return result.rows[0] || null;
    }

    /**
     * Busca todos os alimentos
     */
    async findAllAlimentos() {
        // STEP-15: Validar antes de usar this.query
        if (!this.query || typeof this.query !== 'function') {
            const error = new Error('STEP-15: AlimentoRepository.db.query é undefined no find()');
            error.stack = new Error().stack;
            logger.error(error.message, {
                repositoryName: 'AlimentoRepository.db',
                methodName: 'find',
                queryType: typeof this.query,
                queryIsUndefined: this.query === undefined,
                queryIsNull: this.query === null,
                stack: error.stack
            });
            throw error;
        }
        
        const query = `
            SELECT id, nome, tipo_id, origem_ptn, quantidade_referencia_g,
                   kcal_por_referencia, ptn_por_referencia, cho_por_referencia, lip_por_referencia
            FROM public.alimentos
            ORDER BY nome
        `;
        
        const result = await this.query(query);
        return result.rows;
    }

    /**
     * Busca alimento similar (usando ILIKE)
     */
    async findAlimentoSimilar(nome) {
        // STEP-15: Validar antes de usar this.query
        if (!this.query || typeof this.query !== 'function') {
            const error = new Error('STEP-15: AlimentoRepository.db.query é undefined no find()');
            error.stack = new Error().stack;
            logger.error(error.message, {
                repositoryName: 'AlimentoRepository.db',
                methodName: 'find',
                queryType: typeof this.query,
                queryIsUndefined: this.query === undefined,
                queryIsNull: this.query === null,
                stack: error.stack
            });
            throw error;
        }
        
        const query = `
            SELECT id, nome
            FROM public.alimentos
            WHERE nome ILIKE $1
            LIMIT 1
        `;
        
        const result = await this.query(query, [`%${nome}%`]);
        return result.rows[0] || null;
    }

    /**
     * Cria novo alimento
     * GUARD-01: Fail-fast de integridade - valida tipo_id antes de inserir
     */
    async createAlimento(alimentoData) {
        // STEP-15: Validar antes de usar this.query
        if (!this.query || typeof this.query !== 'function') {
            const error = new Error('STEP-15: AlimentoRepository.db.query é undefined no create()');
            error.stack = new Error().stack;
            logger.error(error.message, {
                repositoryName: 'AlimentoRepository.db',
                methodName: 'create',
                queryType: typeof this.query,
                queryIsUndefined: this.query === undefined,
                queryIsNull: this.query === null,
                stack: error.stack
            });
            throw error;
        }
        
        // GUARD-01: Fail-fast de integridade - tipo_id é obrigatório
        if (!alimentoData.tipo_id || alimentoData.tipo_id === null || alimentoData.tipo_id === undefined) {
            const error = new Error('GUARD-01: tipo_id é obrigatório mas está undefined/null');
            logger.error(error.message, {
                alimentoNome: alimentoData.nome,
                tipoId: alimentoData.tipo_id,
                alimentoDataCompleto: alimentoData
            });
            throw error;
        }
        
        const query = `
            INSERT INTO public.alimentos (
                nome, tipo_id, origem_ptn, quantidade_referencia_g,
                kcal_por_referencia, ptn_por_referencia, cho_por_referencia, lip_por_referencia,
                info_adicional, autor
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, nome
        `;
        
        const values = [
            alimentoData.nome,
            alimentoData.tipo_id,
            alimentoData.origem_ptn,
            alimentoData.quantidade_referencia_g || 100,
            alimentoData.kcal_por_referencia,
            alimentoData.ptn_por_referencia,
            alimentoData.cho_por_referencia,
            alimentoData.lip_por_referencia,
            alimentoData.info_adicional || null,
            alimentoData.autor
        ];
        
        const result = await this.query(query, values);
        return result.rows[0];
    }
}

module.exports = AlimentoRepository;
