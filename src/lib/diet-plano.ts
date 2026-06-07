/** Letra de cardápio (A–Z) usada na dieta e na rotação. */
export type DietPlano = string;

const PLANO_LETTER_RE = /^[A-Z]$/;

export function normalizePlanoLetter(raw: unknown): DietPlano | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim().toUpperCase();
  if (!PLANO_LETTER_RE.test(s)) return null;
  return s;
}

export function isDietPlano(value: unknown): value is DietPlano {
  return normalizePlanoLetter(value) !== null;
}

/** Ordena A, B, C, … */
export function sortPlanos(planos: Iterable<string>): DietPlano[] {
  return [...new Set([...planos].map((p) => normalizePlanoLetter(p)).filter(Boolean) as DietPlano[])].sort(
    (a, b) => a.localeCompare(b),
  );
}
