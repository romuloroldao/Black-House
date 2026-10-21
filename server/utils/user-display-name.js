/**
 * Nome de exibição do utilizador (cadastro) ↔ ficha public.alunos.nome
 */

function normalizeName(value) {
  if (value == null) return null;
  const v = String(value).trim();
  return v.length > 0 ? v : null;
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 */
async function resolveUserDisplayName(db, userId) {
  if (!userId) return null;

  const r = await db.query(
    `SELECT p.display_name,
            u.raw_user_meta_data,
            u.email
     FROM app_auth.users u
     LEFT JOIN public.profiles p ON p.id = u.id
     WHERE u.id = $1
     LIMIT 1`,
    [userId],
  );

  if (!r.rows[0]) return null;
  const row = r.rows[0];
  const meta = row.raw_user_meta_data || {};

  return (
    normalizeName(row.display_name) ||
    normalizeName(meta.full_name) ||
    normalizeName(meta.nome) ||
    normalizeName(meta.name) ||
    null
  );
}

/**
 * Grava nome informado no cadastro (perfil + metadata).
 * @param {import('pg').Pool | import('pg').PoolClient} db
 */
async function persistUserDisplayName(db, userId, fullName) {
  const nome = normalizeName(fullName);
  if (!userId || !nome) return null;

  await db.query(
    `UPDATE app_auth.users
     SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || $2::jsonb,
         updated_at = NOW()
     WHERE id = $1`,
    [userId, JSON.stringify({ full_name: nome, nome })],
  );

  await db.query(
    `INSERT INTO public.profiles (id, display_name, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET
       display_name = COALESCE(NULLIF(TRIM(public.profiles.display_name), ''), EXCLUDED.display_name),
       updated_at = NOW()`,
    [userId, nome],
  );

  return nome;
}

/** Preenche nome da ficha se estiver vazio e houver nome no cadastro. */
function nomeAfterLink(alunoNome, displayName) {
  const current = normalizeName(alunoNome);
  if (current) return current;
  return normalizeName(displayName);
}

module.exports = {
  normalizeName,
  resolveUserDisplayName,
  persistUserDisplayName,
  nomeAfterLink,
};
