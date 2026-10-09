/**
 * Validação do corpo de renovação de validade de um treino atribuído (alunos_treinos).
 */
const { civilDateKeyInTimeZone } = require('./zoned-time');

const APP_TIME_ZONE = 'America/Sao_Paulo';
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDateKey(key) {
  if (!DATE_KEY_RE.test(key)) return false;
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * @param {Record<string, unknown>} body
 * @param {Date} [now]
 * @returns {{ ok: true, dataExpiracao: string, diasAntecedencia: number|null }
 *   | { ok: false, error: string, error_code: string }}
 */
function parseWorkoutValidityBody(body, now = new Date()) {
  const raw = body?.data_expiracao ?? body?.data_retorno;
  const dataExpiracao = raw != null ? String(raw).trim().slice(0, 10) : '';

  if (!dataExpiracao) {
    return { ok: false, error: 'data_expiracao é obrigatória', error_code: 'MISSING_DATA_EXPIRACAO' };
  }
  if (!isRealDateKey(dataExpiracao)) {
    return { ok: false, error: 'data_expiracao inválida (use AAAA-MM-DD)', error_code: 'INVALID_DATA_EXPIRACAO' };
  }

  const todayKey = civilDateKeyInTimeZone(now, APP_TIME_ZONE);
  if (dataExpiracao < todayKey) {
    return {
      ok: false,
      error: 'A nova validade não pode ser anterior a hoje',
      error_code: 'DATA_EXPIRACAO_PAST',
    };
  }

  let diasAntecedencia = null;
  if (body?.dias_antecedencia_notificacao != null && body.dias_antecedencia_notificacao !== '') {
    const n = Number.parseInt(String(body.dias_antecedencia_notificacao), 10);
    if (!Number.isFinite(n) || n < 0 || n > 365) {
      return {
        ok: false,
        error: 'dias_antecedencia_notificacao inválido',
        error_code: 'INVALID_DIAS_ANTECEDENCIA',
      };
    }
    diasAntecedencia = n;
  }

  return { ok: true, dataExpiracao, diasAntecedencia };
}

module.exports = { parseWorkoutValidityBody };
