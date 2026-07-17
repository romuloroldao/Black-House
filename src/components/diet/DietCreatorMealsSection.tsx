import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AsyncFoodCombobox } from "@/components/nutrition/AsyncFoodCombobox";
import { FoodSubstitutionsList } from "@/components/nutrition/FoodSubstitutionsList";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Copy,
  Eye,
  LayoutGrid,
  Pencil,
  Plus,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Food,
  getFoodByIdSafe,
  macroScaleFactor,
  QuantityUnit,
} from "@/lib/foodService";
import { normalizePlanoLetter } from "@/lib/diet-plano";
import {
  buildMealGroups,
  calcularMacros,
  dietHasMultiplosCardapios as dietHasMultiplosCardapiosFromGroups,
  getItemsForPlano,
  getPlanosFromGroups,
  type DietPlano,
} from "@/lib/diet-student-utils";
import {
  CARDAPIO_OPCOES,
  collectPlanosFromRefeicoes,
  dietHasMultiplosCardapios,
  getNextPlanoForMeal,
  getUsedPlanosForMeal,
  groupRefeicoesByMeal,
  isPlanoAvailableForMeal,
  mealBaseKey,
  planoVisualStyle,
  refeicoesToPreviewItens,
} from "@/lib/diet-creator-meals";
import type { DietRotationFormState } from "@/components/DietRotationFields";
import DietRotationBanner from "@/components/student/diet/DietRotationBanner";
import {
  getRotationForDate,
  isRotationEnabled,
  type DietRotationConfig,
} from "@/lib/diet-rotation";

export type ItemRefeicaoEditor = {
  id: string;
  alimento_id: string;
  quantidade: number;
  unidade_quantidade: QuantityUnit;
  refeicao: string;
  alimento?: Food;
};

export type RefeicaoEditor = {
  nome: string;
  plano: DietPlano | "";
  itens: ItemRefeicaoEditor[];
};

type Substituicao = { nome: string; quantidade: number; nutriente: string };

type TotaisRefeicao = {
  kcal: number;
  proteinas: number;
  carboidratos: number;
  lipidios: number;
};

export type DietCreatorMealsSectionProps = {
  refeicoes: RefeicaoEditor[];
  /** @deprecated Lista completa — preferir busca async no combobox */
  alimentos?: Food[];
  rotacao: DietRotationFormState;
  onRefeicoesChange: (next: RefeicaoEditor[]) => void;
  calcularSubstituicoes?: (item: ItemRefeicaoEditor) => Substituicao[];
  calcularTotaisRefeicao: (refeicao: RefeicaoEditor) => TotaisRefeicao;
  refeicaoLabel: (refeicao: RefeicaoEditor) => string;
  syncItensRefeicao: (refeicao: RefeicaoEditor) => RefeicaoEditor;
  emptyRefeicao: (nome: string) => RefeicaoEditor;
};

type ViewMode = "edit" | "preview";

function itemKcal(item: ItemRefeicaoEditor): number {
  if (!item.alimento) return 0;
  const qtd =
    typeof item.quantidade === "string"
      ? parseFloat(item.quantidade) || 0
      : item.quantidade || 0;
  const qtdRef = item.alimento.portion || 100;
  const f = macroScaleFactor(qtd, item.unidade_quantidade, qtdRef);
  return Math.round((item.alimento.calories || 0) * f);
}

type CreateMealDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refeicoes: RefeicaoEditor[];
  rotacao: DietRotationFormState;
  defaultNome?: string;
  lockNome?: boolean;
  title?: string;
  onConfirm: (nome: string, plano: DietPlano | "") => void;
};

function defaultPlanoForNewMeal(
  refeicoes: RefeicaoEditor[],
  rotacao: DietRotationFormState,
  nome: string,
): DietPlano | "" {
  const used = getUsedPlanosForMeal(refeicoes, nome);
  const hasPlanosNaDieta = collectPlanosFromRefeicoes(refeicoes).length > 0;
  const rotacaoAtiva = rotacao.rotacao_ativa;

  if (!rotacaoAtiva && !hasPlanosNaDieta && used.size === 0) {
    return "";
  }

  for (const letter of CARDAPIO_OPCOES) {
    if (!used.has(letter)) return letter;
  }
  return "";
}

