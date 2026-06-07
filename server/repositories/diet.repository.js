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
        
        const hasReturn = dietaData.data_retorno != null;
        const rotacaoAtiva = Boolean(dietaData.rotacao_ativa);
        const rotacaoDiasA =
            rotacaoAtiva && dietaData.rotacao_dias_plano_a != null
                ? Number(dietaData.rotacao_dias_plano_a)
                : null;
        const rotacaoDiasB =
            rotacaoAtiva && dietaData.rotacao_dias_plano_b != null
                ? Number(dietaData.rotacao_dias_plano_b)
                : null;
        const rotacaoInicial =
            String(dietaData.rotacao_plano_inicial || 'A').toUpperCase() === 'B' ? 'B' : 'A';
        const rotacaoInicio =
            rotacaoAtiva && dietaData.rotacao_data_inicio
                ? String(dietaData.rotacao_data_inicio).slice(0, 10)
                : null;
        const rotacaoSequencia =
            rotacaoAtiva && dietaData.rotacao_sequencia
                ? JSON.stringify(dietaData.rotacao_sequencia)
                : null;

        const baseCols = ['nome', 'objetivo', 'aluno_id'];
        const baseVals = [dietaData.nome, dietaData.objetivo || null, dietaData.aluno_id];

        if (hasReturn) {
            baseCols.push('data_retorno', 'ativa');
            baseVals.push(dietaData.data_retorno, true);
        }

        baseCols.push(
            'rotacao_ativa',
            'rotacao_dias_plano_a',
            'rotacao_dias_plano_b',
            'rotacao_plano_inicial',
            'rotacao_data_inicio',
            'rotacao_sequencia',
        );
        baseVals.push(rotacaoAtiva, rotacaoDiasA, rotacaoDiasB, rotacaoInicial, rotacaoInicio, rotacaoSequencia);

        const placeholders = baseCols.map((col, i) => {
            if (col === 'data_retorno' || col === 'rotacao_data_inicio') {
                return `$${i + 1}::date`;
            }
            if (col === 'rotacao_sequencia') {
                return `$${i + 1}::jsonb`;
            }
            return `$${i + 1}`;
        });

        const query = `
            INSERT INTO public.dietas (${baseCols.join(', ')})
            VALUES (${placeholders.join(', ')})
            RETURNING id, nome, objetivo, aluno_id, data_retorno, ativa, schedule_cycle_id, created_at,
              rotacao_ativa, rotacao_dias_plano_a, rotacao_dias_plano_b,
              rotacao_plano_inicial, rotacao_data_inicio, rotacao_sequencia
        `;

        const values = baseVals;
        
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
                dieta_id, alimento_id, quantidade, unidade_quantidade, refeicao, dia_semana
            ) VALUES ${itens.map((_, i) => {
                const base = i * 6;
                return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
            }).join(', ')}
            RETURNING id, dieta_id, alimento_id, quantidade, unidade_quantidade, refeicao, dia_semana
        `;
        
        const values = itens.flatMap(item => [
            item.dieta_id,
            item.alimento_id,
            item.quantidade,
            item.unidade_quantidade &&
                typeof item.unidade_quantidade === 'string' &&
                ['g', 'ml', 'un'].includes(item.unidade_quantidade.trim())
                ? item.unidade_quantidade.trim()
                : 'g',
            item.refeicao,
            item.dia_semana != null && String(item.dia_semana).trim() !== ''
                ? String(item.dia_semana).trim()
                : null
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
