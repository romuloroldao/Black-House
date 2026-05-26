/**
 * Detecção de possíveis alunos duplicados antes de confirmar importação (modo create).
 */

export type DuplicateMatchReason = 'email' | 'cpf' | 'nome';

export interface ExistingAlunoForImport {
  id: string;
  nome: string;
  email?: string | null;
  cpf_cnpj?: string | null;
}

export interface ImportAlunoFields {
  nome: string;
  email?: string | null;
  cpf_cnpj?: string | null;
}

export interface DuplicateMatch {
  aluno: ExistingAlunoForImport;
  reasons: DuplicateMatchReason[];
  score: number;
}

const normalizeEmail = (value?: string | null): string =>
  (value || '').trim().toLowerCase();

const digitsOnly = (value?: string | null): string =>
  (value || '').replace(/\D/g, '');

const normalizeName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const namesSimilar = (a: string, b: string): boolean => {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const firstA = na.split(/\s+/)[0];
  const firstB = nb.split(/\s+/)[0];
  if (firstA.length >= 3 && firstA === firstB) {
    return na.includes(nb) || nb.includes(na);
  }
  return false;
};

/**
 * Devolve matches ordenados por score (maior primeiro).
 */
export function findImportDuplicateMatches(
  incoming: ImportAlunoFields,
  existing: ExistingAlunoForImport[],
): DuplicateMatch[] {
  if (!existing.length) return [];

  const incomingEmail = normalizeEmail(incoming.email);
  const incomingCpf = digitsOnly(incoming.cpf_cnpj);
  const incomingNome = incoming.nome?.trim() || '';

  const matches: DuplicateMatch[] = [];

  for (const aluno of existing) {
    const reasons: DuplicateMatchReason[] = [];
    let score = 0;

    const existingEmail = normalizeEmail(aluno.email);
    if (
      incomingEmail &&
      existingEmail &&
      incomingEmail === existingEmail &&
      !incomingEmail.endsWith('@blackhouse.local')
    ) {
      reasons.push('email');
      score = Math.max(score, 100);
    }

    const existingCpf = digitsOnly(aluno.cpf_cnpj);
    if (incomingCpf && existingCpf && incomingCpf.length >= 11 && incomingCpf === existingCpf) {
      reasons.push('cpf');
      score = Math.max(score, 100);
    }

    if (incomingNome && aluno.nome && namesSimilar(incomingNome, aluno.nome)) {
      reasons.push('nome');
      score = Math.max(score, 70);
    }

    if (reasons.length > 0) {
      matches.push({ aluno, reasons, score });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

export function duplicateReasonLabel(reason: DuplicateMatchReason): string {
  switch (reason) {
    case 'email':
      return 'e-mail igual';
    case 'cpf':
      return 'CPF/CNPJ igual';
    case 'nome':
      return 'nome parecido';
    default:
      return reason;
  }
}
