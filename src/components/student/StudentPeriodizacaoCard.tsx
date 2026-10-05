import { useState } from "react";
import { BookOpen, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface StudentPeriodizacaoCardProps {
  observacao?: string | null;
  contentId?: string | null;
  contentTitle?: string | null;
}

/** Heurística: texto longo o suficiente para o line-clamp-3 cortar. */
function likelyTruncated(text: string) {
  const lines = text.split(/\n/).length;
  return lines > 3 || text.length > 140;
}

/**
 * Card de periodização no portal de treino — espelho leve de StudentRefeicaoLivreCard
 * (sem fluxo de foto; só guia + observação do coach).
 */
const StudentPeriodizacaoCard = ({
  observacao,
  contentId,
  contentTitle,
}: StudentPeriodizacaoCardProps) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  if (!contentId && !observacao?.trim()) return null;

  const description =
    observacao?.trim() ||
    (contentTitle
      ? `Material: ${contentTitle}`
      : "Orientações do seu coach sobre a periodização deste treino.");

  const canExpand = likelyTruncated(description);

  return (
    <Card className="shadow-card overflow-hidden border-primary/25">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15">
            <BookOpen className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold sm:text-lg">Periodização de treino</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Guia do método e notas do seu coach para este plano.
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-muted/40 px-3 py-2.5">
          <p
            className={cn(
              "whitespace-pre-wrap text-sm leading-relaxed text-foreground/90",
              !expanded && canExpand && "line-clamp-3",
            )}
          >
            {description}
          </p>
          {canExpand ? (
            <button
              type="button"
              className="mt-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? "Ver menos" : "Ver mais"}
            </button>
          ) : null}
        </div>

        {contentId ? (
          <Button
            variant="ghost"
            className="h-10 w-full justify-between px-0 text-primary hover:bg-transparent hover:text-primary sm:w-auto sm:justify-start"
            onClick={() => navigate(`/portal-aluno/guia/${contentId}`)}
          >
            Abrir guia de periodização
            <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default StudentPeriodizacaoCard;
