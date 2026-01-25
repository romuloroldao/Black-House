/**
 * OpenAI Provider
 * Implementação isolada do provider OpenAI
 * Nenhum código fora deste arquivo deve importar 'openai' diretamente
 */

const logger = require('../../../utils/logger');

class OpenAIProvider {
    constructor(apiKey, model = 'gpt-4o-mini') {
        this.apiKey = apiKey;
        this.model = model;
        this.client = null;
    }

    /**
     * Inicializa o cliente OpenAI
     * @throws {Error} Se o SDK não estiver instalado ou API key inválida
     */
    initialize() {
        try {
            const OpenAI = require('openai');
            this.client = new OpenAI({ apiKey: this.apiKey });
            logger.info('OpenAI provider inicializado', { model: this.model });
            return true;
        } catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                throw new Error(
                    'SDK do OpenAI não está instalado. Execute: npm install openai'
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
            
            logger.info('Dados extraídos pela IA (OpenAI)', {
                model: this.model,
                dataKeys: Object.keys(parsedData)
            });
            
            return parsedData;
        } catch (error) {
            logger.error('Erro ao extrair dados com OpenAI', {
                error: error.message,
                model: this.model,
                statusCode: error.status,
                stack: error.stack
            });
            
            // Mensagens de erro mais claras baseadas no tipo de erro
            if (error.status === 429) {
                throw new Error('Cota da API OpenAI excedida. Verifique seu plano e faturamento na OpenAI.');
            } else if (error.status === 401) {
                throw new Error('API Key da OpenAI inválida. Verifique a configuração de AI_API_KEY.');
            } else if (error.status === 403) {
                throw new Error('Acesso negado pela OpenAI. Verifique permissões da API Key.');
            } else if (error.message) {
                // Usar mensagem original se for clara
                throw new Error(error.message);
            } else {
                throw new Error(`Erro ao processar PDF com OpenAI: ${error.message || 'Erro desconhecido'}`);
            }
        }
    }
}

module.exports = OpenAIProvider;
