/**
 * Registo de uso de IA externa (public.ai_usage_events).
 * Fire-and-forget: falhas de gravação nunca afectam a chamada de IA.
 */

const logger = require('../../utils/logger');
const { classifyVisionError } = require('../../utils/pose-vision-errors');

let pool = null;
let warnedMissingTable = false;

function setUsagePool(dbPool) {
    pool = dbPool || null;
}

function errorKindOf(error) {
    if (!error) return null;
    const msg = String(error?.message || '');
    if (/PerDay/i.test(msg) && /quota/i.test(msg)) return 'quota_daily';
    const kind = classifyVisionError(error);
    if (kind === 'transient' && /429|quota|rate limit|too many/i.test(msg)) return 'rate_limit';
    if (error?.code === 'AI_TIMEOUT') return 'timeout';
    return kind;
}

function recordAiUsage({ feature, modality = 'text', provider, model, status, error, latencyMs }) {
    if (!pool) return;
    pool
        .query(
            `INSERT INTO public.ai_usage_events
               (feature, modality, provider, model, status, error_kind, latency_ms)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                String(feature || 'unknown').slice(0, 60),
                modality === 'vision' ? 'vision' : 'text',
                provider || null,
                model || null,
                status === 'ok' ? 'ok' : 'error',
                status === 'ok' ? null : errorKindOf(error),
                Number.isFinite(latencyMs) ? Math.round(latencyMs) : null,
            ],
        )
        .catch((err) => {
            if (err?.code === '42P01') {
                if (!warnedMissingTable) {
                    warnedMissingTable = true;
                    logger.warn('ai_usage_events inexistente — rode npm run db:migrate');
                }
                return;
            }
            logger.warn('Falha ao registar uso de IA', { error: err.message });
        });
}

/**
 * Executa fn() e regista o resultado.
 * @template T
 * @param {{ feature?: string, modality?: 'text'|'vision', provider?: string, model?: string }} meta
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function trackAiCall(meta, fn) {
    const started = Date.now();
    try {
        const result = await fn();
        recordAiUsage({ ...meta, status: 'ok', latencyMs: Date.now() - started });
        return result;
    } catch (error) {
        recordAiUsage({ ...meta, status: 'error', error, latencyMs: Date.now() - started });
        throw error;
    }
}

module.exports = { setUsagePool, recordAiUsage, trackAiCall, errorKindOf };
