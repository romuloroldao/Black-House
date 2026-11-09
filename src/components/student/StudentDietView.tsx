import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { Utensils, Pill, Camera } from "lucide-react";
import FoodSubstitutionDialog from "@/components/nutrition/FoodSubstitutionDialog";
import { Food, getAllFoodsSafe } from "@/lib/foodService";
import {
  buildMealGroups,
  calcularMacros,
  countCompletedMeals,
  dietHasMultiplosCardapios,
  getItemsForPlano,
  getPlanosFromGroups,
  pickActiveDieta,
  mealCheckDateKey,
  readMealDone,
  writeMealDone,
  hydrateMealDoneFromServer,
  type DietItemWithFood,
  type DietPlano,
  type MealGroup,
} from "@/lib/diet-student-utils";
import { MacroRingsRow } from "@/components/student/diet/MacroRing";
import MealTimelineItem from "@/components/student/diet/MealTimelineItem";
import MealDetailSheet from "@/components/student/diet/MealDetailSheet";
import PremiumEmptyState from "@/components/student/PremiumEmptyState";
import DietRotationBanner from "@/components/student/diet/DietRotationBanner";
import StudentRefeicaoLivreCard from "@/components/student/StudentRefeicaoLivreCard";
import MealPhotoLogSheet from "@/components/student/meal-photo/MealPhotoLogSheet";
import RefeicoesRegistradasList from "@/components/student/meal-photo/RefeicoesRegistradasList";
import type { EducationalContent } from "@/lib/educational-content";
import {
  getRotationForDateKey,
  isRotationEnabled,
  type DietRotationConfig,
} from "@/lib/diet-rotation";
import { diffDateKeys, isDateKey, relativeDayLabel } from "@/lib/calendar-date";
import DietDayNavigator, {
  DIET_DAY_NAV_FUTURE,
  DIET_DAY_NAV_PAST,
} from "@/components/diet/DietDayNavigator";
import { STUDENT_REALTIME_EVENT, type StudentRealtimeDetail } from "@/hooks/useStudentPortalRealtime";
import FeatureOnboardingPanel, {
  FeatureOnboardingHelpButton,
} from "@/components/student/onboarding/FeatureOnboardingPanel";
import { useFeatureOnboarding } from "@/hooks/useFeatureOnboarding";

