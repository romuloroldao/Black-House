import { apiClient, type ApiResult } from '@/lib/api-client';
import { API_CONTRACT } from '@/contracts/api-contract';
import type {
  FoodAuditEntry,
  FoodCatalogItem,
  FoodCatalogListResponse,
  FoodCatalogUpsertPayload,
  FoodQualityReport,
  FoodSaveResult,
  FoodTipo,
  FoodUsage,
} from '../types/food-catalog';

export type FoodCatalogListQuery = {
  q?: string;
  status?: string;
  tipo_id?: string;
  flags?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
};

export async function listFoodCatalogSafe(
  query?: FoodCatalogListQuery,
): Promise<ApiResult<FoodCatalogListResponse>> {
  return apiClient.requestSafe<FoodCatalogListResponse>(API_CONTRACT.foodCatalog.list(query));
}

export async function getFoodCatalogByIdSafe(id: string): Promise<ApiResult<FoodCatalogItem>> {
  return apiClient.requestSafe<FoodCatalogItem>(API_CONTRACT.foodCatalog.byId(id));
}

export async function getFoodUsageSafe(id: string): Promise<ApiResult<FoodUsage>> {
  return apiClient.requestSafe<FoodUsage>(API_CONTRACT.foodCatalog.usage(id));
}

export async function getFoodHistorySafe(
  id: string,
  query?: { page?: number; pageSize?: number },
): Promise<ApiResult<{ items: FoodAuditEntry[]; pagination: { page: number; pageSize: number; total: number } }>> {
  return apiClient.requestSafe(API_CONTRACT.foodCatalog.history(id, query));
}

export async function listFoodTiposSafe(): Promise<ApiResult<FoodTipo[]>> {
  return apiClient.requestSafe<FoodTipo[]>(API_CONTRACT.foodCatalog.tipos());
}

export async function getFoodQualityReportSafe(): Promise<ApiResult<FoodQualityReport>> {
  return apiClient.requestSafe<FoodQualityReport>(API_CONTRACT.foodCatalog.qualityReport());
}

export async function checkFoodDuplicateSafe(
  nome: string,
  excludeId?: string,
): Promise<ApiResult<{ exact: boolean; exactMatch?: FoodCatalogItem; candidates: FoodCatalogItem[] }>> {
  return apiClient.requestSafe(API_CONTRACT.foodCatalog.checkDuplicate(), {
    method: 'POST',
    body: JSON.stringify({ nome, excludeId }),
  });
}

export async function createFoodCatalogSafe(
  payload: FoodCatalogUpsertPayload,
): Promise<ApiResult<FoodSaveResult>> {
  return apiClient.requestSafe<FoodSaveResult>(API_CONTRACT.foodCatalog.create(), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateFoodCatalogSafe(
  id: string,
  payload: FoodCatalogUpsertPayload,
): Promise<ApiResult<FoodSaveResult>> {
  return apiClient.requestSafe<FoodSaveResult>(API_CONTRACT.foodCatalog.update(id), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export type DuplicateGroup = {
  nome_normalizado: string;
  total: number;
  alimentos: Array<{
    id: string;
    nome: string;
    kcal_por_referencia: number;
    status: string;
    updated_at: string;
  }>;
};

export async function listFoodDuplicatesSafe(
  limit = 50,
): Promise<ApiResult<DuplicateGroup[]>> {
  return apiClient.requestSafe<DuplicateGroup[]>(API_CONTRACT.foodCatalog.duplicates(limit));
}

export async function mergeFoodsSafe(
  targetId: string,
  sourceIds: string[],
): Promise<ApiResult<{ targetId: string; itensAtualizados: number; sourcesMerged: number }>> {
  return apiClient.requestSafe(API_CONTRACT.foodCatalog.merge(targetId), {
    method: 'POST',
    body: JSON.stringify({ sourceIds }),
  });
}

export function kcalFromMacros(ptn: number, cho: number, lip: number, alcohol = 0): number {
  return ptn * 4 + cho * 4 + lip * 9 + alcohol * 7;
}
