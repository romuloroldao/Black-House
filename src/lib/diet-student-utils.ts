import { macroScaleFactor } from "@/lib/foodService";
import { normalizePlanoLetter, sortPlanos, type DietPlano } from "@/lib/diet-plano";

export type { DietPlano };

export type DietItemWithFood = {
  id: string;
  refeicao: string;
  quantidade: number;
  unidade_quantidade?: string;
  alimento_id?: string;
  nutrientes_snapshot?: {
    nome?: string;
    quantidade_referencia?: number;
    unidade_referencia?: string;
    kcal?: number;
    ptn?: number;
    cho?: number;
    lip?: number;
    alcool?: number;
    versao?: number;
  } | null;
  alimentos?: {
    name?: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    portion?: number | string;
  } | null;
};

export type MealGroup = {
  key: string;
  displayName: string;
  /** @deprecated use hasMultiplosCardapios */
  hasPlanoAB: boolean;
  hasMultiplosCardapios: boolean;
  planosPresentes: DietPlano[];
  itemsByPlano: Record<string, DietItemWithFood[]>;
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
    plano = normalizePlanoLetter(letter);
  };

  base = base.replace(/\s*\(substituto\)\s*$/i, "").trim();

  const parenSuffix = base.match(/\s*\(([^)]+)\)\s*$/);
  if (parenSuffix) {
    const inner = parenSuffix[1];
    const planoInParen = inner.match(/\bplano\s*([a-z])\b/i);
    if (planoInParen) {
      setPlano(planoInParen[1]);
      base = base.slice(0, parenSuffix.index).trim();
    } else {
      const letterOnly = inner.match(/^([a-z])\b(?:\s*[•·-]|$)/i);
      if (letterOnly) {
        setPlano(letterOnly[1]);
        base = base.slice(0, parenSuffix.index).trim();
      }
    }
  }

  if (!plano) {
    const patterns = [
      /\s*[-–]\s*plano\s*([a-z])\s*$/i,
      /\s+plano\s*([a-z])\s*$/i,
      /\s*\(([a-z])\)\s*$/i,
      /\s*[-–]\s*([a-z])\s*$/i,
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

/** Nome guardado em `itens_dieta.refeicao` (compatível com parseRefeicaoLabel). */
export function buildRefeicaoStorageLabel(
  nomeBase: string,
  plano: DietPlano | null | undefined | "",
): string {
  const base = String(nomeBase || "").trim() || "Refeição";
  const letter = plano ? normalizePlanoLetter(plano) : null;
  if (!letter) return base;
  return `${base} (Plano ${letter})`;
}

/** Separa rótulo da BD em nome editável + cardápio para o editor. */
export function splitRefeicaoForEditor(refeicao: string): {
  nome: string;
  plano: DietPlano | "";
} {
  const { base, plano } = parseRefeicaoLabel(refeicao);
  return { nome: base, plano: plano ?? "" };
}

export function getPlanosFromGroups(groups: MealGroup[]): DietPlano[] {
  const set = new Set<DietPlano>();
  for (const g of groups) {
    for (const p of g.planosPresentes) set.add(p);
  }
  return sortPlanos(set);
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
        hasMultiplosCardapios: false,
        planosPresentes: [],
        itemsByPlano: {},
      });
    }
    const group = map.get(key)!;
    if (plano) {
      group.itemsByPlano[plano] = [...(group.itemsByPlano[plano] || []), item];
    } else {
      group.itemsByPlano.default = [...(group.itemsByPlano.default || []), item];
    }
  }

  for (const group of map.values()) {
    const planos = sortPlanos(
      Object.keys(group.itemsByPlano).filter(
        (k) => k !== "default" && (group.itemsByPlano[k]?.length ?? 0) > 0,
      ),
    );
    group.planosPresentes = planos;
    group.hasMultiplosCardapios = planos.length >= 2;
    group.hasPlanoAB =
      (group.itemsByPlano.A?.length ?? 0) > 0 && (group.itemsByPlano.B?.length ?? 0) > 0;
  }

  return sortMealGroups([...map.values()]);
}

export function dietHasMultiplosCardapios(groups: MealGroup[]): boolean {
  return getPlanosFromGroups(groups).length >= 2;
}

/** @deprecated use dietHasMultiplosCardapios */
export function dietHasPlanoAB(groups: MealGroup[]): boolean {
  return dietHasMultiplosCardapios(groups);
}

export function getAllItemsInMealGroup(group: MealGroup): DietItemWithFood[] {
  const out: DietItemWithFood[] = [];
  for (const items of Object.values(group.itemsByPlano)) {
    if (items?.length) out.push(...items);
  }
  return out;
}

export function isSubstitutoItem(item: DietItemWithFood): boolean {
  return /\(\s*substituto\s*\)/i.test(String(item.refeicao ?? ""));
}

export type MealItemsPartition = {
  principais: DietItemWithFood[];
  substitutos: DietItemWithFood[];
};

export function partitionMealItems(items: DietItemWithFood[]): MealItemsPartition {
  const principais: DietItemWithFood[] = [];
  const substitutos: DietItemWithFood[] = [];
  for (const item of items) {
    if (isSubstitutoItem(item)) substitutos.push(item);
    else principais.push(item);
  }
  return { principais, substitutos };
}

