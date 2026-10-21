import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Utensils, Replace, Pill, Check } from "lucide-react";
import FoodSubstitutionDialog from "@/components/nutrition/FoodSubstitutionDialog";
import { trackStudentEvent } from "@/lib/studentAnalytics";
import { toast } from "sonner";

const MEAL_EATEN_KEY = "bh_meals_eaten_v1";

function normalizeMealName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Retorna score: menor = mais “agora”. */
function mealNowScore(refeicao: string, hour: number): number {
  const n = normalizeMealName(refeicao);
  const windows: { match: RegExp; start: number; end: number }[] = [
    { match: /cafe|manha(?!.*lanche)/, start: 5, end: 10 },
    { match: /lanche.*manha|colacao/, start: 9, end: 11 },
    { match: /almoco/, start: 11, end: 15 },
    { match: /lanche(?!.*manha)|tarde/, start: 15, end: 18 },
    { match: /jantar|janta/, start: 18, end: 22 },
    { match: /ceia/, start: 21, end: 24 },
  ];

  for (const w of windows) {
    if (w.match.test(n)) {
      if (hour >= w.start && hour < w.end) return 0;
      const mid = (w.start + w.end) / 2;
      return Math.abs(hour - mid);
    }
  }
  return 50;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadEaten(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(MEAL_EATEN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed?.date !== todayKey()) return {};
    return parsed.meals || {};
  } catch {
    return {};
  }
}

function saveEaten(meals: Record<string, boolean>) {
  localStorage.setItem(
    MEAL_EATEN_KEY,
    JSON.stringify({ date: todayKey(), meals })
  );
}

