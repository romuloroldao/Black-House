/**
 * AI Provider Abstraction Layer
 * 
 * Esta camada abstrai os diferentes provedores de IA (OpenAI, Gemini, etc.)
 * Nenhum código fora desta camada deve importar SDKs de IA diretamente.
 * 
 * Regras:
 * - Nenhum require('openai') fora de providers/openai.provider.js
 * - Nenhum require('@google/generative-ai') fora de providers/gemini.provider.js
 * - Provider é selecionado via AI_PROVIDER env var
 * - Se provider não estiver configurado, IA fica desabilitada
 */

const logger = require('../../utils/logger');

function getProviderSpecificApiKey(provider) {
    const normalizedProvider = provider?.toLowerCase();
    if (normalizedProvider === 'gemini') return process.env.GEMINI_API_KEY || null;
    if (normalizedProvider === 'groq') return process.env.GROQ_API_KEY || null;
    if (normalizedProvider === 'openai') return process.env.OPENAI_API_KEY || null;
    return null;
}

class AIProviderManager {
    constructor() {
        this.provider = null;
        this.providerName = null;
        this.isEnabled = false;
        
        // Configuração primária
        const primaryProvider = process.env.AI_PROVIDER || null;
        const fallbackProvider = process.env.AI_PROVIDER_FALLBACK || null;

        this.config = {
            provider: primaryProvider,
            apiKey: process.env.AI_API_KEY || getProviderSpecificApiKey(primaryProvider),
            model: process.env.AI_MODEL || null
        };
        
        // Configuração secundária (fallback)
        this.fallbackConfig = {
            provider: fallbackProvider,
            apiKey: process.env.AI_API_KEY_FALLBACK || getProviderSpecificApiKey(fallbackProvider),
            model: process.env.AI_MODEL_FALLBACK || null
        };
        
        // Providers inicializados (primário e fallback)
        this.fallbackProvider = null;
        this.fallbackProviderName = null;

        // Provider dedicado a vision (fotos) — independente do texto
        this.visionProvider = null;
        this.visionProviderName = null;
        this.visionConfig = {
            provider: process.env.AI_VISION_PROVIDER || 'gemini',
            apiKey:
                process.env.AI_VISION_API_KEY ||
                process.env.GEMINI_API_KEY ||
                process.env.AI_API_KEY_FALLBACK ||
                (String(process.env.AI_PROVIDER || '').toLowerCase() === 'gemini'
                    ? process.env.AI_API_KEY
                    : null) ||
                null,
            model: process.env.AI_VISION_MODEL || null,
        };
    }