const StudentDietView = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [dieta, setDieta] = useState<any>(null);
  const [itensDieta, setItensDieta] = useState<DietItemWithFood[]>([]);
  const [farmacos, setFarmacos] = useState<any[]>([]);
  const [todosAlimentos, setTodosAlimentos] = useState<Food[]>([]);
  const [planoAtivo, setPlanoAtivo] = useState<DietPlano>("A");
  const [checkTick, setCheckTick] = useState(0);
  const dietaOnboarding = useFeatureOnboarding({
    onboardingId: "dieta-refeicao",
    enabled: !loading && Boolean(dieta),
    delayMs: 800,
  });
  const [serverDoneKeys, setServerDoneKeys] = useState<Set<string>>(() => new Set());
  const [todayKey, setTodayKey] = useState(() => mealCheckDateKey());
  const todayKeyRef = useRef(todayKey);
  /** Itens do plano sem as trocas do dia (as trocas valem só para hoje). */
  const [itensPlano, setItensPlano] = useState<DietItemWithFood[]>([]);
  const [detailMeal, setDetailMeal] = useState<MealGroup | null>(null);
  const [refeicaoLivreContent, setRefeicaoLivreContent] = useState<EducationalContent | null>(null);
  const [mealPhotoOpen, setMealPhotoOpen] = useState(false);
  const [mealHistoryKey, setMealHistoryKey] = useState(0);

  /** Deep-link do Daily Agent: ?meal_photo=1 */
  useEffect(() => {
    if (searchParams.get("meal_photo") === "1") {
      setMealPhotoOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("meal_photo");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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

  const loadDietData = useCallback(async ({ quiet = false }: { quiet?: boolean } = {}) => {
    if (!quiet) setLoading(true);
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

    if (dietaData.refeicao_livre_ativa && dietaData.refeicao_livre_content_id) {
      const contentRes = await apiClient.requestSafe<EducationalContent>(
        `/api/educational-contents/${dietaData.refeicao_livre_content_id}`,
      );
      setRefeicaoLivreContent(contentRes.success ? contentRes.data ?? null : null);
    } else {
      setRefeicaoLivreContent(null);
    }

    const [itensRes, farmacosRes] = await Promise.all([
      apiClient.requestSafe<any[]>(`/api/itens-dieta?dieta_id=${dietaData.id}`),
      apiClient.requestSafe<any[]>(`/api/dieta-farmacos?dieta_id=${dietaData.id}`),
    ]);

    const itensArray = itensRes.success && Array.isArray(itensRes.data) ? itensRes.data : [];
    const farmacosArray = farmacosRes.success && Array.isArray(farmacosRes.data) ? farmacosRes.data : [];

    const alimentosMap = new Map(alimentosData.map((a: Food) => [a.id, a]));
    let itensComAlimentos = itensArray.map((item: any) => ({
      ...item,
      alimentos: alimentosMap.get(item.alimento_id) || null,
    }));
    setItensPlano(itensComAlimentos);

    // Phase 4: aplicar overrides de substituição do dia (sem mutar o plano do coach)
    const substRes = await apiClient.getRefeicaoSubstituicoesSafe({
      date: mealCheckDateKey(),
      dieta_id: dietaData.id,
    });
    if (substRes.success && Array.isArray(substRes.data?.items)) {
      const byItem = new Map(
        substRes.data.items.map((s: any) => [String(s.item_dieta_id), s]),
      );
      itensComAlimentos = itensComAlimentos.map((item: any) => {
        const sub = byItem.get(String(item.id));
        if (!sub) return item;
        const food = alimentosMap.get(sub.alimento_substituto_id) || null;
        return {
          ...item,
          alimento_id: sub.alimento_substituto_id,
          quantidade: Number(sub.quantidade_substituto),
          unidade_quantidade: sub.unidade_substituto || item.unidade_quantidade,
          alimentos: food,
          _substituicao: {
            id: sub.id,
            alimento_original_id: sub.alimento_original_id,
            quantidade_original: sub.quantidade_original,
          },
        };
      });
    }

    setItensDieta(itensComAlimentos);
    setFarmacos(farmacosArray);

    // Phase 1a: carregar conclusões do servidor (fallback localStorage)
    const conclusoesRes = await apiClient.getRefeicaoConclusoesSafe(mealCheckDateKey());
    if (conclusoesRes.success && conclusoesRes.data?.items) {
      const keys = hydrateMealDoneFromServer(
        dietaData.id,
        conclusoesRes.data.items,
        conclusoesRes.data.data_ref || mealCheckDateKey(),
      );
      setServerDoneKeys(keys);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      void loadDietData();
    }
  }, [user, loadDietData]);

  /** Virada do dia (Brasília): novo plano do ciclo, checklist e trocas do novo dia. */
  useEffect(() => {
    const syncDay = () => {
      const today = mealCheckDateKey();
      if (todayKeyRef.current === today) return;
      todayKeyRef.current = today;
      setTodayKey(today);
      setCheckTick((t) => t + 1);
      void loadDietData({ quiet: true });
    };
    syncDay();
    document.addEventListener("visibilitychange", syncDay);
    const interval = window.setInterval(syncDay, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", syncDay);
      window.clearInterval(interval);
    };
  }, [loadDietData]);

  useEffect(() => {
    const onRealtime = (ev: Event) => {
      const detail = (ev as CustomEvent<StudentRealtimeDetail>).detail;
      if (detail?.type === 'dieta_atualizada') {
        void loadDietData({ quiet: true });
      }
    };
    window.addEventListener(STUDENT_REALTIME_EVENT, onRealtime);
    return () => window.removeEventListener(STUDENT_REALTIME_EVENT, onRealtime);
  }, [loadDietData]);

  const diaParam = searchParams.get("dia");
  const selectedKey = useMemo(() => {
    if (!isDateKey(diaParam)) return todayKey;
    const offset = diffDateKeys(todayKey, diaParam);
    return offset >= -DIET_DAY_NAV_PAST && offset <= DIET_DAY_NAV_FUTURE ? diaParam : todayKey;
  }, [diaParam, todayKey]);
  const isViewingToday = selectedKey === todayKey;
  const dayLabelLower = relativeDayLabel(selectedKey, todayKey).toLowerCase();

  const selectDay = useCallback(
    (key: string) => {
      const next = new URLSearchParams(searchParams);
      if (key === todayKeyRef.current) next.delete("dia");
      else next.set("dia", key);
      setSearchParams(next, { replace: true });
      setDetailMeal(null);
    },
    [searchParams, setSearchParams],
  );

  /** Hoje mostra as trocas do dia; outros dias mostram o plano do coach. */
  const itensDoDia = isViewingToday ? itensDieta : itensPlano;
  const mealGroups = useMemo(() => buildMealGroups(itensDoDia), [itensDoDia]);
  const planosCardapio = useMemo(() => getPlanosFromGroups(mealGroups), [mealGroups]);
  const hasMultiplosCardapios = useMemo(
    () => dietHasMultiplosCardapios(mealGroups),
    [mealGroups],
  );
  const rotationConfig = useMemo((): DietRotationConfig | null => {
    if (!dieta) return null;
    return {
      rotacao_ativa: dieta.rotacao_ativa,
      rotacao_sequencia: dieta.rotacao_sequencia,
      rotacao_dias_plano_a: dieta.rotacao_dias_plano_a,
      rotacao_dias_plano_b: dieta.rotacao_dias_plano_b,
      rotacao_plano_inicial: dieta.rotacao_plano_inicial,
      rotacao_data_inicio: dieta.rotacao_data_inicio,
      created_at: dieta.created_at,
    };
  }, [dieta]);

  const rotationActive = Boolean(rotationConfig && isRotationEnabled(rotationConfig));
  const rotationSelected = useMemo(
    () => (rotationConfig && rotationActive ? getRotationForDateKey(rotationConfig, selectedKey) : null),
    [rotationConfig, rotationActive, selectedKey],
  );
  const planoForDay = useCallback(
    (key: string) => (rotationConfig ? getRotationForDateKey(rotationConfig, key)?.plano ?? null : null),
    [rotationConfig],
  );
  const showPlanoTabs = useMemo(
    () => !rotationActive && planosCardapio.length >= 2,
    [planosCardapio.length, rotationActive],
  );

  /** Com rotação, o plano vem do dia escolhido; sem rotação, das abas. */
  const plano: DietPlano = rotationSelected?.plano ?? planoAtivo;

  /** O ciclo pede um plano que o cardápio não tem (ex.: B no ciclo, só A cadastrado). */
  const rotationMissingMeals =
    Boolean(rotationSelected) && planosCardapio.length > 0 && !planosCardapio.includes(plano);
  // Nesse caso só as refeições comuns a todos os dias (sem plano) valem para o dia.
  const filtrarPorPlano = hasMultiplosCardapios || rotationMissingMeals;

  const visibleGroups = useMemo(
    () =>
      mealGroups.filter(
        (g) => getItemsForPlano(g, plano, { dietHasMultiplosCardapios: filtrarPorPlano }).length > 0,
      ),
    [mealGroups, plano, filtrarPorPlano],
  );

  const macrosPlano = useMemo(() => {
    const itens = visibleGroups.flatMap((g) =>
      getItemsForPlano(g, plano, { dietHasMultiplosCardapios: filtrarPorPlano }),
    );
    return calcularMacros(itens);
  }, [visibleGroups, plano, filtrarPorPlano]);

  const completedCount = useMemo(() => {
    if (!dieta?.id) return 0;
    void checkTick;
    return countCompletedMeals(dieta.id, visibleGroups, plano, serverDoneKeys);
  }, [dieta?.id, visibleGroups, plano, checkTick, serverDoneKeys]);

  const progressPct =
    visibleGroups.length > 0 ? Math.round((completedCount / visibleGroups.length) * 100) : 0;

  const firstPendingIdx = useMemo(() => {
    if (!dieta?.id) return 0;
    return visibleGroups.findIndex((g) => {
      if (serverDoneKeys.has(`${g.key}::${plano}`)) return false;
      return !readMealDone(dieta.id, g.key, plano);
    });
  }, [dieta?.id, visibleGroups, plano, checkTick, serverDoneKeys]);

  const toggleMealDone = (group: MealGroup) => {
    if (!dieta?.id) return;
    const key = `${group.key}::${plano}`;
    const current =
      serverDoneKeys.has(key) || readMealDone(dieta.id, group.key, plano);
    const next = !current;
    writeMealDone(dieta.id, group.key, plano, next);
    setServerDoneKeys((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(key);
      else copy.delete(key);
      return copy;
    });
    setCheckTick((t) => t + 1);

    void apiClient
      .putRefeicaoConclusaoSafe({
        dieta_id: dieta.id,
        meal_key: group.key,
        plano: plano,
        concluido: next,
        data_ref: mealCheckDateKey(),
        origem: "ui",
      })
      .then((res) => {
        if (!res.success) {
          // reverte cache optimista em falha
          writeMealDone(dieta.id, group.key, plano, current);
          setServerDoneKeys((prev) => {
            const copy = new Set(prev);
            if (current) copy.add(key);
            else copy.delete(key);
            return copy;
          });
          setCheckTick((t) => t + 1);
        }
      });
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
    const itemId = substitutionDialog.itemId;
    const itemOriginal = itensDieta.find((i) => i.id === itemId);
    const novosItens = itensDieta.map((item) => {
      if (item.id === itemId) {
        const novoAlimento = todosAlimentos.find((a) => a.id === novoAlimentoId);
        return {
          ...item,
          alimento_id: novoAlimentoId,
          quantidade: novaQuantidade,
          alimentos: novoAlimento ?? item.alimentos,
          _substituicao: {
            alimento_original_id:
              (item as any)._substituicao?.alimento_original_id || itemOriginal?.alimento_id,
            quantidade_original:
              (item as any)._substituicao?.quantidade_original ?? itemOriginal?.quantidade,
          },
        };
      }
      return item;
    });
    setItensDieta(novosItens);

    if (dieta?.id && itemId) {
      const res = await apiClient.putRefeicaoSubstituicaoSafe({
        dieta_id: dieta.id,
        item_dieta_id: itemId,
        alimento_substituto_id: novoAlimentoId,
        quantidade_substituto: novaQuantidade,
        unidade_substituto: substitutionDialog.unidadeQuantidade || "g",
        quantidade_original: substitutionDialog.quantidadeAtual,
        unidade_original: substitutionDialog.unidadeQuantidade || "g",
        plano: plano,
        data_ref: mealCheckDateKey(),
        origem: "ui",
      });
      if (!res.success) {
        // reverte UI em falha
        void loadDietData();
      }
    }
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
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="mb-1 text-xl font-bold sm:text-2xl">Minha dieta</h1>
          <p className="text-muted-foreground">{dieta.nome}</p>
          {dieta.data_retorno && (
            <p className="mt-1 text-sm text-primary/90">
              Retorno{" "}
              {new Date(String(dieta.data_retorno).slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
        <FeatureOnboardingHelpButton onClick={dietaOnboarding.reopen} label="Como usar a dieta" />
      </div>

      {rotationSelected ? (
        <div className="space-y-3" data-onboarding="dieta-plano">
          <DietDayNavigator
            todayKey={todayKey}
            selectedKey={selectedKey}
            onSelect={selectDay}
            planoForDay={planoForDay}
            selectedDetail={
              rotationSelected.beforeStart
                ? `Plano ${rotationSelected.plano} · ciclo ainda não começou`
                : `Plano ${rotationSelected.plano} · dia ${rotationSelected.dayInBlock} de ${rotationSelected.blockLength}`
            }
          />
          <DietRotationBanner
            info={rotationSelected}
            dayLabel={relativeDayLabel(selectedKey, todayKey)}
            missingMealsMessage={
              rotationMissingMeals
                ? `O Plano ${plano} ainda não tem refeições cadastradas. Fale com o seu coach.`
                : null
            }
          />
        </div>
      ) : null}

      {/* Um bloco: regras + um CTA de foto + histórico (sem cartões/CTAs duplicados). */}
      {dieta.refeicao_livre_ativa ? (
        <StudentRefeicaoLivreCard
          observacao={dieta.refeicao_livre_observacao}
          contentId={dieta.refeicao_livre_content_id}
          contentTitle={refeicaoLivreContent?.title}
          onPhotograph={() => setMealPhotoOpen(true)}
          history={<RefeicoesRegistradasList refreshKey={mealHistoryKey} />}
        />
      ) : (
        <div className="space-y-3 rounded-xl border border-border/60 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Registo por foto</p>
              <p className="text-xs text-muted-foreground">
                Estimativa aproximada — útil para refeições fora do plano.
              </p>
            </div>
            <Button
              variant="outline"
              className="h-10 w-full shrink-0 sm:w-auto"
              onClick={() => setMealPhotoOpen(true)}
            >
              <Camera className="mr-2 h-4 w-4" aria-hidden />
              Fotografar
            </Button>
          </div>
          <RefeicoesRegistradasList refreshKey={mealHistoryKey} />
        </div>
      )}

      <MealPhotoLogSheet
        open={mealPhotoOpen}
        onOpenChange={setMealPhotoOpen}
        highlight={!!dieta.refeicao_livre_ativa}
        onSaved={() => setMealHistoryKey((k) => k + 1)}
      />

      {showPlanoTabs && (
        <div data-onboarding="dieta-plano">
          <Tabs
            value={planoAtivo}
            onValueChange={(v) => setPlanoAtivo(v as DietPlano)}
            className="w-full max-w-full"
          >
            <TabsList
              className="grid h-auto w-full gap-1"
              style={{ gridTemplateColumns: `repeat(${Math.min(planosCardapio.length, 6)}, minmax(0, 1fr))` }}
            >
              {planosCardapio.map((p) => (
                <TabsTrigger key={p} value={p} className="text-xs sm:text-sm">
                  Plano {p}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">
              {isViewingToday ? "Progresso do dia" : `Resumo · ${dayLabelLower}`}
            </CardTitle>
            <Badge variant="premium">
              {isViewingToday
                ? `${completedCount}/${visibleGroups.length} refeições`
                : `${visibleGroups.length} refeiç${visibleGroups.length === 1 ? "ão" : "ões"}`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isViewingToday ? <Progress value={progressPct} className="h-2" /> : null}
          <MacroRingsRow macros={macrosPlano} />
        </CardContent>
      </Card>

      {dieta.objetivo && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Objetivo:</span> {dieta.objetivo}
        </p>
      )}

      <div className="min-w-0" data-onboarding="dieta-refeicoes">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Refeições {isViewingToday ? "de hoje" : `· ${dayLabelLower}`}
        </h2>
        {!isViewingToday ? (
          <p className="mb-3 text-xs text-muted-foreground">
            Pré-visualização do cardápio. Marcar refeições e trocar alimentos fica disponível no próprio dia.
          </p>
        ) : null}
        {visibleGroups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
            {rotationMissingMeals
              ? `Sem refeições cadastradas para o Plano ${plano} neste dia.`
              : "Nenhuma refeição cadastrada neste plano."}{" "}
            Em caso de dúvida, fale com o seu coach.
          </div>
        ) : (
          visibleGroups.map((group, idx) => (
            <MealTimelineItem
              key={`${group.key}-${plano}`}
              group={group}
              plano={plano}
              dietHasMultiplosCardapios={filtrarPorPlano}
              done={
                serverDoneKeys.has(`${group.key}::${plano}`) ||
                readMealDone(dieta.id, group.key, plano)
              }
              isLast={idx === visibleGroups.length - 1}
              isCurrent={isViewingToday && idx === firstPendingIdx}
              readOnly={!isViewingToday}
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
        group={detailMeal}
        plano={plano}
        dietHasMultiplosCardapios={filtrarPorPlano}
        onSubstituir={isViewingToday ? handleVerSubstitutos : undefined}
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

      <FeatureOnboardingPanel
        open={dietaOnboarding.open}
        title={dietaOnboarding.definition?.title || "Dieta"}
        step={dietaOnboarding.step}
        stepIndex={dietaOnboarding.stepIndex}
        stepCount={dietaOnboarding.definition?.steps.length || 0}
        onNext={dietaOnboarding.next}
        onSkip={dietaOnboarding.skip}
        onDismissPermanently={dietaOnboarding.dismissPermanently}
        onClose={dietaOnboarding.skip}
      />
    </div>
  );
};

export default StudentDietView;
