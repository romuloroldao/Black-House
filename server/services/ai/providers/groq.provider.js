/**
 * Groq Provider
 * Implementação isolada do provider Groq
 * Nenhum código fora deste arquivo deve importar 'groq' diretamente
 */

const logger = require('../../../utils/logger');

class GroqProvider {
    constructor(apiKey, model = 'llama-3.3-70b-versatile') {
        this.apiKey = apiKey;
        this.model = model;
        this.client = null;
    }

    /**
     * Inicializa o cliente Groq
     * @throws {Error} Se o SDK não estiver instalado ou API key inválida
     */
    initialize() {
        try {
            const Groq = require('groq-sdk');
            this.client = new Groq({ apiKey: this.apiKey });
            logger.info('Groq provider inicializado', { model: this.model });
            return true;
        } catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                throw new Error(
                    'SDK do Groq não está instalado. Execute: npm install groq-sdk'
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
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.05, // Reduzido para respostas mais consistentes
                max_tokens: 32000 // Aumentado para suportar documentos maiores
            });

            const content = response.choices[0].message.content;
            
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
            
            logger.info('Dados extraídos pela IA (Groq)', {
                model: this.model,
                dataKeys: Object.keys(parsedData)
            });
            
            return parsedData;
        } catch (error) {
            logger.error('Erro ao extrair dados com Groq', {
                error: error.message,
                model: this.model,
                statusCode: error.status,
                stack: error.stack
            });
            
            // Mensagens de erro mais claras baseadas no tipo de erro
            if (error.status === 429) {
                throw new Error('Cota da API Groq excedida. Verifique seu plano e faturamento na Groq.');
            } else if (error.status === 401) {
                throw new Error('API Key da Groq inválida. Verifique a configuração de AI_API_KEY.');
            } else if (error.status === 403) {
                throw new Error('Acesso negado pela Groq. Verifique permissões da API Key.');
            } else if (error.status === 400) {
                // Tratar erro de modelo descontinuado
                const errorBody = typeof error.body === 'string' ? JSON.parse(error.body) : error.body;
                if (errorBody?.error?.code === 'model_decommissioned') {
                    throw new Error(
                        `Modelo descontinuado. Use um modelo atualizado como 'llama-3.3-70b-versatile'. ` +
                        `Erro: ${errorBody.error.message}`
                    );
                }
                throw new Error(errorBody?.error?.message || error.message || 'Erro na requisição à API Groq');
            } else if (error.message) {
                // Usar mensagem original se for clara
                throw new Error(error.message);
            } else {
                throw new Error(`Erro ao processar PDF com Groq: ${error.message || 'Erro desconhecido'}`);
            }
        }
    }
}

module.exports = GroqProvider;
