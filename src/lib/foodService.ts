import { apiClient, ApiResult } from '@/lib/api-client';
import { API_CONTRACT } from '@/contracts/api-contract';

export type Food = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portion: number;
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeFood = (row: any): Food => {
  return {
    id: String(row?.id ?? ''),
    name: row?.name ?? row?.nome ?? '',
    calories: toNumber(row?.calories ?? row?.kcal_por_referencia),
    protein: toNumber(row?.protein ?? row?.ptn_por_referencia),
    carbs: toNumber(row?.carbs ?? row?.cho_por_referencia),
    fat: toNumber(row?.fat ?? row?.lip_por_referencia),
    portion: toNumber(row?.portion ?? row?.quantidade_referencia_g, 100)
  };
};

export const getMacroGroup = (food: Food) => {
  const max = Math.max(food.protein, food.carbs, food.fat);
  if (max === 0) return 'mixed';
  if (max === food.protein) return 'protein';
  if (max === food.carbs) return 'carb';
  return 'fat';
};

export const getAllFoodsSafe = async (): Promise<ApiResult<Food[]>> => {
  const result = await apiClient.requestSafe<any[]>(API_CONTRACT.alimentos.list());
  if (!result.success) return result as ApiResult<Food[]>;
  const data = Array.isArray(result.data) ? result.data : [];
  return {
    success: true,
    data: data.map(normalizeFood)
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
