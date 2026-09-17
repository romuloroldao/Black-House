import { apiClient } from "@/lib/api-client";

export type WorkoutExercise = {
  nome?: string;
  series?: number | string;
  repeticoes?: number | string;
  peso?: string | number | null;
  descanso?: string | number | null;
  observacoes?: string | null;
  video_url?: string | null;
  slot_key?: string | null;
  slotKey?: string | null;
};

export type WorkoutRestMode = "set" | "exercise";

export type WorkoutSetLogEntry = {
  exerciseIndex: number;
  setIndex: number;
  carga: string;
  repeticoes: number | null;
  rpe: number | null;
  dor: number | null;
  at: string;
};

export type WorkoutSessionProgress = {
  treinoId: string;
  date: string;
  completedIndexes: number[];
  updatedAt: string;
  sessaoId?: string;
  currentIndex?: number;
  currentSet?: number;
  /** Epoch ms quando o descanso termina (null = sem descanso). */
  restEndsAt?: number | null;
  restMode?: WorkoutRestMode | null;
  /** Segundos restantes no momento da pausa (null = não pausado). */
  restPausedLeft?: number | null;
  setLogs?: WorkoutSetLogEntry[];
};

/** Registo de carga usada num exercício (histórico local / servidor). */
export type ExerciseLoadLog = {
  exerciseIndex: number;
  exerciseName: string;
  pesoUsado: string;
};

export type WorkoutLoadHistorySession = {
  date: string;
  treinoId: string;
  treinoNome?: string;
  exercises: ExerciseLoadLog[];
};

const MAX_LOAD_HISTORY_SESSIONS = 24;

function loadHistoryKey(treinoId: string): string {
  return `bh-workout-load-history:${treinoId}`;
}

export function parseRestSeconds(descanso: unknown): number {
  if (descanso == null || descanso === "") return 90;
  const s = String(descanso).trim().toLowerCase();
  const minMatch = s.match(/(\d+)\s*m(?:in)?/);
  if (minMatch) return Math.min(600, parseInt(minMatch[1], 10) * 60);
  const colon = s.match(/(\d+)\s*:\s*(\d+)/);
  if (colon) return Math.min(600, parseInt(colon[1], 10) * 60 + parseInt(colon[2], 10));
  const num = s.match(/(\d+)/);
  if (num) return Math.min(600, parseInt(num[1], 10));
  return 90;
}

/** Extrai número de séries prescritas (ex.: "3", "3x10", "4-5"). Default 3. */
export function parsePrescribedSets(series: unknown): number {
  if (series == null || series === "") return 3;
  if (typeof series === "number" && Number.isFinite(series)) {
    return Math.min(20, Math.max(1, Math.round(series)));
  }
  const s = String(series).trim();
  const range = s.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) {
    return Math.min(20, Math.max(1, parseInt(range[1], 10)));
  }
  const n = s.match(/(\d+)/);
  if (n) return Math.min(20, Math.max(1, parseInt(n[1], 10)));
  return 3;
}

/** Extrai repetições alvo sugeridas (número ou texto curto). */
export function parsePrescribedRepsHint(repeticoes: unknown): string {
  if (repeticoes == null || repeticoes === "") return "";
  return String(repeticoes).trim();
}

/** Primeiro exercício ainda não concluído. */
export function firstIncompleteIndex(completedIndexes: number[], total: number): number {
  if (total <= 0) return 0;
  const done = new Set(completedIndexes);
  for (let i = 0; i < total; i++) {
    if (!done.has(i)) return i;
  }
  return Math.max(0, total - 1);
}

export function secondsUntil(restEndsAt: number | null | undefined, now = Date.now()): number | null {
  if (restEndsAt == null || !Number.isFinite(restEndsAt)) return null;
  const left = Math.ceil((restEndsAt - now) / 1000);
  if (left <= 0) return 0;
  return left;
}

export function sessionStorageKey(treinoId: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `bh-workout-session:${treinoId}:${date}`;
}

