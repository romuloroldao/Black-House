/**
 * AI Service
 * Camada de serviço que usa a abstração de providers de IA
 * NÃO importa SDKs de IA diretamente - usa ai/index.js
 *
 * Fichas-modelo para calibrar o prompt (smoke: server/scripts/test-import-real-pdf.js):
 *   black/*.pdf na raiz do repo — variantes "Plano - Retorno …" com o mesmo layout.
 */

const aiProviderManager = require('./ai');
const logger = require('../utils/logger');

class AIService {
    constructor() {
        this.providerManager = aiProviderManager;
    }

    /**
     * Gera o prompt do sistema para extração de dados.
     *
     * IMPRECISÃO-002: Reforço para fichas complexas (multi-dia, periodização,
     * substitutos, ciclos, faixas como "30~40g", macros por refeição, horários).
     *
     * @returns {string}
     */
    getSystemPrompt() {
        // IMPRECISÃO-011: template explícito Plano Alimentar / Plano Retorno + colunas TAB + quantidades coladas.
        return `Você extrai dados de fichas nutricionais em PDF com alta fidelidade (multipáginas, colunas, tabelas, planos A/B).

=== TEMPLATE "PLANO ALIMENTAR" / PLANO RETORNO (Black House) ===
Formato muito frequente nas fichas-modelo; siga estas regras antes de qualquer heurística genérica:

1) Título e planos: linha "PLANO ALIMENTAR - A" ou "- B". Se houver dois blocos (A depois B), refeições após o segundo título pertencem ao "Plano B" — preencha o campo "plano" ("Plano A" / "Plano B") nas refeições afetadas.

2) Cabeçalho do aluno: Nome, Kcal da dieta, Objetivo, Peso (kg), Altura, Idade (anos), ingestão de água (mL), Saldo calórico, Kcal/Kg, Estratégia (ex. GET v0,0), totais globais Prot/Carb/Lip. Objetivo pode vir entrelaçado com colunas (texto do coach junto de números de água). Reconstrua aluno.objetivo só com frases de meta/comportamento; não inclua mL, "Kcal/Kg", "GET v0,0" nem totais globais. aluno.nome só o nome (ex.: entre "Nome" e "Kcal" ou "Objetivo" quando colados). Números com vírgula (83,0) → número JSON. "Idade (anos)39" → idade 39.

3) Colunas e TAB: o texto pode conter o carácter TAB entre colunas. Trate TAB como separador: em tabelas "Qtd / Alimentos de preferência / substitutos 1 / 2", alinhe quantidade ao alimento da mesma linha visual; substitutos da linha → array "alternativas" do alimento principal (quantidade igual à da coluna quando existir).

4) Nome das refeições: quando o PDF diz "Refeição 1", "Refeição 2", … mantenha esse nome (ex. "Refeição 3"). Não renomeie para "Café da manhã" ou "Almoço" a menos que o PDF use explicitamente esse nome.

5) Quantidade colada ao nome (PDF sem espaço): "40Whey Protein" → quantidade "40g", nome "Whey Protein". "170Iogurte natural" → "170g", "Iogurte natural". "90" numa linha e "Ovo, 1un=45g" na seguinte → combine num único alimento com quantidade e nome coerentes ao PDF.

6) Vários pares número+texto na mesma linha: ex. "40Farinha de Arroz40Sucrilhoss60Aveia" — separe em alimentos distintos quando cada par (número + nome) for claro; se ambíguo, uma linha com quantidade string mais fiel ao texto original.

7) Personalizado - PROT / CARB / LIP: o nome do alimento é só a parte descritiva após o número (ex. "180Peito de Frango" → nome "Peito de Frango", quantidade "180g"). Nunca deixe o prefixo "Personalizado - PROT" dentro do campo nome.

8) Categorias (não são alimentos): "Carnes e Proteínas", "Leite e Derivados", "Pães e Variedades", "Feijão e Leguminosas", "Frutas", "Fibras A/B", "Vegetais A (livres…)", "Óleos e Gorduras", "Cereais", "Bebidas" — use apenas para contextualizar a linha seguinte; o alimento é sempre o item concreto (ex. leite, pão, frango).

9) Macros por refeição: linhas "Kcal … CHO … PTN … LIP …" imediatamente após o bloco de alimentos da refeição podem preencher "macros" dessa refeição com os números explícitos; não duplicar essas linhas como alimentos.

10) Secção "LISTA DE SUBSTITUIÇÕES" / "Grupo dos…": é referência de grupos; não misture com o plano principal nem duplique refeições salvo o PDF for claramente uma segunda dieta completa com refeições próprias.

11) dieta.nome: use o título explícito do plano no PDF (ex. "Plano Alimentar - A") quando aparecer junto a "PLANO ALIMENTAR"; caso contrário mantenha um nome curto genérico.
- APENAS JSON válido, sem markdown, sem comentários, sem texto antes/depois.
- Use EXATAMENTE o schema abaixo. Campos opcionais: omita, use null ou [].
- Nunca crie campos fora do schema.
- Nunca invente alimentos, doses ou macros que não resultem do PDF.

ESTRUTURA DO PDF:
- Cada página pode vir como "=== PÁGINA n ===".
- Ordem: cima→baixo, esquerda→direita, página a página; não misture alimentos de refeições diferentes.
- Multi-dia / treino-descanso: uma entrada em "refeicoes" por combinação (dia_semana / plano / refeição) quando o PDF distinguir.

ALIMENTOS:
- Nome literal do PDF (não substituir sinónimos nem "melhorar" o nome).
- Um alimento = um item específico; nunca use só o nome do grupo ("Carnes e Proteínas", "Vegetais", "Opções").
- Ignore totais globais e linhas só de macro da refeição como se fossem alimentos (ver regra 9).
- Preferência vs substitutos: principal em nome+quantidade; substitutos em "alternativas" com quantidade do PDF.
- Quantidades em string: preserve formato ("30~40g", "200-250ml", "1 colher (15g)", "1/2 xícara (60g)").

REFEIÇÕES:
- Campos opcionais: horario, observacao, dia_semana, plano, macros quando o PDF tiver.
- "Pré-treino" / "Pós-treino" só se existirem com esse nome ou equivalente explícito no PDF.

PROTOCOLO:
- Suplementos e fármacos apenas se listados como tal no PDF; nome + dosagem obrigatórios; horario/observacao se existirem.
- "orientacoes": instruções gerais (hidratação, sono, etc.) quando existirem fora das tabelas de refeição.

SCHEMA:
{
  "aluno": { "nome": string, "peso": number|null, "altura": number|null, "idade": number|null, "objetivo": string|null },
  "dieta": {
    "nome": string,
    "objetivo": string|null,
    "refeicoes": [
      {
        "nome": string,
        "horario": string|null,
        "observacao": string|null,
        "dia_semana": string|null,
        "plano": string|null,
        "macros": { "proteina": number|null, "carboidrato": number|null, "gordura": number|null, "calorias": number|null }|null,
        "alimentos": [
          { "nome": string, "quantidade": string, "alternativas": [ { "nome": string, "quantidade": string } ] }
        ]
      }
    ],
    "macros": { "proteina": number|null, "carboidrato": number|null, "gordura": number|null, "calorias": number|null }
  },
  "suplementos": [ { "nome": string, "dosagem": string, "horario": string|null, "observacao": string|null } ],
  "farmacos":    [ { "nome": string, "dosagem": string, "horario": string|null, "observacao": string|null } ],
  "orientacoes": string|null
}

LIMITES: nome 255, quantidade 100, horario 50, dia_semana 50, plano 100, observacao 1000, orientacoes 5000, peso 0-500, altura 0-300, idade 0-150.

CHECKLIST ANTES DE RETORNAR:
- aluno.nome não vazio.
- Se o PDF usar "Refeição 1…N", nomes de refeição alinhados ao PDF (não renomear sem necessidade).
- Colunas TAB / tabela respeitadas; quantidades coladas separadas corretamente do nome.
- Todas refeições do plano principal extraídas; secção "LISTA DE SUBSTITUIÇÕES" não duplicou o plano.
- Multi-plano (A/B): campo "plano" preenchido quando houver segundo bloco PLANO ALIMENTAR.
- Cada refeição tem ≥1 alimento; cada alimento tem nome específico e quantidade textual fiel ao PDF.
- Substitutos no array "alternativas" do alimento principal.
- Macros e categorias NÃO viraram alimentos.
- Suplementos/fármacos somente se presentes no PDF.
- JSON válido, sem campos extras, sem markdown, começa com "{" e termina com "}".`;
    }

