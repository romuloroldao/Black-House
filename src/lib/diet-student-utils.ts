import { macroScaleFactor } from "@/lib/foodService";

export type DietPlano = "A" | "B";

export type DietItemWithFood = {
  id: string;
  refeicao: string;
  quantidade: number;
  unidade_quantidade?: string;
  alimento_id?: string;
  alimentos?: {
    name?: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    portion?: string;
  } | null;
};

export type MealGroup = {
  key: string;
  displayName: string;
  hasPlanoAB: boolean;
  itemsByPlano: {
    A?: DietItemWithFood[];
    B?: DietItemWithFood[];
    default?: DietItemWithFood[];
  };
};

export type DietMacros = {
  totalCalorias: number;
  totalProteinas: number;
  totalCarboidratos: number;
  totalLipidios: number;
};

const MEAL_ORDER_KEYWORDS: Array<{ keys: string[]; order: number }> = [
  { keys: ["café", "cafe", "desjejum", "manhã", "manha"], order: 0 },
  { keys: ["lanche da manhã", "lanche manha", "colação", "colacao"], order: 1 },
  { keys: ["almoço", "almoco"], order: 2 },
  { keys: ["lanche da tarde", "lanche tarde"], order: 3 },
  { keys: ["pré-treino", "pre-treino", "pre treino"], order: 4 },
  { keys: ["pós-treino", "pos-treino", "pos treino"], order: 5 },
  { keys: ["jantar"], order: 6 },
  { keys: ["ceia"], order: 7 },
];

export function parseRefeicaoLabel(refeicao: string): { base: string; plano: DietPlano | null } {
  let base = String(refeicao || "").trim();
  let plano: DietPlano | null = null;

  const setPlano = (letter: string) => {
    const u = letter.toUpperCase();
    if (u === "A" || u === "B") plano = u as DietPlano;
  };

  // Alternativas do import: "… (Substituto)" — não é plano
  base = base.replace(/\s*\(substituto\)\s*$/i, "").trim();

  // Formato gravado no import: "Almoço (Plano A)" ou "Almoço (Plano A • 12:00)"
  const parenSuffix = base.match(/\s*\(([^)]+)\)\s*$/);
  if (parenSuffix) {
    const inner = parenSuffix[1];
    const planoInParen = inner.match(/\bplano\s*([ab])\b/i);
    if (planoInParen) {
      setPlano(planoInParen[1]);
      base = base.slice(0, parenSuffix.index).trim();
    } else {
      const letterOnly = inner.match(/^([ab])\b(?:\s*[•·-]|$)/i);
      if (letterOnly) {
        setPlano(letterOnly[1]);
        base = base.slice(0, parenSuffix.index).trim();
      }
    }
  }

  if (!plano) {
    const patterns = [
      /\s*[-–]\s*plano\s*([ab])\s*$/i,
      /\s+plano\s*([ab])\s*$/i,
      /\s*\(([ab])\)\s*$/i,
      /\s*[-–]\s*([ab])\s*$/i,
    ];

    for (const re of patterns) {
      const m = base.match(re);
      if (m) {
        setPlano(m[1]);
        base = base.replace(re, "").trim();
        break;
      }
    }
  }

  return { base: base || refeicao, plano };
}

export function buildMealGroups(itens: DietItemWithFood[]): MealGroup[] {
  const map = new Map<string, MealGroup>();

  for (const item of itens) {
    const { base, plano } = parseRefeicaoLabel(item.refeicao);
    const key = base.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    if (!map.has(key)) {
      map.set(key, {
        key,
        displayName: base,
        hasPlanoAB: false,
        itemsByPlano: {},
      });
    }
    const group = map.get(key)!;
    if (plano === "A") {
      group.itemsByPlano.A = [...(group.itemsByPlano.A || []), item];
    } else if (plano === "B") {
      group.itemsByPlano.B = [...(group.itemsByPlano.B || []), item];
    } else {
      group.itemsByPlano.default = [...(group.itemsByPlano.default || []), item];
    }
  }

  for (const group of map.values()) {
    group.hasPlanoAB =
      (group.itemsByPlano.A?.length ?? 0) > 0 && (group.itemsByPlano.B?.length ?? 0) > 0;
  }

  return sortMealGroups([...map.values()]);
}

export function dietHasPlanoAB(groups: MealGroup[]): boolean {
  let anyA = false;
  let anyB = false;
  for (const g of groups) {
    if ((g.itemsByPlano.A?.length ?? 0) > 0) anyA = true;
    if ((g.itemsByPlano.B?.length ?? 0) > 0) anyB = true;
  }
  return anyA && anyB;
}

export function getItemsForPlano(group: MealGroup, plano: DietPlano): DietItemWithFood[] {
  if (group.hasPlanoAB) {
    return plano === "A" ? group.itemsByPlano.A || [] : group.itemsByPlano.B || [];
  }
  return group.itemsByPlano.default || group.itemsByPlano.A || group.itemsByPlano.B || [];
}

function mealSortIndex(name: string): number {
  const n = name.toLowerCase();
  for (const row of MEAL_ORDER_KEYWORDS) {
    if (row.keys.some((k) => n.includes(k))) return row.order;
  }
  return 50;
}

export function sortMealGroups(groups: MealGroup[]): MealGroup[] {
  return [...groups].sort(
    (a, b) => mealSortIndex(a.displayName) - mealSortIndex(b.displayName) || a.displayName.localeCompare(b.displayName, "pt-BR"),
  );
}

