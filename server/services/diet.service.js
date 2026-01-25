// Diet Service
// Lógica de negócio para criação de dietas, refeições e itens

class DietService {
    constructor(dietRepository, foodMatchingService) {
        this.dietRepository = dietRepository;
        this.foodMatchingService = foodMatchingService;
    }

    /**
     * Cria dieta completa (dieta + refeições + itens + fármacos + suplementos)
     * @param {Object} dietaData - Dados da dieta
     * @param {string} alunoId - ID do aluno
     * @param {string} userId - ID do usuário (para criação automática de alimentos)
     * @returns {Promise<Object>} Dieta criada com estatísticas
     */
    async createDietaCompleta(dietaData, alunoId, userId) {
        // Criar dieta
        const dieta = await this.dietRepository.createDieta({
            nome: dietaData.nome || 'Plano Alimentar Importado',
            objetivo: dietaData.objetivo || null,
            aluno_id: alunoId
        });

        const stats = {
            dieta_id: dieta.id,
            refeicoes_criadas: 0,
            itens_criados: 0,
            alimentos_criados: [],
            farmacos_criados: 0,
            suplementos_criados: 0
        };

        // Processar refeições e itens
        if (dietaData.refeicoes && dietaData.refeicoes.length > 0) {
            const itensToInsert = [];
            
            for (const refeicao of dietaData.refeicoes) {
                if (!refeicao.alimentos || refeicao.alimentos.length === 0) {
                    continue;
                }

                const refeicaoNome = this._mapRefeicaoName(refeicao.nome);
                stats.refeicoes_criadas++;

                for (const alimento of refeicao.alimentos) {
                    if (!alimento.nome || !alimento.nome.trim()) {
                        continue;
                    }

                    // Encontrar ou criar alimento
                    const alimentoId = await this.foodMatchingService.findOrCreateAlimento(
                        alimento.nome,
                        userId
                    );

                    if (alimentoId) {
                        // Parse quantidade
                        const quantidade = this._parseQuantidade(alimento.quantidade);

                        itensToInsert.push({
                            dieta_id: dieta.id,
                            alimento_id: alimentoId,
                            quantidade: quantidade,
                            refeicao: refeicaoNome
                        });

                        // Marcar alimento como criado (será verificado depois se necessário)
                        if (!stats.alimentos_criados.includes(alimento.nome)) {
                            // Verificar se foi criado verificando se existe no banco
                            // Por enquanto, apenas adiciona à lista de processados
                        }
                    }
                }
            }

            // Inserir itens em lote
            if (itensToInsert.length > 0) {
                await this.dietRepository.createItensDieta(itensToInsert);
                stats.itens_criados = itensToInsert.length;
            }
        }

        // Processar fármacos
        if (dietaData.farmacos && dietaData.farmacos.length > 0) {
            const farmacosToInsert = dietaData.farmacos
                .filter(f => f.nome && f.nome.trim())
                .map(f => ({
                    dieta_id: dieta.id,
                    nome: f.nome.trim(),
                    dosagem: f.dosagem || '',
                    observacao: f.observacao || null
                }));

            if (farmacosToInsert.length > 0) {
                await this.dietRepository.createFarmacos(farmacosToInsert);
                stats.farmacos_criados = farmacosToInsert.length;
            }
        }

        // Processar suplementos
        if (dietaData.suplementos && dietaData.suplementos.length > 0) {
            const suplementosToInsert = dietaData.suplementos
                .filter(s => s.nome && s.nome.trim())
                .map(s => ({
                    dieta_id: dieta.id,
                    nome: s.nome.trim(),
                    dosagem: s.dosagem || '',
                    observacao: s.observacao || 'Suplemento'
                }));

            if (suplementosToInsert.length > 0) {
                await this.dietRepository.createSuplementos(suplementosToInsert);
                stats.suplementos_criados = suplementosToInsert.length;
            }
        }

        return {
            dieta,
            stats
        };
    }

    /**
     * Mapeia nome de refeição para formato padrão
     */
    _mapRefeicaoName(nome) {
        const nomeNormalizado = nome.toLowerCase().trim();

        // Extrai número se existir
        const matchNumero = nomeNormalizado.match(/(?:refeição|refeicao|ref)\s*(\d+)/);
        if (matchNumero) {
            return `Refeição ${matchNumero[1]}`;
        }

        // Mapeia nomes tradicionais conforme especificação
        const mappings = {
            'café da manhã': 'Refeição 1',
            'cafe da manha': 'Refeição 1',
            'lanche da manhã': 'Refeição 2',
            'lanche da manha': 'Refeição 2',
            'almoço': 'Refeição 3',
            'almoco': 'Refeição 3',
            'lanche da tarde': 'Refeição 4',
            'lanche': 'Refeição 4',
            'jantar': 'Refeição 5',
            'ceia': 'Refeição 6',
            'pré-treino': 'Refeição 7',
            'pre treino': 'Refeição 7',
            'pós-treino': 'Refeição 8',
            'pos treino': 'Refeição 8'
        };

        return mappings[nomeNormalizado] || nome;
    }

    /**
     * Parse quantidade de string para número
     * Ex: "100g" -> 100, "2 unidades" -> 2
     */
    _parseQuantidade(quantidadeStr) {
        if (!quantidadeStr) {
            return 100; // Default
        }

        const match = quantidadeStr.match(/[\d.,]+/);
        if (match) {
            return parseFloat(match[0].replace(',', '.'));
        }

        return 100; // Default
    }
}

module.exports = DietService;
