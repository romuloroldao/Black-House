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
};

/** Registo de carga usada num exercício (histórico local). */
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

export function writeSessionProgress(treinoId: string, completedIndexes: number[]): void {
  try {
    const payload: WorkoutSessionProgress = {
      treinoId,
      date: new Date().toISOString().slice(0, 10),
      completedIndexes,
      updatedAt: new Date().toISOString(),
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
