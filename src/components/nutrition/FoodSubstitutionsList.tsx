import { useEffect, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';
import { API_CONTRACT } from '@/contracts/api-contract';
import type { ItemRefeicaoEditor } from '@/components/diet/DietCreatorMealsSection';
import { canSubstitute } from '@/lib/foodEquivalence';

type Substituicao = { nome: string; quantidade: number; nutriente: string };

type FoodSubstitutionsListProps = {
  item: ItemRefeicaoEditor;
  /** Abre o dialog de substituição equivalente (mesmo grupo + qtd isocalórica). */
  onRequestSubstituir?: () => void;
};

export function FoodSubstitutionsList({ item, onRequestSubstituir }: FoodSubstitutionsListProps) {
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

  const podeSubstituir =
    Boolean(onRequestSubstituir) &&
    canSubstitute(item.alimento) &&
    item.alimento.equiv_livre !== true;

  return (
    <div className="border-t pt-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Substituições equivalentes</p>
        {podeSubstituir ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-xs"
            onClick={onRequestSubstituir}
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Substituir
          </Button>
        ) : null}
      </div>
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