export function getItemsForPlano(
  group: MealGroup,
  plano: DietPlano,
  options?: { dietHasMultiplosCardapios?: boolean; dietHasPlanoAB?: boolean },
): DietItemWithFood[] {
  const all = getAllItemsInMealGroup(group);
  if (all.length === 0) return [];

  const usePlanoFilter =
    options?.dietHasMultiplosCardapios ??
    options?.dietHasPlanoAB ??
    group.hasMultiplosCardapios;

  if (!usePlanoFilter) {
    if ((group.itemsByPlano.default?.length ?? 0) > 0) {
      return group.itemsByPlano.default!;
    }
    return all;
  }

  return all.filter((item) => {
    const { plano: itemPlano } = parseRefeicaoLabel(item.refeicao);
    if (itemPlano === null) return true;
    return itemPlano === plano;
  });
}

export function mealSortIndex(name: string): number {
  const n = name.toLowerCase();
  for (const row of MEAL_ORDER_KEYWORDS) {
    if (row.keys.some((k) => n.includes(k))) return row.order;
  }
  return 50;
}

export function sortMealGroups(groups: MealGroup[]): MealGroup[] {
  return [...groups].sort(
    (a, b) =>
      mealSortIndex(a.displayName) - mealSortIndex(b.displayName) ||
      a.displayName.localeCompare(b.displayName, "pt-BR"),
  );
}

export function calcularMacros(itens: DietItemWithFood[]): DietMacros {
  return itens.reduce(
    (total, item) => {
      const snap = item.nutrientes_snapshot;
      if (snap && snap.quantidade_referencia) {
        const fator = macroScaleFactor(
          item.quantidade,
          item.unidade_quantidade,
          snap.quantidade_referencia,
        );
        return {
          totalCalorias: total.totalCalorias + (snap.kcal || 0) * fator,
          totalProteinas: total.totalProteinas + (snap.ptn || 0) * fator,
          totalCarboidratos: total.totalCarboidratos + (snap.cho || 0) * fator,
          totalLipidios: total.totalLipidios + (snap.lip || 0) * fator,
        };
      }
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

/** Aplica estado vindo do servidor ao cache local (dual-read). */
export function hydrateMealDoneFromServer(
  dietaId: string,
  items: Array<{ meal_key: string; plano: string; concluido?: boolean }>,
  dateKey: string = mealCheckDateKey(),
): Set<string> {
  const keys = new Set<string>();
  for (const item of items) {
    if (!item?.meal_key) continue;
    const plano = (item.plano || "A") as DietPlano;
    if (item.concluido === false) continue;
    keys.add(`${item.meal_key}::${plano}`);
    try {
      const k = mealCheckStorageKey(dietaId, item.meal_key, plano, dateKey);
      localStorage.setItem(k, "1");
    } catch {
      /* ignore */
    }
  }
  return keys;
}

export function countCompletedMeals(
  dietaId: string,
  groups: MealGroup[],
  plano: DietPlano,
  serverDoneKeys?: Set<string>,
): number {
  return groups.filter((g) => {
    if (serverDoneKeys?.has(`${g.key}::${plano}`)) return true;
    return readMealDone(dietaId, g.key, plano);
  }).length;
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

export function resolveImportRefeicaoPlano(refeicao: ImportRefeicaoMacros): DietPlano | null {
  const fromField = normalizePlanoLetter(refeicao.plano);
  if (fromField) return fromField;
  return parseRefeicaoLabel(refeicao.nome).plano;
}

export function collectPlanosFromRefeicoes(
  refeicoes: ImportRefeicaoMacros[],
): DietPlano[] {
  const set = new Set<DietPlano>();
  for (const r of refeicoes) {
    const p = resolveImportRefeicaoPlano(r);
    if (p) set.add(p);
  }
  return sortPlanos(set);
}

export function inferImportMacroPlano(refeicoes: ImportRefeicaoMacros[]): {
  hasMultiplosCardapios: boolean;
  planos: DietPlano[];
} {
  const planos = collectPlanosFromRefeicoes(refeicoes);
  return { hasMultiplosCardapios: planos.length >= 2, planos };
}

export function filterImportRefeicoesForMacroSum<T extends ImportRefeicaoMacros>(
  refeicoes: T[],
  plano: DietPlano,
): T[] {
  const { hasMultiplosCardapios } = inferImportMacroPlano(refeicoes);
  if (!hasMultiplosCardapios) return refeicoes;
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

export function dietHasMultiplosCardapiosFromItens(itens: { refeicao: string }[]): boolean {
  const set = new Set<DietPlano>();
  for (const item of itens) {
    const { plano } = parseRefeicaoLabel(item.refeicao);
    if (plano) set.add(plano);
  }
  return set.size >= 2;
}

/** @deprecated */
export function dietHasPlanoABFromItens(itens: { refeicao: string }[]): boolean {
  return dietHasMultiplosCardapiosFromItens(itens);
}

export function filterItensForPlanoView<T extends { refeicao: string }>(
  itens: T[],
  plano: DietPlano,
): T[] {
  if (!dietHasMultiplosCardapiosFromItens(itens)) return itens;
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
