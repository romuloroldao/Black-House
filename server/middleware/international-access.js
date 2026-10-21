// Identificação de acesso internacional — NUNCA bloqueia; apenas observa e expõe headers úteis.
const logger = require('../utils/logger');

const PRIMARY_COUNTRY = String(process.env.PRIMARY_COUNTRY || 'BR').toUpperCase();

function resolveClientRegion(req) {
    const raw =
        req.get('cf-ipcountry') ||
        req.get('CF-IPCountry') ||
        req.get('x-client-region') ||
        req.get('x-country-code');

    if (!raw) return 'XX';

    const region = String(raw).trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(region)) return region;
    return 'XX';
}

function internationalAccessMiddleware(req, res, next) {
    const region = resolveClientRegion(req);
    const isInternational = region !== 'XX' && region !== PRIMARY_COUNTRY;

    req.clientRegion = region;
    req.isInternationalAccess = isInternational;

    res.setHeader('X-Client-Region', region);
    res.setHeader('X-Access-Scope', 'global');
    res.setHeader('Timing-Allow-Origin', '*');

    if (isInternational && req.method !== 'OPTIONS') {
        logger.info('Acesso internacional', {
            region,
            path: req.path,
            method: req.method,
            ip: req.ip
        });
    }

    next();
}

module.exports = {
    internationalAccessMiddleware,
    resolveClientRegion,
    PRIMARY_COUNTRY
};
