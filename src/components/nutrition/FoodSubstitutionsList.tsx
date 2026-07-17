import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';
import { API_CONTRACT } from '@/contracts/api-contract';
import type { ItemRefeicaoEditor } from '@/components/diet/DietCreatorMealsSection';

type Substituicao = { nome: string; quantidade: number; nutriente: string };

export function FoodSubstitutionsList({ item }: { item: ItemRefeicaoEditor }) {
  const [subs, setSubs] = useState<Substituicao[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item.alimento_id || !item.alimento) {
      setSubs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const url = API_CONTRACT.alimentos.substituicoes(item.alimento_id, {
        quantidade: item.quantidade,
        unidade: item.unidade_quantidade || 'g',
        limit: 3,
      });
      const res = await apiClient.requestSafe<{
        substituicoes: Array<{
          alimento: { name: string };
          quantidadeEquivalente: number;
          kcalEquivalente: number;
        }>;
      }>(url);
      if (!cancelled) {
        const list = res.success && res.data?.substituicoes ? res.data.substituicoes : [];
        setSubs(
          list.map((s) => ({
            nome: s.alimento.name,
            quantidade: Math.round(s.quantidadeEquivalente),
            nutriente: `${s.kcalEquivalente.toFixed(0)} kcal`,
          })),
        );
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item.alimento_id, item.alimento, item.quantidade, item.unidade_quantidade]);

  if (!item.alimento) return null;

  return (
    <div className="border-t pt-2">
      <p className="text-xs font-medium text-muted-foreground mb-1">Substituições equivalentes</p>
      {loading ? (
        <Skeleton className="h-8 w-full" />
      ) : subs.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem substitutos no grupo</p>
      ) : (
        <div className="grid grid-cols-1 gap-1">
          {subs.map((sub, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded bg-muted/50 px-2 py-1 text-xs"
            >
              <span className="truncate">{sub.nome}</span>
              <Badge variant="secondary" className="shrink-0 ml-2 text-[10px]">
                {sub.quantidade}g ({sub.nutriente})
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