const StudentDietView = () => {
  const { user } = useAuth();
  const [dieta, setDieta] = useState<any>(null);
  const [itensDieta, setItensDieta] = useState<any[]>([]);
  const [farmacos, setFarmacos] = useState<any[]>([]);
  const [todosAlimentos, setTodosAlimentos] = useState<any[]>([]);
  const [savingSub, setSavingSub] = useState(false);
  const [eaten, setEaten] = useState<Record<string, boolean>>(loadEaten);
  const [substitutionDialog, setSubstitutionDialog] = useState<{
    open: boolean;
    alimentoAtual: any;
    quantidadeAtual: number;
    itemId: string;
  }>({
    open: false,
    alimentoAtual: null,
    quantidadeAtual: 0,
    itemId: "",
  });

  useEffect(() => {
    if (user) loadDietData();
  }, [user]);

  const loadDietData = async () => {
    try {
      const { data: alimentosData } = await supabase
        .from("alimentos")
        .select("*")
        .order("nome");

      setTodosAlimentos(alimentosData || []);

      const { data: aluno } = await supabase
        .from("alunos")
        .select("id")
        .eq("email", user?.email)
        .maybeSingle();

      if (!aluno) return;

      const { data: dietaData } = await supabase
        .from("dietas")
        .select("*")
        .eq("aluno_id", aluno.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!dietaData) return;

      setDieta(dietaData);

      const [{ data: itens }, { data: farmacosData }] = await Promise.all([
        supabase
          .from("itens_dieta")
          .select("*, alimentos(*)")
          .eq("dieta_id", dietaData.id),
        supabase.from("dieta_farmacos").select("*").eq("dieta_id", dietaData.id),
      ]);

      setItensDieta(itens || []);
      setFarmacos(farmacosData || []);
    } catch (error) {
      console.error("Erro ao carregar dieta:", error);
    }
  };

  const agruparPorRefeicao = (itens: any[]) => {
    const refeicoes: { [key: string]: any[] } = {};
    itens.forEach((item) => {
      if (!refeicoes[item.refeicao]) refeicoes[item.refeicao] = [];
      refeicoes[item.refeicao].push(item);
    });
    return refeicoes;
  };

  const calcularMacros = (itens: any[]) =>
    itens.reduce(
      (total, item) => {
        if (!item.alimentos) return total;
        const fator = item.quantidade / item.alimentos.quantidade_referencia_g;
        return {
          totalCalorias:
            total.totalCalorias + item.alimentos.kcal_por_referencia * fator,
          totalProteinas:
            total.totalProteinas + item.alimentos.ptn_por_referencia * fator,
          totalCarboidratos:
            total.totalCarboidratos + item.alimentos.cho_por_referencia * fator,
          totalLipidios:
            total.totalLipidios + item.alimentos.lip_por_referencia * fator,
        };
      },
      {
        totalCalorias: 0,
        totalProteinas: 0,
        totalCarboidratos: 0,
        totalLipidios: 0,
      }
    );

  const handleVerSubstitutos = (item: any) => {
    setSubstitutionDialog({
      open: true,
      alimentoAtual: item.alimentos,
      quantidadeAtual: item.quantidade,
      itemId: item.id,
    });
  };

  const handleSubstituir = async (
    novoAlimentoId: string,
    novaQuantidade: number
  ) => {
    const itemId = substitutionDialog.itemId;
    const qtd = Math.max(1, Math.round(novaQuantidade));

    trackStudentEvent("diet_sub_applied", {
      item_id: itemId,
      persisted: false,
    });

    // Otimistic UI
    const novoAlimento = todosAlimentos.find((a) => a.id === novoAlimentoId);
    setItensDieta((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              alimento_id: novoAlimentoId,
              quantidade: qtd,
              alimentos: novoAlimento,
            }
          : item
      )
    );

    setSavingSub(true);
    try {
      const { error } = await supabase
        .from("itens_dieta")
        .update({
          alimento_id: novoAlimentoId,
          quantidade: qtd,
        })
        .eq("id", itemId);

      if (error) throw error;

      trackStudentEvent("diet_sub_persisted", { item_id: itemId });
      toast.success("Substituição salva no seu cardápio.");
    } catch (error: any) {
      console.error("Erro ao persistir substituição:", error);
      toast.error(
        "Troca aplicada na tela, mas não foi possível salvar. Tente de novo."
      );
      await loadDietData();
    } finally {
      setSavingSub(false);
    }
  };

  const toggleEaten = (refeicao: string, checked: boolean) => {
    setEaten((prev) => {
      const next = { ...prev, [refeicao]: checked };
      saveEaten(next);
      return next;
    });
  };

  const refeicoes = agruparPorRefeicao(itensDieta);
  const hour = new Date().getHours();

  const orderedMeals = useMemo(() => {
    return Object.entries(refeicoes).sort(
      ([a], [b]) => mealNowScore(a, hour) - mealNowScore(b, hour)
    );
  }, [refeicoes, hour]);

  const currentMealName = orderedMeals[0]?.[0];
  const macros = calcularMacros(itensDieta);

  if (!dieta) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Utensils className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma dieta atribuída</h3>
          <p className="text-muted-foreground">
            Entre em contato com seu coach para receber sua dieta personalizada
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-1">Minha Dieta</h1>
        <p className="text-muted-foreground">{dieta.nome}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">
                {Math.round(macros.totalCalorias)}
              </div>
              <div className="text-sm text-muted-foreground">Calorias</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {Math.round(macros.totalProteinas)}g
              </div>
              <div className="text-sm text-muted-foreground">Proteínas</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {Math.round(macros.totalCarboidratos)}g
              </div>
              <div className="text-sm text-muted-foreground">Carboidratos</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {Math.round(macros.totalLipidios)}g
              </div>
              <div className="text-sm text-muted-foreground">Gorduras</div>
            </div>
          </div>
          {(dieta.objetivo || dieta.created_at) && (
            <p className="text-xs text-muted-foreground mt-4 text-center">
              {dieta.objetivo ? `Objetivo: ${dieta.objetivo}` : null}
              {dieta.objetivo && dieta.created_at ? " · " : null}
              {dieta.created_at
                ? `Criada em ${new Date(dieta.created_at).toLocaleDateString("pt-BR")}`
                : null}
            </p>
          )}
        </CardContent>
      </Card>

      {farmacos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Pill className="h-5 w-5 text-primary" />
              Fármacos e suplementos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {farmacos.map((farmaco) => (
              <div key={farmaco.id} className="border rounded-lg p-3 space-y-1">
                <div className="font-semibold">{farmaco.nome}</div>
                <div className="text-sm text-muted-foreground">
                  {farmaco.dosagem}
                </div>
                {farmaco.observacao && (
                  <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                    {farmaco.observacao}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {orderedMeals.map(([refeicao, itensRefeicao]) => {
          const isNow = refeicao === currentMealName;
          const isEaten = !!eaten[refeicao];

          return (
            <Card
              key={refeicao}
              className={
                isNow
                  ? "border-primary/40 bg-primary/5"
                  : isEaten
                    ? "opacity-70"
                    : undefined
              }
            >
              <CardHeader className="pb-3 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg flex items-center gap-2 min-w-0">
                    <Utensils className="h-5 w-5 text-primary shrink-0" />
                    <span className="truncate">{refeicao}</span>
                  </CardTitle>
                  {isNow && (
                    <Badge variant="premium" className="shrink-0">
                      Agora
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`eaten-${refeicao}`}
                    checked={isEaten}
                    onCheckedChange={(v) => toggleEaten(refeicao, v === true)}
                  />
                  <Label
                    htmlFor={`eaten-${refeicao}`}
                    className="text-sm font-normal cursor-pointer flex items-center gap-1"
                  >
                    {isEaten ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-primary" />
                        Comi esta refeição
                      </>
                    ) : (
                      "Marcar como feita"
                    )}
                  </Label>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {itensRefeicao.map((item: any) => {
                    if (!item.alimentos) return null;
                    const fator =
                      item.quantidade / item.alimentos.quantidade_referencia_g;
                    const calorias = Math.round(
                      item.alimentos.kcal_por_referencia * fator
                    );

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-base">
                            {item.alimentos.nome}
                          </div>
                          <div className="text-sm text-muted-foreground mt-0.5">
                            {item.quantidade}g · {calorias} kcal
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          className="w-full sm:w-auto min-h-[44px]"
                          disabled={savingSub}
                          onClick={() => handleVerSubstitutos(item)}
                        >
                          <Replace className="w-4 h-4 mr-2" />
                          Substitutos
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <FoodSubstitutionDialog
        open={substitutionDialog.open}
        onOpenChange={(open) =>
          setSubstitutionDialog({ ...substitutionDialog, open })
        }
        alimentoAtual={substitutionDialog.alimentoAtual}
        quantidadeAtual={substitutionDialog.quantidadeAtual}
        alimentosDisponiveis={todosAlimentos}
        onSubstituir={handleSubstituir}
      />
    </div>
  );
};

export default StudentDietView;
