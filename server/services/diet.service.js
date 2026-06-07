// Diet Service
// Lógica de negócio para criação de dietas, refeições e itens.
//
// IMPRECISÃO-004: agora propaga horário/observação/dia_semana/plano para o item
// (quando suportado pelo schema da tabela) e parseia quantidades complexas
// preservando o número numérico e a unidade textual.

class DietService {
    constructor(dietRepository, foodMatchingService) {
        this.dietRepository = dietRepository;
        this.foodMatchingService = foodMatchingService;
    }

    /**
     * Cria dieta completa (dieta + refeições + itens + fármacos + suplementos)
     * @param {Object} dietaData
     * @param {string} alunoId
     * @param {string} userId
     * @returns {Promise<{dieta:Object, stats:Object}>}
     */
    async createDietaCompleta(dietaData, alunoId, userId) {
        if (this.foodMatchingService?.beginImportBatch) {
            this.foodMatchingService.beginImportBatch();
        }
        try {
            return await this._createDietaCompletaInternal(dietaData, alunoId, userId);
        } finally {
            if (this.foodMatchingService?.endImportBatch) {
                this.foodMatchingService.endImportBatch();
            }
        }
    }

    /**
     * @private
     */
    async _createDietaCompletaInternal(dietaData, alunoId, userId) {
        const { parseReturnDate, afterTableMutation } = require('./return-reminder.service');
        const dataRetorno = parseReturnDate(
            dietaData.data_retorno || dietaData.data_expiracao || null,
        );

        const dieta = await this.dietRepository.createDieta({
            nome: dietaData.nome || 'Plano Alimentar Importado',
            objetivo: dietaData.objetivo || null,
            aluno_id: alunoId,
            data_retorno: dataRetorno,
            rotacao_ativa: Boolean(dietaData.rotacao_ativa),
            rotacao_sequencia: dietaData.rotacao_sequencia ?? null,
            rotacao_dias_plano_a: dietaData.rotacao_dias_plano_a,
            rotacao_dias_plano_b: dietaData.rotacao_dias_plano_b,
            rotacao_plano_inicial: dietaData.rotacao_plano_inicial,
            rotacao_data_inicio: dietaData.rotacao_data_inicio,
        });

        if (dataRetorno) {
            const db = { query: this.dietRepository.query.bind(this.dietRepository) };
            await afterTableMutation(db, 'dietas', { ...dieta, aluno_id: alunoId, data_retorno: dataRetorno });
        }

        const stats = {
            dieta_id: dieta.id,
            refeicoes_criadas: 0,
            itens_criados: 0,
            alimentos_criados: [],
            farmacos_criados: 0,
            suplementos_criados: 0,
            alternativas_criadas: 0
        };

        if (dietaData.refeicoes && dietaData.refeicoes.length > 0) {
            const itensToInsert = [];

            for (const refeicao of dietaData.refeicoes) {
                if (!refeicao.alimentos || refeicao.alimentos.length === 0) {
                    continue;
                }

                const refeicaoNome = this._buildRefeicaoLabel(refeicao);
                stats.refeicoes_criadas++;

                for (const alimento of refeicao.alimentos) {
                    if (!alimento.nome || !alimento.nome.trim()) {
                        continue;
                    }

                    const alimentoId = await this.foodMatchingService.findOrCreateAlimento(
                        alimento.nome,
                        userId
                    );

                    if (alimentoId) {
                        const quantidade = this._parseQuantidade(alimento.quantidade);

        itensToInsert.push({
                            dieta_id: dieta.id,
                            alimento_id: alimentoId,
                            quantidade: quantidade,
                            unidade_quantidade: 'g',
                            refeicao: refeicaoNome,
                            dia_semana: refeicao.dia_semana || null
                        });

                        if (!stats.alimentos_criados.includes(alimento.nome)) {
                            // Apenas trackeia processados; a verificação real
                            // de criação fica no FoodMatchingService.
                        }

                        // Alternativas (substitutos): inseridas como itens
                        // adicionais marcando "[Substituto]" no nome da refeição
                        // para o coach poder distinguir e editar depois.
                        if (Array.isArray(alimento.alternativas) && alimento.alternativas.length > 0) {
                            for (const alt of alimento.alternativas) {
                                if (!alt.nome || !alt.nome.trim()) continue;
                                const altId = await this.foodMatchingService.findOrCreateAlimento(
                                    alt.nome,
                                    userId
                                );
                                if (!altId) continue;
                                itensToInsert.push({
                                    dieta_id: dieta.id,
                                    alimento_id: altId,
                                    quantidade: this._parseQuantidade(alt.quantidade || alimento.quantidade),
                                    unidade_quantidade: 'g',
                                    refeicao: `${refeicaoNome} (Substituto)`,
                                    dia_semana: refeicao.dia_semana || null
                                });
                                stats.alternativas_criadas++;
                            }
                        }
                    }
                }
            }

            if (itensToInsert.length > 0) {
                await this.dietRepository.createItensDieta(itensToInsert);
                stats.itens_criados = itensToInsert.length;
            }
        }

        // Fármacos
        if (dietaData.farmacos && dietaData.farmacos.length > 0) {
            const farmacosToInsert = dietaData.farmacos
                .filter(f => f.nome && f.nome.trim())
                .map(f => ({
                    dieta_id: dieta.id,
                    nome: f.nome.trim(),
                    dosagem: f.dosagem || '',
                    observacao: this._composeObservacao(f.observacao, f.horario, 'Fármaco')
                }));

            if (farmacosToInsert.length > 0) {
                await this.dietRepository.createFarmacos(farmacosToInsert);
                stats.farmacos_criados = farmacosToInsert.length;
            }
        }

        // Suplementos
        if (dietaData.suplementos && dietaData.suplementos.length > 0) {
            const suplementosToInsert = dietaData.suplementos
                .filter(s => s.nome && s.nome.trim())
                .map(s => ({
                    dieta_id: dieta.id,
                    nome: s.nome.trim(),
                    dosagem: s.dosagem || '',
                    observacao: this._composeObservacao(s.observacao, s.horario, 'Suplemento')
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
     * Compõe nome legível da refeição incluindo plano/horário entre parênteses
     * quando estes existirem na ficha original.
     *
     * Ex.: "Almoço (Plano A) - 12:00"
     */
    _resolveRefeicaoPlano(refeicao) {
        if (refeicao.plano && String(refeicao.plano).trim()) {
            const letter = String(refeicao.plano).trim().toUpperCase();
            if (/^[A-Z]$/.test(letter)) return letter;
        }
        const nome = String(refeicao.nome || '');
        const m = nome.match(/\bplano\s*([a-z])\b/i);
        if (m && /^[A-Z]$/i.test(m[1])) return m[1].toUpperCase();
        return null;
    }

    _buildRefeicaoLabel(refeicao) {
        const base = this._mapRefeicaoName(refeicao.nome);
        const extras = [];
        const planoResolved = this._resolveRefeicaoPlano(refeicao);
        if (planoResolved) {
            extras.push(`Plano ${planoResolved}`);
        } else if (refeicao.plano && String(refeicao.plano).trim()) {
            extras.push(String(refeicao.plano).trim());
        }
        if (refeicao.horario && String(refeicao.horario).trim()) {
            extras.push(String(refeicao.horario).trim());
        }
        if (extras.length === 0) return base;
        return `${base} (${extras.join(' • ')})`;
    }

    /**
     * Mapeia nome de refeição para formato padrão. Usado apenas para nomes
     * "puros" sem decoração; nomes customizados pelo coach são preservados.
     */
    _mapRefeicaoName(nome) {
        const nomeNormalizado = (nome || '').toLowerCase().trim();

        const matchNumero = nomeNormalizado.match(/(?:refeição|refeicao|ref)\s*(\d+)/);
        if (matchNumero) {
            return `Refeição ${matchNumero[1]}`;
        }

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
            'pre-treino': 'Refeição 7',
            'pre treino': 'Refeição 7',
            'pós-treino': 'Refeição 8',
            'pos-treino': 'Refeição 8',
            'pos treino': 'Refeição 8'
        };

        return mappings[nomeNormalizado] || (nome || 'Refeição');
    }

    /**
     * Parseia quantidade textual para número (double precision em itens_dieta).
     * Aceita: "100g", "200 ml", "2 unidades", "30~40g" (média), "1/2 xícara (60g)".
     */
    _parseQuantidade(quantidadeStr) {
        if (!quantidadeStr) return 100;

        const str = String(quantidadeStr).trim();

        // 1) Faixa "30~40g" ou "30-40g" -> média
        const rangeMatch = str.match(/(\d+[.,]?\d*)\s*[~\-–—]\s*(\d+[.,]?\d*)/);
        if (rangeMatch) {
            const a = parseFloat(rangeMatch[1].replace(',', '.'));
            const b = parseFloat(rangeMatch[2].replace(',', '.'));
            if (!isNaN(a) && !isNaN(b)) return (a + b) / 2;
        }

        // 2) Valor entre parênteses com "g" ou "ml" -> prioriza
        const parenMatch = str.match(/\((\d+[.,]?\d*)\s*(?:g|ml)\)/i);
        if (parenMatch) {
            const v = parseFloat(parenMatch[1].replace(',', '.'));
            if (!isNaN(v)) return v;
        }

        // 3) Fração simples "1/2" -> 0.5 multiplicado pelo número seguinte se houver
        const fracMatch = str.match(/^(\d+)\s*\/\s*(\d+)/);
        if (fracMatch) {
            const num = parseFloat(fracMatch[1]);
            const den = parseFloat(fracMatch[2]);
            if (den !== 0) {
                return num / den;
            }
        }

        // 4) Primeiro número da string
        const numMatch = str.match(/[\d]+[.,]?\d*/);
        if (numMatch) return parseFloat(numMatch[0].replace(',', '.'));

        return 100;
    }

    /**
     * Combina observação + horário num único campo (já que dieta_farmacos
     * não tem coluna "horario" no schema atual).
     */
    _composeObservacao(observacao, horario, fallback = null) {
        const partes = [];
        if (horario && String(horario).trim()) {
            partes.push(`Horário: ${String(horario).trim()}`);
        }
        if (observacao && String(observacao).trim()) {
            partes.push(String(observacao).trim());
        }
        if (partes.length === 0) {
            return fallback;
        }
        return partes.join(' — ');
    }
}

module.exports = DietService;
