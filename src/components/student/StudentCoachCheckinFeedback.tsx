import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { hasCoachRespostaPublicada } from "@/lib/checkin-display";
import type { WeeklyCheckinRecord } from "@/types/weekly-checkin";
import { STUDENT_REALTIME_EVENT, type StudentRealtimeDetail } from "@/hooks/useStudentPortalRealtime";
import StudentCoachFeedbackHistorySheet, {
  CoachFeedbackHistoryButton,
  isCoachFeedbackUnread,
  markCoachFeedbacksSeen,
} from "@/components/student/StudentCoachFeedbackHistorySheet";

type StudentCoachCheckinFeedbackProps = {
  /** Quando omitido, usa o aluno autenticado (portal do aluno). */
  alunoId?: string;
  /** Se informado, mostra a resposta deste check-in específico. */
  checkinId?: string;
  className?: string;
  compact?: boolean;
  /** Máximo de feedbacks visíveis inline (recomendado: 1 na home). */
  limit?: number;
  /** Mostra botão para abrir histórico completo quando há mais feedbacks. */
  showHistoryAction?: boolean;
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
  isNew,
}: {
  checkin: WeeklyCheckinRecord;
  compact?: boolean;
  className?: string;
  isNew?: boolean;
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
          {isNew && (
            <Badge variant="default" className="student-badge-sm h-5 px-1.5">
              Novo
            </Badge>
          )}
        </p>
        {checkinDate && (
          <p className="mb-2 text-xs text-muted-foreground">Check-in de {checkinDate}</p>
        )}
        <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed">{resposta}</p>
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
          {isNew && (
            <Badge variant="default" className="student-badge-sm h-5 px-1.5">
              Novo
            </Badge>
          )}
        </CardTitle>
        {checkinDate && (
          <p className="text-xs text-muted-foreground">Referente ao check-in de {checkinDate}</p>
        )}
      </CardHeader>
      <CardContent>
        <p className="line-clamp-[12] whitespace-pre-wrap text-sm leading-relaxed">{resposta}</p>
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
  limit,
  showHistoryAction = false,
}: StudentCoachCheckinFeedbackProps) {
  const [loading, setLoading] = useState(true);
  const [checkins, setCheckins] = useState<WeeklyCheckinRecord[]>([]);
  const [feedbackTotal, setFeedbackTotal] = useState(0);
  const [resolvedAlunoId, setResolvedAlunoId] = useState<string | undefined>(alunoId);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadRows = useCallback(async () => {
    let targetAlunoId = alunoId;

    if (!targetAlunoId) {
      const me = await apiClient.getMeSafe();
      if (!me.success || !me.data?.id) {
        return { items: [] as WeeklyCheckinRecord[], total: 0, alunoId: undefined as string | undefined };
      }
      targetAlunoId = me.data.id;
    }

    const inlineLimit = checkinId ? 100 : Math.max(limit ?? 1, 1);
    const result = await apiClient.listCoachFeedbacksPaginatedSafe({
      aluno_id: targetAlunoId,
      limit: inlineLimit,
      offset: 0,
    });

    if (!result.success || !result.data) {
      return { items: [] as WeeklyCheckinRecord[], total: 0, alunoId: targetAlunoId };
    }

    const picked = pickCheckinsWithResposta(result.data.items, checkinId);
    return {
      items: picked,
      total: result.data.total,
      alunoId: targetAlunoId,
    };
  }, [alunoId, checkinId, limit]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const result = await loadRows();
      if (!cancelled) {
        setCheckins(result.items);
        setFeedbackTotal(result.total);
        setResolvedAlunoId(result.alunoId);
        setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [loadRows]);

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
      void loadRows().then((result) => {
        setCheckins(result.items);
        setFeedbackTotal(result.total);
        setResolvedAlunoId(result.alunoId);
      });
    };
    window.addEventListener("blackhouse:checkin-feedback-reload", reload);
    return () => window.removeEventListener("blackhouse:checkin-feedback-reload", reload);
  }, [loadRows]);

  const visibleCheckins = useMemo(() => {
    if (limit == null || limit <= 0) return checkins;
    return checkins.slice(0, limit);
  }, [checkins, limit]);

  const openHistory = () => {
    markCoachFeedbacksSeen(checkins);
    setHistoryOpen(true);
  };

  useEffect(() => {
    if (!historyOpen) return;
    markCoachFeedbacksSeen(checkins);
  }, [historyOpen, checkins]);

  const latestIsNew = visibleCheckins[0] ? isCoachFeedbackUnread(visibleCheckins[0]) : false;

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

  const showHistory = showHistoryAction && feedbackTotal > (limit ?? feedbackTotal);

  return (
    <>
      <div className={className}>
        {visibleCheckins.length === 1 ? (
          <FeedbackBlock
            checkin={visibleCheckins[0]}
            compact={compact}
            isNew={latestIsNew}
          />
        ) : (
          <div className="space-y-4">
            {visibleCheckins.map((checkin, index) => (
              <FeedbackBlock
                key={checkin.id}
                checkin={checkin}
                compact={compact}
                isNew={index === 0 && latestIsNew}
              />
            ))}
          </div>
        )}

        {showHistory && (
          <div className={compact ? "mt-2 flex justify-end" : "mt-3 flex justify-end"}>
            <CoachFeedbackHistoryButton total={feedbackTotal} onClick={openHistory} />
          </div>
        )}
      </div>

      {showHistoryAction && (
        <StudentCoachFeedbackHistorySheet
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          alunoId={resolvedAlunoId}
        />
      )}
    </>
  );
}
