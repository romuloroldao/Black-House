// Tipo Alimento Repository
// Gerencia tipos de alimentos no banco de dados

const { assertQueryable } = require('../shared/db-guards');
const logger = require('../utils/logger');

class TipoAlimentoRepository {
    constructor(queryFn) {
        const stack = new Error().stack;
        logger.info('TipoAlimentoRepository sendo instanciado', {
            queryFnType: typeof queryFn,
            queryFnIsFunction: typeof queryFn === 'function',
            stack: stack ? stack.split('\n').slice(2, 8).join('\n') : 'Stack não disponível'
        });
        
        if (!queryFn || typeof queryFn !== 'function') {
            const error = new Error('TipoAlimentoRepository recebeu queryFn inválido');
            error.stack = stack;
            logger.error(error.message, {
                queryFnType: typeof queryFn,
                stack: stack ? stack.split('\n').slice(2, 10).join('\n') : 'Stack não disponível'
            });
            throw error;
        }
        
        this.query = queryFn;
    }

    /**
     * Busca tipo por nome (case-insensitive, trim)
     * Nota: A tabela usa coluna 'nome_tipo', não 'nome'
     */
    async findTipoByNome(nome) {
        if (!this.query || typeof this.query !== 'function') {
            throw new Error('TipoAlimentoRepository.query é undefined');
        }
        
        const query = `
            SELECT id, nome_tipo as nome
            FROM public.tipos_alimentos
            WHERE LOWER(TRIM(nome_tipo)) = LOWER(TRIM($1))
            LIMIT 1
        `;
        
        const result = await this.query(query, [nome]);
        return result.rows[0] || null;
    }

    /**
     * Cria novo tipo de alimento
     * TYPE-02: Usa RETURNING id para obter ID do banco
     * Nota: A tabela usa coluna 'nome_tipo', não 'nome'
     */
    async createTipo(nome) {
        if (!this.query || typeof this.query !== 'function') {
            throw new Error('TipoAlimentoRepository.query é undefined');
        }
        
        // TYPE-02: Tentar inserir, se já existir retorna o existente
        // A tabela tem UNIQUE constraint em nome_tipo
        const querySimple = `
            INSERT INTO public.tipos_alimentos (nome_tipo)
            VALUES ($1)
            ON CONFLICT (nome_tipo) DO NOTHING
            RETURNING id, nome_tipo as nome
        `;
        
        try {
            // Primeiro tentar buscar para evitar duplicatas
            const existente = await this.findTipoByNome(nome);
            if (existente) {
                logger.info('TYPE-02: Tipo já existe, retornando existente', {
                    tipoNome: nome,
                    tipoId: existente.id
                });
                return existente;
            }
            
            // Se não existe, criar
            const result = await this.query(querySimple, [nome.trim()]);
            
            // Se INSERT não criou nada (ON CONFLICT DO NOTHING), buscar novamente
            if (!result.rows || result.rows.length === 0) {
                logger.info('TYPE-02: Tipo duplicado (ON CONFLICT), buscando existente', {
                    tipoNome: nome
                });
                const existente = await this.findTipoByNome(nome);
                if (existente) {
                    return existente;
                }
                throw new Error(`Tipo "${nome}" não pôde ser criado e não existe no banco`);
            }
            
            logger.info('TYPE-02: Tipo criado com sucesso', {
                tipoNome: nome,
                tipoId: result.rows[0].id
            });
            return result.rows[0];
        } catch (error) {
            // Se erro de duplicata, buscar novamente
            if (error.code === '23505' || error.message.includes('duplicate') || error.message.includes('unique')) {
                logger.info('TYPE-02: Tipo duplicado detectado, buscando existente', {
                    tipoNome: nome,
                    errorCode: error.code
                });
                const existente = await this.findTipoByNome(nome);
                if (existente) {
                    return existente;
                }
            }
            throw error;
        }
    }

    /**
     * Busca ou cria tipo de alimento
     * TYPE-02: Resolve tipo no banco, cria se não existir
     */
    async findOrCreateTipo(nome) {
        // TYPE-02: Normalizar nome antes de buscar/criar
        const nomeNormalizado = nome.trim();
        
        // Buscar primeiro
        const existente = await this.findTipoByNome(nomeNormalizado);
        if (existente) {
            return existente;
        }
        
        // Se não existe, criar
        return await this.createTipo(nomeNormalizado);
    }

    /**
     * Resolve múltiplos tipos de uma vez
     * TYPE-02: Retorna mapa { nomeTipo: id }
     * TYPE-03: IDs sempre vindos do banco
     */
    async resolveTipos(nomesTipos) {
        // TYPE-01: Normalizar e remover duplicatas
        const tiposUnicos = [...new Set(
            nomesTipos
                .map(nome => nome ? nome.trim() : null)
                .filter(nome => nome && nome.length > 0)
                .map(nome => nome.toLowerCase())
        )];
        
        logger.info('TYPE-01: Tipos únicos extraídos', {
            tiposCount: tiposUnicos.length,
            tipos: tiposUnicos
        });
        
        // TYPE-02: Resolver todos os tipos no banco
        const tipoMap = {};
        
        for (const nomeTipo of tiposUnicos) {
            try {
                const tipo = await this.findOrCreateTipo(nomeTipo);
                // TYPE-03: Usar ID vindo do banco
                tipoMap[nomeTipo.toLowerCase()] = tipo.id;
                logger.debug('TYPE-02: Tipo resolvido', {
                    nomeTipo,
                    tipoId: tipo.id
                });
            } catch (error) {
                logger.error('TYPE-02: Erro ao resolver tipo', {
                    nomeTipo,
                    error: error.message,
                    stack: error.stack
                });
                throw new Error(`Erro ao resolver tipo "${nomeTipo}": ${error.message}`);
            }
        }
        
        logger.info('TYPE-03: Mapa de tipos criado', {
            tiposCount: Object.keys(tipoMap).length,
            tiposIds: Object.values(tipoMap).slice(0, 5) // Log apenas primeiros 5
        });
        
        return tipoMap;
    }

    /**
     * Infere nome do tipo baseado no nome do alimento
     * Retorna nome legível do tipo, não ID
     */
    inferirNomeTipo(nomeAlimento) {
        const nomeNorm = nomeAlimento.toLowerCase().trim();
        
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
}

module.exports = TipoAlimentoRepository;
