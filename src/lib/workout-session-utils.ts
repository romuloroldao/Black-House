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
