// Secrets Validator
// Valida força e presença de secrets na inicialização

const logger = require('./logger');

class SecretsValidator {
    /**
     * Valida todos os secrets necessários
     */
    static validate() {
        const errors = [];

        // JWT_SECRET
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            errors.push('JWT_SECRET não configurado');
        } else if (jwtSecret.length < 32) {
            errors.push('JWT_SECRET muito curto (mínimo 32 caracteres)');
        } else if (jwtSecret === 'change_this_to_a_very_long_and_secure_random_string_minimum_32_characters_long_for_production') {
            // Apenas avisar, não bloquear (permitir deploy inicial)
            logger.warn('JWT_SECRET ainda está com valor padrão. Altere antes de produção!');
            // Não adicionar ao errors para permitir continuar
        }

        // Database
        if (!process.env.DB_PASSWORD) {
            errors.push('DB_PASSWORD não configurado');
        }

        // Asaas (opcional, mas avisar se necessário)
        if (process.env.ENABLE_ASAAS === 'true' && !process.env.ASAAS_API_KEY) {
            errors.push('ASAAS_API_KEY não configurado mas ENABLE_ASAAS=true');
        }

        // Webhook token (se webhooks habilitados)
        if (process.env.ENABLE_WEBHOOKS === 'true' && !process.env.ASAAS_WEBHOOK_TOKEN) {
            errors.push('ASAAS_WEBHOOK_TOKEN não configurado mas ENABLE_WEBHOOKS=true');
        }

        if (errors.length > 0) {
            logger.error('Validação de secrets falhou:', { errors });
            throw new Error(`Secrets inválidos: ${errors.join(', ')}`);
        }

        logger.info('Validação de secrets concluída com sucesso');
    }

    /**
     * Gera JWT_SECRET seguro
     */
    static generateJWTSecret() {
        const crypto = require('crypto');
        return crypto.randomBytes(64).toString('hex');
    }
}

module.exports = SecretsValidator;
