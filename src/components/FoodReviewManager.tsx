import { useState, useEffect, useMemo } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Edit, Trash2, AlertCircle, Check, X, Merge, Search, RefreshCw, ArrowLeft } from "lucide-react";
import { confirmDelete, useConfirm } from "@/contexts/ConfirmContext";
import { Food, getAllFoodsSafe, getMacroGroup, kcalFromMacrosFood, searchFoodsSafe } from "@/lib/foodService";

type Alimento = Food & { created_at?: string | null };

interface AlimentoGroup {
  baseNome: string;
  alimentos: Alimento[];
}

interface Props {
  onBack: () => void;
}

export default function FoodReviewManager({ onBack }: Props) {
  const { confirm } = useConfirm();
  const [alimentos, setAlimentos] = useState<Alimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingFood, setEditingFood] = useState<Alimento | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<AlimentoGroup[]>([]);
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<string>("");
  const [activeTab, setActiveTab] = useState("review");
  const [searchResults, setSearchResults] = useState<Alimento[]>([]);
  const [searching, setSearching] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    portion: "100",
    calories: "",
    carbs: "",
    protein: "",
    fat: "",
  });

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    if (alimentos.length > 0) {
      identificarDuplicados();
    }
  }, [alimentos]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const alimentosRes = await getAllFoodsSafe();
      setAlimentos(alimentosRes.success && Array.isArray(alimentosRes.data) ? alimentosRes.data : []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar alimentos");
    } finally {
      setLoading(false);
    }
  };

  const getFoodDisplayName = (alimento: Alimento): string =>
    String(alimento.name || (alimento as { nome?: string }).nome || "").trim();

  const normalizarNome = (nome: string | null | undefined): string => {
    return String(nome || '')
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const matchesSearch = (alimento: Alimento, term: string): boolean => {
    const q = normalizarNome(term);
    if (!q) return true;
    const name = normalizarNome(getFoodDisplayName(alimento));
    const tipo = normalizarNome(alimento.tipo_nome || '');
    const id = String(alimento.id || '').toLowerCase();
    return name.includes(q) || tipo.includes(q) || id.includes(q);
  };

  useEffect(() => {
    const term = searchTerm.trim();
    if (!term) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const res = await searchFoodsSafe(term);
      if (cancelled) return;
      if (res.success && Array.isArray(res.data)) {
        setSearchResults(res.data);
      } else {
        setSearchResults(alimentos.filter((a) => matchesSearch(a, term)));
      }
      setSearching(false);
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchTerm, alimentos]);

  // Extrai o nome base do alimento (remove variações como "cozido", "grelhado", etc.)
  const extrairNomeBase = (nome: string): string => {
    const variacoes = [
      "cozido", "cozida", "grelhado", "grelhada", "frito", "frita",
      "assado", "assada", "refogado", "refogada", "mexido", "mexida",
      "inteiro", "inteira", "picado", "picada", "em cubos", "em fatias",
      "cru", "crua", "natural", "light", "diet", "integral",
      "branco", "branca", "amarelo", "amarela", "verde",
      "sem sal", "com sal", "sem pele", "com pele", "sem osso", "com osso",
      "desnatado", "desnatada", "semidesnatado", "semidesnatada",
      "em conserva", "em lata", "enlatado", "enlatada",
      "moido", "moida", "moído", "moída",
      "tipo a", "tipo b", "tipo c"
    ];

    let nomeNormalizado = normalizarNome(nome);
    
    for (const variacao of variacoes) {
      nomeNormalizado = nomeNormalizado.replace(new RegExp(`\\b${variacao}\\b`, "gi"), "").trim();
    }
    
    // Remove parênteses e seu conteúdo
    nomeNormalizado = nomeNormalizado.replace(/\([^)]*\)/g, "").trim();
    
    // Remove múltiplos espaços
    nomeNormalizado = nomeNormalizado.replace(/\s+/g, " ").trim();
    
    return nomeNormalizado;
  };

  // Identifica grupos de alimentos duplicados/similares
  const identificarDuplicados = () => {
    const grupos: { [key: string]: Alimento[] } = {};
    
    for (const alimento of alimentos) {
      const nomeBase = extrairNomeBase(getFoodDisplayName(alimento));
      
      if (!grupos[nomeBase]) {
        grupos[nomeBase] = [];
      }
      grupos[nomeBase].push(alimento);
    }
    
    // Filtra apenas grupos com mais de 1 alimento
    const gruposDuplicados = Object.entries(grupos)
      .filter(([_, items]) => items.length > 1)
      .map(([baseNome, items]) => ({ baseNome, alimentos: items }))
      .sort((a, b) => b.alimentos.length - a.alimentos.length);
    
    setDuplicateGroups(gruposDuplicados);
  };

  // Alimentos recentes (últimos 30 dias) para revisão
  const alimentosRecentes = useMemo(
    () =>
      alimentos.filter((a) => {
        if (!a.created_at) return false;
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - 30);
        return new Date(a.created_at) >= dataLimite;
      }),
    [alimentos],
  );

  // Alimentos com valores suspeitos
  const alimentosSuspeitos = useMemo(
    () =>
      alimentos.filter((a) => {
        const alc = a.alcohol ?? 0;
        const kcalCalculada = kcalFromMacrosFood(a.protein, a.carbs, a.fat, alc);
        const diferencaPerc = Math.abs(a.calories - kcalCalculada) / (kcalCalculada || 1) * 100;
        return diferencaPerc > 15 || (a.carbs === 0 && a.protein === 0 && a.fat === 0 && alc === 0);
      }),
    [alimentos],
  );

  const trimmedSearch = searchTerm.trim();

  /** Na aba Recentes: sem busca → só últimos 30 dias; com busca → resultados do servidor */
  const filteredAlimentos = useMemo(() => {
    if (!trimmedSearch) return alimentosRecentes;
    return searchResults;
  }, [alimentosRecentes, trimmedSearch, searchResults]);

  const filteredSuspeitos = useMemo(
    () => alimentosSuspeitos.filter((a) => matchesSearch(a, trimmedSearch)),
    [alimentosSuspeitos, trimmedSearch],
  );

  const filteredDuplicateGroups = useMemo(() => {
    if (!trimmedSearch) return duplicateGroups;
    const q = normalizarNome(trimmedSearch);
    return duplicateGroups.filter(
      (g) =>
        normalizarNome(g.baseNome).includes(q) ||
        g.alimentos.some((a) => matchesSearch(a, trimmedSearch)),
    );
  }, [duplicateGroups, trimmedSearch]);

  const handleEdit = (alimento: Alimento) => {
    setEditingFood(alimento);
    setFormData({
      name: getFoodDisplayName(alimento),
      portion: alimento.portion.toString(),
      calories: alimento.calories.toString(),
      carbs: alimento.carbs.toString(),
      protein: alimento.protein.toString(),
      fat: alimento.fat.toString(),
    });
    setIsEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingFood) return;
    
    try {
      const updateResult = await apiClient.requestSafe(`/api/alimentos/${editingFood.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: formData.name.trim(),
          portion: parseFloat(formData.portion) || 100,
          calories: parseFloat(formData.calories) || 0,
          carbs: parseFloat(formData.carbs) || 0,
          protein: parseFloat(formData.protein) || 0,
          fat: parseFloat(formData.fat) || 0,
        }),
      });
      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Erro ao salvar alimento');
      }
      
      toast.success("Alimento atualizado!");
      setIsEditDialogOpen(false);
      carregarDados();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar alimento");
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDelete(confirm, "Este alimento será removido do catálogo."))) return;
    
    try {
      // DESIGN-SUPABASE-PURGE-GLOBAL-003: Usar rota semântica ao invés de from()
      await apiClient.request(`/api/alimentos/${id}`, { method: 'DELETE' });
      
      toast.success("Alimento excluído!");
      carregarDados();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir alimento");
    }
  };

  const toggleSelectForMerge = (id: string) => {
    setSelectedForMerge(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const openMergeDialog = () => {
    if (selectedForMerge.length < 2) {
      toast.error("Selecione pelo menos 2 alimentos para mesclar");
      return;
    }
    setMergeTarget(selectedForMerge[0]);
    setIsMergeDialogOpen(true);
  };

  const handleMerge = async () => {
    if (!mergeTarget || selectedForMerge.length < 2) return;

    const toDelete = selectedForMerge.filter((id) => id !== mergeTarget);
    if (
      !(await confirm({
        title: "Confirmar mesclagem",
        description: `${toDelete.length} alimento(s) duplicado(s) serão fundidos no alimento principal e removidos. Esta ação não pode ser desfeita.`,
        confirmLabel: "Mesclar",
        destructive: true,
      }))
    ) {
      return;
    }

    try {
      // Atualiza itens_dieta para apontar para o alimento alvo
      for (const id of toDelete) {
        // Buscar itens_dieta que usam este alimento
        const itensRes = await apiClient.requestSafe<any[]>(`/api/itens-dieta?alimento_id=${id}`);
        const itens = itensRes.success && Array.isArray(itensRes.data) ? itensRes.data : [];
        
        if (Array.isArray(itens)) {
          for (const item of itens) {
            await apiClient.requestSafe(`/api/itens-dieta/${item.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ alimento_id: mergeTarget }),
            });
          }
        }
      }
      
      // Deleta os alimentos duplicados
      for (const id of toDelete) {
        // DESIGN-SUPABASE-PURGE-GLOBAL-003: Usar rota semântica ao invés de from()
      await apiClient.request(`/api/alimentos/${id}`, { method: 'DELETE' });
      }
      
      toast.success(`${toDelete.length} alimentos mesclados com sucesso!`);
      setSelectedForMerge([]);
      setIsMergeDialogOpen(false);
      carregarDados();
    } catch (error) {
      console.error("Erro ao mesclar:", error);
      toast.error("Erro ao mesclar alimentos");
    }
  };

  const calcularCaloriasDosMacros = () => {
    const cho = parseFloat(formData.carbs) || 0;
    const ptn = parseFloat(formData.protein) || 0;
    const lip = parseFloat(formData.fat) || 0;
    return kcalFromMacrosFood(ptn, cho, lip, 0);
  };

  const ajustarCaloriasAutomaticamente = () => {
    const kcalCalculada = calcularCaloriasDosMacros();
    setFormData({ ...formData, calories: kcalCalculada.toFixed(1) });
    toast.success("Calorias ajustadas!");
  };

  const getTipoNome = (alimento: Alimento) => {
    const group = getMacroGroup(alimento);
    if (group === 'protein') return 'Proteínas';
    if (group === 'carb') return 'Carboidratos';
    if (group === 'fat') return 'Lipídios';
    return 'Misto';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 motion-safe:animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h2 className="text-2xl font-bold">Revisão de Alimentos</h2>
          <p className="text-muted-foreground">
            Revise e corrija alimentos importados ou identifique duplicados
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{alimentosRecentes.length}</div>
            <p className="text-sm text-muted-foreground">Últimos 30 dias</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Suspeitos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{alimentosSuspeitos.length}</div>
            <p className="text-sm text-muted-foreground">Valores inconsistentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Duplicados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{duplicateGroups.length}</div>
            <p className="text-sm text-muted-foreground">Grupos similares</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="review">Revisar Recentes</TabsTrigger>
            <TabsTrigger value="suspicious">
              Valores Suspeitos
              {alimentosSuspeitos.length > 0 && (
                <Badge variant="destructive" className="ml-2">{alimentosSuspeitos.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="duplicates">
              Duplicados
              {duplicateGroups.length > 0 && (
                <Badge variant="secondary" className="ml-2">{duplicateGroups.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, categoria ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {trimmedSearch && (
          <p className="text-xs text-muted-foreground">
            {searching
              ? "Buscando no catálogo..."
              : activeTab === "review"
                ? "Busca em todo o catálogo"
                : `Filtrando ${activeTab === "suspicious" ? "valores suspeitos" : "duplicados"}`}
            {!searching && (
              <>
                {" · "}
                {activeTab === "review"
                  ? filteredAlimentos.length
                  : activeTab === "suspicious"
                    ? filteredSuspeitos.length
                    : filteredDuplicateGroups.length}{" "}
                resultado(s)
              </>
            )}
          </p>
        )}

        <TabsContent value="review" className="space-y-4">
          {!trimmedSearch && alimentosRecentes.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhum alimento importado nos últimos 30 dias. Use a busca acima para encontrar qualquer item do catálogo.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Kcal</TableHead>
                    <TableHead className="text-right">CHO</TableHead>
                    <TableHead className="text-right">PTN</TableHead>
                    <TableHead className="text-right">LIP</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searching ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <RefreshCw className="h-5 w-5 motion-safe:animate-spin inline-block mr-2" />
                        Buscando alimentos...
                      </TableCell>
                    </TableRow>
                  ) : filteredAlimentos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {trimmedSearch
                          ? "Nenhum alimento encontrado para esta busca"
                          : "Nenhum alimento recente para revisar"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAlimentos.map((alimento) => (
                    <TableRow key={alimento.id}>
                      <TableCell className="font-medium">{getFoodDisplayName(alimento)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTipoNome(alimento)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{alimento.calories}</TableCell>
                      <TableCell className="text-right">{alimento.carbs}g</TableCell>
                      <TableCell className="text-right">{alimento.protein}g</TableCell>
                      <TableCell className="text-right">{alimento.fat}g</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(alimento)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(alimento.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="suspicious" className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Estes alimentos têm valores nutricionais que parecem inconsistentes 
              (calorias não correspondem aos macronutrientes ou todos os valores são zero).
            </AlertDescription>
          </Alert>

          <Card>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-right">Kcal Informada</TableHead>
                    <TableHead className="text-right">Kcal Calculada</TableHead>
                    <TableHead className="text-right">Diferença</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuspeitos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {trimmedSearch
                          ? "Nenhum valor suspeito encontrado para esta busca"
                          : "Nenhum valor suspeito detectado"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSuspeitos.map((alimento) => {
                    const kcalCalculada = kcalFromMacrosFood(
                      alimento.protein,
                      alimento.carbs,
                      alimento.fat,
                      alimento.alcohol ?? 0,
                    );
                    const diferenca = alimento.calories - kcalCalculada;
                    
                    return (
                      <TableRow key={alimento.id}>
                        <TableCell className="font-medium">{getFoodDisplayName(alimento)}</TableCell>
                        <TableCell className="text-right">{alimento.calories}</TableCell>
                        <TableCell className="text-right">{kcalCalculada.toFixed(1)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={Math.abs(diferenca) > 50 ? "destructive" : "secondary"}>
                            {diferenca > 0 ? "+" : ""}{diferenca.toFixed(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => handleEdit(alimento)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(alimento.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="duplicates" className="space-y-4">
          <div className="flex items-center justify-between">
            <Alert className="flex-1">
              <Merge className="h-4 w-4" />
              <AlertDescription>
                Selecione alimentos similares e mescle-os em um único registro. 
                As dietas existentes serão atualizadas automaticamente.
              </AlertDescription>
            </Alert>
            
            {selectedForMerge.length >= 2 && (
              <Button onClick={openMergeDialog} className="ml-4">
                <Merge className="h-4 w-4 mr-2" />
                Mesclar ({selectedForMerge.length})
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {filteredDuplicateGroups.map((grupo) => (
              <Card key={grupo.baseNome}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg capitalize flex items-center gap-2">
                    {grupo.baseNome}
                    <Badge variant="secondary">{grupo.alimentos.length} variações</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead className="text-right">Kcal</TableHead>
                        <TableHead className="text-right">CHO</TableHead>
                        <TableHead className="text-right">PTN</TableHead>
                        <TableHead className="text-right">LIP</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grupo.alimentos.map((alimento) => (
                        <TableRow key={alimento.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedForMerge.includes(alimento.id)}
                              onCheckedChange={() => toggleSelectForMerge(alimento.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{getFoodDisplayName(alimento)}</TableCell>
                          <TableCell className="text-right">{alimento.calories}</TableCell>
                          <TableCell className="text-right">{alimento.carbs}g</TableCell>
                          <TableCell className="text-right">{alimento.protein}g</TableCell>
                          <TableCell className="text-right">{alimento.fat}g</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => handleEdit(alimento)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(alimento.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}

            {filteredDuplicateGroups.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  {trimmedSearch ? (
                    <>
                      <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-lg font-medium">Nenhum duplicado para esta busca</p>
                      <p className="text-muted-foreground">Tente outro termo ou limpe o filtro.</p>
                    </>
                  ) : duplicateGroups.length === 0 ? (
                    <>
                      <Check className="h-12 w-12 mx-auto text-green-500 mb-4" />
                      <p className="text-lg font-medium">Nenhum duplicado encontrado!</p>
                      <p className="text-muted-foreground">Sua base de alimentos está organizada.</p>
                    </>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Alimento</DialogTitle>
            <DialogDescription>
              Corrija os valores nutricionais deste alimento
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Porção (g)</Label>
                <Input
                  type="number"
                  value={formData.portion}
                  onChange={(e) => setFormData({ ...formData, portion: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label>Kcal</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={formData.calories}
                    onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={ajustarCaloriasAutomaticamente}
                    title="Calcular automaticamente"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>CHO (g)</Label>
                <Input
                  type="number"
                  value={formData.carbs}
                  onChange={(e) => setFormData({ ...formData, carbs: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label>PTN (g)</Label>
                <Input
                  type="number"
                  value={formData.protein}
                  onChange={(e) => setFormData({ ...formData, protein: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label>LIP (g)</Label>
                <Input
                  type="number"
                  value={formData.fat}
                  onChange={(e) => setFormData({ ...formData, fat: e.target.value })}
                />
              </div>
            </div>

            {/* Alerta de inconsistência */}
            {(() => {
              const kcalInformada = parseFloat(formData.calories) || 0;
              const kcalCalculada = calcularCaloriasDosMacros();
              const diferencaPerc = Math.abs(kcalInformada - kcalCalculada) / (kcalCalculada || 1) * 100;
              
              if (diferencaPerc > 10 && kcalCalculada > 0) {
                return (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      As calorias informadas ({kcalInformada}) diferem das calculadas ({kcalCalculada.toFixed(1)}) em {diferencaPerc.toFixed(0)}%.
                    </AlertDescription>
                  </Alert>
                );
              }
              return null;
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Mesclagem */}
      <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mesclar Alimentos</DialogTitle>
            <DialogDescription>
              Escolha qual alimento será mantido. Os demais serão excluídos e as dietas serão atualizadas.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label>Manter este alimento:</Label>
            <Select value={mergeTarget} onValueChange={setMergeTarget}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Selecione o alimento principal" />
              </SelectTrigger>
              <SelectContent>
                {selectedForMerge.map((id) => {
                  const alimento = alimentos.find(a => a.id === id);
                  return alimento ? (
                    <SelectItem key={id} value={id}>
                      {getFoodDisplayName(alimento)} ({alimento.calories} kcal)
                    </SelectItem>
                  ) : null;
                })}
              </SelectContent>
            </Select>

            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {selectedForMerge.length - 1} alimento(s) serão excluídos e suas referências em dietas serão atualizadas para o alimento selecionado.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMergeDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleMerge} variant="destructive">
              <Merge className="h-4 w-4 mr-2" />
              Confirmar Mesclagem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
