/**
 * Validação de schema canónico (VPS-BACKEND-CANONICAL-ARCH-001).
 * Implementação mínima: o boot em `server/index.js` tolera falha (modo degradado).
 * Estenda com checagens SQL quando necessário.
 */
async function assertCanonicalSchema(_pool) {
    return;
}

module.exports = { assertCanonicalSchema };
