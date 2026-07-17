import type { Food } from '@/lib/foodService';

export type FoodCatalogItem = Food & {
  updated_at?: string | null;
  status?: string;
  versao_actual?: number;
  unidade_referencia?: string;
  fibra_por_referencia?: number | null;
  acucar_por_referencia?: number | null;
  sodio_por_referencia_mg?: number | null;
  qualidade_score?: number | null;
  flags_qualidade?: string[];
};

export type FoodCatalogListResponse = {
  items: FoodCatalogItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type FoodTipo = {
  id: string;
  nome_tipo: string;
  macro_predominante?: string | null;
  ordem_exibicao?: number;
};

export type FoodUsage = {
  dietas: number;
  itens: number;
  alunos: number;
};

export type FoodAuditEntry = {
  id: string;
  alimento_id: string;
  versao_de: number | null;
  versao_para: number | null;
  actor_id: string | null;
  actor_role: string | null;
  acao: string;
  campo: string | null;
  valor_anterior: unknown;
  valor_novo: unknown;
  metadata: Record<string, unknown>;
  criado_em: string;
};

export type FoodQualityReport = {
  total: number;
  active: number;
  draft: number;
  kcal_divergente: number;
  sem_categoria: number;
  baixa_qualidade: number;
};

export type FoodCatalogUpsertPayload = {
  nome: string;
  tipo_id: string;
  unidade_referencia?: 'g' | 'ml' | 'un';
  quantidade_referencia_g?: number;
  ptn_por_referencia?: number;
  cho_por_referencia?: number;
  lip_por_referencia?: number;
  alcool_por_referencia?: number;
  fibra_por_referencia?: number;
  acucar_por_referencia?: number;
  sodio_por_referencia_mg?: number;
  origem_ptn?: string;
  info_adicional?: string | null;
  motivo_alteracao?: string;
  propagar_dietas_activas?: boolean;
};

export type FoodSaveResult = {
  alimento: FoodCatalogItem;
  versao: number;
  changes: Array<{ campo: string; de: unknown; para: unknown }>;
  impacto?: FoodUsage | null;
  propagado?: boolean;
  itensPropagados?: number;
};
