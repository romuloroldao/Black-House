/** UUID genérico (v1–v5) para não exibir IDs crus na UI do aluno */
const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AlunoNomeLike = {
  nome?: string | null;
  email?: string | null;
};

/** Deriva nome legível a partir do e-mail (ex.: joao.silva@gmail.com → Joao Silva). */
export function deriveNameHintFromEmail(addr?: string | null): string | null {
  if (!addr || addr.includes('@blackhouse.local')) return null;
  const local = addr.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
  if (!local || local.length < 2) return null;
  return local.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Nome para listas/combobox quando `alunos.nome` está vazio (cadastros só com e-mail). */
export function getAlunoDisplayName(
  aluno: AlunoNomeLike | null | undefined,
  fallback = 'Sem nome',
): string {
  if (!aluno) return fallback;
  const nome = aluno.nome != null ? String(aluno.nome).trim() : '';
  if (nome) return nome;
  return deriveNameHintFromEmail(aluno.email) || fallback;
}

/**
 * Nome legível do plano para cards do portal do aluno.
 * Usa `plano_nome` quando a API resolve o `payment_plans`; evita mostrar UUID.
 */
export function getPlanoAlunoLegivel(
  aluno: { plano?: string | null; plano_nome?: string | null } | null | undefined,
  fallback = 'Premium'
): string {
  if (!aluno) return fallback;
  const nome = aluno.plano_nome != null && String(aluno.plano_nome).trim();
  if (nome) return String(aluno.plano_nome).trim();
  const p = aluno.plano != null && String(aluno.plano).trim();
  if (!p) return fallback;
  if (UUID_LIKE.test(p)) return 'Plano de pagamento';
  return p;
}