    /**
     * Inicializa o provider de IA baseado na configuração
     * @returns {boolean} true se provider foi inicializado, false se desabilitado
     * @throws {Error} Se provider está configurado mas SDK não está instalado
     */
    initialize() {
        // Se não há provider configurado, IA fica desabilitada
        if (!this.config.provider) {
            logger.warn('AI Provider não configurado. IA desabilitada.');
            this.isEnabled = false;
            return false;
        }

        // Se há provider mas não há API key, erro explícito
        if (!this.config.apiKey) {
            throw new Error(
                `AI_PROVIDER=${this.config.provider} está configurado, mas AI_API_KEY não foi fornecida. ` +
                `Configure AI_API_KEY no arquivo .env`
            );
        }

        // Se há provider mas não há model, usar default
        if (!this.config.model) {
            const defaults = {
                groq: 'llama-3.3-70b-versatile', // Modelo atualizado (llama-3.1-70b-versatile foi descontinuado)
                openai: 'gpt-4o-mini',
                gemini: 'gemini-2.5-pro'
            };
            this.config.model = defaults[this.config.provider.toLowerCase()] || 'llama-3.3-70b-versatile';
            logger.warn(`AI_MODEL não configurado, usando default: ${this.config.model}`);
        }

        // Carregar provider específico
        try {
            switch (this.config.provider.toLowerCase()) {
                case 'groq':
                    const GroqProvider = require('./providers/groq.provider');
                    this.provider = new GroqProvider(this.config.apiKey, this.config.model);
                    this.provider.initialize();
                    this.providerName = 'groq';
                    this.isEnabled = true;
                    logger.info('AI Provider inicializado', {
                        provider: 'groq',
                        model: this.config.model
                    });
                    return true;

                case 'openai':
                    const OpenAIProvider = require('./providers/openai.provider');
                    this.provider = new OpenAIProvider(this.config.apiKey, this.config.model);
                    this.provider.initialize();
                    this.providerName = 'openai';
                    this.isEnabled = true;
                    logger.info('AI Provider inicializado', {
                        provider: 'openai',
                        model: this.config.model
                    });
                    return true;

                case 'gemini':
                    const GeminiProvider = require('./providers/gemini.provider');
                    this.provider = new GeminiProvider(this.config.apiKey, this.config.model);
                    this.provider.initialize();
                    this.providerName = 'gemini';
                    this.isEnabled = true;
                    logger.info('AI Provider inicializado', {
                        provider: 'gemini',
                        model: this.config.model
                    });
                    return true;

                default:
                    throw new Error(
                        `AI_PROVIDER="${this.config.provider}" não é suportado. ` +
                        `Valores permitidos: groq, openai, gemini`
                    );
            }
        } catch (error) {
            // Se for erro de módulo não encontrado, erro explícito
            if (error.code === 'MODULE_NOT_FOUND' || error.message.includes('não está instalado')) {
                throw new Error(
                    `SDK do provider ${this.config.provider} não está instalado. ` +
                    `Execute: npm install ${this.config.provider === 'openai' ? 'openai' : '@google/generative-ai'}`
                );
            }
            throw error;
        }
    }

    /**
     * Verifica se IA está habilitada e configurada
     * @returns {boolean}
     */
    isAvailable() {
        return this.isEnabled && this.provider !== null;
    }

