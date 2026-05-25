import type { DietRotationFormState } from "@/components/DietRotationFields";

export type InferRotationResult = {
  form: DietRotationFormState;
  /** Mensagem curta para toast (ex.: "Detectámos Plano A e B — ciclo 3A·1B sugerido"). */
  hint: string;
};

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizePlanoToken(value: string | null | undefined): "A" | "B" | null {
  if (!value) return null;
  const s = String(value).trim();
  if (/^a$/i.test(s)) return "A";
  if (/^b$/i.test(s)) return "B";
  const m = s.match(/\bplano\s*([ab])\b/i);
  if (m) return m[1].toUpperCase() === "B" ? "B" : "A";
  const m2 = s.match(/\(([ab])\)\s*$/i) || s.match(/\s+plano\s*([ab])\s*$/i);
  if (m2) return m2[1].toUpperCase() === "B" ? "B" : "A";
  return null;
}

function extractCycleFromText(text: string): { diasA?: number; diasB?: number; inicial?: "A" | "B" } {
  const t = text.toLowerCase();
  let diasA: number | undefined;
  let diasB: number | undefined;
  let inicial: "A" | "B" | undefined;

  const assign = (plano: string, n: number) => {
    if (!Number.isFinite(n) || n < 1) return;
    if (plano === "a") diasA = n;
    else diasB = n;
  };

  for (const re of [
    /(\d+)\s*dias?\s*(?:do\s+|de\s+|no\s+|em\s+)?plano\s*([ab])\b/gi,
    /plano\s*([ab])\s*[:\-]?\s*(\d+)\s*dias?\b/gi,
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

  const xy = t.match(/\b(\d+)\s*[x×]\s*(\d+)\b/);
  if (xy) {
    diasA = parseInt(xy[1], 10);
    diasB = parseInt(xy[2], 10);
  }

  const inicio = t.match(/(?:in[ií]cio|come[cç]a(?:r)?)\s+(?:no\s+)?plano\s*([ab])\b/i);
  if (inicio) inicial = inicio[1].toUpperCase() === "B" ? "B" : "A";

  return { diasA, diasB, inicial };
}

function detectPlanoInRefeicoes(
  refeicoes: Array<{ nome?: string; plano?: string | null }>,
): { hasA: boolean; hasB: boolean } {
  let hasA = false;
  let hasB = false;
  for (const r of refeicoes) {
    const fromPlano = normalizePlanoToken(r.plano);
    const fromNome = normalizePlanoToken(r.nome);
    const p = fromPlano || fromNome;
    if (p === "A") hasA = true;
    if (p === "B") hasB = true;
  }
  return { hasA, hasB };
}

/**
 * Sugere ciclo rotativo a partir de orientações, nome da dieta e refeições com Plano A/B.
 */
export function inferRotationFromImport(params: {
  refeicoes?: Array<{ nome?: string; plano?: string | null }>;
  textHints?: Array<string | null | undefined>;
  dataRetorno?: string | null;
}): InferRotationResult | null {
  const refeicoes = params.refeicoes ?? [];
  const blob = (params.textHints ?? []).filter(Boolean).join("\n");
  const fromText = blob ? extractCycleFromText(blob) : {};
  const { hasA, hasB } = detectPlanoInRefeicoes(refeicoes);

  const diasA = fromText.diasA ?? (hasA && hasB ? 3 : undefined);
  const diasB = fromText.diasB ?? (hasA && hasB ? 1 : undefined);

  if (!diasA || !diasB || diasA < 1 || diasB < 1) return null;
  if (!hasA && !hasB && !fromText.diasA) return null;

  const form: DietRotationFormState = {
    rotacao_ativa: true,
    rotacao_dias_plano_a: String(diasA),
    rotacao_dias_plano_b: String(diasB),
    rotacao_plano_inicial: fromText.inicial ?? "A",
    rotacao_data_inicio:
      params.dataRetorno?.slice(0, 10) || todayIso(),
  };

  const hint =
    fromText.diasA != null
      ? `Ciclo ${diasA}A·${diasB}B detectado no texto da ficha — revê e confirma.`
      : hasA && hasB
        ? `Refeições Plano A e B encontradas — ciclo ${diasA}A·${diasB}B sugerido (ajusta se necessário).`
        : `Ciclo ${diasA}A·${diasB}B sugerido a partir da ficha — revê e confirma.`;

  return { form, hint };
}
