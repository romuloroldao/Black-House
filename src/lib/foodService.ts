import { apiClient, ApiResult } from '@/lib/api-client';
import { API_CONTRACT } from '@/contracts/api-contract';

export type Food = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Gramas de álcool etílico por `portion` (mesma base que macros); 7 kcal/g na energia. */
  alcohol?: number;
  portion: number;
  tipo_id?: string | null;
  tipo_nome?: string | null;
  macro_predominante?: string | null;
  equiv_livre?: boolean;
  origem_ptn?: string | null;
  updated_at?: string | null;
  status?: string;
  versao_actual?: number;
  unidade_referencia?: string;
  fibra_por_referencia?: number | null;
  acucar_por_referencia?: number | null;
  sodio_por_referencia_mg?: number | null;
  qualidade_score?: number | null;
  flags_qualidade?: string[];
  created_at?: string | null;
};

export type QuantityUnit = 'g' | 'ml' | 'un';

/** kcal a partir de macros + álcool (4/4/9/7). */
export function kcalFromMacrosFood(
  protein: number,
  carbs: number,
  fat: number,
  alcohol = 0,
): number {
  const p = Number(protein) || 0;
  const c = Number(carbs) || 0;
  const l = Number(fat) || 0;
  const a = Number(alcohol) || 0;
  return p * 4 + c * 4 + l * 9 + a * 7;
}

/**
 * Factor para aplicar nutrientes por referência ao item da dieta.
 * - g/ml: quantidade na mesma base que `food.portion` (ex.: g por 100g; ml por 100ml).
 * - un: número de unidades; macros no cadastro devem ser por UMA unidade (`portion` = massa/volume dessa unidade).
 */
export function macroScaleFactor(
  quantidade: number,
  unidade: string | undefined,
  portion: number | string | undefined,
): number {
  const q = Number(quantidade) || 0;
  const p = Number(portion) > 0 ? Number(portion) : 100;
  const u = (unidade || 'g').toLowerCase();
  if (u === 'un') return q;
  return q / p;
}

export function quantityUnitLabel(u: string | undefined): string {
  const x = (u || 'g').toLowerCase();
  if (x === 'ml') return 'ml';
  if (x === 'un') return 'un.';
  return 'g';
}

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeFood = (row: any): Food => {
  return {
    id: String(row?.id ?? ''),
    name: String(row?.name ?? row?.nome ?? ''),
    calories: toNumber(row?.calories ?? row?.kcal_por_referencia),
    protein: toNumber(row?.protein ?? row?.ptn_por_referencia),
    carbs: toNumber(row?.carbs ?? row?.cho_por_referencia),
    fat: toNumber(row?.fat ?? row?.lip_por_referencia),
    alcohol: toNumber(row?.alcohol ?? row?.alcool_por_referencia, 0),
    portion: toNumber(row?.portion ?? row?.quantidade_referencia_g, 100),
    tipo_id: row?.tipo_id != null ? String(row.tipo_id) : null,
    tipo_nome: row?.tipo_nome != null ? String(row.tipo_nome) : null,
    macro_predominante: row?.macro_predominante != null ? String(row.macro_predominante) : null,
    equiv_livre: row?.equiv_livre === true,
    origem_ptn: row?.origem_ptn != null ? String(row.origem_ptn) : null,
    updated_at: row?.updated_at != null ? String(row.updated_at) : null,
    status: row?.status != null ? String(row.status) : undefined,
    versao_actual: row?.versao_actual != null ? Number(row.versao_actual) : undefined,
    unidade_referencia: row?.unidade_referencia != null ? String(row.unidade_referencia) : 'g',
    fibra_por_referencia: toNumber(row?.fibra_por_referencia, 0),
    acucar_por_referencia: toNumber(row?.acucar_por_referencia, 0),
    sodio_por_referencia_mg: toNumber(row?.sodio_por_referencia_mg, 0),
    qualidade_score: row?.qualidade_score != null ? Number(row.qualidade_score) : null,
    flags_qualidade: Array.isArray(row?.flags_qualidade) ? row.flags_qualidade : [],
    created_at: row?.created_at != null ? String(row.created_at) : null,
  };
};

// Reexporta motor isocalórico (logicaTabela)
export {
  sameEquivalenceGroup,
  canSubstitute,
  listarSubstituicoesIsocaloricas,
  kcalPorPorcao,
  calcularQuantidadeEquivalente,
} from '@/lib/foodEquivalence';
export type { SubstituicaoIsocalorica } from '@/lib/foodEquivalence';

export const getSubstitutionCategory = (food: Food) => {
  if (food.tipo_id && String(food.tipo_id).trim() !== '') {
    return `tipo:${String(food.tipo_id)}`;
  }
  return 'sem-grupo';
};

export const getSubstitutionCategoryLabel = (
  _categoryKey: string,
  food?: Food | null,
) => food?.tipo_nome?.trim() || 'Sem grupo';

export const getMacroGroup = (food: Food) => {
  const max = Math.max(food.protein, food.carbs, food.fat);
  if (max === 0) return 'mixed';
  if (max === food.protein) return 'protein';
  if (max === food.carbs) return 'carb';
  return 'fat';
};

export const getMacroGroupLabel = (macro: string) => {
  if (macro === 'protein') return 'PROTEÍNAS';
  if (macro === 'carb') return 'CARBOIDRATOS';
  if (macro === 'fat') return 'GORDURAS';
  if (macro === 'mixed') return 'ALIMENTOS MISTOS';
  return 'OUTROS';
};

/** @deprecated Usar equivalência isocalórica; mantido para compatibilidade. */
export const getCategoryEquivalenceKey = () => 'calories' as const;
export const getEquivalenceLabel = () => 'Calorias (isocalórica)';
export const getEquivalenceUnit = () => 'kcal';

export const getAllFoodsSafe = async (): Promise<ApiResult<Food[]>> => {
  const result = await apiClient.requestSafe<any[]>(API_CONTRACT.alimentos.list());
  if (!result.success) return result as ApiResult<Food[]>;
  const data = Array.isArray(result.data) ? result.data : [];
  return {
    success: true,
    data: data.map(normalizeFood)
  };
};

export const searchFoodsSafe = async (q: string): Promise<ApiResult<Food[]>> => {
  const term = String(q || '').trim();
  if (!term) return getAllFoodsSafe();
  const result = await apiClient.requestSafe<any[]>(API_CONTRACT.alimentos.list({ q: term }));
  if (!result.success) return result as ApiResult<Food[]>;
  const data = Array.isArray(result.data) ? result.data : [];
  return {
    success: true,
    data: data.map(normalizeFood),
  };
};

export const getFoodByIdSafe = async (foodId: string): Promise<ApiResult<Food>> => {
  const result = await apiClient.requestSafe<any>(API_CONTRACT.alimentos.byId(foodId));
  if (!result.success) return result as ApiResult<Food>;
  return {
    success: true,
    data: normalizeFood(result.data)
  };
};