    /**
     * Inicializa provider de fallback se configurado
     * @returns {boolean} true se fallback foi inicializado
     */
    initializeFallback() {
        // Se não há provider fallback configurado, não faz nada
        if (!this.fallbackConfig.provider || !this.fallbackConfig.apiKey) {
            return false;
        }

        // Se é o mesmo provider que o primário, não faz nada
        if (this.fallbackConfig.provider.toLowerCase() === this.config.provider?.toLowerCase()) {
            logger.warn('AI Fallback: Provider fallback é o mesmo que o primário, ignorando');
            return false;
        }

        try {
            // Se há provider mas não há model, usar default
            if (!this.fallbackConfig.model) {
                const defaults = {
                    groq: 'llama-3.3-70b-versatile',
                gemini: 'gemini-2.5-pro'
                };
                this.fallbackConfig.model = defaults[this.fallbackConfig.provider.toLowerCase()] || 'gemini-pro';
            }

            // Carregar provider de fallback
            switch (this.fallbackConfig.provider.toLowerCase()) {
                case 'groq':
                    const GroqProvider = require('./providers/groq.provider');
                    this.fallbackProvider = new GroqProvider(this.fallbackConfig.apiKey, this.fallbackConfig.model);
                    this.fallbackProvider.initialize();
                    this.fallbackProviderName = 'groq';
                    logger.info('AI Fallback Provider inicializado', {
                        provider: 'groq',
                        model: this.fallbackConfig.model
                    });
                    return true;

                case 'gemini':
                    const GeminiProvider = require('./providers/gemini.provider');
                    this.fallbackProvider = new GeminiProvider(this.fallbackConfig.apiKey, this.fallbackConfig.model);
                    this.fallbackProvider.initialize();
                    this.fallbackProviderName = 'gemini';
                    logger.info('AI Fallback Provider inicializado', {
                        provider: 'gemini',
                        model: this.fallbackConfig.model
                    });
                    return true;

                default:
                    logger.warn(`AI Fallback: Provider ${this.fallbackConfig.provider} não é suportado para fallback`);
                    return false;
            }
        } catch (error) {
            logger.warn('AI Fallback: Falha ao inicializar provider de fallback', {
                provider: this.fallbackConfig.provider,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Verifica se provider de fallback está disponível
     * @returns {boolean}
     */
    isFallbackAvailable() {
        return this.fallbackProvider !== null;
    }

    /**
     * Extrai dados estruturados do texto do PDF
     * @param {string} pdfText - Texto extraído do PDF
     * @param {string} systemPrompt - Prompt do sistema
     * @param {string} userPrompt - Prompt do usuário
     * @param {Buffer|null} pdfBuffer - PDF original para providers multimodais/layout-aware
     * @returns {Promise<Object>} Dados estruturados
     * @throws {Error} Se IA não estiver disponível ou ocorrer erro na extração
     */
    async extractStructuredData(pdfText, systemPrompt, userPrompt, pdfBuffer = null) {
        if (!this.isAvailable()) {
            throw new Error(
                'IA não está disponível. Verifique se AI_PROVIDER e AI_API_KEY estão configurados.'
            );
        }

        // Tentar provider primário primeiro
        try {
            const result = await this.provider.extractStructuredData(pdfText, systemPrompt, userPrompt, pdfBuffer);
            logger.info('AI: Dados extraídos com sucesso usando provider primário', {
                provider: this.providerName
            });
            return result;
        } catch (primaryError) {
            logger.error('AI: Erro ao extrair dados com provider primário, tentando fallback', {
                primaryProvider: this.providerName,
                error: primaryError.message,
                hasFallback: this.isFallbackAvailable()
            });

            // Se há provider de fallback disponível, tentar usar
            if (this.isFallbackAvailable()) {
                try {
                    logger.info('AI: Tentando provider de fallback', {
                        fallbackProvider: this.fallbackProviderName
                    });
                    
                    const result = await this.fallbackProvider.extractStructuredData(pdfText, systemPrompt, userPrompt, pdfBuffer);
                    
                    logger.info('AI: Dados extraídos com sucesso usando provider de fallback', {
                        fallbackProvider: this.fallbackProviderName,
                        primaryProvider: this.providerName
                    });
                    
                    return result;
                } catch (fallbackError) {
                    logger.error('AI: Erro também no provider de fallback', {
                        primaryProvider: this.providerName,
                        primaryError: primaryError.message,
                        fallbackProvider: this.fallbackProviderName,
                        fallbackError: fallbackError?.message || 'Erro desconhecido'
                    });
                    
                    // Se ambos falharem, re-throw erro do primário (mais descritivo)
                    throw new Error(
                        `Erro ao processar PDF com IA. ` +
                        `Primário (${this.providerName}): ${primaryError.message}. ` +
                        `Fallback (${this.fallbackProviderName}): ${fallbackError?.message || 'Erro desconhecido'}`
                    );
                }
            }

            // Se não há fallback, re-throw erro do primário
            throw new Error(`Erro ao processar PDF com IA (${this.providerName}): ${primaryError.message}`);
        }
    }

    /**
     * Retorna informações sobre o provider atual
     * @returns {Object}
     */
    getProviderInfo() {
        return {
            enabled: this.isEnabled,
            provider: this.providerName,
            model: this.config.model,
            fallback: {
                available: this.isFallbackAvailable(),
                provider: this.fallbackProviderName || null,
                model: this.fallbackConfig.model || null
            },
            vision: {
                available: this.isVisionAvailable(),
                provider: this.visionProviderName || null,
                model: this.visionConfig.model || null,
            },
        };
    }

    /**
     * Inicializa provider de visão (Gemini por defeito) para análise de imagens.
     */
    initializeVisionProvider() {
        const name = String(this.visionConfig.provider || 'gemini').toLowerCase();
        if (name !== 'gemini') {
            logger.warn('AI Vision: apenas gemini é suportado actualmente', { provider: name });
            return false;
        }
        if (!this.visionConfig.apiKey) {
            // Reutilizar provider primário/fallback se já for Gemini
            if (this.providerName === 'gemini' && this.provider) {
                this.visionProvider = this.provider;
                this.visionProviderName = 'gemini';
                this.visionConfig.model = this.config.model;
                logger.info('AI Vision: a reutilizar provider Gemini primário');
                return true;
            }
            if (this.fallbackProviderName === 'gemini' && this.fallbackProvider) {
                this.visionProvider = this.fallbackProvider;
                this.visionProviderName = 'gemini';
                this.visionConfig.model = this.fallbackConfig.model;
                logger.info('AI Vision: a reutilizar provider Gemini de fallback');
                return true;
            }
            logger.warn('AI Vision: Gemini não configurado (AI_VISION_API_KEY / GEMINI_API_KEY)');
            return false;
        }
        try {
            if (!this.visionConfig.model) {
                this.visionConfig.model = 'gemini-2.5-pro';
            }
            const GeminiProvider = require('./providers/gemini.provider');
            this.visionProvider = new GeminiProvider(this.visionConfig.apiKey, this.visionConfig.model);
            this.visionProvider.initialize();
            this.visionProviderName = 'gemini';
            logger.info('AI Vision Provider inicializado', {
                provider: 'gemini',
                model: this.visionConfig.model,
            });
            return true;
        } catch (error) {
            logger.warn('AI Vision: falha ao inicializar', { error: error.message });
            this.visionProvider = null;
            this.visionProviderName = null;
            return false;
        }
    }

    isVisionAvailable() {
        if (this.visionProvider && typeof this.visionProvider.extractStructuredDataFromImage === 'function') {
            return true;
        }
        if (
            this.providerName === 'gemini' &&
            this.provider &&
            typeof this.provider.extractStructuredDataFromImage === 'function'
        ) {
            return true;
        }
        if (
            this.fallbackProviderName === 'gemini' &&
            this.fallbackProvider &&
            typeof this.fallbackProvider.extractStructuredDataFromImage === 'function'
        ) {
            return true;
        }
        return false;
    }

    _resolveVisionProvider() {
        if (this.visionProvider) return this.visionProvider;
        if (this.providerName === 'gemini' && this.provider) return this.provider;
        if (this.fallbackProviderName === 'gemini' && this.fallbackProvider) return this.fallbackProvider;
        return null;
    }

    /**
     * Análise estruturada de imagem (meal photo / vision).
     */
    async extractStructuredDataFromImage(imageBuffer, mimeType, systemPrompt, userPrompt, options = {}) {
        const provider = this._resolveVisionProvider();
        if (!provider || typeof provider.extractStructuredDataFromImage !== 'function') {
            throw new Error(
                'IA de visão não está disponível. Configure AI_VISION_PROVIDER=gemini e GEMINI_API_KEY.',
            );
        }
        return provider.extractStructuredDataFromImage(
            imageBuffer,
            mimeType,
            systemPrompt,
            userPrompt,
            options,
        );
    }
}

// Singleton instance
const aiProviderManager = new AIProviderManager();

// Inicializar na importação do módulo
// Nota: Se falhar, provider fica desabilitado mas não bloqueia servidor
try {
    const initialized = aiProviderManager.initialize();
    if (initialized) {
        try {
            aiProviderManager.initializeFallback();
        } catch (fallbackError) {
            logger.warn('AI Fallback: Falha ao inicializar provider de fallback (não crítico)', {
                error: fallbackError.message
            });
        }
    }
    try {
        aiProviderManager.initializeVisionProvider();
    } catch (visionError) {
        logger.warn('AI Vision: Falha ao inicializar (não crítico)', {
            error: visionError.message,
        });
    }
} catch (error) {
    // Se falhar na inicialização, logar mas não crashar
    // Isso permite que o servidor suba mesmo sem IA configurada
    logger.error('Falha ao inicializar AI Provider', {
        error: error.message,
        stack: error.stack
    });
    // Provider fica desabilitado
}

module.exports = aiProviderManager;
