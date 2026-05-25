import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { Utensils, Pill } from "lucide-react";
import FoodSubstitutionDialog from "@/components/nutrition/FoodSubstitutionDialog";
import { Food, getAllFoodsSafe } from "@/lib/foodService";
import {
  buildMealGroups,
  calcularMacros,
  countCompletedMeals,
  dietHasPlanoAB,
  getItemsForPlano,
  pickActiveDieta,
  mealCheckDateKey,
  readMealDone,
  writeMealDone,
  type DietItemWithFood,
  type DietPlano,
  type MealGroup,
} from "@/lib/diet-student-utils";
import { MacroRingsRow } from "@/components/student/diet/MacroRing";
import MealTimelineItem from "@/components/student/diet/MealTimelineItem";
import MealDetailSheet from "@/components/student/diet/MealDetailSheet";
import PremiumEmptyState from "@/components/student/PremiumEmptyState";
import DietRotationBanner from "@/components/student/diet/DietRotationBanner";
import {
  getRotationForDate,
  isRotationEnabled,
  type DietRotationConfig,
} from "@/lib/diet-rotation";

const StudentDietView = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dieta, setDieta] = useState<any>(null);
  const [itensDieta, setItensDieta] = useState<DietItemWithFood[]>([]);
  const [farmacos, setFarmacos] = useState<any[]>([]);
  const [todosAlimentos, setTodosAlimentos] = useState<Food[]>([]);
  const [planoAtivo, setPlanoAtivo] = useState<DietPlano>("A");
  const [checkTick, setCheckTick] = useState(0);
  const mealDayRef = useRef(mealCheckDateKey());
  const [detailMeal, setDetailMeal] = useState<MealGroup | null>(null);

  /** Reinicia o checklist quando muda o dia (dieta diária). */
  useEffect(() => {
    const syncDay = () => {
      const today = mealCheckDateKey();
      if (mealDayRef.current !== today) {
        mealDayRef.current = today;
        setCheckTick((t) => t + 1);
      }
    };
    syncDay();
    document.addEventListener("visibilitychange", syncDay);
    const interval = window.setInterval(syncDay, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", syncDay);
      window.clearInterval(interval);
    };
  }, []);
  const [substitutionDialog, setSubstitutionDialog] = useState<{
    open: boolean;
    alimentoAtual: any;
    quantidadeAtual: number;
    unidadeQuantidade: string;
    itemId: string;
  }>({
    open: false,
    alimentoAtual: null,
    quantidadeAtual: 0,
    unidadeQuantidade: "g",
    itemId: "",
  });

  const loadDietData = useCallback(async () => {
    setLoading(true);
    const alimentosResult = await getAllFoodsSafe();
    const alimentosData =
      alimentosResult.success && Array.isArray(alimentosResult.data) ? alimentosResult.data : [];
    const alimentosOrdenados = alimentosData.sort((a, b) => a.name.localeCompare(b.name));
    setTodosAlimentos(alimentosOrdenados);

    const alunoResult = await apiClient.getMeSafe();
    const aluno = alunoResult.success ? alunoResult.data : null;

    if (!aluno) {
      setDieta(null);
      setItensDieta([]);
      setFarmacos([]);
      setLoading(false);
      return;
    }

    const dietasResult = await apiClient.requestSafe<any[]>("/api/dietas");
    const dietas = dietasResult.success && Array.isArray(dietasResult.data) ? dietasResult.data : [];
    const dietaData = pickActiveDieta(dietas, aluno.id);

    if (!dietaData) {
      setDieta(null);
      setItensDieta([]);
      setFarmacos([]);
      setLoading(false);
      return;
    }

    setDieta(dietaData);

    const [itensRes, farmacosRes] = await Promise.all([
      apiClient.requestSafe<any[]>(`/api/itens-dieta?dieta_id=${dietaData.id}`),
      apiClient.requestSafe<any[]>(`/api/dieta-farmacos?dieta_id=${dietaData.id}`),
    ]);

    const itensArray = itensRes.success && Array.isArray(itensRes.data) ? itensRes.data : [];
    const farmacosArray = farmacosRes.success && Array.isArray(farmacosRes.data) ? farmacosRes.data : [];

    const alimentosMap = new Map(alimentosData.map((a: Food) => [a.id, a]));
    const itensComAlimentos = itensArray.map((item: any) => ({
      ...item,
      alimentos: alimentosMap.get(item.alimento_id) || null,
    }));

    setItensDieta(itensComAlimentos);
    setFarmacos(farmacosArray);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      void loadDietData();
    }
  }, [user, loadDietData]);

  const mealGroups = useMemo(() => buildMealGroups(itensDieta), [itensDieta]);
  const rotationConfig = useMemo((): DietRotationConfig | null => {
    if (!dieta) return null;
    return {
      rotacao_ativa: dieta.rotacao_ativa,
      rotacao_dias_plano_a: dieta.rotacao_dias_plano_a,
      rotacao_dias_plano_b: dieta.rotacao_dias_plano_b,
      rotacao_plano_inicial: dieta.rotacao_plano_inicial,
      rotacao_data_inicio: dieta.rotacao_data_inicio,
      created_at: dieta.created_at,
    };
  }, [dieta]);

  const rotationToday = useMemo(
    () => (rotationConfig ? getRotationForDate(rotationConfig) : null),
    [rotationConfig],
  );

  const rotationActive = Boolean(rotationConfig && isRotationEnabled(rotationConfig));
  const showPlanoTabs = useMemo(
    () => !rotationActive && dietHasPlanoAB(mealGroups),
    [mealGroups, rotationActive],
  );

  useEffect(() => {
    if (rotationToday?.plano) {
      setPlanoAtivo(rotationToday.plano);
    }
  }, [rotationToday?.plano]);

  const visibleGroups = useMemo(
    () => mealGroups.filter((g) => getItemsForPlano(g, planoAtivo).length > 0),
    [mealGroups, planoAtivo],
  );

  const macrosPlano = useMemo(() => {
    const itens = visibleGroups.flatMap((g) => getItemsForPlano(g, planoAtivo));
    return calcularMacros(itens);
  }, [visibleGroups, planoAtivo]);

  const completedCount = useMemo(() => {
    if (!dieta?.id) return 0;
    void checkTick;
    return countCompletedMeals(dieta.id, visibleGroups, planoAtivo);
  }, [dieta?.id, visibleGroups, planoAtivo, checkTick]);

  const progressPct =
    visibleGroups.length > 0 ? Math.round((completedCount / visibleGroups.length) * 100) : 0;

  const firstPendingIdx = useMemo(() => {
    if (!dieta?.id) return 0;
    return visibleGroups.findIndex((g) => !readMealDone(dieta.id, g.key, planoAtivo));
  }, [dieta?.id, visibleGroups, planoAtivo, checkTick]);

  const toggleMealDone = (group: MealGroup) => {
    if (!dieta?.id) return;
    const current = readMealDone(dieta.id, group.key, planoAtivo);
    writeMealDone(dieta.id, group.key, planoAtivo, !current);
    setCheckTick((t) => t + 1);
  };

  const handleVerSubstitutos = (item: DietItemWithFood) => {
    setSubstitutionDialog({
      open: true,
      alimentoAtual: item.alimentos,
      quantidadeAtual: item.quantidade,
      unidadeQuantidade: item.unidade_quantidade || "g",
      itemId: item.id,
    });
  };

  const handleSubstituir = async (novoAlimentoId: string, novaQuantidade: number) => {
    const novosItens = itensDieta.map((item) => {
      if (item.id === substitutionDialog.itemId) {
        const novoAlimento = todosAlimentos.find((a) => a.id === novoAlimentoId);
        return {
          ...item,
          alimento_id: novoAlimentoId,
          quantidade: novaQuantidade,
          alimentos: novoAlimento ?? null,
        };
      }
      return item;
    });
    setItensDieta(novosItens);
  };

  if (loading) {
    return (
      <div className="min-w-0 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!dieta) {
    return (
      <PremiumEmptyState
        icon={Utensils}
        title="Nenhuma dieta atribuída"
        description="Quando o seu coach publicar o plano, ele aparece aqui com refeições, macros e checklist do dia."
      />
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <div>
        <h1 className="mb-1 text-2xl font-bold sm:text-3xl">Minha dieta</h1>
        <p className="text-muted-foreground">{dieta.nome}</p>
        {dieta.data_retorno && (
          <p className="mt-1 text-sm text-primary/90">
            Retorno{" "}
            {new Date(String(dieta.data_retorno).slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR")}
          </p>
        )}
      </div>

      {rotationToday && <DietRotationBanner info={rotationToday} />}

      {showPlanoTabs && (
        <Tabs
          value={planoAtivo}
          onValueChange={(v) => setPlanoAtivo(v as DietPlano)}
          className="w-full max-w-xs"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="A">Plano A</TabsTrigger>
            <TabsTrigger value="B">Plano B</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Progresso do dia</CardTitle>
            <Badge variant="premium">
              {completedCount}/{visibleGroups.length} refeições
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={progressPct} className="h-2" />
          <MacroRingsRow macros={macrosPlano} />
        </CardContent>
      </Card>

      {dieta.objetivo && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Objetivo:</span> {dieta.objetivo}
        </p>
      )}

      <div className="min-w-0">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Refeições de hoje
        </h2>
        {visibleGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item neste plano.</p>
        ) : (
          visibleGroups.map((group, idx) => (
            <MealTimelineItem
              key={`${group.key}-${planoAtivo}`}
              group={group}
              plano={planoAtivo}
              done={readMealDone(dieta.id, group.key, planoAtivo)}
              isLast={idx === visibleGroups.length - 1}
              isCurrent={idx === firstPendingIdx}
              onToggleDone={() => toggleMealDone(group)}
              onOpenDetail={() => setDetailMeal(group)}
            />
          ))
        )}
      </div>

      {farmacos.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Pill className="h-5 w-5 text-primary" />
              Fármacos e suplementos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {farmacos.map((farmaco) => (
              <div key={farmaco.id} className="rounded-lg border border-border/60 p-3">
                <p className="font-semibold">{farmaco.nome}</p>
                <p className="text-sm text-muted-foreground">{farmaco.dosagem}</p>
                {farmaco.observacao && (
                  <p className="mt-2 text-xs text-muted-foreground bg-muted/40 rounded p-2">
                    {farmaco.observacao}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <MealDetailSheet
        open={detailMeal != null}
        onOpenChange={(open) => !open && setDetailMeal(null)}
        mealName={detailMeal?.displayName ?? ""}
        plano={planoAtivo}
        items={detailMeal ? getItemsForPlano(detailMeal, planoAtivo) : []}
        onSubstituir={handleVerSubstitutos}
      />

      <FoodSubstitutionDialog
        open={substitutionDialog.open}
        onOpenChange={(open) => setSubstitutionDialog({ ...substitutionDialog, open })}
        alimentoAtual={substitutionDialog.alimentoAtual}
        quantidadeAtual={substitutionDialog.quantidadeAtual}
        unidadeQuantidade={substitutionDialog.unidadeQuantidade}
        alimentosDisponiveis={todosAlimentos}
        onSubstituir={handleSubstituir}
      />
    </div>
  );
};

export default StudentDietView;
