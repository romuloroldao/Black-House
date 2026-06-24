import {
  buildRefeicaoStorageLabel,
  mealSortIndex,
  type DietItemWithFood,
  type DietPlano,
} from "@/lib/diet-student-utils";
import { sortPlanos } from "@/lib/diet-plano";

export const CARDAPIO_OPCOES: DietPlano[] = ["A", "B", "C", "D", "E", "F", "G", "H"];

export type RefeicaoEditorShape = {
  nome: string;
  plano: DietPlano | "";
  itens: Array<{
    id: string;
    alimento_id: string;
    quantidade: number;
    unidade_quantidade?: string;
    refeicao: string;
    alimento?: {
      name?: string;
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
      portion?: string;
    } | null;
  }>;
};

export function mealBaseKey(nome: string): string {
  return String(nome || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function refeicaoStorageLabel(refeicao: Pick<RefeicaoEditorShape, "nome" | "plano">): string {
  return buildRefeicaoStorageLabel(refeicao.nome, refeicao.plano || null);
}

export function collectPlanosFromRefeicoes(refeicoes: RefeicaoEditorShape[]): DietPlano[] {
  const set = new Set<DietPlano>();
  for (const r of refeicoes) {
    if (r.plano) set.add(r.plano);
  }
  return sortPlanos(set);
}

export function dietHasMultiplosCardapios(refeicoes: RefeicaoEditorShape[]): boolean {
  return collectPlanosFromRefeicoes(refeicoes).length >= 2;
}

export function getUsedPlanosForMeal(
  refeicoes: RefeicaoEditorShape[],
  nome: string,
): Set<DietPlano | ""> {
  const key = mealBaseKey(nome);
  const used = new Set<DietPlano | "">();
  for (const r of refeicoes) {
    if (mealBaseKey(r.nome) === key) used.add(r.plano || "");
  }
  return used;
}

export function isPlanoAvailableForMeal(
  refeicoes: RefeicaoEditorShape[],
  nome: string,
  plano: DietPlano | "",
): boolean {
  const used = getUsedPlanosForMeal(refeicoes, nome);
  return !used.has(plano);
}

export function getNextPlanoForMeal(
  refeicoes: RefeicaoEditorShape[],
  baseKey: string,
): DietPlano | null {
  const used = new Set<DietPlano>();
  for (const r of refeicoes) {
    if (mealBaseKey(r.nome) === baseKey && r.plano) used.add(r.plano);
  }
  for (const letter of CARDAPIO_OPCOES) {
    if (!used.has(letter)) return letter;
  }
  return null;
}

export type MealEditGroup = {
  key: string;
  displayName: string;
  slots: Array<{ index: number; refeicao: RefeicaoEditorShape }>;
};

export function groupRefeicoesByMeal(refeicoes: RefeicaoEditorShape[]): MealEditGroup[] {
  const order: string[] = [];
  const map = new Map<string, MealEditGroup>();

  refeicoes.forEach((refeicao, index) => {
    const key = mealBaseKey(refeicao.nome) || `ref-${index}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        displayName: refeicao.nome.trim() || "Refeição",
        slots: [],
      });
      order.push(key);
    }
    map.get(key)!.slots.push({ index, refeicao });
  });

  const groups = order.map((key) => map.get(key)!);
  for (const group of groups) {
    group.slots.sort((a, b) => {
      if (!a.refeicao.plano) return -1;
      if (!b.refeicao.plano) return 1;
      return a.refeicao.plano.localeCompare(b.refeicao.plano);
    });
  }

  return groups.sort(
    (a, b) =>
      mealSortIndex(a.displayName) - mealSortIndex(b.displayName) ||
      a.displayName.localeCompare(b.displayName, "pt-BR"),
  );
}

export function refeicoesToPreviewItens(refeicoes: RefeicaoEditorShape[]): DietItemWithFood[] {
  return refeicoes.flatMap((refeicao) =>
    refeicao.itens
      .filter((item) => item.alimento_id)
      .map((item) => ({
        id: item.id,
        refeicao: refeicaoStorageLabel(refeicao),
        quantidade: item.quantidade,
        unidade_quantidade: item.unidade_quantidade,
        alimento_id: item.alimento_id,
        alimentos: item.alimento
          ? {
              name: item.alimento.name,
              calories: item.alimento.calories,
              protein: item.alimento.protein,
              carbs: item.alimento.carbs,
              fat: item.alimento.fat,
              portion: item.alimento.portion,
            }
          : null,
      })),
  );
}

const PLANO_STYLES: Record<
  string,
  { border: string; bg: string; badge: string; ring: string }
> = {
  A: {
    border: "border-l-primary",
    bg: "bg-primary/[0.04]",
    badge: "bg-primary/15 text-primary border-primary/20",
    ring: "ring-primary/30",
  },
  B: {
    border: "border-l-amber-500",
    bg: "bg-amber-500/[0.06]",
    badge: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/25",
    ring: "ring-amber-500/30",
  },
  C: {
    border: "border-l-emerald-500",
    bg: "bg-emerald-500/[0.06]",
    badge: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/25",
    ring: "ring-emerald-500/30",
  },
  D: {
    border: "border-l-violet-500",
    bg: "bg-violet-500/[0.06]",
    badge: "bg-violet-500/15 text-violet-800 dark:text-violet-300 border-violet-500/25",
    ring: "ring-violet-500/30",
  },
};

const DEFAULT_PLANO_STYLE = {
  border: "border-l-muted-foreground/40",
  bg: "bg-muted/20",
  badge: "bg-muted text-muted-foreground border-border",
  ring: "ring-border",
};

export function planoVisualStyle(plano: DietPlano | "") {
  if (!plano) return DEFAULT_PLANO_STYLE;
  return PLANO_STYLES[plano] ?? DEFAULT_PLANO_STYLE;
}