export function calcularMacros(itens: DietItemWithFood[]): DietMacros {
  return itens.reduce(
    (total, item) => {
      if (!item.alimentos) return total;
      const fator = macroScaleFactor(
        item.quantidade,
        item.unidade_quantidade,
        item.alimentos.portion,
      );
      return {
        totalCalorias: total.totalCalorias + (item.alimentos.calories || 0) * fator,
        totalProteinas: total.totalProteinas + (item.alimentos.protein || 0) * fator,
        totalCarboidratos: total.totalCarboidratos + (item.alimentos.carbs || 0) * fator,
        totalLipidios: total.totalLipidios + (item.alimentos.fat || 0) * fator,
      };
    },
    { totalCalorias: 0, totalProteinas: 0, totalCarboidratos: 0, totalLipidios: 0 },
  );
}

/** Data local (YYYY-MM-DD) para checklist diário de refeições. */
export function mealCheckDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function mealCheckStorageKey(
  dietaId: string,
  mealKey: string,
  plano: DietPlano,
  dateKey: string = mealCheckDateKey(),
): string {
  return `bh-meal-done:${dateKey}:${dietaId}:${mealKey}:${plano}`;
}

function pruneStaleMealDoneKeys(
  dietaId: string,
  mealKey: string,
  plano: DietPlano,
  todayKey: string,
): void {
  const prefix = "bh-meal-done:";
  const suffix = `:${dietaId}:${mealKey}:${plano}`;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k?.startsWith(prefix) || !k.endsWith(suffix)) continue;
      const datePart = k.slice(prefix.length, k.length - suffix.length);
      if (datePart && datePart !== todayKey) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

export function readMealDone(dietaId: string, mealKey: string, plano: DietPlano): boolean {
  try {
    return localStorage.getItem(mealCheckStorageKey(dietaId, mealKey, plano)) === "1";
  } catch {
    return false;
  }
}

export function writeMealDone(dietaId: string, mealKey: string, plano: DietPlano, done: boolean): void {
  try {
    const todayKey = mealCheckDateKey();
    pruneStaleMealDoneKeys(dietaId, mealKey, plano, todayKey);
    const k = mealCheckStorageKey(dietaId, mealKey, plano, todayKey);
    if (done) localStorage.setItem(k, "1");
    else localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

export function countCompletedMeals(
  dietaId: string,
  groups: MealGroup[],
  plano: DietPlano,
): number {
  return groups.filter((g) => readMealDone(dietaId, g.key, plano)).length;
}

export type ImportRefeicaoMacros = {
  nome: string;
  plano?: string | null;
  macros?: {
    proteina?: number | null;
    carboidrato?: number | null;
    gordura?: number | null;
    calorias?: number | null;
  } | null;
};

/** Plano A/B explícito no campo `plano` ou no nome da refeição. */
export function resolveImportRefeicaoPlano(refeicao: ImportRefeicaoMacros): DietPlano | null {
  const fromField = String(refeicao.plano ?? "")
    .trim()
    .toUpperCase();
  if (fromField === "A" || fromField === "B") return fromField;
  return parseRefeicaoLabel(refeicao.nome).plano;
}

export function inferImportMacroPlano(refeicoes: ImportRefeicaoMacros[]): {
  hasPlanoAB: boolean;
} {
  let anyA = false;
  let anyB = false;
  for (const r of refeicoes) {
    const p = resolveImportRefeicaoPlano(r);
    if (p === "A") anyA = true;
    if (p === "B") anyB = true;
  }
  return { hasPlanoAB: anyA && anyB };
}

export function filterImportRefeicoesForMacroSum<T extends ImportRefeicaoMacros>(
  refeicoes: T[],
  plano: DietPlano,
): T[] {
  const { hasPlanoAB } = inferImportMacroPlano(refeicoes);
  if (!hasPlanoAB) return refeicoes;
  return refeicoes.filter((r) => {
    const p = resolveImportRefeicaoPlano(r);
    if (p === null) return true;
    return p === plano;
  });
}

export function sumImportDeclaredMacros(
  refeicoes: ImportRefeicaoMacros[],
  plano: DietPlano,
): { proteina: number; carboidrato: number; gordura: number; calorias: number } {
  const filtered = filterImportRefeicoesForMacroSum(refeicoes, plano);
  return filtered.reduce(
    (totals, r) => {
      if (!r.macros) return totals;
      return {
        proteina: totals.proteina + Number(r.macros.proteina || 0),
        carboidrato: totals.carboidrato + Number(r.macros.carboidrato || 0),
        gordura: totals.gordura + Number(r.macros.gordura || 0),
        calorias: totals.calorias + Number(r.macros.calorias || 0),
      };
    },
    { proteina: 0, carboidrato: 0, gordura: 0, calorias: 0 },
  );
}

export function dietHasPlanoABFromItens(itens: { refeicao: string }[]): boolean {
  let anyA = false;
  let anyB = false;
  for (const item of itens) {
    const { plano } = parseRefeicaoLabel(item.refeicao);
    if (plano === "A") anyA = true;
    if (plano === "B") anyB = true;
  }
  return anyA && anyB;
}

export function filterItensForPlanoView<T extends { refeicao: string }>(
  itens: T[],
  plano: DietPlano,
): T[] {
  if (!dietHasPlanoABFromItens(itens)) return itens;
  return itens.filter((item) => {
    const { plano: p } = parseRefeicaoLabel(item.refeicao);
    return p === null || p === plano;
  });
}

export function pickActiveDieta<T extends { aluno_id: string; ativa?: boolean; created_at?: string }>(
  dietas: T[],
  alunoId: string,
): T | null {
  const dietasAluno = dietas.filter((d) => d.aluno_id === alunoId);
  return (
    dietasAluno.find((d) => d.ativa === true) ||
    dietasAluno.sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
    )[0] ||
    null
  );
}
