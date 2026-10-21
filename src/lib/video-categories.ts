/** Categorias da galeria de vídeos (coach + portal aluno). */
export const VIDEO_CATEGORIES = [
  "Técnica para Exercícios",
  "Técnica",
  "Nutrição",
  "Saúde",
  "Cardio",
  "Funcional",
] as const;

export type VideoCategory = (typeof VIDEO_CATEGORIES)[number];

export const VIDEO_CATEGORY_FILTER_ALL = "all";
