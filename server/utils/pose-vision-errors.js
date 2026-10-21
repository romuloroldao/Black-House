/**
 * Classificação de erros da API de visão (Gemini) para retry inteligente.
 */

function extractStatus(error) {
  if (error?.status) return Number(error.status);
  if (error?.statusCode) return Number(error.statusCode);
  const msg = String(error?.message || '');
  const m = msg.match(/\[\s*(\d{3})\s+/);
  return m ? Number(m[1]) : null;
}

/**
 * @returns {'transient'|'permanent_config'|'permanent_auth'|'permanent'|'unknown'}
 */
function classifyVisionError(error) {
  const msg = String(error?.message || error || '');
  const status = extractStatus(error);

  if (status === 429 || /429|too many requests|quota|rate limit|resource exhausted/i.test(msg)) {
    return 'transient';
  }
  if (status === 503 || /503|service unavailable|overloaded|high demand/i.test(msg)) {
    return 'transient';
  }
  if (status === 408 || /timeout|timed out|ETIMEDOUT|ECONNRESET|ENOTFOUND/i.test(msg)) {
    return 'transient';
  }
  if (status === 404 || /404|not found|no longer available/i.test(msg)) {
    return 'permanent_config';
  }
  if (status === 401 || status === 403 || /invalid api key|api key|permission denied/i.test(msg)) {
    return 'permanent_auth';
  }
  if (status === 400 || /400|invalid argument/i.test(msg)) {
    return 'permanent';
  }
  return 'unknown';
}

function isRetryableVisionError(error) {
  const kind = classifyVisionError(error);
  return kind === 'transient' || kind === 'unknown';
}

function shouldBurnAttempt(error) {
  const kind = classifyVisionError(error);
  return kind !== 'transient';
}

module.exports = {
  classifyVisionError,
  isRetryableVisionError,
  shouldBurnAttempt,
  extractStatus,
};
