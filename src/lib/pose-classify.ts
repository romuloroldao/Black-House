/**
 * Classificação de pose a partir dos pontos do corpo do MediaPipe Pose Landmarker.
 * Função pura (sem dependências) usada no navegador e na validação offline.
 *
 * Convenção anatómica: "lado_esquerdo" = lado esquerdo do corpo virado para a câmara,
 * logo o rosto aponta para a esquerda da imagem.
 */

export type PoseLandmark = { x: number; y: number; z?: number; visibility?: number };

export type ClientPose =
  | "frente"
  | "costas"
  | "lado_esquerdo"
  | "lado_direito"
  | "desconhecido"
  | "invalido";

export type PoseClassification = {
  pose: ClientPose;
  confidence: number;
  reason: string;
  people_count: number;
};

export type PoseClassifyOptions = {
  /** Largura/altura da imagem em píxeis (os pontos vêm normalizados 0..1). */
  width: number;
  height: number;
  minVisibility?: number;
  /** Abaixo disto (largura dos ombros / altura do tronco) a foto é lateral. */
  lateralRatioMax?: number;
  /** Acima disto é frente/costas; entre os dois limites fica "desconhecido". */
  frontalRatioMin?: number;
};

const LM = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
} as const;

const DEFAULTS = {
  minVisibility: 0.5,
  lateralRatioMax: 0.35,
  frontalRatioMin: 0.5,
};

function vis(p: PoseLandmark | undefined): number {
  return p?.visibility ?? 0;
}

function inFrame(p: PoseLandmark | undefined): boolean {
  return !!p && p.x >= -0.02 && p.x <= 1.02 && p.y >= -0.02 && p.y <= 1.02;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function result(pose: ClientPose, confidence: number, reason: string, people: number): PoseClassification {
  return { pose, confidence: Number(clamp01(confidence).toFixed(3)), reason, people_count: people };
}

export function classifyPoseFromLandmarks(
  poses: PoseLandmark[][],
  options: PoseClassifyOptions,
): PoseClassification {
  const opts = { ...DEFAULTS, ...options };
  const people = poses.length;
  if (people === 0) return result("invalido", 0.9, "nenhuma pessoa detetada", 0);
  if (people > 1) return result("invalido", 0.8, "mais de uma pessoa detetada", people);

  const lm = poses[0];
  const ls = lm[LM.leftShoulder];
  const rs = lm[LM.rightShoulder];
  const lh = lm[LM.leftHip];
  const rh = lm[LM.rightHip];
  const nose = lm[LM.nose];

  const shouldersSeen = Math.max(vis(ls), vis(rs)) >= opts.minVisibility && inFrame(ls) && inFrame(rs);
  const hipsSeen = Math.max(vis(lh), vis(rh)) >= opts.minVisibility && inFrame(lh) && inFrame(rh);
  if (!shouldersSeen || !hipsSeen) {
    return result("invalido", 0.7, "tronco cortado ou pouco visível", 1);
  }

  const W = opts.width;
  const H = opts.height;
  const shoulderMidX = ((ls.x + rs.x) / 2) * W;
  const shoulderMidY = ((ls.y + rs.y) / 2) * H;
  const hipMidX = ((lh.x + rh.x) / 2) * W;
  const hipMidY = ((lh.y + rh.y) / 2) * H;
  const torso = Math.hypot(shoulderMidX - hipMidX, shoulderMidY - hipMidY);
  if (torso < 1) return result("desconhecido", 0.3, "tronco sem altura mensurável", 1);

  const shoulderWidth = Math.abs(ls.x - rs.x) * W;
  const hipWidth = Math.abs(lh.x - rh.x) * W;
  const ratio = Math.max(shoulderWidth, hipWidth * 1.15) / torso;

  if (ratio <= opts.lateralRatioMax) {
    const noseOffset = inFrame(nose) ? (nose.x * W - (shoulderMidX + hipMidX) / 2) / torso : 0;
    // z menor = mais perto da câmara.
    const depthCue = (rs.z ?? 0) - (ls.z ?? 0) + ((rh.z ?? 0) - (lh.z ?? 0));
    const visCue = vis(ls) - vis(rs) + (vis(lh) - vis(rh));

    let score = 0;
    if (Math.abs(noseOffset) > 0.06) score += noseOffset < 0 ? 2 : -2;
    if (Math.abs(depthCue) > 0.05) score += depthCue > 0 ? 1 : -1;
    if (Math.abs(visCue) > 0.2) score += visCue > 0 ? 1 : -1;

    if (score === 0) return result("desconhecido", 0.4, "perfil sem direção clara", 1);
    const pose: ClientPose = score > 0 ? "lado_esquerdo" : "lado_direito";
    const confidence = 0.55 + 0.1 * Math.min(Math.abs(score), 4) - (ratio / opts.lateralRatioMax) * 0.1;
    return result(pose, confidence, `perfil (ombros/tronco ${ratio.toFixed(2)}, nariz ${noseOffset.toFixed(2)})`, 1);
  }

  if (ratio < opts.frontalRatioMin) {
    return result("desconhecido", 0.35, `ângulo intermédio (ombros/tronco ${ratio.toFixed(2)})`, 1);
  }

  // De frente, o ombro esquerdo do aluno aparece à direita da imagem e o nariz fica
  // à frente dos ombros (z menor). A visibilidade do rosto não distingue: o modelo a estima alta nos dois casos.
  const shoulderSign = ls.x - rs.x;
  const hipSign = lh.x - rh.x;
  const noseDepth = (nose?.z ?? 0) - ((ls.z ?? 0) + (rs.z ?? 0)) / 2;

  let score = 0;
  score += shoulderSign > 0 ? 2 : -2;
  score += hipSign > 0 ? 1 : -1;
  if (Math.abs(noseDepth) > 0.1) score += noseDepth < 0 ? 1 : -1;

  const pose: ClientPose = score > 0 ? "frente" : "costas";
  const confidence = 0.5 + 0.1 * Math.min(Math.abs(score), 4);
  return result(pose, confidence, `${pose} (ombros/tronco ${ratio.toFixed(2)})`, 1);
}
