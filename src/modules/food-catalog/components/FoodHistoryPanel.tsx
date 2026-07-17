import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getFoodHistorySafe } from '../lib/food-catalog-api';
import type { FoodAuditEntry, FoodCatalogItem } from '../types/food-catalog';

type Props = {
  food: FoodCatalogItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatField(campo: string | null) {
  if (!campo) return 'Registo';
  const labels: Record<string, string> = {
    nome: 'Nome',
    tipo_id: 'Categoria',
    ptn_por_referencia: 'Proteína',
    cho_por_referencia: 'Carboidrato',
    lip_por_referencia: 'Lipídio',
    quantidade_referencia_g: 'Porção',
    merged_from: 'Fusão',
  };
  return labels[campo] || campo;
}

function formatValue(val: unknown): string {
  if (val == null) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

export default function FoodHistoryPanel({ food, open, onOpenChange }: Props) {
  const [entries, setEntries] = useState<FoodAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !food?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await getFoodHistorySafe(food.id, { pageSize: 100 });
      if (!cancelled) {
        setEntries(res.success && res.data ? res.data.items : []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, food?.id]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Histórico</SheetTitle>
          <SheetDescription>{food?.name}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem alterações registadas.</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="border-l-2 border-primary/30 pl-3 py-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">{entry.acao}</Badge>
                  {entry.versao_para != null && (
                    <span className="text-xs text-muted-foreground">v{entry.versao_para}</span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(entry.criado_em).toLocaleString('pt-BR')}
                  </span>
                </div>
                <p className="text-sm font-medium mt-1">{formatField(entry.campo)}</p>
                {entry.campo && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatValue(entry.valor_anterior)} → {formatValue(entry.valor_novo)}
                  </p>
                )}
                {!entry.campo && entry.valor_novo != null && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {formatValue(entry.valor_novo)}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
