// Student Repository
// Acesso ao banco de dados para alunos

const { assertQueryable } = require('../shared/db-guards');
const logger = require('../utils/logger');

class StudentRepository {
    constructor(pool) {
        // STEP-16: Validar argumentos recebidos no constructor
        // STEP-17: Logar stack trace no momento da instanciação
        const stack = new Error().stack;
        logger.info('STEP-17: StudentRepository sendo instanciado', {
            poolType: typeof pool,
            poolIsNull: pool === null,
            poolIsUndefined: pool === undefined,
            hasQuery: typeof pool?.query === 'function',
            stack: stack ? stack.split('\n').slice(2, 8).join('\n') : 'Stack não disponível'
        });
        
        // STEP-16: Abortar se db/client não for passado
        if (pool === null || pool === undefined) {
            const error = new Error('STEP-16: StudentRepository recebeu db undefined');
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
        assertQueryable(pool, 'StudentRepository.db', 'constructor');
        
        // STEP-18: Bloquear defaults perigosos - falhar explicitamente se db não existir
        // Removido fallback tipo this.db = db || pool
        if (typeof pool.query === 'function') {
            this.query = pool.query.bind(pool);
        } else {
            const error = new Error('STEP-18: StudentRepository: pool.query não é função');
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
     * Cria um novo aluno
     */
    async createAluno(alunoData) {
        // STEP-15: Validar antes de usar this.query
        if (!this.query || typeof this.query !== 'function') {
            const error = new Error('STEP-15: StudentRepository.db.query é undefined no create()');
            error.stack = new Error().stack;
            logger.error(error.message, {
                repositoryName: 'StudentRepository.db',
                methodName: 'create',
                queryType: typeof this.query,
                queryIsUndefined: this.query === undefined,
                queryIsNull: this.query === null,
                stack: error.stack
            });
            throw error;
        }
        
        // Nota: altura não é persistida conforme especificação (forbidden_columns)
        const query = `
            INSERT INTO public.alunos (
                nome, peso, idade, objetivo, coach_id, email
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, nome, peso, idade, objetivo, coach_id, email, created_at
        `;
        
        const values = [
            alunoData.nome,
            alunoData.peso || null,
            // altura: removido - não é persistido conforme especificação
            alunoData.idade || null,
            alunoData.objetivo || null,
            alunoData.coach_id,
            alunoData.email || `${alunoData.nome.toLowerCase().replace(/\s+/g, '.')}@importado.temp`
        ];
        
        const result = await this.query(query, values);
        return result.rows[0];
    }

    /**
     * Busca aluno por ID e coach_id
     */
    async findAlunoById(alunoId, coachId) {
        // STEP-15: Validar antes de usar this.query
        if (!this.query || typeof this.query !== 'function') {
            const error = new Error('STEP-15: StudentRepository.db.query é undefined no find()');
            error.stack = new Error().stack;
            logger.error(error.message, {
                repositoryName: 'StudentRepository.db',
                methodName: 'find',
                queryType: typeof this.query,
                queryIsUndefined: this.query === undefined,
                queryIsNull: this.query === null,
                stack: error.stack
            });
            throw error;
        }
        
        // Nota: altura não é selecionada conforme especificação (forbidden_columns)
        const query = `
            SELECT id, nome, peso, idade, objetivo, coach_id, email, created_at
            FROM public.alunos
            WHERE id = $1 AND coach_id = $2
        `;
        
        const result = await this.query(query, [alunoId, coachId]);
        return result.rows[0] || null;
    }
}

module.exports = StudentRepository;
