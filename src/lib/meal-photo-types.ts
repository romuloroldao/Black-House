export type MealPhotoItem = {
  nome: string;
  quantidade: number;
  unidade: string;
  kcal: number;
  ptn: number;
  cho: number;
  lip: number;
  alimento_id?: string | null;
  fonte?: "AI" | "USER";
  confidence?: number | null;
  ordem?: number;
};

export type MealPhotoTotals = {
  kcal: number;
  ptn: number;
  cho: number;
  lip: number;
};

export type MealPhotoAnalysis = {
  ok: boolean;
  status: string;
  error_message?: string | null;
  nome_sugerido: string;
  confidence?: number | null;
  itens: MealPhotoItem[];
  totais: MealPhotoTotals;
  uncertainties: string[];
  disclaimer?: string;
  imagem_path?: string | null;
};

export type RefeicaoRegistrada = {
  id: string;
  aluno_id: string;
  registrado_em: string;
  nome_sugerido: string | null;
  imagem_path: string | null;
  kcal: number;
  ptn: number;
  cho: number;
  lip: number;
  ai_kcal?: number | null;
  ai_ptn?: number | null;
  ai_cho?: number | null;
  ai_lip?: number | null;
  origem: "AI_ESTIMATE" | "USER_ADJUSTED";
  ai_confidence?: number | null;
  ai_uncertainties?: string[] | unknown;
  notas?: string | null;
  itens?: MealPhotoItem[];
};

export function sumMealItems(itens: MealPhotoItem[]): MealPhotoTotals {
  return itens.reduce(
    (acc, it) => ({
      kcal: acc.kcal + (Number(it.kcal) || 0),
      ptn: acc.ptn + (Number(it.ptn) || 0),
      cho: acc.cho + (Number(it.cho) || 0),
      lip: acc.lip + (Number(it.lip) || 0),
    }),
    { kcal: 0, ptn: 0, cho: 0, lip: 0 },
  );
}

export function round1(n: number) {
  return Math.round((Number(n) || 0) * 10) / 10;
}
