import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronRight, ClipboardList, Search } from "lucide-react";
import { API_CONTRACT } from "@/contracts/api-contract";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { getCheckinSummaryChips, hasRelato, isCheckinMarcadoSemTexto, isCheckinRespondido } from "@/lib/checkin-display";
import { compareCheckinsForTriagem, isCheckinPrioridade } from "@/lib/checkin-highlights";
import {
  countByInboxFilter,
  formatFilterLabel,
  INBOX_FILTER_OPTIONS,
  matchesInboxFilter,
  type InboxFilterId,
} from "@/lib/checkin-inbox-filters";
import { matchesCheckinSearch } from "@/lib/checkin-relato-search";
import type { WeeklyCheckinRecord } from "@/types/weekly-checkin";
import CoachCheckinDetailSheet from "@/components/coach/CoachCheckinDetailSheet";
import CheckinPriorityBadge from "@/components/coach/CheckinPriorityBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type InboxItem = {
  checkin: WeeklyCheckinRecord;
  studentId: string;
  studentName: string;
  previousCheckin: WeeklyCheckinRecord | null;
};

export default function CoachCheckinInbox() {
  const { role } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamInboxHint, setTeamInboxHint] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InboxFilterId>("pendentes");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const loadInbox = useCallback(async (searchQuery?: string) => {
    setLoading(true);
    const term = searchQuery?.trim() ?? "";
    const [checkinsResult, alunosResult] = await Promise.all([
      apiClient.listWeeklyCheckinsSafe(term.length >= 2 ? { q: term } : undefined),
      apiClient.requestSafe<Array<{ id: string; nome?: string }>>("/api/alunos"),
    ]);

    const alunosMap = new Map<string, string>();
    if (alunosResult.success && Array.isArray(alunosResult.data)) {
      for (const a of alunosResult.data) {
        if (a.id) alunosMap.set(a.id, a.nome?.trim() || "Aluno");
      }
    }

    const checkins =
      checkinsResult.success && Array.isArray(checkinsResult.data) ? checkinsResult.data : [];

    const byAluno = new Map<string, WeeklyCheckinRecord[]>();
    for (const c of checkins) {
      const aid = c.aluno_id;
      if (!aid) continue;
      if (!byAluno.has(aid)) byAluno.set(aid, []);
      byAluno.get(aid)!.push(c);
    }
    for (const list of byAluno.values()) {
      list.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      );
    }

    const inbox: InboxItem[] = checkins
      .slice()
      .sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      )
      .map((checkin) => {
        const studentId = checkin.aluno_id || "";
        const alunoList = byAluno.get(studentId) || [];
        const idx = alunoList.findIndex((c) => c.id === checkin.id);
        const previousCheckin = idx >= 0 && idx < alunoList.length - 1 ? alunoList[idx + 1] : null;
        return {
          checkin,
          studentId,
          studentName: alunosMap.get(studentId) || "Aluno",
          previousCheckin,
        };
      });

    setItems(inbox);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (role !== "coach") {
      setTeamInboxHint(
        role === "admin"
          ? "Visão global de todos os coaches."
          : "Inbox partilhada com a equipa do coach titular.",
      );
      return;
    }
    apiClient.requestSafe<Array<{ id: string }>>(API_CONTRACT.coach.teamMembers()).then((r) => {
      if (r.success && Array.isArray(r.data) && r.data.length > 0) {
        setTeamInboxHint(
          `Inbox da equipa — ${r.data.length} ${r.data.length === 1 ? "membro" : "membros"} com acesso aos mesmos alunos.`,
        );
      } else {
        setTeamInboxHint(null);
      }
    });
  }, [role]);

  const checkinsByAluno = useMemo(() => {
    const map = new Map<string, WeeklyCheckinRecord[]>();
    for (const item of items) {
      const sid = item.studentId;
      if (!sid) continue;
      if (!map.has(sid)) map.set(sid, []);
      map.get(sid)!.push(item.checkin);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      );
    }
    return map;
  }, [items]);

  useEffect(() => {
    const term = search.trim();
    if (term.length === 0 || term.length === 1) {
      void loadInbox();
      return;
    }
    const timer = window.setTimeout(() => {
      void loadInbox(term);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, loadInbox]);

  useEffect(() => {
    const refresh = () => {
      const term = search.trim();
      void loadInbox(term.length >= 2 ? term : undefined);
    };
    window.addEventListener("blackhouse:checkin-pending-updated", refresh);
    window.addEventListener("blackhouse:coach-realtime", refresh);
    return () => {
      window.removeEventListener("blackhouse:checkin-pending-updated", refresh);
      window.removeEventListener("blackhouse:coach-realtime", refresh);
    };
  }, [search, loadInbox]);

  const handleCheckinRespondido = (checkinId: string, updated?: WeeklyCheckinRecord) => {
    const now = updated?.coach_respondido_em || new Date().toISOString();
    const patch = {
      coach_respondido_em: now,
      coach_respondido_por: updated?.coach_respondido_por ?? null,
      coach_resposta: updated?.coach_resposta ?? null,
    };
    setItems((prev) =>
      prev.map((item) =>
        item.checkin.id === checkinId
          ? { ...item, checkin: { ...item.checkin, ...patch } }
          : item,
      ),
    );
  };

  const allCheckins = useMemo(() => items.map((i) => i.checkin), [items]);

  const filterCounts = useMemo(() => {
    const map = new Map<InboxFilterId, number>();
    for (const opt of INBOX_FILTER_OPTIONS) {
      map.set(opt.id, countByInboxFilter(allCheckins, opt.id));
    }
    return map;
  }, [allCheckins]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    const matched = items.filter(({ checkin, studentName }) => {
      if (term && !matchesCheckinSearch(checkin, studentName, term)) return false;
      return matchesInboxFilter(checkin, filter);
    });

    return matched.sort((a, b) => compareCheckinsForTriagem(a.checkin, b.checkin));
  }, [items, search, filter]);

  const prioridadeCountInView = useMemo(
    () => filteredItems.filter((i) => isCheckinPrioridade(i.checkin)).length,
    [filteredItems],
  );

  const selected = selectedIndex !== null ? filteredItems[selectedIndex] ?? null : null;
  const activeFilterLabel =
    INBOX_FILTER_OPTIONS.find((o) => o.id === filter)?.label ?? "filtro atual";

  const openAt = (index: number) => {
    setSelectedIndex(index);
    setSheetOpen(true);
  };

  const navigateCheckin = (direction: "prev" | "next") => {
    if (selectedIndex === null) return;
    const next = direction === "prev" ? selectedIndex - 1 : selectedIndex + 1;
    if (next < 0 || next >= filteredItems.length) return;
    setSelectedIndex(next);
  };

  const relatoPreview = (text?: string | null) => {
    const trimmed = text?.trim();
    if (!trimmed) return null;
    return trimmed.length > 100 ? `${trimmed.slice(0, 100)}…` : trimmed;
  };

  const emptyMessage = search.trim()
    ? `Nenhum check-in com «${search.trim()}» no nome do aluno ou no relato.`
    : filter === "pendentes"
      ? "Nenhum check-in pendente de resposta. Ótimo trabalho!"
      : filter === "prioridade"
        ? "Nenhum check-in com estresse, adesão baixa e relato longo neste momento."
        : filter === "respondidos"
          ? "Ainda não há check-ins marcados como respondidos neste filtro."
          : `Nenhum check-in encontrado em «${activeFilterLabel}».`;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Check-ins Semanais</h1>
        <p className="text-muted-foreground mt-1">
          Triagem de todos os alunos — comece pelos pendentes e responda no drawer
        </p>
        {teamInboxHint && (
          <p className="mt-2 text-sm text-muted-foreground">{teamInboxHint}</p>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar aluno ou texto do relato…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            aria-label="Buscar por nome do aluno ou texto do relato"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as InboxFilterId)}>
          <SelectTrigger className="w-full sm:w-[280px]">
            <SelectValue placeholder="Filtrar" />
          </SelectTrigger>
          <SelectContent>
            {INBOX_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {formatFilterLabel(opt, filterCounts.get(opt.id) ?? 0)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!loading && prioridadeCountInView > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
          <span className="font-medium text-destructive">
            {prioridadeCountInView}{" "}
            {prioridadeCountInView === 1 ? "check-in prioritário" : "check-ins prioritários"}
          </span>
          <span className="text-muted-foreground">
            {" "}
            — estresse, adesão baixa e relato longo. Responda estes primeiro.
          </span>
        </div>
      )}

      {!loading && search.trim().length > 0 && search.trim().length < 2 && (
        <p className="text-sm text-muted-foreground">Digite pelo menos 2 caracteres para buscar.</p>
      )}

      {!loading && (
        <p className="text-sm text-muted-foreground">
          {filteredItems.length}{" "}
          {filteredItems.length === 1 ? "check-in" : "check-ins"} em «{activeFilterLabel}»
          {search.trim().length >= 2 ? ` · busca «${search.trim()}»` : ""}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">{emptyMessage}</p>
            {filter !== "pendentes" && (filterCounts.get("pendentes") ?? 0) > 0 && (
              <button
                type="button"
                className="text-sm font-medium text-primary hover:underline"
                onClick={() => setFilter("pendentes")}
              >
                Ver {filterCounts.get("pendentes")} pendente
                {(filterCounts.get("pendentes") ?? 0) !== 1 ? "s" : ""}
              </button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Inbox</CardTitle>
            <CardDescription>
              Ordenado do mais recente — clique para abrir detalhes e responder
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredItems.map((item, index) => {
              const { checkin, studentName } = item;
              const chips = getCheckinSummaryChips(checkin);
              const preview = relatoPreview(checkin.nao_cumpriu_porque);
              const dateLabel = format(new Date(checkin.created_at), "dd/MM/yyyy 'às' HH:mm", {
                locale: ptBR,
              });
              const responded = isCheckinRespondido(checkin);
              const marcadoSemTexto = isCheckinMarcadoSemTexto(checkin);

              return (
                <button
                  key={checkin.id}
                  type="button"
                  onClick={() => openAt(index)}
                  className="flex w-full items-start gap-3 rounded-lg border border-border/70 p-4 text-left transition-colors hover:bg-muted/50"
                >
                  <div
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      responded ? "bg-muted-foreground/40" : "bg-amber-500"
                    }`}
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{studentName}</span>
                      <span className="text-sm text-muted-foreground">{dateLabel}</span>
                      {hasRelato(checkin) && (
                        <Badge variant="secondary" className="text-xs">
                          Relato
                        </Badge>
                      )}
                      <CheckinPriorityBadge checkin={checkin} />
                      {responded ? (
                        <Badge variant="outline" className="text-xs">
                          Respondido
                        </Badge>
                      ) : marcadoSemTexto ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500/50 text-xs text-amber-700 dark:text-amber-400"
                        >
                          Sem texto no portal
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-amber-500/50 text-xs text-amber-700 dark:text-amber-400"
                        >
                          Pendente
                        </Badge>
                      )}
                    </div>
                    {chips.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {chips.slice(0, 4).map((chip) => (
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
      )}

      {selected && (
        <CoachCheckinDetailSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          checkin={selected.checkin}
          previousCheckin={selected.previousCheckin}
          allCheckins={checkinsByAluno.get(selected.studentId) ?? []}
          studentId={selected.studentId}
          studentName={selected.studentName}
          onNavigate={navigateCheckin}
          canNavigatePrev={selectedIndex !== null && selectedIndex > 0}
          canNavigateNext={
            selectedIndex !== null && selectedIndex < filteredItems.length - 1
          }
          onRespondido={handleCheckinRespondido}
        />
      )}
    </div>
  );
}
