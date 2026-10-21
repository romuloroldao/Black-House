/**
 * Deteção de pose no dispositivo do aluno (MediaPipe Pose Landmarker, modelo lite).
 * Carregado sob demanda; qualquer falha devolve null e a foto segue para a fila de visão do servidor.
 */
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import {
  classifyPoseFromLandmarks,
  type PoseClassification,
  type PoseLandmark,
} from "./pose-classify";

const ASSET_BASE = `/mediapipe/${__MEDIAPIPE_VERSION__}`;
const LOAD_TIMEOUT_MS = 20000;

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

export function isClientPoseDetectionEnabled(): boolean {
  if (import.meta.env.VITE_POSE_CLIENT_ENABLED === "false") return false;
  if (typeof window === "undefined" || typeof WebAssembly === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !connection?.saveData;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("pose_detect_timeout")), ms);
    promise.then(
      (v) => {
        window.clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function loadLandmarker(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = withTimeout(
      (async () => {
        const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks(`${ASSET_BASE}/wasm`);
        return PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: `${ASSET_BASE}/pose_landmarker_lite.task`, delegate: "CPU" },
          runningMode: "IMAGE",
          numPoses: 2,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
        });
      })(),
      LOAD_TIMEOUT_MS,
    ).catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const detections = new WeakMap<Blob, Promise<PoseClassification | null>>();

/** Inicia a deteção em segundo plano (sem bloquear o formulário). */
export function startPoseDetection(file: Blob): void {
  if (!detections.has(file)) detections.set(file, detectPoseFromFile(file));
}

/** Resultado da deteção, esperando no máximo `waitMs`; null se não houver a tempo. */
export async function getPoseDetection(file: Blob, waitMs: number): Promise<PoseClassification | null> {
  startPoseDetection(file);
  const pending = detections.get(file) as Promise<PoseClassification | null>;
  return Promise.race([
    pending,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), waitMs)),
  ]);
}

export async function detectPoseFromFile(file: Blob): Promise<PoseClassification | null> {
  if (!isClientPoseDetectionEnabled()) return null;
  try {
    const [landmarker, img] = await Promise.all([loadLandmarker(), loadImage(file)]);
    let poses: PoseLandmark[][] = [];
    landmarker.detect(img, (result) => {
      poses = result.landmarks.map((pose) =>
        pose.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility })),
      );
    });
    return classifyPoseFromLandmarks(poses, { width: img.naturalWidth, height: img.naturalHeight });
  } catch {
    return null;
  }
}
