/** Tipos e categorias da biblioteca de conteúdo educativo. */

export const EDUCATIONAL_CONTENT_TYPES = ["pdf", "article", "video"] as const;
export type EducationalContentType = (typeof EDUCATIONAL_CONTENT_TYPES)[number];

export const EDUCATIONAL_CONTENT_TYPE_LABELS: Record<EducationalContentType, string> = {
  pdf: "PDF",
  article: "Artigo",
  video: "Vídeo",
};

/** Categorias preset — o coach também pode criar nomes próprios ao salvar conteúdo. */
export const EDUCATIONAL_CONTENT_CATEGORIES = [
  "Refeição Livre",
  "Hidratação",
  "Suplementação",
  "Sono",
  "Estratégias de Viagem",
  "Finais de Semana",
  "Educação Alimentar",
  "Periodização",
  "Tudo sobre treino",
] as const;

export type EducationalContentCategory = (typeof EDUCATIONAL_CONTENT_CATEGORIES)[number];

/** Une presets com categorias já usadas (extras alfabéticos, sem duplicata). */
export function mergeEducationalCategories(extra?: Array<string | null | undefined>): string[] {
  const presets = [...EDUCATIONAL_CONTENT_CATEGORIES];
  const seen = new Set(presets.map((c) => c.toLowerCase()));
  const extras: string[] = [];
  for (const raw of extra ?? []) {
    const name = typeof raw === "string" ? raw.trim() : "";
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    extras.push(name);
  }
  extras.sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  return [...presets, ...extras];
}

export interface EducationalContent {
  id: string;
  coach_id: string;
  title: string;
  description: string | null;
  category: string | null;
  content_type: EducationalContentType;
  file_url: string | null;
  article_content: string | null;
  video_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function contentTypeLabel(type: string): string {
  return EDUCATIONAL_CONTENT_TYPE_LABELS[type as EducationalContentType] ?? type;
}
