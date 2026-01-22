// Diet Repository
// Acesso ao banco de dados para dietas, refeições e itens

const { assertQueryable } = require('../shared/db-guards');
const logger = require('../utils/logger');

class DietRepository {
    constructor(pool) {
        // STEP-16: Validar argumentos recebidos no constructor
        // STEP-17: Logar stack trace no momento da instanciação
        const stack = new Error().stack;
        logger.info('STEP-17: DietRepository sendo instanciado', {
            poolType: typeof pool,
            poolIsNull: pool === null,
            poolIsUndefined: pool === undefined,
            hasQuery: typeof pool?.query === 'function',
            stack: stack ? stack.split('\n').slice(2, 8).join('\n') : 'Stack não disponível'
        });
        
        // STEP-16: Abortar se db/client não for passado
        if (pool === null || pool === undefined) {
            const error = new Error('STEP-16: DietRepository recebeu db undefined');
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
        assertQueryable(pool, 'DietRepository.db', 'constructor');
        
        // STEP-18: Bloquear defaults perigosos - falhar explicitamente se db não existir
        // Removido fallback tipo this.db = db || pool
        if (typeof pool.query === 'function') {
            this.query = pool.query.bind(pool);
        } else {
            const error = new Error('STEP-18: DietRepository: pool.query não é função');
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
     * Cria uma nova dieta
     */
    async createDieta(dietaData) {
        // STEP-15: Validar antes de usar this.query
        if (!this.query || typeof this.query !== 'function') {
            const error = new Error('STEP-15: DietRepository.db.query é undefined no create()');
            error.stack = new Error().stack;
            logger.error(error.message, {
                repositoryName: 'DietRepository.db',
                methodName: 'create',
                queryType: typeof this.query,
                queryIsUndefined: this.query === undefined,
                queryIsNull: this.query === null,
                stack: error.stack
            });
            throw error;
        }
        
        const query = `
            INSERT INTO public.dietas (
                nome, objetivo, aluno_id
            ) VALUES ($1, $2, $3)
            RETURNING id, nome, objetivo, aluno_id, created_at
        `;
        
        const values = [
            dietaData.nome,
            dietaData.objetivo || null,
            dietaData.aluno_id
        ];
        
        const result = await this.query(query, values);
        return result.rows[0];
    }

    /**
     * Cria itens da dieta (alimentos em refeições)
     */
    async createItensDieta(itens) {
        if (!itens || itens.length === 0) {
            return [];
        }

        // STEP-15: Validar antes de usar this.query
        if (!this.query || typeof this.query !== 'function') {
            const error = new Error('STEP-15: DietRepository.db.query é undefined no create()');
            error.stack = new Error().stack;
            logger.error(error.message, {
                repositoryName: 'DietRepository.db',
                methodName: 'create',
                queryType: typeof this.query,
                queryIsUndefined: this.query === undefined,
                queryIsNull: this.query === null,
                stack: error.stack
            });
            throw error;
        }

        const query = `
            INSERT INTO public.itens_dieta (
                dieta_id, alimento_id, quantidade, refeicao
            ) VALUES ${itens.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ')}
            RETURNING id, dieta_id, alimento_id, quantidade, refeicao
        `;
        
        const values = itens.flatMap(item => [
            item.dieta_id,
            item.alimento_id,
            item.quantidade,
            item.refeicao
        ]);
        
        const result = await this.query(query, values);
        return result.rows;
    }

    /**
     * Cria fármacos da dieta
     */
    async createFarmacos(farmacos) {
        if (!farmacos || farmacos.length === 0) {
            return [];
        }

        // STEP-15: Validar antes de usar this.query
        if (!this.query || typeof this.query !== 'function') {
            const error = new Error('STEP-15: DietRepository.db.query é undefined no create()');
            error.stack = new Error().stack;
            logger.error(error.message, {
                repositoryName: 'DietRepository.db',
                methodName: 'create',
                queryType: typeof this.query,
                queryIsUndefined: this.query === undefined,
                queryIsNull: this.query === null,
                stack: error.stack
            });
            throw error;
        }

        const query = `
            INSERT INTO public.dieta_farmacos (
                dieta_id, nome, dosagem, observacao
            ) VALUES ${farmacos.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ')}
            RETURNING id, dieta_id, nome, dosagem, observacao
        `;
        
        const values = farmacos.flatMap(farmaco => [
            farmaco.dieta_id,
            farmaco.nome,
            farmaco.dosagem,
            farmaco.observacao || null
        ]);
        
        const result = await this.query(query, values);
        return result.rows;
    }

    /**
     * Cria suplementos da dieta (usando a mesma tabela de fármacos)
     */
    async createSuplementos(suplementos) {
        // Suplementos são salvos na mesma tabela dieta_farmacos
        return this.createFarmacos(suplementos);
    }
}

module.exports = DietRepository;
