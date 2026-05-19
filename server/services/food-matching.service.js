// Food Matching Service
// Implementa algoritmo de matching de alimentos com prioridades

const { normalizeOrigemPtn, kcalFromMacros, roundNutrient } = require('../utils/nutrition-alimento-utils');

class FoodMatchingService {
    constructor(repository, tipoAlimentoRepository = null) {
        this.repository = repository;
        this.tipoAlimentoRepository = tipoAlimentoRepository;
        this._importBatchActive = false;
        this._importBatchAlimentos = null;
    }

    /**
     * Inicia janela de import em massa: uma única leitura da lista para similaridade,
     * com atualização incremental quando novos alimentos são criados.
     */
    beginImportBatch() {
        this._importBatchActive = true;
        this._importBatchAlimentos = null;
    }

    endImportBatch() {
        this._importBatchActive = false;
        this._importBatchAlimentos = null;
    }

    async _loadAlimentosForSimilarity() {
        if (this._importBatchActive) {
            if (!this._importBatchAlimentos) {
                this._importBatchAlimentos = await this.repository.findAllAlimentos();
            }
            return this._importBatchAlimentos;
        }
        return this.repository.findAllAlimentos();
    }

    _registerAlimentoInBatchCache(row) {
        if (!this._importBatchActive || !row?.nome) return;
        if (!this._importBatchAlimentos) return;
        this._importBatchAlimentos.push({ id: row.id, nome: row.nome });
    }

    /**
     * Encontra ou cria um alimento baseado no nome
     * Implementa algoritmo de matching com prioridades:
     * 1. Match exato (nome original) - PRIORIDADE MÁXIMA
     * 2. Match exato normalizado
     * 3. Mapeamento específico (apenas se necessário)
     * 4. Match por similaridade (alimento mais específico)
     * 5. Criação automática
     * 
     * REGRA CRÍTICA: NÃO converte o alimento original para uma variação diferente
     * Exemplo: "ovo" NÃO vira "clara de ovo", "pão de forma tradicional" NÃO vira "pão francês"
     * 
     * @param {string} nomeAlimento - Nome do alimento a ser encontrado
     * @param {string} userId - ID do usuário (para criação automática)
     * @returns {Promise<string|null>} ID do alimento encontrado ou criado, ou null se falhar
     */
    async findOrCreateAlimento(nomeAlimento, userId) {
        if (!nomeAlimento || !nomeAlimento.trim()) {
            return null;
        }

        // 1. MATCH EXATO COM NOME ORIGINAL - PRIORIDADE MÁXIMA
        // Busca primeiro com o nome exatamente como veio (sem normalização)
        const alimentoExatoOriginal = await this.repository.findAlimentoByNomeExato(nomeAlimento.trim());
        if (alimentoExatoOriginal) {
            console.log(`Match exato (original): "${nomeAlimento}" → id: ${alimentoExatoOriginal.id}`);
            return alimentoExatoOriginal.id;
        }

        const nomeNormalizado = this._normalizeText(nomeAlimento);

        // 2. MATCH EXATO NORMALIZADO - prioridade alta
        const alimentoExato = await this.repository.findAlimentoByNomeExato(nomeNormalizado);
        if (alimentoExato) {
            console.log(`Match exato (normalizado): "${nomeAlimento}" → id: ${alimentoExato.id}`);
            return alimentoExato.id;
        }

        // 3. MAPEAMENTO ESPECÍFICO - apenas se não houver match exato
        // Usa mapeamento para encontrar variações conhecidas
        const mapeamentosEspecificos = this._getMapeamentosEspecificos();
        if (mapeamentosEspecificos[nomeNormalizado]) {
            const nomeMapeado = mapeamentosEspecificos[nomeNormalizado];
            const alimento = await this.repository.findAlimentoByNomeExato(nomeMapeado);
            if (alimento) {
                console.log(`Mapeamento específico: "${nomeAlimento}" → "${nomeMapeado}"`);
                return alimento.id;
            }
        }

        // 4. MATCH POR SIMILARIDADE - busca alimento mais específico (menor diferença)
        const alimentos = await this._loadAlimentosForSimilarity();
        const matchSimilar = this._findSimilarMatch(nomeNormalizado, alimentos);
        if (matchSimilar) {
            console.log(`Match por similaridade: "${nomeAlimento}" → "${matchSimilar.nome}"`);
            return matchSimilar.id;
        }

        // 5. CRIAÇÃO AUTOMÁTICA - última opção
        // Mantém o nome original, não converte para variação
        console.log(`Alimento não encontrado, criando automaticamente: "${nomeAlimento}"`);
        return await this._createAlimentoAutomatico(nomeAlimento, userId);
    }

