import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronRight, ClipboardList, Columns2 } from "lucide-react";
import { CheckinSideBySideCompare } from "@/components/coach/CheckinSideBySideCompare";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { getCheckinSummaryChips, hasRelato, isCheckinRespondido } from "@/lib/checkin-display";
import { compareCheckinsForTriagem, isCheckinPrioridade } from "@/lib/checkin-highlights";
import type { WeeklyCheckinRecord } from "@/types/weekly-checkin";
import CoachCheckinDetailSheet from "@/components/coach/CoachCheckinDetailSheet";
import CheckinPriorityBadge from "@/components/coach/CheckinPriorityBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type CoachCheckinTimelineProps = {
  studentId: string;
  studentName: string;
};

export default function CoachCheckinTimeline({ studentId, studentName }: CoachCheckinTimelineProps) {
  const [checkins, setCheckins] = useState<WeeklyCheckinRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const result = await apiClient.listWeeklyCheckinsSafe();
      if (cancelled) return;

      const rows =
        result.success && Array.isArray(result.data)
          ? result.data
              .filter((c) => c.aluno_id === studentId)
              .sort(compareCheckinsForTriagem)
          : [];

      setCheckins(rows);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const selectedCheckin = selectedIndex !== null ? checkins[selectedIndex] ?? null : null;
  const previousCheckin =
    selectedIndex !== null && selectedIndex < checkins.length - 1
      ? checkins[selectedIndex + 1]
      : null;

  const openAt = (index: number) => {
    setSelectedIndex(index);
    setSheetOpen(true);
  };

  const navigateCheckin = (direction: "prev" | "next") => {
    if (selectedIndex === null) return;
    const next = direction === "prev" ? selectedIndex - 1 : selectedIndex + 1;
    if (next < 0 || next >= checkins.length) return;
    setSelectedIndex(next);
  };

  const handleCheckinRespondido = (checkinId: string) => {
    const now = new Date().toISOString();
    setCheckins((prev) =>
      prev.map((c) =>
        c.id === checkinId ? { ...c, coach_respondido_em: now } : c,
      ),
    );
  };

  const relatoPreview = useMemo(
    () => (text?: string | null) => {
      const trimmed = text?.trim();
      if (!trimmed) return null;
      return trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed;
    },
    [],
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (checkins.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <ClipboardList className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            Este aluno ainda não enviou nenhum check-in semanal.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Histórico de check-ins</CardTitle>
            <CardDescription>
              {checkins.length} {checkins.length === 1 ? "registro" : "registros"} — clique para ver
              todas as respostas
            </CardDescription>
          </div>
          {checkins.length >= 2 && (
            <Button type="button" variant="outline" size="sm" onClick={() => setCompareOpen(true)}>
              <Columns2 className="mr-2 h-4 w-4" />
              Comparar 2 semanas
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {checkins.map((checkin, index) => {
            const chips = getCheckinSummaryChips(checkin);
            const preview = relatoPreview(checkin.nao_cumpriu_porque);
            const dateLabel = format(new Date(checkin.created_at), "dd/MM/yyyy 'às' HH:mm", {
              locale: ptBR,
            });

            const responded = isCheckinRespondido(checkin);
            const prioridade = isCheckinPrioridade(checkin);

            return (
              <button
                key={checkin.id}
                type="button"
                onClick={() => openAt(index)}
                className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 ${
                  prioridade ? "border-destructive/40 bg-destructive/5" : "border-border/70"
                }`}
              >
                <div
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    responded ? "bg-muted-foreground/40" : "bg-amber-500"
                  }`}
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{dateLabel}</span>
                    {hasRelato(checkin) && (
                      <Badge variant="secondary" className="text-xs">
                        Com relato
                      </Badge>
                    )}
                    <CheckinPriorityBadge checkin={checkin} />
                    {responded ? (
                      <Badge variant="outline" className="text-xs">
                        Respondido
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500/50 text-xs text-amber-700 dark:text-amber-400">
                        Pendente
                      </Badge>
                    )}
                  </div>
                  {chips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {chips.map((chip) => (
                        <Badge key={chip} variant="outline" className="text-xs font-normal">
                          {chip}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {preview && (
                    <p className="text-sm text-muted-foreground italic">&ldquo;{preview}&rdquo;</p>
                  )}
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </CardContent>
      </Card>

      <CoachCheckinDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        checkin={selectedCheckin}
        previousCheckin={previousCheckin}
        allCheckins={checkins}
        studentId={studentId}
        studentName={studentName}
        onNavigate={navigateCheckin}
        canNavigatePrev={selectedIndex !== null && selectedIndex > 0}
        canNavigateNext={selectedIndex !== null && selectedIndex < checkins.length - 1}
        onRespondido={handleCheckinRespondido}
      />

      <CheckinSideBySideCompare
        open={compareOpen}
        onOpenChange={setCompareOpen}
        checkins={checkins}
        studentName={studentName}
        initialLeftId={selectedCheckin?.id}
        initialRightId={
          selectedIndex != null && checkins[selectedIndex + 1]
            ? checkins[selectedIndex + 1].id
            : undefined
        }
      />
    </>
  );
}
