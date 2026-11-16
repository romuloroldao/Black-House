import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiClient, type ApiResult } from "@/lib/api-client";
import {
  cleanApiErrorMessage,
  moveFoodsLocally,
  normalizeCategoriesResponse,
  type FoodCategory,
} from "@/lib/food-categories";

type Status = "idle" | "loading" | "ready" | "error";

function errorOf(res: ApiResult<unknown>): string | undefined {
  return res.success ? undefined : (res as { error?: string }).error;
}

/**
 * Categorias pessoais do profissional (aluno recebe as do seu coach, só leitura).
 * Mutações são otimistas e revertem em caso de erro.
 */
export function useFoodCategories(enabled: boolean) {
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const loadedRef = useRef(false);
  const categoriesRef = useRef<FoodCategory[]>([]);
  categoriesRef.current = categories;

  const reload = useCallback(async () => {
    setStatus("loading");
    const res = await apiClient.getFoodCategoriesSafe();
    if (!res.success) {
      setStatus("error");
      return;
    }
    const data = normalizeCategoriesResponse(res.data);
    setCategories(data.categories);
    setCanEdit(data.can_edit);
    setStatus("ready");
    loadedRef.current = true;
  }, []);

  useEffect(() => {
    if (enabled && !loadedRef.current) void reload();
  }, [enabled, reload]);

  const fail = useCallback((previous: FoodCategory[], message: string | undefined, fallback: string) => {
    setCategories(previous);
    toast.error(cleanApiErrorMessage(message, fallback));
  }, []);

  const createCategory = useCallback(async (nome: string): Promise<FoodCategory | null> => {
    const res = await apiClient.createFoodCategorySafe(nome);
    if (!res.success) {
      toast.error(cleanApiErrorMessage(errorOf(res), "Não foi possível criar a categoria."));
      return null;
    }
    if (!res.data?.id) {
      toast.error("Não foi possível criar a categoria.");
      return null;
    }
    const created = { ...res.data, alimento_ids: res.data.alimento_ids ?? [] };
    setCategories((prev) => [...prev, created]);
    return created;
  }, []);

  const renameCategory = useCallback(
    async (id: string, nome: string): Promise<boolean> => {
      const previous = categoriesRef.current;
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, nome } : c)));
      const res = await apiClient.updateFoodCategorySafe(id, { nome });
      if (!res.success) {
        fail(previous, errorOf(res), "Não foi possível renomear a categoria.");
        return false;
      }
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, nome: res.data?.nome ?? nome } : c)));
      return true;
    },
    [fail],
  );

  const deleteCategory = useCallback(
    async (id: string): Promise<boolean> => {
      const previous = categoriesRef.current;
      setCategories((prev) => prev.filter((c) => c.id !== id));
      const res = await apiClient.deleteFoodCategorySafe(id);
      if (!res.success) {
        fail(previous, errorOf(res), "Não foi possível excluir a categoria.");
        return false;
      }
      return true;
    },
    [fail],
  );

  /** `categoryId = null` tira os alimentos de qualquer categoria. */
  const moveFoods = useCallback(
    async (alimentoIds: string[], categoryId: string | null): Promise<boolean> => {
      if (alimentoIds.length === 0) return true;
      const previous = categoriesRef.current;
      setCategories((prev) => moveFoodsLocally(prev, alimentoIds, categoryId));
      const res = categoryId
        ? await apiClient.assignFoodsToCategorySafe(categoryId, alimentoIds)
        : await apiClient.unassignFoodsFromCategoriesSafe(alimentoIds);
      if (!res.success) {
        fail(previous, errorOf(res), "Não foi possível mover o alimento.");
        return false;
      }
      return true;
    },
    [fail],
  );

  return { categories, canEdit, status, reload, createCategory, renameCategory, deleteCategory, moveFoods };
}

export type FoodCategoriesState = ReturnType<typeof useFoodCategories>;
