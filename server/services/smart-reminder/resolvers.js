/**
 * Registo de domínios com lembretes inteligentes activos.
 */
const checkinWeekly = require('./domains/checkin-weekly');

const DOMAIN_REGISTRY = {
  [checkinWeekly.domain]: checkinWeekly,
};

function getDomainHandler(domain) {
  return DOMAIN_REGISTRY[domain] || null;
}

function listActiveDomains() {
  return Object.keys(DOMAIN_REGISTRY);
}

module.exports = {
  DOMAIN_REGISTRY,
  getDomainHandler,
  listActiveDomains,
};
