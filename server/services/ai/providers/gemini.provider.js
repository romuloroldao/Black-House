/**
 * Google Gemini Provider (Secundário)
 * Implementação isolada do provider Gemini
 * Nenhum código fora deste arquivo deve importar '@google/generative-ai' diretamente
 */

const logger = require('../../../utils/logger');

class GeminiProvider {
    constructor(apiKey, model = 'gemini-pro') {
        this.apiKey = apiKey;
        this.model = model;
        this.client = null;
    }

    /**
     * Inicializa o cliente Gemini
     * @throws {Error} Se o SDK não estiver instalado ou API key inválida
     */
    initialize() {
        try {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            this.client = new GoogleGenerativeAI(this.apiKey);
            logger.info('Gemini provider inicializado', { model: this.model });
            return true;
        } catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                throw new Error(
                    'SDK do Gemini não está instalado. Execute: npm install @google/generative-ai'
                );
            }
            throw error;
        }
    }

    /**
     * Extrai dados estruturados do texto do PDF
     * @param {string} pdfText - Texto extraído do PDF
     * @param {string} systemPrompt - Prompt do sistema
     * @param {string} userPrompt - Prompt do usuário
     * @returns {Promise<Object>} Dados estruturados
     */
    async extractStructuredData(pdfText, systemPrompt, userPrompt) {
        if (!this.client) {
            this.initialize();
        }

        try {
            const model = this.client.getGenerativeModel({ 
                model: this.model,
                generationConfig: {
                    temperature: 0.05, // Reduzido para respostas mais consistentes
                    maxOutputTokens: 32000, // Aumentado para suportar documentos maiores
                    responseMimeType: 'application/json'
                }
            });

            const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            const content = response.text();
            
            // Parse do JSON retornado
            let parsedData;
            try {
                parsedData = JSON.parse(content);
            } catch (parseError) {
                // Tentar extrair JSON se vier com markdown ou texto
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        parsedData = JSON.parse(jsonMatch[0]);
                    } catch (e) {
                        throw new Error(
                            `Resposta da IA não contém JSON válido. Erro: ${e.message}. ` +
                            `Conteúdo: ${content.substring(0, 500)}`
                        );
                    }
                } else {
                    throw new Error(
                        `Resposta da IA não contém JSON válido. ` +
                        `Conteúdo recebido: ${content.substring(0, 500)}`
                    );
                }
            }
            
            logger.info('Dados extraídos pela IA (Gemini)', {
                model: this.model,
                dataKeys: Object.keys(parsedData)
            });
            
            return parsedData;
        } catch (error) {
            logger.error('Erro ao extrair dados com Gemini', {
                error: error.message,
                model: this.model,
                statusCode: error.status,
                stack: error.stack
            });
            
            // Mensagens de erro mais claras
            if (error.status === 429) {
                throw new Error('Cota da API Gemini excedida. Verifique seu plano e faturamento na Google.');
            } else if (error.status === 401) {
                throw new Error('API Key da Gemini inválida. Verifique a configuração de AI_API_KEY.');
            } else if (error.status === 403) {
                throw new Error('Acesso negado pela Gemini. Verifique permissões da API Key.');
            } else if (error.message) {
                throw new Error(error.message);
            } else {
                throw new Error(`Erro ao processar PDF com Gemini: ${error.message || 'Erro desconhecido'}`);
            }
        }
    }
}

module.exports = GeminiProvider;
