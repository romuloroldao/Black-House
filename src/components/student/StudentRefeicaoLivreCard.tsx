import { BookOpen, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface StudentRefeicaoLivreCardProps {
  observacao?: string | null;
  contentId?: string | null;
  contentTitle?: string | null;
}

const StudentRefeicaoLivreCard = ({
  observacao,
  contentId,
  contentTitle,
}: StudentRefeicaoLivreCardProps) => {
  const navigate = useNavigate();

  if (!contentId && !observacao?.trim()) return null;

  const description =
    observacao?.trim() ||
    (contentTitle
      ? `Material: ${contentTitle}`
      : "Orientações do seu coach sobre refeições livres.");

  return (
    <Card className="shadow-card border-primary/20">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15">
            <BookOpen className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <h2 className="text-base font-semibold sm:text-lg">Guia de Refeição Livre</h2>
              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{description}</p>
            </div>
            {contentId ? (
              <Button
                className="h-11 w-full sm:w-auto"
                onClick={() => navigate(`/portal-aluno/guia/${contentId}`)}
              >
                Abrir guia
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StudentRefeicaoLivreCard;