function CreateMealDialog({
  open,
  onOpenChange,
  refeicoes,
  rotacao,
  defaultNome = "",
  lockNome = false,
  title = "Nova refeição",
  onConfirm,
}: CreateMealDialogProps) {
  const [nome, setNome] = useState(defaultNome);
  const [plano, setPlano] = useState<DietPlano | "">("");

  useEffect(() => {
    if (open) {
      const initialNome = defaultNome.trim() || `Refeição ${refeicoes.length + 1}`;
      setNome(initialNome);
      setPlano(defaultPlanoForNewMeal(refeicoes, rotacao, initialNome));
    }
  }, [open, defaultNome, refeicoes, rotacao]);

  const usedPlanos = useMemo(
    () => getUsedPlanosForMeal(refeicoes, nome),
    [refeicoes, nome],
  );

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
  };

  const handleSubmit = () => {
    const trimmed = nome.trim();
    if (!trimmed) return;
    if (usedPlanos.has(plano)) return;
    onConfirm(trimmed, plano);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Defina o horário e a qual cardápio (A, B, C…) esta refeição pertence.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="nova-refeicao-nome">Nome da refeição</Label>
            <Input
              id="nova-refeicao-nome"
              value={nome}
              onChange={(e) => {
                const next = e.target.value;
                setNome(next);
                if (!lockNome) {
                  setPlano((prev) => {
                    const used = getUsedPlanosForMeal(refeicoes, next);
                    if (prev && !used.has(prev)) return prev;
                    return defaultPlanoForNewMeal(refeicoes, rotacao, next);
                  });
                }
              }}
              placeholder="Ex: Almoço, Lanche da tarde"
              disabled={lockNome}
              autoFocus={!lockNome}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nova-refeicao-cardapio">Cardápio</Label>
            <Select
              value={plano || "__none__"}
              onValueChange={(v) =>
                setPlano(v === "__none__" ? "" : normalizePlanoLetter(v) || "")
              }
            >
              <SelectTrigger id="nova-refeicao-cardapio">
                <SelectValue placeholder="Escolha o cardápio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" disabled={usedPlanos.has("")}>
                  Sem cardápio (todos os dias)
                </SelectItem>
                {CARDAPIO_OPCOES.map((letra) => {
                  const used = usedPlanos.has(letra);
                  return (
                    <SelectItem key={letra} value={letra} disabled={used}>
                      Cardápio {letra}
                      {used ? " — já existe nesta refeição" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {plano ? (
              <Badge variant="outline" className={planoVisualStyle(plano).badge}>
                Plano {plano}
              </Badge>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sem cardápio: o aluno vê esta refeição em todos os planos.
              </p>
            )}
            {rotacao.rotacao_ativa ? (
              <p className="text-xs text-muted-foreground">
                Com rotação activa, use os mesmos cardápios definidos no ciclo (A, B…).
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!nome.trim() || usedPlanos.has(plano)}
          >
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MealSlotEditor({
  refeicao,
  refeicaoIndex,
  canRemoveSlot,
  calcularTotaisRefeicao,
  onPlanoChange,
  onRemoveSlot,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onDuplicateCardapio,
}: {
  refeicao: RefeicaoEditor;
  refeicaoIndex: number;
  canRemoveSlot: boolean;
  calcularTotaisRefeicao: (refeicao: RefeicaoEditor) => TotaisRefeicao;
  onPlanoChange: (index: number, plano: DietPlano | "") => void;
  onRemoveSlot: (index: number) => void;
  onAddItem: (index: number) => void;
  onRemoveItem: (refIndex: number, itemIndex: number) => void;
  onUpdateItem: (
    refIndex: number,
    itemIndex: number,
    campo: keyof ItemRefeicaoEditor,
    valor: unknown,
    food?: Food | null,
  ) => void;
  onDuplicateCardapio: (index: number) => void;
}) {
  const style = planoVisualStyle(refeicao.plano);
  const totais = calcularTotaisRefeicao(refeicao);

  return (
    <div
      className={`rounded-xl border border-l-4 ${style.border} ${style.bg} p-4 space-y-3 min-w-0`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={refeicao.plano || "__none__"}
            onValueChange={(v) =>
              onPlanoChange(
                refeicaoIndex,
                v === "__none__" ? "" : normalizePlanoLetter(v) || "",
              )
            }
          >
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue placeholder="Cardápio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem cardápio</SelectItem>
              {CARDAPIO_OPCOES.map((letra) => (
                <SelectItem key={letra} value={letra}>
                  Cardápio {letra}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {refeicao.plano ? (
            <Badge variant="outline" className={style.badge}>
              Plano {refeicao.plano}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Todos os dias
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-xs">
            {Math.round(totais.kcal)} kcal
          </Badge>
          {canRemoveSlot ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onRemoveSlot(refeicaoIndex)}
              aria-label="Remover cardápio"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        {refeicao.itens.map((item, itemIndex) => (
          <div key={item.id} className="rounded-lg border bg-background/80 p-3 space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Alimento</Label>
                <AsyncFoodCombobox
                  value={item.alimento_id}
                  selectedLabel={item.alimento?.name}
                  onSelect={(foodId, food) => {
                    onUpdateItem(refeicaoIndex, itemIndex, "alimento_id", foodId, food);
                  }}
                  placeholder="Buscar alimento..."
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Quantidade</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    className="h-9"
                    value={item.quantidade}
                    onChange={(e) =>
                      onUpdateItem(
                        refeicaoIndex,
                        itemIndex,
                        "quantidade",
                        Number(e.target.value),
                      )
                    }
                  />
                  <Select
                    value={item.unidade_quantidade}
                    onValueChange={(v: QuantityUnit) =>
                      onUpdateItem(refeicaoIndex, itemIndex, "unidade_quantidade", v)
                    }
                  >
                    <SelectTrigger className="h-9 w-[72px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="ml">ml</SelectItem>
                      <SelectItem value="un">un.</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-end justify-between gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Calorias</Label>
                  <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm">
                    {itemKcal(item)}
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => onRemoveItem(refeicaoIndex, itemIndex)}
                  aria-label="Remover alimento"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {item.alimento ? (
              <FoodSubstitutionsList item={item} />
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onAddItem(refeicaoIndex)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Alimento
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 text-muted-foreground"
          onClick={() => onDuplicateCardapio(refeicaoIndex)}
        >
          <Copy className="h-4 w-4 mr-1" />
          Duplicar cardápio
        </Button>
      </div>
    </div>
  );
}

function PreviewMealsList({
  refeicoes,
  rotacao,
  planoAtivo,
  onPlanoChange,
}: {
  refeicoes: RefeicaoEditor[];
  rotacao: DietRotationFormState;
  planoAtivo: DietPlano;
  onPlanoChange: (p: DietPlano) => void;
}) {
  const previewItens = useMemo(() => refeicoesToPreviewItens(refeicoes), [refeicoes]);
  const mealGroups = useMemo(() => buildMealGroups(previewItens), [previewItens]);
  const planosCardapio = useMemo(() => getPlanosFromGroups(mealGroups), [mealGroups]);
  const hasMulti = useMemo(
    () => dietHasMultiplosCardapiosFromGroups(mealGroups),
    [mealGroups],
  );

  const rotationConfig = useMemo((): DietRotationConfig => ({
    rotacao_ativa: rotacao.rotacao_ativa,
    rotacao_sequencia: rotacao.blocos.map((b) => ({
      plano: normalizePlanoLetter(b.plano) || "A",
      dias: parseInt(b.dias, 10) || 0,
    })),
    rotacao_data_inicio: rotacao.rotacao_data_inicio || null,
  }), [rotacao]);

  const rotationToday = useMemo(
    () => (isRotationEnabled(rotationConfig) ? getRotationForDate(rotationConfig) : null),
    [rotationConfig],
  );

  const rotationActive = Boolean(rotationToday);
  const effectivePlano = rotationToday?.plano ?? planoAtivo;
  const showPlanoTabs = !rotationActive && planosCardapio.length >= 2;

  const visibleGroups = useMemo(
    () =>
      mealGroups.filter(
        (g) =>
          getItemsForPlano(g, effectivePlano, { dietHasMultiplosCardapios: hasMulti }).length > 0,
      ),
    [mealGroups, effectivePlano, hasMulti],
  );

  const macros = useMemo(() => {
    const itens = visibleGroups.flatMap((g) =>
      getItemsForPlano(g, effectivePlano, { dietHasMultiplosCardapios: hasMulti }),
    );
    return calcularMacros(itens);
  }, [visibleGroups, effectivePlano, hasMulti]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.03] px-4 py-3">
        <p className="text-sm font-medium flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          Pré-visualização — como o aluno vê hoje
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {rotationActive
            ? "Com rotação activa, o aluno vê automaticamente o cardápio do dia."
            : hasMulti
              ? "Alterne entre os planos para rever cada cardápio completo."
              : "Refeições sem cardápio aparecem todos os dias."}
        </p>
      </div>

      {rotationToday ? <DietRotationBanner info={rotationToday} /> : null}

      {showPlanoTabs ? (
        <Tabs
          value={planoAtivo}
          onValueChange={(v) => onPlanoChange(v as DietPlano)}
          className="w-full"
        >
          <TabsList
            className="grid h-auto w-full gap-1"
            style={{
              gridTemplateColumns: `repeat(${Math.min(planosCardapio.length, 6)}, minmax(0, 1fr))`,
            }}
          >
            {planosCardapio.map((p) => (
              <TabsTrigger key={p} value={p} className="text-xs sm:text-sm">
                Plano {p}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
            ["Calorias", `${Math.round(macros.kcal)}`, "text-primary"],
            ["Proteínas", `${Math.round(macros.proteinas)}g`, "text-primary"],
            ["Carboidratos", `${Math.round(macros.carboidratos)}g`, "text-warning"],
            ["Lipídios", `${Math.round(macros.lipidios)}g`, "text-destructive"],
          ] as const
        ).map(([label, value, color]) => (
          <div key={label} className="rounded-lg border bg-muted/30 p-3 text-center">
            <div className={`text-lg font-bold ${color}`}>{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {visibleGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum alimento neste plano. Adicione itens no modo Editar.
        </p>
      ) : (
        <div className="space-y-3">
          {visibleGroups.map((group) => {
            const items = getItemsForPlano(group, effectivePlano, {
              dietHasMultiplosCardapios: hasMulti,
            });
            return (
              <Card key={group.key} className="overflow-hidden">
                <CardHeader className="py-3 px-4 bg-muted/20">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                    {group.displayName}
                    {hasMulti ? (
                      <Badge variant="secondary" className="text-xs font-normal">
                        Plano {effectivePlano}
                      </Badge>
                    ) : null}
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-3 px-4">
                  <ul className="space-y-2">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between text-sm gap-2"
                      >
                        <span className="truncate">
                          {item.alimentos?.name ?? "Alimento"}
                        </span>
                        <span className="text-muted-foreground shrink-0">
                          {item.quantidade}
                          {item.unidade_quantidade || "g"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DietCreatorMealsSection({
  refeicoes,
  alimentos = [],
  rotacao,
  onRefeicoesChange,
  calcularTotaisRefeicao,
  refeicaoLabel,
  syncItensRefeicao,
  emptyRefeicao,
}: DietCreatorMealsSectionProps) {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [previewPlano, setPreviewPlano] = useState<DietPlano>("A");
  const [createMealOpen, setCreateMealOpen] = useState(false);
  const [createMealContext, setCreateMealContext] = useState<{
    defaultNome?: string;
    lockNome?: boolean;
    title?: string;
  }>({});

  const groups = useMemo(() => groupRefeicoesByMeal(refeicoes), [refeicoes]);
  const planos = useMemo(() => collectPlanosFromRefeicoes(refeicoes), [refeicoes]);
  const hasMulti = dietHasMultiplosCardapios(refeicoes);

  const editarNomeGrupo = (groupKey: string, novoNome: string) => {
    onRefeicoesChange(
      refeicoes.map((r) =>
        mealBaseKey(r.nome) === groupKey
          ? syncItensRefeicao({ ...r, nome: novoNome })
          : r,
      ),
    );
  };

  const editarPlanoRefeicao = (refeicaoIndex: number, plano: DietPlano | "") => {
    const next = [...refeicoes];
    next[refeicaoIndex] = syncItensRefeicao({ ...next[refeicaoIndex], plano });
    onRefeicoesChange(next);
  };

  const adicionarItem = (refeicaoIndex: number) => {
    const ref = refeicoes[refeicaoIndex];
    const novoItem: ItemRefeicaoEditor = {
      id: Math.random().toString(36).slice(2, 11),
      alimento_id: "",
      quantidade: 100,
      unidade_quantidade: "g",
      refeicao: refeicaoLabel(ref),
    };
    const next = [...refeicoes];
    next[refeicaoIndex] = { ...next[refeicaoIndex], itens: [...next[refeicaoIndex].itens, novoItem] };
    onRefeicoesChange(next);
  };

  const removerItem = (refeicaoIndex: number, itemIndex: number) => {
    const next = [...refeicoes];
    next[refeicaoIndex].itens.splice(itemIndex, 1);
    onRefeicoesChange(next);
  };

  const atualizarItem = (
    refeicaoIndex: number,
    itemIndex: number,
    campo: keyof ItemRefeicaoEditor,
    valor: unknown,
    food?: Food | null,
  ) => {
    const next = [...refeicoes];
    next[refeicaoIndex].itens[itemIndex] = {
      ...next[refeicaoIndex].itens[itemIndex],
      [campo]: valor,
    } as ItemRefeicaoEditor;

    if (campo === "alimento_id") {
      if (food) {
        next[refeicaoIndex].itens[itemIndex].alimento = food;
      } else {
        const cached = alimentos.find((a) => a.id === valor);
        if (cached) {
          next[refeicaoIndex].itens[itemIndex].alimento = cached;
        } else if (typeof valor === "string" && valor) {
          void getFoodByIdSafe(valor).then((res) => {
            if (res.success && res.data) {
              const updated = [...refeicoes];
              const item = updated[refeicaoIndex]?.itens[itemIndex];
              if (item && item.alimento_id === valor) {
                updated[refeicaoIndex].itens[itemIndex] = { ...item, alimento: res.data };
                onRefeicoesChange(updated);
              }
            }
          });
        }
      }
    }

    onRefeicoesChange(next);
  };

  const removerRefeicao = (refeicaoIndex: number) => {
    if (refeicoes.length <= 1) return;
    onRefeicoesChange(refeicoes.filter((_, i) => i !== refeicaoIndex));
  };

  const confirmarNovaRefeicao = (nome: string, plano: DietPlano | "") => {
    if (!isPlanoAvailableForMeal(refeicoes, nome, plano)) {
      toast({
        variant: "destructive",
        title: "Cardápio indisponível",
        description: plano
          ? `O cardápio ${plano} já existe para "${nome}".`
          : `Já existe uma versão sem cardápio para "${nome}".`,
      });
      return;
    }

    onRefeicoesChange([
      ...refeicoes,
      syncItensRefeicao({ ...emptyRefeicao(nome), plano }),
    ]);
  };

  const abrirDialogNovaRefeicao = () => {
    setCreateMealContext({});
    setCreateMealOpen(true);
  };

  const abrirDialogNovoCardapio = (displayName: string) => {
    setCreateMealContext({
      defaultNome: displayName,
      lockNome: true,
      title: `Novo cardápio — ${displayName}`,
    });
    setCreateMealOpen(true);
  };

  const duplicarCardapio = (refeicaoIndex: number, copiarItens = true) => {
    const ref = refeicoes[refeicaoIndex];
    const key = mealBaseKey(ref.nome);
    const nextPlano = getNextPlanoForMeal(refeicoes, key);
    if (!nextPlano) {
      toast({
        variant: "destructive",
        title: "Limite de cardápios",
        description: "Esta refeição já usa todos os cardápios A–H.",
      });
      return;
    }

    const novo = syncItensRefeicao({
      nome: ref.nome,
      plano: nextPlano,
      itens: copiarItens
        ? ref.itens.map((item) => ({
            ...item,
            id: Math.random().toString(36).slice(2, 11),
          }))
        : [],
    });

    const next = [...refeicoes];
    const insertAt = refeicaoIndex + 1;
    next.splice(insertAt, 0, novo);
    onRefeicoesChange(next);

    toast({
      title: `Cardápio ${nextPlano} criado`,
      description: copiarItens
        ? "Itens copiados — ajuste conforme necessário."
        : "Cardápio vazio adicionado ao lado.",
    });
  };

  const adicionarCardapioGrupo = (displayName: string) => {
    abrirDialogNovoCardapio(displayName);
  };

  return (
    <div className="space-y-4">
      <CreateMealDialog
        open={createMealOpen}
        onOpenChange={setCreateMealOpen}
        refeicoes={refeicoes}
        rotacao={rotacao}
        defaultNome={createMealContext.defaultNome ?? ""}
        lockNome={createMealContext.lockNome}
        title={createMealContext.title}
        onConfirm={confirmarNovaRefeicao}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-muted-foreground" />
            Refeições
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            {hasMulti
              ? "Refeições com o mesmo nome ficam agrupadas. Cada coluna é um cardápio (A, B, C…)."
              : rotacao.rotacao_ativa
                ? "Active a rotação acima e atribua cardápios às refeições para alternar A/B ao longo da semana."
                : "Use cardápios A/B quando o aluno alterna opções no mesmo horário."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex rounded-lg border p-0.5 bg-muted/40">
            <Button
              type="button"
              variant={viewMode === "edit" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setViewMode("edit")}
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
            <Button
              type="button"
              variant={viewMode === "preview" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setViewMode("preview")}
            >
              <Eye className="h-3.5 w-3.5" />
              Pré-visualizar
            </Button>
          </div>
          {viewMode === "edit" ? (
            <Button onClick={abrirDialogNovaRefeicao} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Refeição
            </Button>
          ) : null}
        </div>
      </div>

      {hasMulti && viewMode === "edit" ? (
        <div className="flex flex-wrap gap-2">
          {planos.map((p) => {
            const s = planoVisualStyle(p);
            return (
              <Badge key={p} variant="outline" className={s.badge}>
                Plano {p}
              </Badge>
            );
          })}
        </div>
      ) : null}

      {viewMode === "preview" ? (
        <PreviewMealsList
          refeicoes={refeicoes}
          rotacao={rotacao}
          planoAtivo={previewPlano}
          onPlanoChange={setPreviewPlano}
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => {
            const multiSlot = group.slots.length > 1 || group.slots.some((s) => s.refeicao.plano);
            const gridCols =
              group.slots.length >= 3
                ? "grid-cols-1 lg:grid-cols-3"
                : group.slots.length === 2
                  ? "grid-cols-1 md:grid-cols-2"
                  : "grid-cols-1";

            return (
              <Card key={group.key} className="overflow-hidden">
                <CardHeader className="pb-3 bg-muted/15">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                      <Input
                        value={group.displayName}
                        onChange={(e) => editarNomeGrupo(group.key, e.target.value)}
                        className="font-semibold bg-transparent border-none p-0 h-auto text-lg min-w-[140px] max-w-md"
                        aria-label="Nome da refeição"
                      />
                      {multiSlot ? (
                        <Badge variant="secondary" className="text-xs">
                          {group.slots.length} cardápio{group.slots.length > 1 ? "s" : ""}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => adicionarCardapioGrupo(group.displayName)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Cardápio
                      </Button>
                      {refeicoes.length > 1 && group.slots.length === 1 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removerRefeicao(group.slots[0].index)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remover
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className={`grid gap-4 ${gridCols}`}>
                    {group.slots.map(({ index, refeicao }) => (
                      <MealSlotEditor
                        key={`${group.key}-${index}-${refeicao.plano}`}
                        refeicao={refeicao}
                        refeicaoIndex={index}
                        canRemoveSlot={refeicoes.length > 1}
                        calcularTotaisRefeicao={calcularTotaisRefeicao}
                        onPlanoChange={editarPlanoRefeicao}
                        onRemoveSlot={removerRefeicao}
                        onAddItem={adicionarItem}
                        onRemoveItem={removerItem}
                        onUpdateItem={atualizarItem}
                        onDuplicateCardapio={(i) => duplicarCardapio(i, true)}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DietCreatorMealsSection;
