import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { hasCoachRespostaPublicada } from "@/lib/checkin-display";
import type { WeeklyCheckinRecord } from "@/types/weekly-checkin";
import { STUDENT_REALTIME_EVENT, type StudentRealtimeDetail } from "@/hooks/useStudentPortalRealtime";

type StudentCoachCheckinFeedbackProps = {
  /** Quando omitido, usa o aluno autenticado (portal do aluno). */
  alunoId?: string;
  /** Se informado, mostra a resposta deste check-in específico. */
  checkinId?: string;
  className?: string;
  compact?: boolean;
};

function pickCheckinsWithResposta(
  rows: WeeklyCheckinRecord[],
  checkinId?: string,
): WeeklyCheckinRecord[] {
  const withResposta = rows.filter((r) => hasCoachRespostaPublicada(r));
  if (checkinId) {
    const one = withResposta.find((r) => r.id === checkinId);
    return one ? [one] : [];
  }
  return [...withResposta].sort(
    (a, b) =>
      new Date(b.coach_respondido_em || b.created_at || 0).getTime() -
      new Date(a.coach_respondido_em || a.created_at || 0).getTime(),
  );
}

function FeedbackBlock({
  checkin,
  compact,
  className,
}: {
  checkin: WeeklyCheckinRecord;
  compact?: boolean;
  className?: string;
}) {
  const resposta = checkin.coach_resposta?.trim() ?? "";
  const when = checkin.coach_respondido_em || checkin.created_at;
  const whenLabel = when
    ? format(new Date(when), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : null;
  const checkinDate = checkin.created_at
    ? format(new Date(checkin.created_at), "dd/MM/yyyy", { locale: ptBR })
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
        {checkinDate && (
          <p className="mb-2 text-xs text-muted-foreground">Check-in de {checkinDate}</p>
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{resposta}</p>
        {whenLabel && (
          <p className="mt-2 text-xs text-muted-foreground">Respondido em {whenLabel}</p>
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
        {checkinDate && (
          <p className="text-xs text-muted-foreground">Referente ao check-in de {checkinDate}</p>
        )}
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{resposta}</p>
        {whenLabel && (
          <p className="mt-3 text-xs text-muted-foreground">Respondido em {whenLabel}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function StudentCoachCheckinFeedback({
  alunoId,
  checkinId,
  className,
  compact = false,
}: StudentCoachCheckinFeedbackProps) {
  const [loading, setLoading] = useState(true);
  const [checkins, setCheckins] = useState<WeeklyCheckinRecord[]>([]);

  const loadRows = async () => {
    let targetAlunoId = alunoId;

    if (!targetAlunoId) {
      const me = await apiClient.getMeSafe();
      if (!me.success || !me.data?.id) {
        return [];
      }
      targetAlunoId = me.data.id;
    }

    const result = await apiClient.listWeeklyCheckinsSafe();
    const rows =
      result.success && Array.isArray(result.data)
        ? result.data.filter((r) => r.aluno_id === targetAlunoId)
        : [];

    return pickCheckinsWithResposta(rows, checkinId);
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const picked = await loadRows();
      if (!cancelled) {
        setCheckins(picked);
        setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [alunoId, checkinId]);

  useEffect(() => {
    const onRealtime = (ev: Event) => {
      const detail = (ev as CustomEvent<StudentRealtimeDetail>).detail;
      if (detail?.type === "checkin_respondido") {
        window.dispatchEvent(new CustomEvent("blackhouse:checkin-feedback-reload"));
      }
    };
    window.addEventListener(STUDENT_REALTIME_EVENT, onRealtime);
    return () => window.removeEventListener(STUDENT_REALTIME_EVENT, onRealtime);
  }, []);

  useEffect(() => {
    const reload = () => {
      void loadRows().then(setCheckins);
    };
    window.addEventListener("blackhouse:checkin-feedback-reload", reload);
    return () => window.removeEventListener("blackhouse:checkin-feedback-reload", reload);
  }, [alunoId, checkinId]);

  if (loading) {
    return compact ? (
      <Skeleton className={`h-16 w-full ${className ?? ""}`} />
    ) : (
      <Skeleton className={`h-28 w-full ${className ?? ""}`} />
    );
  }

  if (checkins.length === 0) {
    return null;
  }

  if (checkins.length === 1) {
    return (
      <FeedbackBlock checkin={checkins[0]} compact={compact} className={className} />
    );
  }

  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      {checkins.map((checkin) => (
        <FeedbackBlock key={checkin.id} checkin={checkin} compact={compact} />
      ))}
    </div>
  );
}
