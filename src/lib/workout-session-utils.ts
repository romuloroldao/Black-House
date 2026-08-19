import { apiClient } from "@/lib/api-client";

export type WorkoutExercise = {
  nome?: string;
  series?: number | string;
  repeticoes?: number | string;
  peso?: string | number | null;
  descanso?: string | number | null;
  observacoes?: string | null;
  video_url?: string | null;
};

export type WorkoutSessionProgress = {
  treinoId: string;
  date: string;
  completedIndexes: number[];
  updatedAt: string;
  sessaoId?: string;
};

/** Resume local só para UI; métrica e verdade vêm do servidor. */
export const WORKOUT_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

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

export function sessionStorageKey(treinoId: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `bh-workout-session:${treinoId}:${date}`;
}

export function readSessionProgress(treinoId: string): WorkoutSessionProgress | null {
  try {
    const raw = localStorage.getItem(sessionStorageKey(treinoId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkoutSessionProgress;
    if (!parsed?.updatedAt) {
      localStorage.removeItem(sessionStorageKey(treinoId));
      return null;
    }
    const age = Date.now() - new Date(parsed.updatedAt).getTime();
    if (!Number.isFinite(age) || age > WORKOUT_SESSION_TTL_MS) {
      localStorage.removeItem(sessionStorageKey(treinoId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSessionProgress(
  treinoId: string,
  completedIndexes: number[],
  sessaoId?: string,
): void {
  try {
    const payload: WorkoutSessionProgress = {
      treinoId,
      date: new Date().toISOString().slice(0, 10),
      completedIndexes,
      updatedAt: new Date().toISOString(),
      sessaoId,
    };
    localStorage.setItem(sessionStorageKey(treinoId), JSON.stringify(payload));
  } catch {
    /* ignore */
  }
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

function mapServerSessao(
  treinoId: string,
  sessao: {
    id?: string;
    treino_id?: string;
    data_ref?: string;
    completed_indexes?: number[];
  },
): WorkoutSessionProgress | null {
  if (!sessao?.id) return null;
  const completedIndexes = Array.isArray(sessao.completed_indexes)
    ? sessao.completed_indexes.filter((n) => Number.isFinite(Number(n))).map((n) => Number(n))
    : [];
  return {
    treinoId: String(sessao.treino_id || treinoId),
    date: String(sessao.data_ref || new Date().toISOString().slice(0, 10)).slice(0, 10),
    completedIndexes,
    updatedAt: new Date().toISOString(),
    sessaoId: String(sessao.id),
  };
}

/**
 * GET-only: hidrata sessão aberta a partir de treino_sessoes / séries.
 * Não cria sessão. localStorage fica só como resume de UI (TTL ~2h).
 */
export async function loadWorkoutSessionFromServer(
  treinoId: string,
  query?: { date?: string },
): Promise<WorkoutSessionProgress | null> {
  const res = await apiClient.getTreinoSessoesSafe({
    date: query?.date,
    treino_id: treinoId,
  });
  if (!res.success || !Array.isArray(res.data?.sessoes) || res.data.sessoes.length === 0) {
    return null;
  }
  const sessao =
    res.data.sessoes.find((s: { treino_id?: string }) => s.treino_id === treinoId) ||
    res.data.sessoes[0];
  const progress = mapServerSessao(treinoId, sessao);
  if (!progress) return null;
  writeSessionProgress(treinoId, progress.completedIndexes, progress.sessaoId);
  return progress;
}

export const hydrateWorkoutSessionFromServer = loadWorkoutSessionFromServer;

/** GET-only: todas as sessões do dia (listagem de treinos — sem POST). */
export async function loadTodayWorkoutSessionsFromServer(date?: string): Promise<
  Map<string, WorkoutSessionProgress>
> {
  const map = new Map<string, WorkoutSessionProgress>();
  const res = await apiClient.getTreinoSessoesSafe(date ? { date } : undefined);
  if (!res.success || !Array.isArray(res.data?.sessoes)) return map;
  for (const sessao of res.data.sessoes) {
    const treinoId = String(sessao.treino_id || "");
    if (!treinoId) continue;
    const progress = mapServerSessao(treinoId, sessao);
    if (progress) {
      map.set(treinoId, progress);
      writeSessionProgress(treinoId, progress.completedIndexes, progress.sessaoId);
    }
  }
  return map;
}

/** Garante sessão no servidor; devolve sessaoId (ou null se falhar — UI continua com local). */
export async function ensureServerWorkoutSession(
  treinoId: string,
  alunoTreinoId?: string,
): Promise<string | null> {
  const fromServer = await loadWorkoutSessionFromServer(treinoId);
  if (fromServer?.sessaoId) return fromServer.sessaoId;

  const local = readSessionProgress(treinoId);
  const res = await apiClient.startTreinoSessaoSafe({
    treino_id: treinoId,
    aluno_treino_id: alunoTreinoId,
    origem: "ui",
  });
  if (!res.success || !res.data?.id) return null;

  const sessaoId = String(res.data.id);
  const indexes = Array.isArray(res.data.completed_indexes)
    ? res.data.completed_indexes
    : local?.completedIndexes ?? [];
  writeSessionProgress(treinoId, indexes, sessaoId);
  return sessaoId;
}

export async function syncWorkoutSerieToServer(opts: {
  sessaoId: string;
  exerciseIndex: number;
  exerciseName: string;
  setIndex?: number;
  carga: string;
  repeticoes?: number | null;
  rpe?: number | null;
  dor?: number | null;
  completedIndexes: number[];
  finished?: boolean;
}): Promise<void> {
  await apiClient.putTreinoSerieSafe(opts.sessaoId, {
    exercise_index: opts.exerciseIndex,
    exercise_name: opts.exerciseName,
    set_index: opts.setIndex ?? 1,
    carga: opts.carga,
    repeticoes: opts.repeticoes ?? null,
    rpe: opts.rpe ?? null,
    dor: opts.dor ?? null,
    concluido: true,
    origem: "ui",
  });
  await apiClient.patchTreinoSessaoSafe(opts.sessaoId, {
    completed_indexes: opts.completedIndexes,
    status: opts.finished ? "completed" : "in_progress",
  });
}

export async function hydrateLoadHistoryFromServer(treinoId: string): Promise<WorkoutLoadHistorySession[]> {
  const res = await apiClient.getTreinoCargasSafe(treinoId);
  if (!res.success || !res.data?.sessions) return readLoadHistory(treinoId);
  const sessions = res.data.sessions as WorkoutLoadHistorySession[];
  if (sessions.length > 0) writeLoadHistory(treinoId, sessions);
  return sessions.length > 0 ? sessions : readLoadHistory(treinoId);
}
