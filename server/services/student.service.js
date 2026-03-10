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

        console.log(alunoData)

        // Criar aluno
        // Nota: altura não é persistida conforme especificação (forbidden_columns)
        const aluno = await this.repository.createAluno({
            nome: alunoData.nome.trim(),
            peso: alunoData.peso || null,
            cpf_cnpj: alunoData.cpf_cnpj,
            altura: alunoData.altura,
            coach_id: alunoData.coach_id,
            idade: alunoData.idade || null,
            objetivo: alunoData.objetivo || null,
            user_id: alunoData.user_id,
            email: alunoData.email
        });

        return aluno;
    }
}

module.exports = StudentService;
