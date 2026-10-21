/**
 * Coluna de vínculo aluno ↔ app_auth.users.
 * Produção usa user_id; alguns ambientes podem ter linked_user_id.
 */

let cachedLinkColumn = null;
let cacheAt = 0;
const CACHE_MS = 60_000;

async function getAlunoUserLinkColumn(pool) {
    const now = Date.now();
    if (cachedLinkColumn && now - cacheAt < CACHE_MS) {
        return cachedLinkColumn;
    }

    const r = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'alunos'
           AND column_name IN ('linked_user_id', 'user_id')`
    );
    const cols = new Set(r.rows.map((x) => x.column_name));

    if (cols.has('linked_user_id')) {
        cachedLinkColumn = 'linked_user_id';
    } else if (cols.has('user_id')) {
        cachedLinkColumn = 'user_id';
    } else {
        cachedLinkColumn = 'user_id';
    }
    cacheAt = now;
    return cachedLinkColumn;
}

function invalidateAlunoLinkColumnCache() {
    cachedLinkColumn = null;
    cacheAt = 0;
}

module.exports = {
    getAlunoUserLinkColumn,
    invalidateAlunoLinkColumnCache
};
