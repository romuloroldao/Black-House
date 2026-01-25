// Student Service
// Lógica de negócio para criação de alunos

class StudentService {
    constructor(repository) {
        this.repository = repository;
    }

    /**
     * Cria um novo aluno
     * @param {Object} alunoData - Dados do aluno
     * @returns {Promise<Object>} Aluno criado
     */
    async createAluno(alunoData) {
        // Validações de negócio
        if (!alunoData.nome || alunoData.nome.trim().length === 0) {
            throw new Error('Nome do aluno é obrigatório');
        }

        if (!alunoData.coach_id) {
            throw new Error('Coach ID é obrigatório');
        }

        // Criar aluno
        // Nota: altura não é persistida conforme especificação (forbidden_columns)
        const aluno = await this.repository.createAluno({
            nome: alunoData.nome.trim(),
            peso: alunoData.peso || null,
            // altura: removido - não é persistido no banco conforme especificação
            idade: alunoData.idade || null,
            objetivo: alunoData.objetivo || null,
            coach_id: alunoData.coach_id,
            email: alunoData.email || this._generateEmail(alunoData.nome)
        });

        return aluno;
    }

    /**
     * Gera email temporário para aluno importado
     */
    _generateEmail(nome) {
        return `${nome.toLowerCase().replace(/\s+/g, '.')}@importado.temp`;
    }
}

module.exports = StudentService;
