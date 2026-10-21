/**
 * E-mails técnicos gerados na importação de fichas (sem conta real).
 */
function isImportPlaceholderEmail(email) {
  if (email == null) return true;
  const v = String(email).trim().toLowerCase();
  if (!v) return true;
  return v.endsWith('@blackhouse.local') || v.startsWith('import-');
}

/**
 * Ao vincular credencial, usar e-mail real do utilizador se a ficha tiver placeholder.
 */
function emailAfterLink(alunoEmail, authEmail) {
  const auth = authEmail != null ? String(authEmail).trim().toLowerCase() : '';
  if (!auth || !auth.includes('@')) return alunoEmail;
  if (isImportPlaceholderEmail(alunoEmail)) return auth;
  return alunoEmail;
}

module.exports = {
  isImportPlaceholderEmail,
  emailAfterLink,
};