    /**
     * Compila o texto para envio à IA, anotando páginas quando disponível.
     * Isso ajuda a IA a NÃO misturar refeições de páginas distintas em fichas
     * complexas.
     *
     * @param {string|string[]} pdfText - Texto bruto ou array por página
     * @returns {string}
     */
    composePromptText(pdfText) {
        if (Array.isArray(pdfText)) {
            return pdfText
                .map((page, idx) => `=== PÁGINA ${idx + 1} ===\n${(page || '').trim()}`)
                .join('\n\n');
        }
        return String(pdfText || '');
    }

    /**
     * Extrai dados estruturados de um PDF usando IA multimodal
     * @param {string|string[]} pdfText - Texto extraído do PDF (string OU array por página)
     * @param {Buffer|null} pdfBuffer - Buffer do PDF para providers multimodais (Gemini)
     * @param {Object|null} promptOverrides - { systemPrompt, userPrompt } da import-engine
     * @returns {Promise<Object>} Dados estruturados do aluno e dieta
     * @throws {Error} Se IA não estiver disponível ou ocorrer erro na extração
     */
    async extractStructuredData(pdfText, pdfBuffer = null, promptOverrides = null) {
        // Verificar se IA está disponível
        if (!this.providerManager.isAvailable()) {
            const providerInfo = this.providerManager.getProviderInfo();
            throw new Error(
                `IA não está disponível. ` +
                `Provider: ${providerInfo.provider || 'não configurado'}. ` +
                `Configure AI_PROVIDER e AI_API_KEY no arquivo .env`
            );
        }

        try {
            const systemPrompt = promptOverrides?.systemPrompt || this.getSystemPrompt();
            const promptText = this.composePromptText(pdfText);
            const userPrompt = promptOverrides?.userPrompt ||
                ('Extraia os dados da ficha abaixo. O texto pode vir com "=== PÁGINA n ===" e com TAB entre colunas — respeite colunas e ordem visual. ' +
                'Priorize fidelidade literal a nomes e quantidades do PDF; para campos opcionais, prefira null ou omitir a inventar.\n\n' +
                promptText);

            const extractedData = await this.providerManager.extractStructuredData(
                promptText,
                systemPrompt,
                userPrompt,
                pdfBuffer
            );

            // Log do que foi retornado (para debug)
            logger.info('Dados extraídos pela IA', {
                provider: this.providerManager.getProviderInfo().provider,
                dataKeys: Object.keys(extractedData)
            });

            return extractedData;
        } catch (error) {
            logger.error('Erro ao extrair dados com IA', {
                error: error.message,
                stack: error.stack,
                provider: this.providerManager.getProviderInfo().provider
            });
            
            // Re-throw a mensagem original (já tratada pelo provider)
            // Não aninhar mensagens de erro
            throw error;
        }
    }

    /**
     * Verifica se IA está disponível
     * @returns {boolean}
     */
    isAvailable() {
        return this.providerManager.isAvailable();
    }

    isVisionAvailable() {
        return this.providerManager.isVisionAvailable();
    }

    /**
     * Análise de foto de refeição (vision → JSON).
     */
    async analyzeMealPhoto(imageBuffer, mimeType, systemPrompt, userPrompt) {
        if (!this.isVisionAvailable()) {
            throw new Error(
                'IA de visão não está disponível. Configure Gemini (AI_VISION_PROVIDER / GEMINI_API_KEY).',
            );
        }
        return this.providerManager.extractStructuredDataFromImage(
            imageBuffer,
            mimeType,
            systemPrompt,
            userPrompt,
            { timeoutMs: 55000 },
        );
    }

    /**
     * Retorna informações sobre o provider atual
     * @returns {Object}
     */
    getProviderInfo() {
        return this.providerManager.getProviderInfo();
    }
}

module.exports = new AIService();
