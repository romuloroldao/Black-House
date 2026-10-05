/** Tipos e categorias da biblioteca de conteúdo educativo. */

export const EDUCATIONAL_CONTENT_TYPES = ["pdf", "article", "video"] as const;
export type EducationalContentType = (typeof EDUCATIONAL_CONTENT_TYPES)[number];

export const EDUCATIONAL_CONTENT_TYPE_LABELS: Record<EducationalContentType, string> = {
  pdf: "PDF",
  article: "Artigo",
  video: "Vídeo",
};

/** Categorias extensíveis — Refeição Livre, Periodizações de Treino e outras secções. */
export const EDUCATIONAL_CONTENT_CATEGORIES = [
  "Refeição Livre",
  "Periodizações de Treino",
  "Hidratação",
  "Suplementação",
  "Sono",
  "Estratégias de Viagem",
  "Finais de Semana",
  "Educação Alimentar",
] as const;

/** Categoria usada na caixa de periodização na ficha de treino. */
export const PERIODIZACAO_TREINO_CATEGORY = "Periodizações de Treino" as const;

export type EducationalContentCategory = (typeof EDUCATIONAL_CONTENT_CATEGORIES)[number];

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
