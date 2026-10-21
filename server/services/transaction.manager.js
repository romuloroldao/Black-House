// Transaction Manager
// Gerencia transações do banco de dados para garantir atomicidade

class TransactionManager {
    constructor(pool) {
        this.pool = pool;
    }

    /**
     * Executa uma função dentro de uma transação
     * Se houver erro, faz rollback automaticamente
     * 
     * @param {Function} callback - Função que recebe o client da transação
     * @returns {Promise<any>} Resultado da função callback
     */
    async executeInTransaction(callback) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            const result = await callback(client);
            
            await client.query('COMMIT');
            
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro na transação, rollback realizado:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Cria repositórios com client de transação
     */
    createRepositories(client) {
        const AlimentoRepository = require('../repositories/alimento.repository');
        const StudentRepository = require('../repositories/student.repository');
        const DietRepository = require('../repositories/diet.repository');
        const FoodMatchingService = require('../services/food-matching.service');

        const alimentoRepo = new AlimentoRepository({ query: client.query.bind(client) });
        const studentRepo = new StudentRepository({ query: client.query.bind(client) });
        const dietRepo = new DietRepository({ query: client.query.bind(client) });
        const foodMatching = new FoodMatchingService(alimentoRepo);

        return {
            alimentoRepo,
            studentRepo,
            dietRepo,
            foodMatching
        };
    }
}

module.exports = TransactionManager;
