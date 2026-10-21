import type { DietRotationFormState } from "@/components/DietRotationFields";
import {
  inferRotationBlocksFromPlanos,
  type RotationBlock,
} from "@/lib/diet-rotation";
import { collectPlanosFromRefeicoes, type ImportRefeicaoMacros } from "@/lib/diet-student-utils";

export type InferRotationResult = {
  form: DietRotationFormState;
  hint: string;
};

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function extractCycleFromText(text: string): { diasA?: number; diasB?: number; inicial?: string } {
  const t = text.toLowerCase();
  let diasA: number | undefined;
  let diasB: number | undefined;
  let inicial: string | undefined;

  const assign = (plano: string, n: number) => {
    if (!Number.isFinite(n) || n < 1) return;
    if (plano === "a") diasA = n;
    else if (plano === "b") diasB = n;
  };

  for (const re of [
    /(\d+)\s*dias?\s*(?:do\s+|de\s+|no\s+|em\s+)?plano\s*([a-z])\b/gi,
    /plano\s*([a-z])\s*[:\-]?\s*(\d+)\s*dias?\b/gi,
  ]) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(t)) !== null) {
      if (re.source.startsWith("(\\d+)")) {
        assign(m[2], parseInt(m[1], 10));
      } else {
        assign(m[1], parseInt(m[2], 10));
      }
    }
  }

  const cicloSlash = t.match(/\bciclo\s*(\d+)\s*[\/\-]\s*(\d+)\b/i);
  if (cicloSlash) {
    diasA = parseInt(cicloSlash[1], 10);
    diasB = parseInt(cicloSlash[2], 10);
  }

  const inicio = t.match(/(?:in[ií]cio|come[cç]a(?:r)?)\s+(?:no\s+)?plano\s*([a-z])\b/i);
  if (inicio) inicial = inicio[1].toUpperCase();

  return { diasA, diasB, inicial };
}

/**
 * Sugere ciclo rotativo a partir de orientações, nome da dieta e refeições com Plano A/B/C…
 */
export function inferRotationFromImport(params: {
  refeicoes?: Array<ImportRefeicaoMacros>;
  textHints?: Array<string | null | undefined>;
  dataRetorno?: string | null;
}): InferRotationResult | null {
  const refeicoes = params.refeicoes ?? [];
  const planos = collectPlanosFromRefeicoes(refeicoes);
  if (planos.length < 2) return null;

  const blob = (params.textHints ?? []).filter(Boolean).join("\n");
  const fromText = blob ? extractCycleFromText(blob) : {};

  const blocks: RotationBlock[] = inferRotationBlocksFromPlanos(planos, {
    diasA: fromText.diasA,
    diasB: fromText.diasB,
  });

  if (fromText.inicial && blocks.length > 1) {
    const idx = blocks.findIndex((b) => b.plano === fromText.inicial);
    if (idx > 0) {
      const reordered = [...blocks.slice(idx), ...blocks.slice(0, idx)];
      blocks.splice(0, blocks.length, ...reordered);
    }
  }

  const form: DietRotationFormState = {
    rotacao_ativa: true,
    blocos: blocks.map((b) => ({ plano: b.plano, dias: String(b.dias) })),
    rotacao_data_inicio: params.dataRetorno?.slice(0, 10) || todayIso(),
  };

  const short = blocks.map((b) => `${b.dias}${b.plano}`).join("·");
  const hint =
    planos.length > 2
      ? `Cardápios ${planos.join(", ")} detectados — ciclo ${short} sugerido (1 dia por cardápio extra; ajusta se necessário).`
      : fromText.diasA != null
        ? `Ciclo ${short} detectado no texto — revê e confirma.`
        : `Planos A e B na ficha — ciclo ${short} sugerido.`;

  return { form, hint };
}