    /**
     * Normaliza texto para comparação (remove acentos, espaços extras, etc.)
     */
    _normalizeText(text) {
        return text.toLowerCase().trim()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/[^a-z0-9\s]/g, ' ') // Remove caracteres especiais
            .replace(/\s+/g, ' '); // Normaliza espaços
    }

    /**
     * Retorna mapeamentos específicos para alimentos comuns.
     *
     * IMPORTANTE: estes mapeamentos só são consultados quando NÃO há match exato
     * (original ou normalizado). Mantemos apenas variações ortográficas/redundantes
     * para o mesmo item — NÃO convertemos sinônimos para um nome canônico
     * diferente, pois isso descaracteriza a ficha original do aluno.
     *
     * Ex.: "frango" NÃO vira "peito de frango"; "ovo cozido" NÃO vira
     * "ovo inteiro". Cada um continua sendo criado/buscado com o nome original.
     */
    _getMapeamentosEspecificos() {
        return {
            // Variações ortográficas comuns (com/sem acento, plural/singular)
            'whey': 'whey protein',
            'pao de forma tradicional': 'pao de forma tradicional',
            'arroz branco': 'arroz branco',
            'feijao carioca cozido': 'feijao carioca cozido',
            'banana prata': 'banana prata',
            'peito de frango': 'peito de frango',
            'carne bovina patinho sem gordura grelhado': 'carne bovina patinho sem gordura grelhado',
            'patinho': 'patinho',
            'requeijao': 'requeijao',
            'mussarela': 'mussarela',
            'aveia': 'aveia',
            'macarrao': 'macarrao',
            'tapioca': 'tapioca'
        };
    }

    /**
     * Exige que todos os tokens significativos (>=3 chars) de `innerNorm` apareçam em `outerNorm`.
     */
    _tokensConsistent(outerNorm, innerNorm) {
        const tokens = innerNorm.split(' ').filter((t) => t.length >= 3);
        if (tokens.length === 0) {
            return innerNorm.length < 3 || outerNorm.includes(innerNorm);
        }
        return tokens.every((t) => outerNorm.includes(t));
    }

    /**
     * Encontra match por similaridade
     * Prioriza alimento mais específico (menor diferença de caracteres)
     * NÃO converte para variação diferente - busca o mais próximo possível
     */
    _findSimilarMatch(nomeNormalizado, alimentos) {
        if (!nomeNormalizado || nomeNormalizado.length < 3) {
            return null;
        }

        let melhorMatch = null;
        let menorDiff = Infinity;

        for (const alimento of alimentos) {
            const nomeAlimentoNorm = this._normalizeText(alimento.nome);

            if (nomeAlimentoNorm === nomeNormalizado) {
                return alimento;
            }

            // Nome no BD contém a ficha (BD mais específico)
            if (
                nomeAlimentoNorm.includes(nomeNormalizado) &&
                this._tokensConsistent(nomeAlimentoNorm, nomeNormalizado)
            ) {
                const diff = nomeAlimentoNorm.length - nomeNormalizado.length;
                if (diff < menorDiff && diff <= 28) {
                    menorDiff = diff;
                    melhorMatch = alimento;
                }
            }

            // Ficha contém nome do BD (BD mais genérico): só com base razoável
            if (
                nomeNormalizado.includes(nomeAlimentoNorm) &&
                nomeAlimentoNorm.length >= 6 &&
                this._tokensConsistent(nomeNormalizado, nomeAlimentoNorm)
            ) {
                const diff = nomeNormalizado.length - nomeAlimentoNorm.length;
                if (diff < menorDiff && diff <= 14) {
                    menorDiff = diff;
                    melhorMatch = alimento;
                }
            }
        }

        return melhorMatch;
    }

    /**
     * Cria alimento automaticamente com valores nutricionais estimados
     * ALIM-01: Resolve tipo_id via repository antes de inserir
     * GUARD-01: Valida tipo_id antes de inserir
     */
    async _createAlimentoAutomatico(nomeAlimento, userId) {
        // ALIM-01: Resolver tipo via repository se disponível
        let tipoId;
        
        if (this.tipoAlimentoRepository) {
            // TYPE-02: Resolver tipo no banco (buscar ou criar)
            const nomeTipo = this._inferirNomeTipo(nomeAlimento);
            try {
                const tipo = await this.tipoAlimentoRepository.findOrCreateTipo(nomeTipo);
                tipoId = tipo.id;
                
                // GUARD-01: Validar tipo_id antes de inserir
                if (!tipoId || tipoId === null || tipoId === undefined) {
                    throw new Error(`GUARD-01: tipo_id inválido para alimento "${nomeAlimento}" e tipo "${nomeTipo}"`);
                }
            } catch (error) {
                console.error(`Erro ao resolver tipo "${nomeTipo}" para alimento "${nomeAlimento}":`, error);
                throw new Error(`Erro ao resolver tipo para alimento "${nomeAlimento}": ${error.message}`);
            }
        } else {
            // Fallback: usar método antigo (DEPRECATED - manter apenas para compatibilidade)
            console.warn('ALIM-01: tipoAlimentoRepository não disponível, usando fallback (deprecated)');
            tipoId = this._inferirTipoAlimento(nomeAlimento);
        }
        
        // GUARD-01: Fail-fast de integridade
        if (!tipoId || tipoId === null || tipoId === undefined) {
            const error = new Error(`GUARD-01: tipo_id é obrigatório mas está undefined/null para alimento "${nomeAlimento}"`);
            console.error(error.message, {
                nomeAlimento,
                tipoId,
                hasTipoRepository: !!this.tipoAlimentoRepository
            });
            throw error;
        }
        
        const origemPtn = normalizeOrigemPtn(this._inferirOrigemPtn(nomeAlimento));
        const valoresMeta = this._inferirValoresNutricionaisMeta(nomeAlimento);
        const { confidence, ...valoresNutr } = valoresMeta;
        const alcoolGramas = 0;
        const kcalCalculada = roundNutrient(
            kcalFromMacros(valoresNutr.ptn, valoresNutr.cho, valoresNutr.lip, alcoolGramas),
            1
        );

        // Verifica se já existe um alimento similar antes de criar
        const existente = await this.repository.findAlimentoSimilar(nomeAlimento);
        if (existente) {
            console.log(`Alimento similar já existe: "${nomeAlimento}", usando ID existente`);
            return existente.id;
        }

        const infoMeta = {
            origem: 'importacao_automatica',
            confianca_estimativa_nutricao: confidence,
            nota: 'Valores estimados por heurística no nome; rever no gestor de alimentos.'
        };
        const info_adicional = JSON.stringify(infoMeta);

        // ALIM-01: Inserir alimento com FK válida
        const novoAlimento = await this.repository.createAlimento({
            nome: nomeAlimento.trim(),
            tipo_id: tipoId,
            origem_ptn: origemPtn,
            quantidade_referencia_g: 100,
            kcal_por_referencia: kcalCalculada,
            ptn_por_referencia: valoresNutr.ptn,
            cho_por_referencia: valoresNutr.cho,
            lip_por_referencia: valoresNutr.lip,
            alcool_por_referencia: alcoolGramas,
            info_adicional,
            autor: userId
        });

        this._registerAlimentoInBatchCache(novoAlimento);
        console.log(`Novo alimento criado: "${nomeAlimento}" com tipo_id=${tipoId} e valores estimados`);
        return novoAlimento.id;
    }

    /**
     * Infere nome do tipo baseado no nome do alimento
     * Retorna nome legível do tipo (ex: "Proteínas"), não ID
     */
    _inferirNomeTipo(nome) {
        const nomeNorm = this._normalizeText(nome);

        if (/frango|carne|peixe|atum|ovo|whey|peito/.test(nomeNorm)) {
            return 'Proteínas';
        }
        if (/arroz|batata|pao|macarrao|aveia|tapioca|feijao/.test(nomeNorm)) {
            return 'Carboidratos';
        }
        if (/azeite|oleo|manteiga|castanha|amendoim/.test(nomeNorm)) {
            return 'Lipídeos';
        }
        if (/banana|maca|laranja|fruta|morango/.test(nomeNorm)) {
            return 'Frutas';
        }
        if (/alface|tomate|brocolis|cenoura|vegetal/.test(nomeNorm)) {
            return 'Vegetais';
        }
        if (/leite|queijo|iogurte|requeijao/.test(nomeNorm)) {
            return 'Laticínios';
        }

        return 'Carboidratos'; // Default
    }

    /**
     * Infere tipo de alimento baseado no nome (DEPRECATED)
     * @deprecated Use _inferirNomeTipo() e resolva via repository
     * Mantido apenas para fallback quando repository não está disponível
     */
    _inferirTipoAlimento(nome) {
        const nomeNorm = this._normalizeText(nome);

        // IDs de tipos (ajustar conforme seu banco) - DEPRECATED
        // ALIM-01: Anti-pattern - IDs hardcoded não devem ser usados
        if (/frango|carne|peixe|atum|ovo|whey|peito/.test(nomeNorm)) {
            return '33acba74-bbc2-446a-8476-401693c56baf'; // Proteínas
        }
        if (/arroz|batata|pao|macarrao|aveia|tapioca|feijao/.test(nomeNorm)) {
            return 'dea776a3-f586-40bb-a945-6f466b8c3e31'; // Carboidratos
        }
        if (/azeite|oleo|manteiga|castanha|amendoim/.test(nomeNorm)) {
            return 'e5863a2d-695d-46a7-9ef5-d7e3cf87ee1c'; // Lipídeos
        }
        if (/banana|maca|laranja|fruta|morango/.test(nomeNorm)) {
            return 'c0a07056-794b-424a-acd6-14215b9be248'; // Frutas
        }
        if (/alface|tomate|brocolis|cenoura|vegetal/.test(nomeNorm)) {
            return '92b02101-c685-4fd7-956d-51fd21673690'; // Vegetais
        }
        if (/leite|queijo|iogurte|requeijao/.test(nomeNorm)) {
            return 'b46fa5f1-7333-4313-a747-9ea6efbfe3a7'; // Laticínios
        }

        return 'dea776a3-f586-40bb-a945-6f466b8c3e31'; // Default: Carboidratos
    }

    /**
     * Infere origem da proteína
     */
    _inferirOrigemPtn(nome) {
        const nomeNorm = this._normalizeText(nome);

        if (/frango|carne|peixe|ovo|atum|whey|leite|queijo/.test(nomeNorm)) {
            return 'Animal';
        }
        if (/feijao|lentilha|grao de bico|soja|quinoa/.test(nomeNorm)) {
            return 'Vegetal';
        }

        return 'Mista';
    }

    /**
     * Estimativa nutricional + nível de confiança (heurística).
     * @returns {{ kcal: number, ptn: number, cho: number, lip: number, confidence: 'media'|'baixa' }}
     */
    _inferirValoresNutricionaisMeta(nome) {
        const nomeNorm = this._normalizeText(nome);

        if (/frango|carne|peixe|ovo|atum|whey|peito/.test(nomeNorm)) {
            return { kcal: 165, ptn: 31, cho: 0, lip: 3.6, confidence: 'media' };
        }
        if (/arroz|batata|pao|macarrao|aveia|tapioca/.test(nomeNorm)) {
            return { kcal: 130, ptn: 2.7, cho: 28, lip: 0.3, confidence: 'media' };
        }
        if (/azeite|oleo|manteiga|castanha|amendoim/.test(nomeNorm)) {
            return { kcal: 884, ptn: 0, cho: 0, lip: 100, confidence: 'media' };
        }
        if (/banana|maca|laranja|fruta|morango/.test(nomeNorm)) {
            return { kcal: 52, ptn: 0.3, cho: 14, lip: 0.2, confidence: 'media' };
        }
        if (/alface|tomate|brocolis|cenoura|vegetal/.test(nomeNorm)) {
            return { kcal: 25, ptn: 2, cho: 4, lip: 0.4, confidence: 'media' };
        }
        if (/leite|queijo|iogurte|requeijao/.test(nomeNorm)) {
            return { kcal: 42, ptn: 3.4, cho: 5, lip: 1, confidence: 'media' };
        }

        return { kcal: 100, ptn: 10, cho: 10, lip: 5, confidence: 'baixa' };
    }

    /**
     * Infere valores nutricionais estimados
     */
    _inferirValoresNutricionais(nome) {
        const { confidence: _c, ...rest } = this._inferirValoresNutricionaisMeta(nome);
        return rest;
    }
}

module.exports = FoodMatchingService;
