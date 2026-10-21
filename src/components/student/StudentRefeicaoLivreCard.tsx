import { useState, type ReactNode } from "react";
import { BookOpen, Camera, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface StudentRefeicaoLivreCardProps {
  observacao?: string | null;
  contentId?: string | null;
  contentTitle?: string | null;
  /** Abre o fluxo de estimativa por foto (um único CTA na secção). */
  onPhotograph?: () => void;
  /** Histórico renderizado dentro do mesmo bloco, sem segunda secção competindo. */
  history?: ReactNode;
}

/** Heurística: texto longo o suficiente para o line-clamp-3 cortar. */
function likelyTruncated(text: string) {
  const lines = text.split(/\n/).length;
  return lines > 3 || text.length > 140;
}

/**
 * Bloco único de refeição livre: regras do coach + uma ação principal (fotografar) + histórico.
 * Evita cartões e CTAs duplicados na dieta do aluno.
 */
const StudentRefeicaoLivreCard = ({
  observacao,
  contentId,
  contentTitle,
  onPhotograph,
  history,
}: StudentRefeicaoLivreCardProps) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  if (!contentId && !observacao?.trim() && !onPhotograph && !history) return null;

  const description =
    observacao?.trim() ||
    (contentTitle
      ? `Material: ${contentTitle}`
      : "Orientações do seu coach sobre refeições livres.");

  const canExpand = likelyTruncated(description);
  const hasGuideBody = !!(contentId || observacao?.trim());

  return (
    <Card className="shadow-card overflow-hidden border-primary/25">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15">
            <BookOpen className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold sm:text-lg">Refeição livre</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Regras do coach e registo por foto (estimativa aproximada).
            </p>
          </div>
        </div>

        {hasGuideBody ? (
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
        ) : null}

        {onPhotograph ? (
          <div className="space-y-2">
            <Button className="h-11 w-full sm:w-auto" onClick={onPhotograph}>
              <Camera className="mr-2 h-4 w-4" aria-hidden />
              Fotografar minha refeição
            </Button>
            <p className="text-xs text-muted-foreground">
              Valores estimados — revise as porções antes de salvar.
            </p>
          </div>
        ) : null}

        {contentId ? (
          <Button
            variant="ghost"
            className="h-10 w-full justify-between px-0 text-primary hover:bg-transparent hover:text-primary sm:w-auto sm:justify-start"
            onClick={() => navigate(`/portal-aluno/guia/${contentId}`)}
          >
            Abrir guia completo
            <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
          </Button>
        ) : null}

        {history ? (
          <div className="border-t border-border/60 pt-4">
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Os seus registos
            </h3>
            {history}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default StudentRefeicaoLivreCard;
