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
            // IMPRECISÃO-009: max_tokens é reservado contra o limite de TPM da Groq
            // (12.000 TPM no tier on_demand do llama-3.3-70b-versatile).
            // Com max_tokens=32000, qualquer prompt explora o orçamento e gera
            // erro 413 "Request too large". A resposta JSON realmente cabe em
            // ~3-4k tokens, então mantemos 4096 por default, permitindo override
            // via AI_MAX_TOKENS para fichas excepcionalmente grandes.
            const maxTokens = Number.parseInt(process.env.AI_MAX_TOKENS || '4096', 10) || 4096;

            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.05,
                max_tokens: maxTokens
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

    /**
     * Extrai JSON estruturado a partir de uma imagem (modelos Groq com visão, ex. qwen/qwen3.8-27b).
     * @param {Buffer} imageBuffer
     * @param {string} mimeType
     * @param {string} systemPrompt
     * @param {string} userPrompt
     * @param {{ timeoutMs?: number }} [options]
     */
    async extractStructuredDataFromImage(
        imageBuffer,
        mimeType = 'image/jpeg',
        systemPrompt,
        userPrompt,
        options = {},
    ) {
        if (!this.client) {
            this.initialize();
        }
        if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
            throw new Error('imageBuffer inválido');
        }

        const timeoutMs = options.timeoutMs || 55000;
        const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${imageBuffer.toString('base64')}`;
        const request = {
            model: this.model,
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: userPrompt },
                        { type: 'image_url', image_url: { url: dataUrl } },
                    ],
                },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2,
            // plano gratuito: limite de 1000 tokens de saída por minuto por modelo
            max_tokens: Number(process.env.GROQ_VISION_MAX_TOKENS) || 600,
        };

        const response = await this._createWithRateLimitRetry(request, timeoutMs);
        const content = response.choices?.[0]?.message?.content || '';
        const parsedData = parseJsonContent(content);

        logger.info('Dados extraídos pela IA vision (Groq)', {
            model: this.model,
            dataKeys: Object.keys(parsedData || {}),
        });
        return parsedData;
    }

    /**
     * Limites do Groq gratuito são por minuto: um 429 com retry-after curto vale a espera.
     */
    async _createWithRateLimitRetry(request, timeoutMs, maxAttempts = 3) {
        let lastError;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
                return await this.client.chat.completions.create(request, {
                    timeout: timeoutMs,
                    maxRetries: 0,
                });
            } catch (error) {
                lastError = error;
                if (error?.constructor?.name === 'APIConnectionTimeoutError') {
                    const err = new Error('Timeout na análise de imagem (Groq)');
                    err.code = 'AI_TIMEOUT';
                    throw err;
                }
                const headers = error?.headers;
                const retryAfterSec = Number(
                    typeof headers?.get === 'function' ? headers.get('retry-after') : headers?.['retry-after'],
                );
                const maxWaitSec = Number(process.env.GROQ_RATE_LIMIT_MAX_WAIT_SEC) || 30;
                const canWait =
                    error?.status === 429 &&
                    Number.isFinite(retryAfterSec) &&
                    retryAfterSec <= maxWaitSec &&
                    attempt < maxAttempts;
                if (!canWait) throw error;
                logger.warn('Groq vision 429 — a aguardar retry-after', {
                    model: this.model,
                    attempt,
                    retryAfterSec,
                });
                await new Promise((r) => setTimeout(r, Math.ceil(retryAfterSec * 1000) + 250));
            }
        }
        throw lastError;
    }
}

function parseJsonContent(content) {
    try {
        return JSON.parse(content);
    } catch {
        const jsonMatch = String(content).match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        throw new Error(
            `Resposta da IA (vision) sem JSON válido. Conteúdo: ${String(content).substring(0, 400)}`,
        );
    }
}

module.exports = GroqProvider;
