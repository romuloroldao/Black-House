import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type FeedbackRecord = {
  id: string;
  feedback: string;
  updated_at?: string;
  created_at?: string;
};

type StudentCoachCheckinFeedbackProps = {
  /** Quando omitido, usa o aluno autenticado (portal do aluno). */
  alunoId?: string;
  className?: string;
  compact?: boolean;
};

export default function StudentCoachCheckinFeedback({
  alunoId,
  className,
  compact = false,
}: StudentCoachCheckinFeedbackProps) {
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackRecord | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      let targetAlunoId = alunoId;

      if (!targetAlunoId) {
        const me = await apiClient.getMeSafe();
        if (!me.success || !me.data?.id) {
          if (!cancelled) {
            setFeedback(null);
            setLoading(false);
          }
          return;
        }
        targetAlunoId = me.data.id;
      }

      const result = await apiClient.listFeedbacksAlunosSafe(targetAlunoId);

      if (cancelled) return;

      const rows = result.success && Array.isArray(result.data) ? result.data : [];
      const latest =
        [...rows]
          .filter((r) => r?.feedback?.trim())
          .sort(
            (a, b) =>
              new Date(b.updated_at || b.created_at || 0).getTime() -
              new Date(a.updated_at || a.created_at || 0).getTime(),
          )[0] ?? null;

      setFeedback(latest);
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [alunoId]);

  if (loading) {
    return compact ? (
      <Skeleton className={`h-16 w-full ${className ?? ""}`} />
    ) : (
      <Skeleton className={`h-28 w-full ${className ?? ""}`} />
    );
  }

  if (!feedback?.feedback?.trim()) {
    return null;
  }

  const when = feedback.updated_at || feedback.created_at;
  const whenLabel = when
    ? format(new Date(when), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : null;

  if (compact) {
    return (
      <div
        className={`rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 ${className ?? ""}`}
      >
        <p className="mb-1 flex items-center gap-2 text-sm font-medium text-primary">
          <MessageSquare className="h-4 w-4" />
          Resposta do seu coach
        </p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{feedback.feedback}</p>
        {whenLabel && (
          <p className="mt-2 text-xs text-muted-foreground">Atualizado em {whenLabel}</p>
        )}
      </div>
    );
  }

  return (
    <Card className={`border-primary/20 bg-primary/5 ${className ?? ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-primary">
          <MessageSquare className="h-5 w-5" />
          Resposta do seu coach
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{feedback.feedback}</p>
        {whenLabel && (
          <p className="mt-3 text-xs text-muted-foreground">Atualizado em {whenLabel}</p>
        )}
      </CardContent>
    </Card>
  );
}
