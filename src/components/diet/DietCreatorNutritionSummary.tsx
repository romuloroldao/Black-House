import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator } from "lucide-react";
import {
  collectPlanosFromRefeicoes,
  dietHasMultiplosCardapios,
  type RefeicaoEditorShape,
} from "@/lib/diet-creator-meals";
import type { DietPlano } from "@/lib/diet-student-utils";

type Totais = {
  kcal: number;
  proteinas: number;
  carboidratos: number;
  lipidios: number;
};

type DietCreatorNutritionSummaryProps = {
  refeicoes: RefeicaoEditorShape[];
  calcularTotaisRefeicao: (refeicao: RefeicaoEditorShape) => Totais;
};

function refeicoesForPlano(
  refeicoes: RefeicaoEditorShape[],
  plano: DietPlano,
  hasMulti: boolean,
): RefeicaoEditorShape[] {
  if (!hasMulti) return refeicoes;
  return refeicoes.filter((r) => !r.plano || r.plano === plano);
}

function sumTotais(
  refeicoes: RefeicaoEditorShape[],
  calcular: (r: RefeicaoEditorShape) => Totais,
): Totais {
  return refeicoes.reduce(
    (acc, ref) => {
      const t = calcular(ref);
      return {
        kcal: acc.kcal + t.kcal,
        proteinas: acc.proteinas + t.proteinas,
        carboidratos: acc.carboidratos + t.carboidratos,
        lipidios: acc.lipidios + t.lipidios,
      };
    },
    { kcal: 0, proteinas: 0, carboidratos: 0, lipidios: 0 },
  );
}

function TotaisGrid({ totais }: { totais: Totais }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="text-center">
        <div className="text-2xl font-bold text-primary">{Math.round(totais.kcal)}</div>
        <div className="text-sm text-muted-foreground">Calorias</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-primary">{Math.round(totais.proteinas)}g</div>
        <div className="text-sm text-muted-foreground">Proteínas</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-warning">{Math.round(totais.carboidratos)}g</div>
        <div className="text-sm text-muted-foreground">Carboidratos</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-destructive">{Math.round(totais.lipidios)}g</div>
        <div className="text-sm text-muted-foreground">Lipídios</div>
      </div>
    </div>
  );
}

export function DietCreatorNutritionSummary({
  refeicoes,
  calcularTotaisRefeicao,
}: DietCreatorNutritionSummaryProps) {
  const planos = useMemo(() => collectPlanosFromRefeicoes(refeicoes), [refeicoes]);
  const hasMulti = dietHasMultiplosCardapios(refeicoes);
  const [planoAtivo, setPlanoAtivo] = useState<DietPlano>("A");

  const totaisGeral = useMemo(
    () => sumTotais(refeicoes, calcularTotaisRefeicao),
    [refeicoes, calcularTotaisRefeicao],
  );

  const totaisPlano = useMemo(() => {
    const filtered = refeicoesForPlano(refeicoes, planoAtivo, hasMulti);
    return sumTotais(filtered, calcularTotaisRefeicao);
  }, [refeicoes, planoAtivo, hasMulti, calcularTotaisRefeicao]);

  const effectivePlano = planos.includes(planoAtivo) ? planoAtivo : planos[0] ?? "A";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          Resumo Nutricional
          {hasMulti ? (
            <span className="text-sm font-normal text-muted-foreground">
              — por cardápio
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasMulti ? (
          <>
            <Tabs
              value={effectivePlano}
              onValueChange={(v) => setPlanoAtivo(v as DietPlano)}
            >
              <TabsList
                className="grid h-auto w-full max-w-md gap-1"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(planos.length, 6)}, minmax(0, 1fr))`,
                }}
              >
                {planos.map((p) => (
                  <TabsTrigger key={p} value={p} className="text-xs sm:text-sm">
                    Plano {p}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <TotaisGrid totais={totaisPlano} />
            <p className="text-xs text-muted-foreground">
              Refeições sem cardápio entram em todos os planos. Não some A + B — escolha o plano
              que o aluno segue em cada dia.
            </p>
          </>
        ) : (
          <TotaisGrid totais={totaisGeral} />
        )}
      </CardContent>
    </Card>
  );
}

export default DietCreatorNutritionSummary;