export function readSessionProgress(treinoId: string): WorkoutSessionProgress | null {
  try {
    const raw = localStorage.getItem(sessionStorageKey(treinoId));
    if (!raw) return null;
    return JSON.parse(raw) as WorkoutSessionProgress;
  } catch {
    return null;
  }
}

export type WriteSessionProgressOpts = {
  completedIndexes: number[];
  sessaoId?: string | null;
  currentIndex?: number;
  currentSet?: number;
  restEndsAt?: number | null;
  restMode?: WorkoutRestMode | null;
  restPausedLeft?: number | null;
  setLogs?: WorkoutSetLogEntry[];
};

export function writeSessionProgress(treinoId: string, opts: WriteSessionProgressOpts): void {
  try {
    const prev = readSessionProgress(treinoId);
    const payload: WorkoutSessionProgress = {
      treinoId,
      date: new Date().toISOString().slice(0, 10),
      completedIndexes: opts.completedIndexes,
      updatedAt: new Date().toISOString(),
      sessaoId: opts.sessaoId ?? prev?.sessaoId,
      currentIndex: opts.currentIndex ?? prev?.currentIndex,
      currentSet: opts.currentSet ?? prev?.currentSet,
      restEndsAt: opts.restEndsAt !== undefined ? opts.restEndsAt : prev?.restEndsAt ?? null,
      restMode: opts.restMode !== undefined ? opts.restMode : prev?.restMode ?? null,
      restPausedLeft:
        opts.restPausedLeft !== undefined ? opts.restPausedLeft : prev?.restPausedLeft ?? null,
      setLogs: opts.setLogs ?? prev?.setLogs ?? [],
    };
    localStorage.setItem(sessionStorageKey(treinoId), JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

/** Compat: assinatura antiga (indexes + sessaoId). */
export function writeSessionProgressLegacy(
  treinoId: string,
  completedIndexes: number[],
  sessaoId?: string,
): void {
  writeSessionProgress(treinoId, { completedIndexes, sessaoId });
}

export function clearSessionProgress(treinoId: string): void {
  try {
    localStorage.removeItem(sessionStorageKey(treinoId));
  } catch {
    /* ignore */
  }
}

export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function readLoadHistory(treinoId: string): WorkoutLoadHistorySession[] {
  try {
    const raw = localStorage.getItem(loadHistoryKey(treinoId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorkoutLoadHistorySession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeLoadHistory(treinoId: string, sessions: WorkoutLoadHistorySession[]): void {
  try {
    const trimmed = sessions.slice(0, MAX_LOAD_HISTORY_SESSIONS);
    localStorage.setItem(loadHistoryKey(treinoId), JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

/** Última carga registada para o exercício (sessão anterior, não inclui hoje). */
export function getLastLoadForExercise(
  treinoId: string,
  exerciseIndex: number,
  exerciseName: string,
  excludeDate: string = new Date().toISOString().slice(0, 10),
): string | null {
  const history = readLoadHistory(treinoId);
  for (const session of history) {
    if (session.date === excludeDate) continue;
    const hit =
      session.exercises.find((e) => e.exerciseIndex === exerciseIndex) ||
      session.exercises.find(
        (e) => e.exerciseName.toLowerCase() === exerciseName.toLowerCase(),
      );
    if (hit?.pesoUsado?.trim()) return hit.pesoUsado.trim();
  }
  return null;
}

export function upsertTodayLoadHistory(
  treinoId: string,
  treinoNome: string | undefined,
  exerciseIndex: number,
  exerciseName: string,
  pesoUsado: string,
): void {
  const date = new Date().toISOString().slice(0, 10);
  const all = readLoadHistory(treinoId);
  const todayExisting = all.find((s) => s.date === date);
  const historyWithoutToday = all.filter((s) => s.date !== date);

  const exercises = [
    ...(todayExisting?.exercises ?? []).filter((e) => e.exerciseIndex !== exerciseIndex),
  ];
  if (pesoUsado.trim()) {
    exercises.push({
      exerciseIndex,
      exerciseName,
      pesoUsado: pesoUsado.trim(),
    });
  }
  exercises.sort((a, b) => a.exerciseIndex - b.exerciseIndex);

  const todaySession: WorkoutLoadHistorySession = {
    date,
    treinoId,
    treinoNome: treinoNome ?? todayExisting?.treinoNome,
    exercises,
  };

  writeLoadHistory(treinoId, [todaySession, ...historyWithoutToday]);
}

export function appendSetLog(
  existing: WorkoutSetLogEntry[],
  entry: WorkoutSetLogEntry,
): WorkoutSetLogEntry[] {
  const filtered = existing.filter(
    (e) => !(e.exerciseIndex === entry.exerciseIndex && e.setIndex === entry.setIndex),
  );
  return [...filtered, entry].sort(
    (a, b) => a.exerciseIndex - b.exerciseIndex || a.setIndex - b.setIndex,
  );
}

export const LOCAL_RESUME_TTL_MS = 2 * 60 * 60 * 1000;

export function isLocalResumeFresh(
  progress: WorkoutSessionProgress | null,
  now = Date.now(),
): boolean {
  if (!progress?.updatedAt) return false;
  const t = Date.parse(progress.updatedAt);
  return Number.isFinite(t) && now - t <= LOCAL_RESUME_TTL_MS;
}

function seriesToSetLogs(series: unknown): WorkoutSetLogEntry[] {
  if (!Array.isArray(series)) return [];
  return series
    .filter((s: { concluido?: boolean }) => s?.concluido)
    .map((s: Record<string, unknown>) => ({
      exerciseIndex: Number(s.exercise_index) || 0,
      setIndex: Number(s.set_index) || 1,
      carga: s.carga != null ? String(s.carga) : "",
      repeticoes: s.repeticoes != null ? Number(s.repeticoes) : null,
      rpe: s.rpe != null ? Number(s.rpe) : null,
      dor: s.dor != null ? Number(s.dor) : null,
      at: typeof s.registrado_em === "string" ? s.registrado_em : new Date().toISOString(),
    }));
}

export function progressFromServerSessao(
  treinoId: string,
  sessao: Record<string, unknown>,
): WorkoutSessionProgress {
  const completed = Array.isArray(sessao.completed_indexes)
    ? sessao.completed_indexes.map((n) => Number(n)).filter((n) => Number.isFinite(n))
    : [];
  return {
    treinoId,
    date: String(sessao.data_ref || new Date().toISOString().slice(0, 10)).slice(0, 10),
    completedIndexes: completed,
    updatedAt: new Date().toISOString(),
    sessaoId: String(sessao.id),
    setLogs: seriesToSetLogs(sessao.series),
    currentIndex: firstIncompleteIndex(completed, Math.max(completed.length + 1, 1)),
  };
}

function mergeLocalResume(
  fromServer: WorkoutSessionProgress,
  local: WorkoutSessionProgress | null,
): WorkoutSessionProgress {
  if (!local || !isLocalResumeFresh(local)) return fromServer;
  if (local.sessaoId && local.sessaoId !== fromServer.sessaoId) return fromServer;
  return {
    ...fromServer,
    restEndsAt: local.restEndsAt,
    restPausedLeft: local.restPausedLeft,
    currentIndex: local.currentIndex ?? fromServer.currentIndex,
    currentSet: local.currentSet ?? fromServer.currentSet,
    restMode: local.restMode ?? fromServer.restMode,
  };
}

function persistHydrated(treinoId: string, progress: WorkoutSessionProgress): WorkoutSessionProgress {
  writeSessionProgress(treinoId, {
    completedIndexes: progress.completedIndexes,
    sessaoId: progress.sessaoId,
    currentIndex: progress.currentIndex,
    currentSet: progress.currentSet,
    restEndsAt: progress.restEndsAt ?? null,
    restMode: progress.restMode ?? null,
    restPausedLeft: progress.restPausedLeft ?? null,
    setLogs: progress.setLogs,
  });
  return readSessionProgress(treinoId) ?? progress;
}

/** Lê sessão do servidor sem criar uma nova. */
export async function loadWorkoutSessionFromServer(
  treinoId: string,
): Promise<WorkoutSessionProgress | null> {
  const today = new Date().toISOString().slice(0, 10);
  const res = await apiClient.getTreinoSessoesSafe({ date: today, treino_id: treinoId });
  const sessoes = res.success && Array.isArray(res.data?.sessoes) ? res.data.sessoes : [];
  const sessao =
    sessoes.find((s: { treino_id?: string }) => String(s.treino_id) === String(treinoId)) ||
    sessoes[0] ||
    null;
  if (!sessao?.id) return null;
  const local = readSessionProgress(treinoId);
  return persistHydrated(treinoId, mergeLocalResume(progressFromServerSessao(treinoId, sessao), local));
}

/** Fonte de verdade: PostgreSQL. Cria sessão se ainda não existir. localStorage só resume fresco. */
export async function hydrateWorkoutSessionFromServer(
  treinoId: string,
  alunoTreinoId?: string,
): Promise<WorkoutSessionProgress | null> {
  const existing = await loadWorkoutSessionFromServer(treinoId);
  if (existing) return existing;

  const local = readSessionProgress(treinoId);
  const started = await apiClient.startTreinoSessaoSafe({
    treino_id: treinoId,
    aluno_treino_id: alunoTreinoId,
    origem: "ui",
  });
  if (!started.success || !started.data?.id) {
    return isLocalResumeFresh(local) ? local : null;
  }
  const merged = mergeLocalResume(progressFromServerSessao(treinoId, started.data), local);
  return persistHydrated(treinoId, merged);
}

/** Garante sessão no servidor; devolve sessaoId (ou null se falhar). */
export async function ensureServerWorkoutSession(
  treinoId: string,
  alunoTreinoId?: string,
): Promise<string | null> {
  const hydrated = await hydrateWorkoutSessionFromServer(treinoId, alunoTreinoId);
  return hydrated?.sessaoId ?? null;
}

export async function syncWorkoutSerieToServer(opts: {
  sessaoId: string;
  exerciseIndex: number;
  exerciseName: string;
  setIndex?: number;
  carga: string;
  slotKey?: string | null;
  repeticoes?: number | null;
  rpe?: number | null;
  dor?: number | null;
  completedIndexes: number[];
  finished?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const serie = await apiClient.putTreinoSerieSafe(opts.sessaoId, {
            exercise_index: opts.exerciseIndex,
            exercise_name: opts.exerciseName,
            set_index: opts.setIndex ?? 1,
            carga: opts.carga,
            slot_key: opts.slotKey,
    repeticoes: opts.repeticoes ?? null,
    rpe: opts.rpe ?? null,
    dor: opts.dor ?? null,
    concluido: true,
    origem: "ui",
  });
  if (!serie.success) {
    return { ok: false, error: serie.error || "Falha ao guardar série" };
  }
  const patch = await apiClient.patchTreinoSessaoSafe(opts.sessaoId, {
    completed_indexes: opts.completedIndexes,
    status: opts.finished ? "completed" : "in_progress",
  });
  if (!patch.success) {
    return { ok: false, error: patch.error || "Falha ao actualizar sessão" };
  }
  return { ok: true };
}

export async function hydrateLoadHistoryFromServer(treinoId: string): Promise<WorkoutLoadHistorySession[]> {
  const res = await apiClient.getTreinoCargasSafe(treinoId);
  if (!res.success || !res.data?.sessions) return readLoadHistory(treinoId);
  const sessions = res.data.sessions as WorkoutLoadHistorySession[];
  if (sessions.length > 0) writeLoadHistory(treinoId, sessions);
  return sessions.length > 0 ? sessions : readLoadHistory(treinoId);
}
