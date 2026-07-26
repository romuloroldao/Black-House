import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  History,
  Pause,
  Play,
  SkipForward,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  formatTimer,
  parseRestSeconds,
  parsePrescribedSets,
  parsePrescribedRepsHint,
  readSessionProgress,
  writeSessionProgress,
  clearSessionProgress,
  readLoadHistory,
  getLastLoadForExercise,
  upsertTodayLoadHistory,
  ensureServerWorkoutSession,
  syncWorkoutSerieToServer,
  hydrateLoadHistoryFromServer,
  type WorkoutExercise,
} from "@/lib/workout-session-utils";

type TreinoSession = {
  id: string;
  nome?: string;
  descricao?: string;
  exercicios?: WorkoutExercise[];
  alunoTreinoId?: string;
};

type StudentWorkoutSessionViewProps = {
  treino: TreinoSession;
  onExit: () => void;
};

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const StudentWorkoutSessionView = ({ treino, onExit }: StudentWorkoutSessionViewProps) => {
  const exercicios = useMemo(
    () => (Array.isArray(treino.exercicios) ? treino.exercicios : []),
    [treino.exercicios],
  );
  const total = exercicios.length;

  const saved = readSessionProgress(treino.id);
  const initialIndex = saved?.completedIndexes.length
    ? Math.min(saved.completedIndexes.length, Math.max(0, total - 1))
    : 0;

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [completed, setCompleted] = useState<Set<number>>(
    () => new Set(saved?.completedIndexes ?? []),
  );
  const [currentSet, setCurrentSet] = useState(1);
  const [finished, setFinished] = useState(false);
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const [restPaused, setRestPaused] = useState(false);
  const [restTotal, setRestTotal] = useState(0);
  /** Após descanso de série (não de exercício), não avançar exercício. */
  const [restMode, setRestMode] = useState<"set" | "exercise" | null>(null);
  const [cargaInput, setCargaInput] = useState("");
  const [repsInput, setRepsInput] = useState("");
  const [rpeInput, setRpeInput] = useState("");
  const [dorInput, setDorInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessaoId, setSessaoId] = useState<string | null>(saved?.sessaoId ?? null);
  const [loadHistory, setLoadHistory] = useState<ReturnType<typeof readLoadHistory>>(() =>
    readLoadHistory(treino.id),
  );
  const [logging, setLogging] = useState(false);

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const id = await ensureServerWorkoutSession(treino.id, treino.alunoTreinoId);
      if (!cancelled && id) setSessaoId(id);
      const history = await hydrateLoadHistoryFromServer(treino.id);
      if (!cancelled) setLoadHistory(history);
    })();
    return () => {
      cancelled = true;
    };
  }, [treino.id, treino.alunoTreinoId]);

  const current = exercicios[currentIndex];
  const prescribedSets = parsePrescribedSets(current?.series);
  const repsHint = parsePrescribedRepsHint(current?.repeticoes);

  const ultimaCarga = useMemo(() => {
    if (!current?.nome) return null;
    return getLastLoadForExercise(treino.id, currentIndex, current.nome, todayKey);
  }, [treino.id, currentIndex, current?.nome, todayKey, loadHistory]);

  useEffect(() => {
    const todaySession = loadHistory.find((s) => s.date === todayKey);
    const savedLoad = todaySession?.exercises.find((e) => e.exerciseIndex === currentIndex);
    setCargaInput(savedLoad?.pesoUsado ?? (current?.peso != null ? String(current.peso) : ""));
    setRepsInput("");
    setRpeInput("");
    setDorInput("");
    if (!completed.has(currentIndex)) {
      setCurrentSet(1);
    }
  }, [currentIndex, loadHistory, todayKey, current?.peso, completed]);

  const progressPct = total > 0 ? Math.round((completed.size / total) * 100) : 0;
  const setProgressLabel = `Série ${Math.min(currentSet, prescribedSets)} de ${prescribedSets}`;

  const persist = useCallback(
    (next: Set<number>, sid?: string | null) => {
      writeSessionProgress(treino.id, [...next], sid ?? sessaoId ?? undefined);
    },
    [treino.id, sessaoId],
  );

  useEffect(() => {
    if (restSecondsLeft == null || restPaused) return;
    if (restSecondsLeft <= 0) {
      setRestSecondsLeft(null);
      const mode = restMode;
      setRestMode(null);
      if (mode === "exercise") {
        setCurrentIndex((i) => (i < total - 1 ? i + 1 : i));
      }
      // mode === "set": permanece no mesmo exercício, currentSet já incrementado
      return;
    }
    const t = window.setInterval(() => {
      setRestSecondsLeft((s) => (s == null || s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [restSecondsLeft, restPaused, total, restMode]);

  const startRest = (mode: "set" | "exercise") => {
    const sec = parseRestSeconds(current?.descanso);
    setRestMode(mode);
    setRestTotal(sec);
    setRestSecondsLeft(sec);
    setRestPaused(false);
  };

  const skipRest = () => {
    const mode = restMode;
    setRestSecondsLeft(null);
    setRestMode(null);
    if (mode === "exercise") {
      setCurrentIndex((i) => (i < total - 1 ? i + 1 : i));
    }
  };

  const logSetAndAdvance = async () => {
    if (logging) return;
    setLogging(true);
    try {
      const setIndex = currentSet;
      const reps = parseOptionalNumber(repsInput);
      const rpe = parseOptionalNumber(rpeInput);
      const dor = parseOptionalNumber(dorInput);

      upsertTodayLoadHistory(
        treino.id,
        treino.nome,
        currentIndex,
        current?.nome ?? `Exercício ${currentIndex + 1}`,
        cargaInput,
      );
      setLoadHistory(readLoadHistory(treino.id));

      const isLastSet = setIndex >= prescribedSets;
      const isLastExercise = currentIndex >= total - 1;
      let nextCompleted = completed;
      let finishedSession = false;

      if (isLastSet) {
        nextCompleted = new Set(completed);
        nextCompleted.add(currentIndex);
        setCompleted(nextCompleted);
        persist(nextCompleted);
        finishedSession = isLastExercise;
        if (finishedSession) {
          setFinished(true);
          setRestSecondsLeft(null);
          setRestMode(null);
        } else {
          startRest("exercise");
        }
      } else {
        setCurrentSet(setIndex + 1);
        startRest("set");
      }

      const sid = sessaoId;
      if (sid) {
        await syncWorkoutSerieToServer({
          sessaoId: sid,
          exerciseIndex: currentIndex,
          exerciseName: current?.nome ?? `Exercício ${currentIndex + 1}`,
          setIndex,
          carga: cargaInput,
          repeticoes: reps,
          rpe,
          dor,
          completedIndexes: [...nextCompleted],
          finished: finishedSession,
        });
      }
    } finally {
      setLogging(false);
    }
  };

  const goPrev = () => {
    setRestSecondsLeft(null);
    setRestMode(null);
    setCurrentIndex((i) => Math.max(0, i - 1));
  };

  const goNext = () => {
    setRestSecondsLeft(null);
    setRestMode(null);
    setCurrentIndex((i) => Math.min(total - 1, i + 1));
  };

  if (total === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <Dumbbell className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Este treino não tem exercícios cadastrados.</p>
        <Button type="button" variant="outline" onClick={onExit}>
          Voltar
        </Button>
      </div>
    );
  }

  if (finished) {
    const todayLoads =
      loadHistory.find((s) => s.date === todayKey)?.exercises.filter((e) => e.pesoUsado) ?? [];

    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15">
          <Check className="h-10 w-10 text-primary" strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Sessão concluída!</h2>
          <p className="mt-2 text-muted-foreground">
            {completed.size} de {total} exercícios em {treino.nome}
          </p>
        </div>
        {todayLoads.length > 0 && (
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-3 text-left text-sm">
            <p className="mb-2 font-medium">Cargas registadas hoje</p>
            <ul className="space-y-1 text-muted-foreground">
              {todayLoads.map((e) => (
                <li key={e.exerciseIndex} className="flex justify-between gap-2">
                  <span className="truncate">{e.exerciseName}</span>
                  <span className="shrink-0 font-medium text-foreground">{e.pesoUsado}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Button type="button" className="w-full" onClick={onExit}>
            Voltar aos treinos
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              clearSessionProgress(treino.id);
              setCompleted(new Set());
              setCurrentIndex(0);
              setCurrentSet(1);
              setFinished(false);
            }}
          >
            Reiniciar sessão
          </Button>
        </div>
      </div>
    );
  }

  const ctaLabel =
    currentSet < prescribedSets
      ? `Registar série ${currentSet}`
      : currentIndex < total - 1
        ? "Última série · próximo exercício"
        : "Última série · finalizar";

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-background">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Button type="button" variant="ghost" size="icon" aria-label="Sair da sessão" onClick={onExit}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{treino.nome}</p>
          <p className="text-xs text-muted-foreground">
            Exercício {currentIndex + 1}/{total} · {setProgressLabel}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Histórico de cargas">
                <History className="h-5 w-5" />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
          <Badge variant="premium">{progressPct}%</Badge>
        </div>
      </header>

      {historyOpen && loadHistory.length > 0 && (
        <div className="max-h-40 shrink-0 overflow-y-auto border-b border-border px-4 py-2 text-sm">
          <p className="mb-2 font-medium">Histórico de cargas</p>
          <ul className="space-y-2">
            {loadHistory.slice(0, 8).map((session) => (
              <li key={session.date}>
                <p className="text-xs text-muted-foreground">
                  {new Date(session.date + "T12:00:00").toLocaleDateString("pt-BR")}
                  {session.date === todayKey ? " (hoje)" : ""}
                </p>
                {session.exercises.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem cargas</p>
                ) : (
                  <ul className="mt-0.5 space-y-0.5">
                    {session.exercises.map((e) => (
                      <li key={e.exerciseIndex} className="flex justify-between gap-2 text-xs">
                        <span className="truncate">{e.exerciseName}</span>
                        <span className="shrink-0">{e.pesoUsado}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="px-4 pt-2">
        <Progress value={progressPct} className="h-1.5" />
      </div>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
        {restSecondsLeft != null && restSecondsLeft > 0 && (
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/10 p-4 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              {restMode === "set" ? "Descanso entre séries" : "Descanso · próximo exercício"}
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-primary">
              {formatTimer(restSecondsLeft)}
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRestPaused((p) => !p)}
              >
                {restPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={skipRest}>
                <SkipForward className="mr-1 h-4 w-4" />
                Pular
              </Button>
            </div>
            <Progress
              value={restTotal > 0 ? ((restTotal - restSecondsLeft) / restTotal) * 100 : 0}
              className="mt-3 h-1"
            />
          </div>
        )}

        <div
          className={cn(
            "flex flex-1 flex-col rounded-xl border p-4",
            completed.has(currentIndex)
              ? "border-primary/40 bg-primary/5"
              : "border-border bg-card",
          )}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-primary">Agora</p>
          <h2 className="mt-1 text-2xl font-bold leading-tight">{current?.nome || "Exercício"}</h2>
          {current?.observacoes && (
            <p className="mt-2 text-sm text-muted-foreground">{current.observacoes}</p>
          )}

          <div className="mt-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-center">
            <p className="text-xs text-muted-foreground">Série actual</p>
            <p className="text-lg font-bold text-primary">{setProgressLabel}</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <Target className="mx-auto mb-1 h-5 w-5 text-primary" />
              <p className="text-xs text-muted-foreground">Séries (plano)</p>
              <p className="text-xl font-bold">{current?.series ?? prescribedSets}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <Dumbbell className="mx-auto mb-1 h-5 w-5 text-primary" />
              <p className="text-xs text-muted-foreground">Reps (plano)</p>
              <p className="text-xl font-bold">{current?.repeticoes ?? "—"}</p>
            </div>
            {current?.peso != null && current.peso !== "" && (
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-xs text-muted-foreground">Carga (T.E.P)</p>
                <p className="text-lg font-bold">{current.peso}</p>
              </div>
            )}
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <Clock className="mx-auto mb-1 h-5 w-5 text-primary" />
              <p className="text-xs text-muted-foreground">Descanso</p>
              <p className="text-lg font-bold">
                {formatTimer(parseRestSeconds(current?.descanso))}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="carga-usada" className="text-sm">
                Carga usada
              </Label>
              <Input
                id="carga-usada"
                value={cargaInput}
                onChange={(e) => setCargaInput(e.target.value)}
                placeholder="ex: 40 kg"
                className="text-base"
                autoComplete="off"
              />
              {ultimaCarga && (
                <p className="text-xs text-muted-foreground">
                  Última vez: <span className="font-medium text-foreground">{ultimaCarga}</span>
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="reps-usada" className="text-xs">
                  Reps
                </Label>
                <Input
                  id="reps-usada"
                  value={repsInput}
                  onChange={(e) => setRepsInput(e.target.value)}
                  placeholder={repsHint || "10"}
                  inputMode="decimal"
                  className="text-base"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rpe-usada" className="text-xs">
                  RPE
                </Label>
                <Input
                  id="rpe-usada"
                  value={rpeInput}
                  onChange={(e) => setRpeInput(e.target.value)}
                  placeholder="0–10"
                  inputMode="decimal"
                  className="text-base"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dor-usada" className="text-xs">
                  Dor
                </Label>
                <Input
                  id="dor-usada"
                  value={dorInput}
                  onChange={(e) => setDorInput(e.target.value)}
                  placeholder="0–10"
                  inputMode="decimal"
                  className="text-base"
                />
              </div>
            </div>
          </div>

          {current?.video_url && (
            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full"
              onClick={() => window.open(current.video_url!, "_blank")}
            >
              <Play className="mr-2 h-4 w-4" />
              Ver vídeo do exercício
            </Button>
          )}
        </div>
      </main>

      <footer className="shrink-0 border-t border-border p-4 pb-safe-bottom">
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          <Button
            type="button"
            className="h-12 w-full text-base font-semibold"
            disabled={logging || (restSecondsLeft != null && restSecondsLeft > 0)}
            onClick={() => void logSetAndAdvance()}
          >
            <Check className="mr-2 h-5 w-5" />
            {ctaLabel}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" disabled={currentIndex === 0} onClick={goPrev}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={currentIndex >= total - 1}
              onClick={goNext}
            >
              Próximo
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          {!(restSecondsLeft != null && restSecondsLeft > 0) && (
            <Button type="button" variant="ghost" size="sm" onClick={() => startRest("set")}>
              Só iniciar descanso
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default StudentWorkoutSessionView;
