/**
 * Categorias pessoais de alimentos do profissional (só organizam a lista de substituição).
 * Funções puras: agrupar a lista completa por categoria e filtrar por nome.
 */

export interface FoodCategory {
  id: string;
  nome: string;
  ordem: number;
  alimento_ids: string[];
  created_at?: string;
  updated_at?: string;
}

export interface FoodCategoriesResponse {
  categories: FoodCategory[];
  can_edit: boolean;
  unavailable?: boolean;
}

export const UNCATEGORIZED_ID = "__sem_categoria__";
export const UNCATEGORIZED_LABEL = "Sem categoria";

export interface FoodCategorySection<T> {
  id: string;
  nome: string;
  items: T[];
}

/** A API devolve `[]` quando a rota está indisponível; normaliza para o formato esperado. */
export function normalizeCategoriesResponse(raw: unknown): FoodCategoriesResponse {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { categories: [], can_edit: false, unavailable: true };
  }
  const r = raw as Partial<FoodCategoriesResponse>;
  const categories = Array.isArray(r.categories)
    ? r.categories
        .filter((c): c is FoodCategory => Boolean(c && typeof c.id === "string"))
        .map((c) => ({ ...c, alimento_ids: Array.isArray(c.alimento_ids) ? c.alimento_ids : [] }))
    : [];
  return { categories, can_edit: Boolean(r.can_edit), unavailable: Boolean(r.unavailable) };
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Todas as palavras do termo têm de aparecer no nome (ordem livre, sem acentos). */
export function matchesFoodSearch(name: string, term: string): boolean {
  const t = normalizeSearchText(term);
  if (!t) return true;
  const n = normalizeSearchText(name);
  return t.split(" ").every((w) => n.includes(w));
}

/** alimento_id → category_id (um alimento só está numa categoria por profissional). */
export function categoryIndex(categories: FoodCategory[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of categories) for (const id of c.alimento_ids) map.set(id, c.id);
  return map;
}

/**
 * Secções na ordem das categorias do profissional; "Sem categoria" no fim.
 * Cada alimento aparece uma única vez. Secções vazias são omitidas salvo `keepEmpty`.
 */
export function groupByCategory<T>(
  items: T[],
  getId: (item: T) => string,
  categories: FoodCategory[],
  opts: { keepEmpty?: boolean } = {},
): FoodCategorySection<T>[] {
  const index = categoryIndex(categories);
  const ordered = [...categories].sort(
    (a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"),
  );
  const buckets = new Map<string, T[]>(ordered.map((c) => [c.id, []]));
  const loose: T[] = [];
  for (const item of items) {
    const catId = index.get(getId(item));
    const bucket = catId ? buckets.get(catId) : undefined;
    if (bucket) bucket.push(item);
    else loose.push(item);
  }
  const sections: FoodCategorySection<T>[] = ordered.map((c) => ({
    id: c.id,
    nome: c.nome,
    items: buckets.get(c.id) ?? [],
  }));
  sections.push({ id: UNCATEGORIZED_ID, nome: UNCATEGORIZED_LABEL, items: loose });
  return opts.keepEmpty ? sections : sections.filter((s) => s.items.length > 0);
}

/** Aplica localmente uma mudança de categoria (otimista), sem duplicar o alimento. */
export function moveFoodsLocally(
  categories: FoodCategory[],
  alimentoIds: string[],
  targetCategoryId: string | null,
): FoodCategory[] {
  const moving = new Set(alimentoIds);
  return categories.map((c) => {
    const kept = c.alimento_ids.filter((id) => !moving.has(id));
    if (c.id === targetCategoryId) return { ...c, alimento_ids: [...kept, ...alimentoIds] };
    return kept.length === c.alimento_ids.length ? c : { ...c, alimento_ids: kept };
  });
}

/** Remove o sufixo " [CODIGO]" que o api-client acrescenta às mensagens de erro. */
export function cleanApiErrorMessage(message: string | undefined, fallback: string): string {
  const m = (message || "").replace(/\s*\[[A-Z_]+\]\s*$/, "").trim();
  return m || fallback;
}
