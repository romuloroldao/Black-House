import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Merge, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/contexts/ConfirmContext';
import {
  listFoodDuplicatesSafe,
  mergeFoodsSafe,
  type DuplicateGroup,
} from '../lib/food-catalog-api';

export default function FoodMergeWizard({ onMerged }: { onMerged?: () => void }) {
  const { confirm } = useConfirm();
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [activeGroup, setActiveGroup] = useState<DuplicateGroup | null>(null);
  const [targetId, setTargetId] = useState('');
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listFoodDuplicatesSafe(40);
    setGroups(res.success && res.data ? res.data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openGroup = (group: DuplicateGroup) => {
    setActiveGroup(group);
    const ids = group.alimentos.map((a) => a.id);
    setTargetId(ids[0] || '');
    setSelectedSources(new Set(ids.slice(1)));
  };

  const toggleSource = (id: string) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMerge = async () => {
    if (!targetId || selectedSources.size === 0) {
      toast.error('Seleccione alimento principal e duplicados a fundir');
      return;
    }
    const sources = [...selectedSources].filter((id) => id !== targetId);
    if (sources.length === 0) {
      toast.error('Seleccione pelo menos um duplicado diferente do principal');
      return;
    }

    const ok = await confirm({
      title: 'Confirmar mesclagem',
      description: `${sources.length} alimento(s) serão marcados como fundidos. Itens de dieta serão repontados para o principal.`,
      confirmLabel: 'Mesclar',
      destructive: true,
    });
    if (!ok) return;

    setMerging(true);
    try {
      const res = await mergeFoodsSafe(targetId, sources);
      if (!res.success) throw new Error(res.error || 'Erro ao mesclar');
      toast.success(
        `Mesclagem concluída: ${res.data?.itensAtualizados ?? 0} itens de dieta actualizados`,
      );
      setActiveGroup(null);
      onMerged?.();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao mesclar');
    } finally {
      setMerging(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (activeGroup) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setActiveGroup(null)}>
          ← Voltar à lista
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mesclar duplicados</CardTitle>
            <p className="text-sm text-muted-foreground">
              Grupo: <strong>{activeGroup.nome_normalizado}</strong> ({activeGroup.total} itens)
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Alimento principal (manter)</Label>
              <RadioGroup value={targetId} onValueChange={setTargetId}>
                {activeGroup.alimentos.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 rounded border p-2">
                    <RadioGroupItem value={a.id} id={`target-${a.id}`} />
                    <Label htmlFor={`target-${a.id}`} className="flex-1 cursor-pointer">
                      <span className="font-medium">{a.nome}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {a.kcal_por_referencia} kcal
                      </span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Duplicados a fundir (remover)</Label>
              {activeGroup.alimentos
                .filter((a) => a.id !== targetId)
                .map((a) => (
                  <div key={a.id} className="flex items-center gap-2 rounded border p-2">
                    <Checkbox
                      id={`src-${a.id}`}
                      checked={selectedSources.has(a.id)}
                      onCheckedChange={() => toggleSource(a.id)}
                    />
                    <Label htmlFor={`src-${a.id}`} className="flex-1 cursor-pointer">
                      {a.nome}
                    </Label>
                  </div>
                ))}
            </div>

            <Button className="w-full gap-2" onClick={handleMerge} disabled={merging}>
              <Merge className="h-4 w-4" />
              {merging ? 'A mesclar...' : 'Confirmar mesclagem'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {groups.length} grupos de nomes duplicados detectados
        </p>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Actualizar
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum duplicado exacto por nome normalizado.
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => (
          <Card
            key={group.nome_normalizado}
            className="cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => openGroup(group)}
          >
            <CardContent className="py-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{group.nome_normalizado}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {group.alimentos.map((a) => a.nome).join(' · ')}
                </p>
              </div>
              <Badge>{group.total}</Badge>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
