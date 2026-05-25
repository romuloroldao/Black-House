import { ChevronRight, Dumbbell, Utensils } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { AlunoHojeDietaRotacao, AlunoHojeTreino } from "@/types/aluno-hoje";

type TodayPlanCardsProps = {
  loading?: boolean;
  treino?: AlunoHojeTreino | null;
  dieta?: { nome?: string | null; objetivo?: string | null; data_retorno?: string | null } | null;
  dietaRotacao?: AlunoHojeDietaRotacao | null;
  onOpenTreino: () => void;
  onOpenDieta: () => void;
};

const TodayPlanCards = ({
  loading,
  treino,
  dieta,
  dietaRotacao,
  onOpenTreino,
  onOpenDieta,
}: TodayPlanCardsProps) => {
  if (loading) {
    return (
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Dumbbell className="h-5 w-5 text-primary" />
            Treino de hoje
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {treino?.detalhe?.nome ? (
            <>
              <p className="font-semibold leading-snug line-clamp-2">{treino.detalhe.nome}</p>
              {treino.detalhe.duracao != null && (
                <p className="text-xs text-muted-foreground">
                  ~{treino.detalhe.duracao} min
                </p>
              )}
              <Button type="button" className="w-full gap-2" onClick={onOpenTreino}>
                Ver treino
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Nenhum treino atribuído ainda.</p>
              <Button type="button" variant="outline" className="w-full" onClick={onOpenTreino}>
                Abrir treinos
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Utensils className="h-5 w-5 text-primary" />
            Dieta de hoje
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {dieta?.nome ? (
            <>
              <p className="font-semibold leading-snug line-clamp-2">{dieta.nome}</p>
              {dietaRotacao && (
                <Badge variant="premium" className="text-xs font-normal">
                  {dietaRotacao.today_label}
                </Badge>
              )}
              {dieta.data_retorno && (
                <p className="text-xs text-muted-foreground">
                  Retorno{" "}
                  {new Date(String(dieta.data_retorno).slice(0, 10) + "T12:00:00").toLocaleDateString(
                    "pt-BR",
                  )}
                </p>
              )}
              <Button type="button" className="w-full gap-2" onClick={onOpenDieta}>
                Ver dieta
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Nenhuma dieta ativa no momento.</p>
              <Button type="button" variant="outline" className="w-full" onClick={onOpenDieta}>
                Abrir dieta
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TodayPlanCards;
