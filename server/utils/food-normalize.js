/**
 * Normalização de nomes de alimentos para busca e deduplicação.
 */

function normalizeFoodName(raw) {
    if (raw == null) return '';
    return String(raw)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

module.exports = {
    normalizeFoodName,
};
