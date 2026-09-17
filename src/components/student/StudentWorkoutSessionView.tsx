import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
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
  hydrateWorkoutSessionFromServer,
  syncWorkoutSerieToServer,
  hydrateLoadHistoryFromServer,
  firstIncompleteIndex,
  secondsUntil,
  appendSetLog,
  type WorkoutExercise,
  type WorkoutRestMode,
  type WorkoutSetLogEntry,
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
  const { toast } = useToast();
  const exercicios = useMemo(
    () => (Array.isArray(treino.exercicios) ? treino.exercicios : []),
    [treino.exercicios],
  );
  const total = exercicios.length;

  const saved = readSessionProgress(treino.id);
  const initialCompleted = saved?.completedIndexes ?? [];
  const initialIndex =
    saved?.currentIndex != null && saved.currentIndex >= 0 && saved.currentIndex < Math.max(total, 1)
      ? Math.min(saved.currentIndex, Math.max(0, total - 1))
      : firstIncompleteIndex(initialCompleted, total);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [completed, setCompleted] = useState<Set<number>>(
    () => new Set(initialCompleted),
  );
  const [currentSet, setCurrentSet] = useState(() =>
    Math.max(1, saved?.currentSet ?? 1),
  );
  const [finished, setFinished] = useState(false);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(() => {
    if (saved?.restPausedLeft != null && saved.restPausedLeft > 0) return null;
    if (saved?.restEndsAt && saved.restEndsAt > Date.now()) return saved.restEndsAt;
    return null;
  });
  const [restPausedLeft, setRestPausedLeft] = useState<number | null>(() =>
    saved?.restPausedLeft != null && saved.restPausedLeft > 0 ? saved.restPausedLeft : null,
  );
  const [restMode, setRestMode] = useState<WorkoutRestMode | null>(
    () => saved?.restMode ?? null,
  );
  const [restTotal, setRestTotal] = useState(() => {
    if (saved?.restPausedLeft != null && saved.restPausedLeft > 0) return saved.restPausedLeft;
    if (saved?.restEndsAt && saved.restEndsAt > Date.now()) {
      return secondsUntil(saved.restEndsAt) ?? 0;
    }
    return 0;
  });
  const [cargaInput, setCargaInput] = useState("");
  const [repsInput, setRepsInput] = useState("");
  const [rpeInput, setRpeInput] = useState("");
  const [dorInput, setDorInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessaoId, setSessaoId] = useState<string | null>(saved?.sessaoId ?? null);
  const [loadHistory, setLoadHistory] = useState<ReturnType<typeof readLoadHistory>>(() =>
    readLoadHistory(treino.id),
  );
  const [setLogs, setSetLogs] = useState<WorkoutSetLogEntry[]>(() => saved?.setLogs ?? []);
  const [logging, setLogging] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [tick, setTick] = useState(0);
  const mainRef = useRef<HTMLElement | null>(null);

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const restPaused = restPausedLeft != null;
  // `tick` força re-render do countdown baseado em restEndsAt
  const restSecondsLeft = restPaused
    ? restPausedLeft
    : (tick >= 0 ? secondsUntil(restEndsAt) : null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const hydrated = await hydrateWorkoutSessionFromServer(treino.id, treino.alunoTreinoId);
      if (cancelled || !hydrated) return;
      setSessaoId(hydrated.sessaoId ?? null);
      const indexes = hydrated.completedIndexes ?? [];
      setCompleted(new Set(indexes));
      const nextIndex =
        hydrated.currentIndex != null &&
        hydrated.currentIndex >= 0 &&
        hydrated.currentIndex < Math.max(total, 1)
          ? Math.min(hydrated.currentIndex, Math.max(0, total - 1))
          : firstIncompleteIndex(indexes, total);
      setCurrentIndex(nextIndex);
      if (hydrated.currentSet != null) setCurrentSet(Math.max(1, hydrated.currentSet));
      if (hydrated.setLogs) setSetLogs(hydrated.setLogs);
      if (hydrated.restPausedLeft != null && hydrated.restPausedLeft > 0) {
        setRestPausedLeft(hydrated.restPausedLeft);
        setRestEndsAt(null);
        setRestTotal(hydrated.restPausedLeft);
      } else if (hydrated.restEndsAt && hydrated.restEndsAt > Date.now()) {
        setRestEndsAt(hydrated.restEndsAt);
        setRestPausedLeft(null);
        setRestTotal(secondsUntil(hydrated.restEndsAt) ?? 0);
      }
      if (hydrated.restMode) setRestMode(hydrated.restMode);
      const history = await hydrateLoadHistoryFromServer(treino.id);
      if (!cancelled) setLoadHistory(history);
    })();
    return () => {
      cancelled = true;
    };
  }, [treino.id, treino.alunoTreinoId, total]);

  /* Teclado móvel: manter footer acima do visualViewport */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(inset > 40 ? inset : 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  const current = exercicios[currentIndex];
  const prescribedSets = parsePrescribedSets(current?.series);
  const repsHint = parsePrescribedRepsHint(current?.repeticoes);

  const ultimaCarga = useMemo(() => {
    if (!current?.nome) return null;
    return getLastLoadForExercise(treino.id, currentIndex, current.nome, todayKey);
  }, [treino.id, currentIndex, current?.nome, todayKey, loadHistory]);

  const exerciseSetLogs = useMemo(
    () => setLogs.filter((l) => l.exerciseIndex === currentIndex),
    [setLogs, currentIndex],
  );

  /* Só ao mudar de exercício — NÃO reagir a loadHistory (apagava reps mid-série). */
  useEffect(() => {
    const todaySession = readLoadHistory(treino.id).find((s) => s.date === todayKey);
    const savedLoad = todaySession?.exercises.find((e) => e.exerciseIndex === currentIndex);
    const lastPrev = getLastLoadForExercise(
      treino.id,
      currentIndex,
      current?.nome ?? "",
      todayKey,
    );
    setCargaInput(
      savedLoad?.pesoUsado ??
        lastPrev ??
        (current?.peso != null ? String(current.peso) : ""),
    );
    setRepsInput("");
    setRpeInput("");
    setDorInput("");
    // currentSet restaurado só no mount; ao navegar exercício → 1
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intencional: só currentIndex
  }, [currentIndex]);

  const prevIndexRef = useRef(currentIndex);
  useEffect(() => {
    if (prevIndexRef.current !== currentIndex) {
      prevIndexRef.current = currentIndex;
      setCurrentSet(1);
    }
  }, [currentIndex]);

  const persist = useCallback(
    (partial: {
      completedIndexes?: number[];
      currentIndex?: number;
      currentSet?: number;
      restEndsAt?: number | null;
      restMode?: WorkoutRestMode | null;
      restPausedLeft?: number | null;
      setLogs?: WorkoutSetLogEntry[];
      sessaoId?: string | null;
    }) => {
      writeSessionProgress(treino.id, {
        completedIndexes: partial.completedIndexes ?? [...completed],
        sessaoId: partial.sessaoId !== undefined ? partial.sessaoId : sessaoId,
        currentIndex: partial.currentIndex ?? currentIndex,
        currentSet: partial.currentSet ?? currentSet,
        restEndsAt: partial.restEndsAt !== undefined ? partial.restEndsAt : restEndsAt,
        restMode: partial.restMode !== undefined ? partial.restMode : restMode,
        restPausedLeft:
          partial.restPausedLeft !== undefined ? partial.restPausedLeft : restPausedLeft,
        setLogs: partial.setLogs ?? setLogs,
      });
    },
    [
      treino.id,
      completed,
      sessaoId,
      currentIndex,
      currentSet,
      restEndsAt,
      restMode,
      restPausedLeft,
      setLogs,
    ],
  );

  /* Timer baseado em restEndsAt (sobrevive throttle de background) */
  useEffect(() => {
    if (restPaused || restEndsAt == null) return;

    const finishRest = () => {
      const mode = restMode;
      setRestEndsAt(null);
      setRestMode(null);
      setRestPausedLeft(null);
      if (mode === "exercise") {
        setCurrentIndex((i) => {
          const next = i < total - 1 ? i + 1 : i;
          writeSessionProgress(treino.id, {
            completedIndexes: [...completed],
            sessaoId,
            currentIndex: next,
            currentSet: 1,
            restEndsAt: null,
            restMode: null,
            restPausedLeft: null,
            setLogs,
          });
          return next;
        });
        setCurrentSet(1);
      } else {
        writeSessionProgress(treino.id, {
          completedIndexes: [...completed],
          sessaoId,
          currentIndex,
          currentSet,
          restEndsAt: null,
          restMode: null,
          restPausedLeft: null,
          setLogs,
        });
      }
    };

    const poll = () => {
      const left = secondsUntil(restEndsAt);
      if (left == null || left <= 0) {
        finishRest();
        return;
      }
      setTick((n) => n + 1);
    };

    poll();
    const t = window.setInterval(poll, 250);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick só força re-render; estado lido no poll
  }, [restEndsAt, restPaused, restMode, total, treino.id]);

  const startRest = (mode: WorkoutRestMode) => {
    const sec = parseRestSeconds(current?.descanso);
    const ends = Date.now() + sec * 1000;
    setRestMode(mode);
    setRestTotal(sec);
    setRestEndsAt(ends);
    setRestPausedLeft(null);
    persist({ restEndsAt: ends, restMode: mode, restPausedLeft: null });
  };

  const clearRest = (advanceExercise: boolean) => {
    const mode = restMode;
    setRestEndsAt(null);
    setRestMode(null);
    setRestPausedLeft(null);
    if (advanceExercise && mode === "exercise") {
      setCurrentIndex((i) => {
        const next = i < total - 1 ? i + 1 : i;
        persist({
          currentIndex: next,
          currentSet: 1,
          restEndsAt: null,
          restMode: null,
          restPausedLeft: null,
        });
        return next;
      });
    } else {
      persist({ restEndsAt: null, restMode: null, restPausedLeft: null });
    }
  };

  const skipRest = () => clearRest(true);

  const togglePauseRest = () => {
    if (restPaused) {
      const left = restPausedLeft ?? 0;
      const ends = Date.now() + left * 1000;
      setRestEndsAt(ends);
      setRestPausedLeft(null);
      persist({ restEndsAt: ends, restPausedLeft: null });
    } else {
      const left = secondsUntil(restEndsAt) ?? 0;
      setRestPausedLeft(left);
      setRestEndsAt(null);
      persist({ restEndsAt: null, restPausedLeft: left });
    }
  };

  const blurActive = () => {
    const el = document.activeElement;
    if (el instanceof HTMLElement) el.blur();
  };

  const logSetAndAdvance = async () => {
    if (logging) return;
    blurActive();

    const isResting = restSecondsLeft != null && restSecondsLeft > 0;

    // Descanso entre exercícios: só pular (avançar) — não re-registar a série já feita
    if (isResting && restMode === "exercise") {
      skipRest();
      return;
    }

    // Descanso entre séries: limpar timer e registar a próxima série
    if (isResting && restMode === "set") {
      clearRest(false);
    }

    setLogging(true);
    const exerciseIdx = currentIndex;
    const exercise = exercicios[exerciseIdx];
    const setsForExercise = parsePrescribedSets(exercise?.series);
    const setIndex = currentSet;
    const reps = parseOptionalNumber(repsInput);
    const rpe = parseOptionalNumber(rpeInput);
    const dor = parseOptionalNumber(dorInput);
    const carga = cargaInput;

    upsertTodayLoadHistory(
      treino.id,
      treino.nome,
      exerciseIdx,
      exercise?.nome ?? `Exercício ${exerciseIdx + 1}`,
      carga,
    );
    setLoadHistory(readLoadHistory(treino.id));

    const entry: WorkoutSetLogEntry = {
      exerciseIndex: exerciseIdx,
      setIndex,
      carga: carga.trim(),
      repeticoes: reps,
      rpe,
      dor,
      at: new Date().toISOString(),
    };
    const nextLogs = appendSetLog(setLogs, entry);
    setSetLogs(nextLogs);

    const isLastSet = setIndex >= setsForExercise;
    const isLastExercise = exerciseIdx >= total - 1;
    let nextCompleted = completed;
    let finishedSession = false;
    let nextSet = setIndex;
    let nextIndex = currentIndex;
    let nextRestEnds: number | null = null;
    let nextRestMode: WorkoutRestMode | null = null;

    if (isLastSet) {
      nextCompleted = new Set(completed);
      nextCompleted.add(exerciseIdx);
      setCompleted(nextCompleted);
      finishedSession = isLastExercise;
      if (finishedSession) {
        setFinished(true);
        setRestEndsAt(null);
        setRestMode(null);
        setRestPausedLeft(null);
      } else {
        const sec = parseRestSeconds(exercise?.descanso);
        nextRestEnds = Date.now() + sec * 1000;
        nextRestMode = "exercise";
        setRestTotal(sec);
        setRestEndsAt(nextRestEnds);
        setRestMode("exercise");
        setRestPausedLeft(null);
      }
    } else {
      nextSet = setIndex + 1;
      setCurrentSet(nextSet);
      const sec = parseRestSeconds(exercise?.descanso);
      nextRestEnds = Date.now() + sec * 1000;
      nextRestMode = "set";
      setRestTotal(sec);
      setRestEndsAt(nextRestEnds);
      setRestMode("set");
      setRestPausedLeft(null);
    }

    persist({
      completedIndexes: [...nextCompleted],
      currentIndex: nextIndex,
      currentSet: isLastSet && !finishedSession ? 1 : nextSet,
      restEndsAt: finishedSession ? null : nextRestEnds,
      restMode: finishedSession ? null : nextRestMode,
      restPausedLeft: null,
      setLogs: nextLogs,
    });

    // Sync em background — não bloqueia o CTA após o debounce
    const sid = sessaoId;
    window.setTimeout(() => setLogging(false), 280);

    if (sid) {
      void (async () => {
        const res = await syncWorkoutSerieToServer({
          sessaoId: sid,
          exerciseIndex: exerciseIdx,
          exerciseName: exercise?.nome ?? `Exercício ${exerciseIdx + 1}`,
          setIndex,
          carga,
          slotKey: exercise?.slot_key || exercise?.slotKey || null,
          repeticoes: reps,
          rpe,
          dor,
          completedIndexes: [...nextCompleted],
          finished: finishedSession,
        });
        if (!res.ok) {
          toast({
            title: "Série guardada neste dispositivo",
            description: res.error || "Não foi possível sincronizar agora. Podes continuar.",
            variant: "destructive",
          });
        }
      })();
    }
  };

  const goPrev = () => {
    clearRest(false);
    setCurrentIndex((i) => {
      const next = Math.max(0, i - 1);
      persist({ currentIndex: next, currentSet: 1, restEndsAt: null, restMode: null });
      return next;
    });
  };

  const goNext = () => {
    clearRest(false);
    setCurrentIndex((i) => {
      const next = Math.min(total - 1, i + 1);
      persist({ currentIndex: next, currentSet: 1, restEndsAt: null, restMode: null });
      return next;
    });
  };

  const onInputFocus = (e: { currentTarget: HTMLInputElement }) => {
    const target = e.currentTarget;
    window.setTimeout(() => {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 120);
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
              setSetLogs([]);
              setFinished(false);
              setRestEndsAt(null);
              setRestMode(null);
              setRestPausedLeft(null);
            }}
          >
            Reiniciar sessão
          </Button>
        </div>
      </div>
    );
  }

  const progressPct = total > 0 ? Math.round((completed.size / total) * 100) : 0;
  const setProgressLabel = `Série ${Math.min(currentSet, prescribedSets)} de ${prescribedSets}`;
  const resting = restSecondsLeft != null && restSecondsLeft > 0;

  const ctaLabel = logging
    ? "A guardar…"
    : resting && restMode === "exercise"
      ? "Pular descanso · próximo exercício"
      : resting
        ? `Registar série ${currentSet} · pular descanso`
        : currentSet < prescribedSets
          ? `Registar série ${currentSet}`
          : currentIndex < total - 1
            ? "Última série · próximo exercício"
            : "Última série · finalizar";

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-background"
      style={keyboardInset > 0 ? { paddingBottom: keyboardInset } : undefined}
    >
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

      <main ref={mainRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
        {resting && (
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/10 p-4 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              {restMode === "set" ? "Descanso entre séries" : "Descanso · próximo exercício"}
            </p>
            {restPaused && (
              <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                Descanso pausado — retomar ou pular
              </p>
            )}
            <p className="mt-1 text-3xl font-bold tabular-nums text-primary">
              {formatTimer(restSecondsLeft ?? 0)}
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={togglePauseRest}>
                {restPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={skipRest}>
                <SkipForward className="mr-1 h-4 w-4" />
                Pular
              </Button>
            </div>
            <Progress
              value={
                restTotal > 0
                  ? ((restTotal - (restSecondsLeft ?? 0)) / restTotal) * 100
                  : 0
              }
              className="mt-3 h-1"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Podes preencher carga/reps e registar a série abaixo — o descanso será saltado.
            </p>
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
          <h2 className="mt-1 text-xl font-bold leading-tight sm:text-2xl">{current?.nome || "Exercício"}</h2>
          {current?.observacoes && (
            <p className="mt-2 text-sm text-muted-foreground">{current.observacoes}</p>
          )}

          <div className="mt-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-center">
            <p className="text-xs text-muted-foreground">
              {resting && restMode === "set" ? "Próxima série" : "Série actual"}
            </p>
            <p className="text-lg font-bold text-primary">{setProgressLabel}</p>
          </div>

          {exerciseSetLogs.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs">
              <li className="font-medium text-muted-foreground">Séries deste exercício</li>
              {exerciseSetLogs.map((l) => (
                <li key={`${l.exerciseIndex}-${l.setIndex}`} className="flex justify-between gap-2">
                  <span>
                    Série {l.setIndex}
                    {l.carga ? ` · ${l.carga}` : ""}
                    {l.repeticoes != null ? ` · ${l.repeticoes} reps` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}

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
                onFocus={onInputFocus}
                placeholder="ex: 40"
                inputMode="decimal"
                enterKeyHint="done"
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
                  onFocus={onInputFocus}
                  placeholder={repsHint || "10"}
                  inputMode="decimal"
                  enterKeyHint="done"
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
                  onFocus={onInputFocus}
                  placeholder="0–10"
                  inputMode="decimal"
                  enterKeyHint="done"
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
                  onFocus={onInputFocus}
                  placeholder="0–10"
                  inputMode="decimal"
                  enterKeyHint="done"
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
            disabled={logging}
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
          {!resting && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => startRest("set")}
            >
              Só iniciar descanso (sem registar série)
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default StudentWorkoutSessionView;
