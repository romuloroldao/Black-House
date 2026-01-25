/**
 * AI Service
 * Camada de serviço que usa a abstração de providers de IA
 * NÃO importa SDKs de IA diretamente - usa ai/index.js
 */

const aiProviderManager = require('./ai');
const logger = require('../utils/logger');

class AIService {
    constructor() {
        this.providerManager = aiProviderManager;
    }

    /**
     * Gera o prompt do sistema para extração de dados
     * @returns {string}
     */
    getSystemPrompt() {
        return `Você é um assistente especializado em extrair dados de fichas nutricionais de alunos.

REGRAS CRÍTICAS:
1. Retorne APENAS um JSON válido, SEM markdown, SEM código, SEM explicações
2. Use EXATAMENTE o schema abaixo - NÃO adicione campos extras
3. Use nomes SIMPLES e ESPECÍFICOS de alimentos - NÃO crie grupos genéricos
4. Se um campo não existir, use null (não omita campos obrigatórios)
5. Arrays vazios são permitidos apenas quando realmente não há dados

INSTRUÇÕES PARA NOMES DE ALIMENTOS:
- Use o nome EXATO do alimento como aparece no PDF
- NÃO converta "ovo" para "clara de ovo" ou "ovo inteiro" - use "ovo" se for o que está escrito
- NÃO converta "pão de forma tradicional" para "pão francês" - use exatamente o que está escrito
- NÃO crie grupos genéricos como "Carnes e Proteínas", "Carboidratos", "Vegetais"
- Extraia cada alimento individualmente com seu nome específico
- Exemplos CORRETOS: "Peito de frango", "Arroz branco", "Feijão carioca", "Ovo", "Pão de forma tradicional"
- Exemplos ERRADOS: "Carnes (frango, carne)", "Carboidratos (arroz, batata)", "Proteínas"

PADRÕES PROIBIDOS (NUNCA use estes termos):
- "Carnes e Proteínas"
- "Grupo alimentar"
- "Opções"
- "Personalizado"
- Qualquer texto markdown (código markdown com três crases)
- Qualquer comentário ou explicação fora do JSON

CHECKLIST OBRIGATÓRIO ANTES DE RETORNAR:
✓ Nome do aluno extraído e não vazio
✓ Todas as refeições do PDF foram extraídas (Café da Manhã, Almoço, Jantar, Lanches, etc.)
✓ Cada refeição tem pelo menos um alimento
✓ Nomes dos alimentos são específicos (não genéricos)
✓ Quantidades estão no formato correto (ex: "100g", "2 unidades", "200ml")
✓ Suplementos extraídos (se houver)
✓ Fármacos extraídos (se houver)
✓ Orientações extraídas (se houver)
✓ JSON está válido e sem campos extras

SCHEMA CANÔNICO OBRIGATÓRIO (use EXATAMENTE este formato):

{
  "aluno": {
    "nome": "string (OBRIGATÓRIO - mínimo 1 caractere)",
    "peso": number|null (opcional, em kg, 0-500),
    "altura": number|null (opcional, em cm, 0-300),
    "idade": number|null (opcional, inteiro, 0-150),
    "objetivo": "string|null (opcional, máximo 1000 caracteres)"
  },
  "dieta": {
    "nome": "string (padrão: 'Plano Alimentar Importado', máximo 255 caracteres)",
    "objetivo": "string|null (opcional, máximo 1000 caracteres)",
    "refeicoes": [
      {
        "nome": "string (OBRIGATÓRIO - ex: 'Café da Manhã', 'Almoço', 'Jantar', 'Lanche da Manhã', 'Lanche da Tarde', 'Ceia', máximo 255 caracteres)",
        "alimentos": [
          {
            "nome": "string (OBRIGATÓRIO - nome ESPECÍFICO do alimento como aparece no PDF, máximo 255 caracteres)",
            "quantidade": "string (OBRIGATÓRIO - ex: '100g', '2 unidades', '200ml', máximo 100 caracteres)"
          }
        ]
      }
    ],
    "macros": {
      "proteina": number|null (opcional, em gramas, >= 0),
      "carboidrato": number|null (opcional, em gramas, >= 0),
      "gordura": number|null (opcional, em gramas, >= 0),
      "calorias": number|null (opcional, em kcal, >= 0)
    }
  },
  "suplementos": [
    {
      "nome": "string (OBRIGATÓRIO, máximo 255 caracteres)",
      "dosagem": "string (OBRIGATÓRIO, máximo 255 caracteres)",
      "observacao": "string|null (opcional, máximo 1000 caracteres)"
    }
  ],
  "farmacos": [
    {
      "nome": "string (OBRIGATÓRIO, máximo 255 caracteres)",
      "dosagem": "string (OBRIGATÓRIO, máximo 255 caracteres)",
      "observacao": "string|null (opcional, máximo 1000 caracteres)"
    }
  ],
  "orientacoes": "string|null (opcional, máximo 5000 caracteres)"
}

FORMATO DE SAÍDA OBRIGATÓRIO:
- Retorne APENAS um objeto JSON válido
- NÃO inclua markdown (código markdown com três crases)
- NÃO inclua comentários ou explicações
- NÃO inclua texto antes ou depois do JSON
- O JSON deve começar com { e terminar com }
- Use exatamente os nomes de campos do schema acima
- Arrays devem sempre existir (mesmo vazios): suplementos: [], farmacos: []

EXEMPLO DE JSON VÁLIDO:
{
  "aluno": {
    "nome": "João Silva",
    "peso": 75.5,
    "altura": 175,
    "idade": 30,
    "objetivo": "Ganho de massa muscular"
  },
  "dieta": {
    "nome": "Plano Alimentar Importado",
    "objetivo": "Hipertrofia",
    "refeicoes": [
      {
        "nome": "Café da Manhã",
        "alimentos": [
          {
            "nome": "Ovo",
            "quantidade": "2 unidades"
          }
        ]
      }
    ],
    "macros": {
      "proteina": 150,
      "carboidrato": 200,
      "gordura": 60,
      "calorias": 2000
    }
  },
  "suplementos": [],
  "farmacos": [],
  "orientacoes": null
}

PROIBIDO:
- Adicionar campos que não estão no schema acima
- Criar grupos genéricos ao invés de alimentos específicos
- Converter nomes de alimentos (ex: "ovo" → "clara de ovo")
- Retornar markdown ou texto explicativo
- Omitir campos obrigatórios (use null se não encontrar)
- Arrays vazios quando deveriam conter dados (ex: refeições sem alimentos)
- Omitir refeições que existem no PDF
- Incluir texto antes ou depois do JSON
- Usar comentários no JSON
- Retornar arrays undefined ou null (sempre use [] para arrays vazios)
- Inventar dados não presentes no PDF
- Usar termos genéricos como "Carnes e Proteínas", "Grupo alimentar", "Opções", "Personalizado"

INSTRUÇÕES FINAIS:
- Retorne SOMENTE JSON válido
- Siga EXATAMENTE o schema
- Não crie campos extras
- Não invente dados não presentes no PDF
- Liste TODAS as refeições encontradas no PDF
- Cada alimento deve ser específico (não genérico)`;
    }

    /**
     * Extrai dados estruturados de um PDF usando IA multimodal
     * @param {string} pdfText - Texto extraído do PDF
     * @param {Buffer} pdfBuffer - Buffer do PDF (para imagens, se necessário - não usado atualmente)
     * @returns {Promise<Object>} Dados estruturados do aluno e dieta
     * @throws {Error} Se IA não estiver disponível ou ocorrer erro na extração
     */
    async extractStructuredData(pdfText, pdfBuffer = null) {
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
            const systemPrompt = this.getSystemPrompt();
            const userPrompt = `Extraia os dados da seguinte ficha nutricional:\n\n${pdfText}`;

            const extractedData = await this.providerManager.extractStructuredData(
                pdfText,
                systemPrompt,
                userPrompt
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

    /**
     * Retorna informações sobre o provider atual
     * @returns {Object}
     */
    getProviderInfo() {
        return this.providerManager.getProviderInfo();
    }
}

module.exports = new AIService();
