import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, History, Loader2, MessageSquare } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useStudentOverlayLock } from "@/hooks/useStudentOverlayLock";
import type { WeeklyCheckinRecord } from "@/types/weekly-checkin";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const PREVIEW_CHARS = 180;
const PAGE_SIZE = 20;

function groupByYear(checkins: WeeklyCheckinRecord[]): Map<number, WeeklyCheckinRecord[]> {
  const groups = new Map<number, WeeklyCheckinRecord[]>();
  for (const checkin of checkins) {
    const when = checkin.coach_respondido_em || checkin.created_at;
    const year = when ? new Date(when).getFullYear() : new Date().getFullYear();
    const list = groups.get(year) ?? [];
    list.push(checkin);
    groups.set(year, list);
  }
  return new Map([...groups.entries()].sort((a, b) => b[0] - a[0]));
}

function FeedbackHistoryItem({
  checkin,
  defaultOpen,
}: {
  checkin: WeeklyCheckinRecord;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const resposta = checkin.coach_resposta?.trim() ?? "";
  const needsCollapse = resposta.length > PREVIEW_CHARS;
  const preview = needsCollapse ? `${resposta.slice(0, PREVIEW_CHARS).trim()}…` : resposta;

  const checkinDate = checkin.created_at
    ? format(new Date(checkin.created_at), "dd/MM/yyyy", { locale: ptBR })
    : null;
  const respondedAt = checkin.coach_respondido_em || checkin.created_at;
  const respondedLabel = respondedAt
    ? format(new Date(respondedAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : null;

  if (!needsCollapse) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {checkinDate && (
            <Badge variant="outline" className="text-xs">
              Check-in {checkinDate}
            </Badge>
          )}
          {respondedLabel && (
            <span className="text-xs text-muted-foreground">Respondido em {respondedLabel}</span>
          )}
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{resposta}</p>
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border/60 bg-muted/20">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/40"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {checkinDate && (
                <Badge variant="outline" className="text-xs">
                  Check-in {checkinDate}
                </Badge>
              )}
              {respondedLabel && (
                <span className="text-xs text-muted-foreground">Respondido em {respondedLabel}</span>
              )}
            </div>
            <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed">{preview}</p>
          </div>
          <ChevronDown
            className={cn(
              "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border/40 px-4 pb-4 pt-2">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{resposta}</p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface StudentCoachFeedbackHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alunoId?: string;
}

export default function StudentCoachFeedbackHistorySheet({
  open,
  onOpenChange,
  alunoId,
}: StudentCoachFeedbackHistorySheetProps) {
  useStudentOverlayLock(open);
  const [resolvedAlunoId, setResolvedAlunoId] = useState<string | undefined>(alunoId);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<WeeklyCheckinRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [years, setYears] = useState<number[]>([]);
  const [yearFilter, setYearFilter] = useState<number | "all">("all");

  const resolveAlunoId = useCallback(async () => {
    if (alunoId) return alunoId;
    const me = await apiClient.getMeSafe();
    return me.success && me.data?.id ? me.data.id : undefined;
  }, [alunoId]);

  const fetchPage = useCallback(
    async (targetAlunoId: string, offset: number, year: number | "all", append: boolean) => {
      const result = await apiClient.listCoachFeedbacksPaginatedSafe({
        aluno_id: targetAlunoId,
        limit: PAGE_SIZE,
        offset,
        year: year === "all" ? undefined : year,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || "Erro ao carregar histórico");
      }

      setItems((prev) => (append ? [...prev, ...result.data!.items] : result.data!.items));
      setTotal(result.data.total);
      setHasMore(result.data.has_more);
      if (result.data.years?.length) {
        setYears(result.data.years);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setItems([]);
      try {
        const id = await resolveAlunoId();
        if (cancelled) return;
        if (!id) {
          setError("Não foi possível identificar o aluno.");
          setLoading(false);
          return;
        }
        setResolvedAlunoId(id);
        await fetchPage(id, 0, yearFilter, false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar histórico");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, yearFilter, resolveAlunoId, fetchPage]);

  const handleLoadMore = async () => {
    if (!resolvedAlunoId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      await fetchPage(resolvedAlunoId, items.length, yearFilter, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar mais");
    } finally {
      setLoadingMore(false);
    }
  };

  const grouped = useMemo(() => groupByYear(items), [items]);
  const firstYear = years[0] ?? [...grouped.keys()][0];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[min(88dvh,920px)] flex-col gap-0 overflow-hidden rounded-t-2xl px-0">
        <SheetHeader className="shrink-0 px-6 pb-2 pt-6 text-left">
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de feedbacks
          </SheetTitle>
          <SheetDescription>
            {total} resposta{total === 1 ? "" : "s"} do seu coach ao longo do acompanhamento.
          </SheetDescription>
        </SheetHeader>

        {years.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-6 pb-3 pt-1">
            <Button
              variant={yearFilter === "all" ? "default" : "outline"}
              size="sm"
              className="shrink-0 h-8"
              onClick={() => setYearFilter("all")}
            >
              Todos
            </Button>
            {years.map((year) => (
              <Button
                key={year}
                variant={yearFilter === year ? "default" : "outline"}
                size="sm"
                className="shrink-0 h-8"
                onClick={() => setYearFilter(year)}
              >
                {year}
              </Button>
            ))}
          </div>
        )}

        <ScrollArea className="min-h-0 flex-1 px-6">
          <div className="space-y-8 pb-overlay-safe pt-2">
            {loading &&
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}

            {!loading && error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {!loading &&
              !error &&
              [...grouped.entries()].map(([year, yearItems]) => (
                <section key={year}>
                  {yearFilter === "all" && (
                    <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{year}</h3>
                  )}
                  <div className="space-y-3">
                    {yearItems.map((checkin, index) => (
                      <FeedbackHistoryItem
                        key={checkin.id}
                        checkin={checkin}
                        defaultOpen={index === 0 && year === firstYear && items.length <= PAGE_SIZE}
                      />
                    ))}
                  </div>
                </section>
              ))}

            {!loading && !error && items.length === 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {yearFilter === "all"
                  ? "Nenhum feedback publicado ainda."
                  : `Nenhum feedback em ${yearFilter}.`}
              </div>
            )}

            {!loading && !error && hasMore && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" size="sm" disabled={loadingMore} onClick={handleLoadMore}>
                  {loadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Carregando…
                    </>
                  ) : (
                    `Carregar mais (${items.length} de ${total})`
                  )}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export function CoachFeedbackHistoryButton({
  total,
  onClick,
  className,
}: {
  total: number;
  onClick: () => void;
  className?: string;
}) {
  if (total <= 1) return null;

  return (
    <Button variant="ghost" size="sm" className={cn("h-8 text-xs text-primary", className)} onClick={onClick}>
      <History className="mr-1 h-3.5 w-3.5" />
      Ver histórico ({total})
    </Button>
  );
}

const LAST_SEEN_KEY = "blackhouse:coach-feedback-last-seen";

export function markCoachFeedbacksSeen(checkins: WeeklyCheckinRecord[]) {
  const latest = checkins[0]?.coach_respondido_em || checkins[0]?.created_at;
  if (!latest) return;
  try {
    localStorage.setItem(LAST_SEEN_KEY, new Date(latest).toISOString());
  } catch {
    /* ignore */
  }
}

export function isCoachFeedbackUnread(checkin: WeeklyCheckinRecord): boolean {
  const when = checkin.coach_respondido_em || checkin.created_at;
  if (!when) return false;
  try {
    const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
    if (!lastSeen) return true;
    return new Date(when).getTime() > new Date(lastSeen).getTime();
  } catch {
    return false;
  }
}
