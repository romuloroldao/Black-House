import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, ChevronLeft, ChevronRight, Pencil, History, Merge } from 'lucide-react';
import FoodEditSheet from '../components/FoodEditSheet';
import FoodHistoryPanel from '../components/FoodHistoryPanel';
import FoodMergeWizard from '../components/FoodMergeWizard';
import type { FoodCatalogItem, FoodQualityReport, FoodTipo } from '../types/food-catalog';
import {
  getFoodQualityReportSafe,
  listFoodCatalogSafe,
  listFoodTiposSafe,
} from '../lib/food-catalog-api';

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function qualityBadge(score?: number | null, flags?: string[]) {
  if (flags?.includes('kcal_divergente')) {
    return <Badge variant="destructive" className="text-xs">Kcal divergente</Badge>;
  }
  if ((score ?? 0) < 60) {
    return <Badge variant="secondary" className="text-xs">Revisar</Badge>;
  }
  return <Badge variant="outline" className="text-xs">OK</Badge>;
}

export default function FoodCatalogPage() {
  const [items, setItems] = useState<FoodCatalogItem[]>([]);
  const [tipos, setTipos] = useState<FoodTipo[]>([]);
  const [report, setReport] = useState<FoodQualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [tipoId, setTipoId] = useState('all');
  const [sort, setSort] = useState('nome');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 25;

  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingFood, setEditingFood] = useState<FoodCatalogItem | null>(null);
  const [historyFood, setHistoryFood] = useState<FoodCatalogItem | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    const [listRes, tiposRes, reportRes] = await Promise.all([
      listFoodCatalogSafe({
        q: debouncedQ || undefined,
        tipo_id: tipoId !== 'all' ? tipoId : undefined,
        sort,
        order: 'asc',
        page,
        pageSize,
      }),
      listFoodTiposSafe(),
      getFoodQualityReportSafe(),
    ]);

    if (listRes.success && listRes.data) {
      setItems(listRes.data.items);
      setTotalPages(listRes.data.pagination.totalPages);
      setTotal(listRes.data.pagination.total);
    } else {
      setItems([]);
    }
    if (tiposRes.success && tiposRes.data) setTipos(tiposRes.data);
    if (reportRes.success && reportRes.data) setReport(reportRes.data);
    setLoading(false);
  }, [debouncedQ, tipoId, sort, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingFood(null);
    setEditOpen(true);
  };

  const openEdit = (food: FoodCatalogItem) => {
    setEditingFood(food);
    setEditOpen(true);
  };

  const openHistory = (food: FoodCatalogItem) => {
    setHistoryFood(food);
    setHistoryOpen(true);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catálogo de Alimentos</h1>
          <p className="text-muted-foreground mt-1">
            Gestão nutricional com versionamento e auditoria
          </p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Novo alimento
        </Button>
      </div>

      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground">Total activos</p>
            <p className="text-2xl font-semibold">{report.active}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground">Kcal divergente</p>
            <p className="text-2xl font-semibold text-amber-600">{report.kcal_divergente}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground">Sem categoria</p>
            <p className="text-2xl font-semibold">{report.sem_categoria}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground">Baixa qualidade</p>
            <p className="text-2xl font-semibold">{report.baixa_qualidade}</p>
          </div>
        </div>
      )}

      <Tabs defaultValue="lista" className="space-y-4">
        <TabsList>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="revisar" className="gap-1">
            <Merge className="h-3.5 w-3.5" />
            Revisar duplicados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-4 mt-0">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nome, categoria ou ID..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select value={tipoId} onValueChange={(v) => { setTipoId(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {tipos.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.nome_tipo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nome">Nome</SelectItem>
                <SelectItem value="kcal">Calorias</SelectItem>
                <SelectItem value="updated_at">Actualização</SelectItem>
                <SelectItem value="qualidade_score">Qualidade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">{total} alimentos encontrados</p>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Kcal</TableHead>
                  <TableHead className="text-right">PTN</TableHead>
                  <TableHead className="text-right">CHO</TableHead>
                  <TableHead className="text-right">LIP</TableHead>
                  <TableHead>Un.</TableHead>
                  <TableHead>Actualizado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={10}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                      Nenhum alimento encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((food) => (
                    <TableRow key={food.id} className="group">
                      <TableCell className="font-medium max-w-[200px] truncate">{food.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{food.tipo_nome || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{food.calories}</TableCell>
                      <TableCell className="text-right tabular-nums">{food.protein}g</TableCell>
                      <TableCell className="text-right tabular-nums">{food.carbs}g</TableCell>
                      <TableCell className="text-right tabular-nums">{food.fat}g</TableCell>
                      <TableCell className="text-sm">{food.portion}{food.unidade_referencia || 'g'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(food.updated_at)}</TableCell>
                      <TableCell>{qualityBadge(food.qualidade_score, food.flags_qualidade)}</TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="icon" onClick={() => openHistory(food)} title="Histórico">
                            <History className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(food)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Página {page} de {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="revisar" className="mt-0">
          <FoodMergeWizard onMerged={() => void load()} />
        </TabsContent>
      </Tabs>

      <FoodEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        food={editingFood}
        tipos={tipos}
        onSaved={() => void load()}
      />

      <FoodHistoryPanel
        food={historyFood}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </div>
  );
}
