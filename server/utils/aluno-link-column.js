/**
 * Coluna de vínculo aluno ↔ app_auth.users.
 * Produção usa user_id; alguns ambientes podem ter linked_user_id.
 */

let cachedLinkColumn = null;
let cachedColumns = null;
let cacheAt = 0;
const CACHE_MS = 60_000;

/** Colunas de vínculo presentes em public.alunos (user_id e/ou linked_user_id). */
async function getAlunoUserLinkColumns(pool) {
    const now = Date.now();
    if (cachedColumns && now - cacheAt < CACHE_MS) {
        return cachedColumns;
    }
    const r = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'alunos'
           AND column_name IN ('linked_user_id', 'user_id')`
    );
    cachedColumns = new Set(r.rows.map((x) => x.column_name));
    cachedLinkColumn = null;
    cacheAt = now;
    return cachedColumns;
}

async function getAlunoUserLinkColumn(pool) {
    const now = Date.now();
    if (cachedLinkColumn && now - cacheAt < CACHE_MS) {
        return cachedLinkColumn;
    }

    const cols = await getAlunoUserLinkColumns(pool);

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
    cachedColumns = null;
    cacheAt = 0;
}

module.exports = {
    getAlunoUserLinkColumn,
    getAlunoUserLinkColumns,
    invalidateAlunoLinkColumnCache
};
