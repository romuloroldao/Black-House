-- ============================================================================
-- SCHEMA ADAPTADO PARA POSTGRESQL PURO
-- Substitui todas as referências de auth.users por app_auth.users
-- Remove dependências do Supabase Auth
-- ============================================================================

-- Criar tipos ENUM se não existirem
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('coach', 'aluno');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TABELAS DO SCHEMA PÚBLICO
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agenda_eventos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  aluno_id uuid,
  titulo text NOT NULL,
  descricao text,
  data_evento date NOT NULL,
  hora_evento time without time zone,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['retorno'::text, 'ajuste_dieta'::text, 'alteracao_treino'::text, 'avaliacao'::text, 'outro'::text])),
  status text NOT NULL DEFAULT 'pendente'::text CHECK (status = ANY (ARRAY['pendente'::text, 'concluido'::text, 'cancelado'::text])),
  prioridade text DEFAULT 'normal'::text CHECK (prioridade = ANY (ARRAY['baixa'::text, 'normal'::text, 'alta'::text])),
  notificacao_enviada boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT agenda_eventos_pkey PRIMARY KEY (id),
  CONSTRAINT agenda_eventos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT agenda_eventos_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.tipos_alimentos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome_tipo text NOT NULL UNIQUE,
  macro_predominante text,
  equiv_isocalorica boolean NOT NULL DEFAULT true,
  equiv_livre boolean NOT NULL DEFAULT false,
  ordem_exibicao integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tipos_alimentos_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.alimentos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  quantidade_referencia_g numeric NOT NULL DEFAULT 100,
  kcal_por_referencia numeric NOT NULL,
  cho_por_referencia numeric NOT NULL,
  ptn_por_referencia numeric NOT NULL,
  lip_por_referencia numeric NOT NULL,
  alcool_por_referencia numeric NOT NULL DEFAULT 0,
  origem_ptn text NOT NULL CHECK (origem_ptn = ANY (ARRAY['Vegetal'::text, 'Animal'::text, 'Mista'::text, 'N/A'::text])),
  tipo_id uuid,
  info_adicional text,
  autor text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT alimentos_pkey PRIMARY KEY (id),
  CONSTRAINT alimentos_novo_tipo_id_fkey FOREIGN KEY (tipo_id) REFERENCES public.tipos_alimentos(id)
);

CREATE TABLE IF NOT EXISTS public.alunos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text,
  email text NOT NULL DEFAULT ''::text UNIQUE,
  data_nascimento date,
  peso bigint,
  objetivo text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  coach_id uuid,
  cpf_cnpj text,
  telefone text,
  plano text,
  CONSTRAINT alunos_pkey PRIMARY KEY (id),
  CONSTRAINT alunos_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.treinos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  duracao integer NOT NULL DEFAULT 60,
  dificuldade text NOT NULL CHECK (dificuldade = ANY (ARRAY['Iniciante'::text, 'Intermediário'::text, 'Avançado'::text])),
  categoria text NOT NULL,
  num_exercicios integer DEFAULT 0,
  is_template boolean DEFAULT false,
  tags text[] DEFAULT '{}'::text[],
  coach_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  exercicios jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT treinos_pkey PRIMARY KEY (id),
  CONSTRAINT treinos_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.alunos_treinos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  treino_id uuid NOT NULL,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  data_expiracao date,
  dias_antecedencia_notificacao integer DEFAULT 7,
  notificacao_expiracao_enviada boolean DEFAULT false,
  CONSTRAINT alunos_treinos_pkey PRIMARY KEY (id),
  CONSTRAINT alunos_treinos_treino_id_fkey FOREIGN KEY (treino_id) REFERENCES public.treinos(id),
  CONSTRAINT alunos_treinos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id)
);

CREATE TABLE IF NOT EXISTS public.asaas_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL UNIQUE,
  is_sandbox boolean NOT NULL DEFAULT true,
  webhook_url text,
  asaas_api_key text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT asaas_config_pkey PRIMARY KEY (id),
  CONSTRAINT asaas_config_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.asaas_customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  asaas_customer_id text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT asaas_customers_pkey PRIMARY KEY (id),
  CONSTRAINT asaas_customers_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id)
);

CREATE TABLE IF NOT EXISTS public.asaas_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  asaas_payment_id text NOT NULL UNIQUE,
  asaas_customer_id text NOT NULL,
  value numeric NOT NULL,
  description text,
  billing_type text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING'::text,
  due_date date NOT NULL,
  invoice_url text,
  bank_slip_url text,
  pix_qr_code text,
  pix_copy_paste text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT asaas_payments_pkey PRIMARY KEY (id),
  CONSTRAINT asaas_payments_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT asaas_payments_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.avisos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  tipo text NOT NULL DEFAULT 'individual'::text,
  anexo_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT avisos_pkey PRIMARY KEY (id),
  CONSTRAINT avisos_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.turmas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  cor text DEFAULT '#3b82f6'::text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT turmas_pkey PRIMARY KEY (id),
  CONSTRAINT turmas_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.avisos_destinatarios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aviso_id uuid NOT NULL,
  aluno_id uuid,
  turma_id uuid,
  lido boolean NOT NULL DEFAULT false,
  lido_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT avisos_destinatarios_pkey PRIMARY KEY (id),
  CONSTRAINT avisos_destinatarios_aviso_id_fkey FOREIGN KEY (aviso_id) REFERENCES public.avisos(id),
  CONSTRAINT avisos_destinatarios_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT avisos_destinatarios_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id)
);

CREATE TABLE IF NOT EXISTS public.checkin_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  ultima_notificacao timestamp with time zone,
  proximo_lembrete timestamp with time zone NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT checkin_reminders_pkey PRIMARY KEY (id),
  CONSTRAINT checkin_reminders_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id)
);

CREATE TABLE IF NOT EXISTS public.coach_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  nome_completo text,
  bio text,
  especialidades text[] DEFAULT '{}'::text[],
  conquistas jsonb DEFAULT '[]'::jsonb,
  anos_experiencia integer DEFAULT 0,
  total_alunos_acompanhados integer DEFAULT 0,
  principais_resultados text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT coach_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT coach_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.conversas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  ultima_mensagem text,
  ultima_mensagem_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT conversas_pkey PRIMARY KEY (id),
  CONSTRAINT conversas_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id),
  CONSTRAINT conversas_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id)
);

CREATE TABLE IF NOT EXISTS public.dietas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  aluno_id uuid NOT NULL,
  nome text NOT NULL,
  objetivo text,
  data_criacao timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
  CONSTRAINT dietas_pkey PRIMARY KEY (id),
  CONSTRAINT dietas_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id)
);

CREATE TABLE IF NOT EXISTS public.dieta_farmacos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  dieta_id uuid NOT NULL,
  nome text NOT NULL,
  dosagem text NOT NULL,
  observacao text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT dieta_farmacos_pkey PRIMARY KEY (id),
  CONSTRAINT dieta_farmacos_dieta_id_fkey FOREIGN KEY (dieta_id) REFERENCES public.dietas(id)
);

CREATE TABLE IF NOT EXISTS public.itens_dieta (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  dieta_id uuid NOT NULL,
  quantidade double precision NOT NULL,
  unidade_quantidade text NOT NULL DEFAULT 'g'::text,
  refeicao text NOT NULL,
  dia_semana text,
  alimento_id uuid,
  CONSTRAINT itens_dieta_pkey PRIMARY KEY (id),
  CONSTRAINT itens_dieta_dieta_id_fkey FOREIGN KEY (dieta_id) REFERENCES public.dietas(id),
  CONSTRAINT itens_dieta_alimento_id_fkey FOREIGN KEY (alimento_id) REFERENCES public.alimentos(id),
  CONSTRAINT itens_dieta_unidade_quantidade_check CHECK ((unidade_quantidade = ANY (ARRAY['g'::text, 'ml'::text, 'un'::text])))
);

CREATE TABLE IF NOT EXISTS public.eventos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  turma_id uuid,
  titulo text NOT NULL,
  descricao text,
  data_inicio timestamp with time zone NOT NULL,
  hora_inicio time without time zone NOT NULL,
  duracao_minutos integer NOT NULL DEFAULT 60,
  recorrencia text NOT NULL DEFAULT 'unica'::text,
  recorrencia_config jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'agendado'::text,
  link_online text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT eventos_pkey PRIMARY KEY (id),
  CONSTRAINT eventos_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id),
  CONSTRAINT eventos_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.eventos_participantes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  confirmado boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT eventos_participantes_pkey PRIMARY KEY (id),
  CONSTRAINT eventos_participantes_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.eventos(id),
  CONSTRAINT eventos_participantes_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id)
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  descricao text NOT NULL,
  valor numeric NOT NULL,
  categoria text NOT NULL,
  data_vencimento date NOT NULL,
  data_pagamento date,
  status text NOT NULL DEFAULT 'pendente'::text CHECK (status = ANY (ARRAY['pendente'::text, 'pago'::text, 'atrasado'::text, 'cancelado'::text])),
  forma_pagamento text,
  observacoes text,
  recorrente boolean DEFAULT false,
  frequencia_recorrencia text CHECK (frequencia_recorrencia = ANY (ARRAY['mensal'::text, 'trimestral'::text, 'semestral'::text, 'anual'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT expenses_pkey PRIMARY KEY (id),
  CONSTRAINT expenses_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.feedbacks_alunos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  coach_id uuid NOT NULL,
  feedback text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT feedbacks_alunos_pkey PRIMARY KEY (id),
  CONSTRAINT feedbacks_alunos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT feedbacks_alunos_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.financial_exceptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  motivo text NOT NULL,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['isento'::text, 'desconto'::text, 'acordo_pagamento'::text, 'bolsa'::text])),
  valor_desconto numeric,
  percentual_desconto numeric,
  data_inicio date NOT NULL,
  data_fim date,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT financial_exceptions_pkey PRIMARY KEY (id),
  CONSTRAINT financial_exceptions_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id),
  CONSTRAINT financial_exceptions_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id)
);

CREATE TABLE IF NOT EXISTS public.fotos_alunos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  coach_id uuid,
  url text NOT NULL,
  descricao text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fotos_alunos_pkey PRIMARY KEY (id),
  CONSTRAINT fotos_alunos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT fotos_alunos_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.lembretes_eventos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  tipo_lembrete text NOT NULL,
  enviado boolean NOT NULL DEFAULT false,
  enviado_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lembretes_eventos_pkey PRIMARY KEY (id),
  CONSTRAINT lembretes_eventos_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.eventos(id),
  CONSTRAINT lembretes_eventos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id)
);

CREATE TABLE IF NOT EXISTS public.lives (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  youtube_stream_key text,
  youtube_url text,
  data_agendamento date NOT NULL,
  hora_agendamento time without time zone NOT NULL,
  duracao integer NOT NULL DEFAULT 60,
  status text NOT NULL CHECK (status = ANY (ARRAY['scheduled'::text, 'live'::text, 'ended'::text])),
  visibilidade text NOT NULL CHECK (visibilidade = ANY (ARRAY['active-students'::text, 'inactive-students'::text, 'guests'::text, 'everyone'::text])),
  max_participantes integer DEFAULT 100,
  num_inscricoes integer DEFAULT 0,
  lembretes_ativados boolean DEFAULT true,
  auto_gravar boolean DEFAULT true,
  tags text[] DEFAULT '{}'::text[],
  coach_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lives_pkey PRIMARY KEY (id),
  CONSTRAINT lives_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.mensagens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL,
  remetente_id uuid NOT NULL,
  conteudo text NOT NULL,
  lida boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT mensagens_pkey PRIMARY KEY (id),
  CONSTRAINT mensagens_conversa_id_fkey FOREIGN KEY (conversa_id) REFERENCES public.conversas(id),
  CONSTRAINT mensagens_remetente_id_fkey FOREIGN KEY (remetente_id) REFERENCES app_auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  aluno_id uuid,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  lida boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notificacoes_pkey PRIMARY KEY (id),
  CONSTRAINT notificacoes_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id),
  CONSTRAINT notificacoes_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id)
);

CREATE TABLE IF NOT EXISTS public.payment_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  nome text NOT NULL,
  valor numeric NOT NULL,
  descricao text,
  dia_vencimento integer NOT NULL CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31),
  frequencia text NOT NULL CHECK (frequencia = ANY (ARRAY['mensal'::text, 'trimestral'::text, 'semestral'::text, 'anual'::text])),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payment_plans_pkey PRIMARY KEY (id),
  CONSTRAINT payment_plans_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.planos_pagamento (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  nome text NOT NULL,
  valor numeric NOT NULL,
  frequencia text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT planos_pagamento_pkey PRIMARY KEY (id),
  CONSTRAINT planos_pagamento_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  avatar_url text,
  display_name text,
  phone text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES app_auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.recurring_charges_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  payment_plan_id uuid,
  valor_customizado numeric,
  dia_vencimento_customizado integer CHECK (dia_vencimento_customizado >= 1 AND dia_vencimento_customizado <= 31),
  ativo boolean NOT NULL DEFAULT true,
  enviar_lembrete boolean DEFAULT true,
  dias_antecedencia_lembrete integer DEFAULT 3,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recurring_charges_config_pkey PRIMARY KEY (id),
  CONSTRAINT recurring_charges_config_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id),
  CONSTRAINT recurring_charges_config_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT recurring_charges_config_payment_plan_id_fkey FOREIGN KEY (payment_plan_id) REFERENCES public.payment_plans(id)
);

CREATE TABLE IF NOT EXISTS public.relatorios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  template_id uuid,
  titulo text NOT NULL,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  observacoes text,
  metricas jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'rascunho'::text CHECK (status = ANY (ARRAY['rascunho'::text, 'enviado'::text, 'visualizado'::text])),
  enviado_em timestamp with time zone,
  visualizado_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT relatorios_pkey PRIMARY KEY (id),
  CONSTRAINT relatorios_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT relatorios_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.relatorio_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  campos jsonb NOT NULL DEFAULT '[]'::jsonb,
  layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT relatorio_templates_pkey PRIMARY KEY (id),
  CONSTRAINT relatorio_templates_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'relatorios_template_id_fkey'
  ) THEN
    ALTER TABLE public.relatorios
      ADD CONSTRAINT relatorios_template_id_fkey
      FOREIGN KEY (template_id) REFERENCES public.relatorio_templates(id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.relatorio_feedbacks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  relatorio_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  comentario text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT relatorio_feedbacks_pkey PRIMARY KEY (id),
  CONSTRAINT relatorio_feedbacks_relatorio_id_fkey FOREIGN KEY (relatorio_id) REFERENCES public.relatorios(id),
  CONSTRAINT relatorio_feedbacks_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id)
);

CREATE TABLE IF NOT EXISTS public.relatorio_midias (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  relatorio_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['foto'::text, 'video'::text])),
  url text NOT NULL,
  legenda text,
  ordem integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT relatorio_midias_pkey PRIMARY KEY (id),
  CONSTRAINT relatorio_midias_relatorio_id_fkey FOREIGN KEY (relatorio_id) REFERENCES public.relatorios(id)
);

CREATE TABLE IF NOT EXISTS public.turmas_alunos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  turma_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT turmas_alunos_pkey PRIMARY KEY (id),
  CONSTRAINT turmas_alunos_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id),
  CONSTRAINT turmas_alunos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id)
);

CREATE TABLE IF NOT EXISTS public.twilio_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  account_sid text,
  auth_token text,
  whatsapp_from text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT twilio_config_pkey PRIMARY KEY (id),
  CONSTRAINT twilio_config_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  role user_role NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.videos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  youtube_id text NOT NULL,
  duracao text,
  categoria text NOT NULL,
  visibilidade text NOT NULL CHECK (visibilidade = ANY (ARRAY['active-students'::text, 'inactive-students'::text, 'guests'::text, 'everyone'::text])),
  tags text[] DEFAULT '{}'::text[],
  views integer DEFAULT 0,
  likes integer DEFAULT 0,
  instrutor text,
  coach_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT videos_pkey PRIMARY KEY (id),
  CONSTRAINT videos_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.weekly_checkins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  beliscou_fora_plano text NOT NULL CHECK (beliscou_fora_plano = ANY (ARRAY['prejudicando'::text, 'comprometido'::text])),
  seguiu_plano_nota integer NOT NULL CHECK (seguiu_plano_nota >= 1 AND seguiu_plano_nota <= 5),
  apetite text NOT NULL CHECK (apetite = ANY (ARRAY['alto'::text, 'normal'::text, 'ruim'::text])),
  treinou_todas_sessoes boolean NOT NULL,
  desafiou_treinos boolean NOT NULL,
  fez_cardio boolean NOT NULL,
  seguiu_suplementacao boolean NOT NULL,
  recursos_hormonais text NOT NULL CHECK (recursos_hormonais = ANY (ARRAY['sim'::text, 'nao'::text, 'nao_uso'::text])),
  ingeriu_agua_minima boolean NOT NULL,
  exposicao_sol boolean NOT NULL,
  pressao_arterial text,
  glicemia text,
  media_horas_sono text NOT NULL CHECK (media_horas_sono = ANY (ARRAY['4-5'::text, '5-6'::text, '6-8'::text])),
  dificuldade_adormecer boolean NOT NULL,
  acordou_noite text,
  estresse_semana boolean NOT NULL,
  lida_desafios text NOT NULL CHECK (lida_desafios = ANY (ARRAY['nao_lida_bem'::text, 'as_vezes_abate'::text, 'lida_bem'::text])),
  convivio_familiar text NOT NULL CHECK (convivio_familiar = ANY (ARRAY['ruim'::text, 'bom'::text, 'otimo'::text])),
  convivio_trabalho text NOT NULL CHECK (convivio_trabalho = ANY (ARRAY['ruim'::text, 'bom'::text, 'otimo'::text])),
  postura_problemas text NOT NULL CHECK (postura_problemas = ANY (ARRAY['nao_sabe_resolver'::text, 'resiliente'::text])),
  higiene_sono boolean NOT NULL,
  autoestima integer NOT NULL CHECK (autoestima >= 1 AND autoestima <= 5),
  media_evacuacoes text NOT NULL CHECK (media_evacuacoes = ANY (ARRAY['dias_sem'::text, '1'::text, '2'::text, '3'::text, 'mais_4'::text])),
  formato_fezes text NOT NULL CHECK (formato_fezes = ANY (ARRAY['tipo1'::text, 'tipo2'::text, 'tipo3'::text, 'tipo4'::text, 'tipo5'::text, 'tipo6'::text, 'tipo7'::text])),
  nao_cumpriu_porque text,
  status text DEFAULT 'concluido'::text,
  CONSTRAINT weekly_checkins_pkey PRIMARY KEY (id),
  CONSTRAINT weekly_checkins_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id)
);

-- ============================================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_alunos_coach_id ON public.alunos(coach_id);
CREATE INDEX IF NOT EXISTS idx_alunos_email ON public.alunos(email);
CREATE INDEX IF NOT EXISTS idx_treinos_coach_id ON public.treinos(coach_id);
CREATE INDEX IF NOT EXISTS idx_alunos_treinos_aluno_id ON public.alunos_treinos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_alunos_treinos_treino_id ON public.alunos_treinos(treino_id);
CREATE INDEX IF NOT EXISTS idx_conversas_coach_id ON public.conversas(coach_id);
CREATE INDEX IF NOT EXISTS idx_conversas_aluno_id ON public.conversas(aluno_id);
CREATE INDEX IF NOT EXISTS idx_dietas_aluno_id ON public.dietas(aluno_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_id ON public.mensagens(conversa_id);
CREATE INDEX IF NOT EXISTS idx_weekly_checkins_aluno_id ON public.weekly_checkins(aluno_id);
CREATE INDEX IF NOT EXISTS idx_fotos_alunos_aluno_id ON public.fotos_alunos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_eventos_coach_id ON public.eventos(coach_id);
CREATE INDEX IF NOT EXISTS idx_asaas_payments_aluno_id ON public.asaas_payments(aluno_id);
CREATE INDEX IF NOT EXISTS idx_asaas_payments_coach_id ON public.asaas_payments(coach_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_coach_id ON public.payment_plans(coach_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_coach_id ON public.notificacoes(coach_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_aluno_id ON public.notificacoes(aluno_id);

-- ============================================================================
-- TRIGGERS PARA UPDATED_AT
-- ============================================================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em todas as tabelas com updated_at
DO $$ 
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND column_name = 'updated_at'
        AND table_name NOT IN (
            SELECT tgtable.relname 
            FROM pg_trigger t
            JOIN pg_class tgtable ON t.tgrelid = tgtable.oid
            WHERE tgname = 'update_updated_at'
        )
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_updated_at ON public.%I;
            CREATE TRIGGER update_updated_at
            BEFORE UPDATE ON public.%I
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
        ', tbl.table_name, tbl.table_name);
    END LOOP;
END $$;

-- ============================================================================
-- Patch idempotente: fotos_alunos.coach_id (denormaliza o coach do aluno)
-- ============================================================================

ALTER TABLE public.fotos_alunos
  ADD COLUMN IF NOT EXISTS coach_id uuid;

UPDATE public.fotos_alunos f
SET coach_id = a.coach_id
FROM public.alunos a
WHERE f.aluno_id = a.id
  AND f.coach_id IS NULL
  AND a.coach_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fotos_alunos_coach_id_fkey'
  ) THEN
    ALTER TABLE public.fotos_alunos
      ADD CONSTRAINT fotos_alunos_coach_id_fkey
      FOREIGN KEY (coach_id) REFERENCES app_auth.users(id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_fotos_alunos_coach_id ON public.fotos_alunos(coach_id);

-- ============================================================================
-- Patch: campos opcionais em profiles (PATCH /api/profiles/me)
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- ============================================================================
-- Sincronização coach_id em fotos_alunos
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_fotos_alunos_coach_id_from_aluno()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT a.coach_id
    INTO NEW.coach_id
  FROM public.alunos a
  WHERE a.id = NEW.aluno_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_fotos_alunos_coach_id ON public.fotos_alunos;
CREATE TRIGGER trg_sync_fotos_alunos_coach_id
BEFORE INSERT OR UPDATE OF aluno_id ON public.fotos_alunos
FOR EACH ROW
EXECUTE FUNCTION public.sync_fotos_alunos_coach_id_from_aluno();

CREATE OR REPLACE FUNCTION public.propagate_aluno_coach_to_fotos()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.coach_id IS DISTINCT FROM OLD.coach_id THEN
    UPDATE public.fotos_alunos
       SET coach_id = NEW.coach_id
     WHERE aluno_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_aluno_coach_to_fotos ON public.alunos;
CREATE TRIGGER trg_propagate_aluno_coach_to_fotos
AFTER UPDATE OF coach_id ON public.alunos
FOR EACH ROW
EXECUTE FUNCTION public.propagate_aluno_coach_to_fotos();

-- Coluna opcional em bases já criadas (CREATE TABLE IF NOT EXISTS não acrescenta colunas novas)
ALTER TABLE public.asaas_config ADD COLUMN IF NOT EXISTS asaas_api_key text;

-- Precisão nutricional: álcool (7 kcal/g) + unidade da quantidade no item da dieta
ALTER TABLE public.alimentos ADD COLUMN IF NOT EXISTS alcool_por_referencia numeric NOT NULL DEFAULT 0;

ALTER TABLE public.itens_dieta ADD COLUMN IF NOT EXISTS unidade_quantidade text NOT NULL DEFAULT 'g';
ALTER TABLE public.itens_dieta DROP CONSTRAINT IF EXISTS itens_dieta_unidade_quantidade_check;
ALTER TABLE public.itens_dieta ADD CONSTRAINT itens_dieta_unidade_quantidade_check CHECK (
  unidade_quantidade = ANY (ARRAY['g'::text, 'ml'::text, 'un'::text])
);

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================

COMMENT ON TABLE public.alunos IS 'Tabela principal de alunos do sistema';
COMMENT ON TABLE public.treinos IS 'Treinos cadastrados pelos coaches';
COMMENT ON TABLE public.dietas IS 'Dietas prescritas para alunos';
COMMENT ON TABLE public.conversas IS 'Conversas entre coach e aluno';
COMMENT ON TABLE public.weekly_checkins IS 'Check-ins semanais dos alunos';

-- ============================================================================
-- Retorno dieta/treino + preferências de notificação do aluno
-- (detalhe em server/migrations/20260520_return_reminders.sql)
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.automation_domain AS ENUM ('diet', 'workout');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.return_milestone AS ENUM ('D_MINUS_2', 'D_MINUS_1', 'D_DAY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.student_notification_channel AS ENUM ('in_app_only', 'in_app_and_email');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS notification_channel public.student_notification_channel
    NOT NULL DEFAULT 'in_app_and_email';

ALTER TABLE public.dietas
  ADD COLUMN IF NOT EXISTS data_retorno date,
  ADD COLUMN IF NOT EXISTS ativa boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS schedule_cycle_id uuid,
  ADD COLUMN IF NOT EXISTS rotacao_ativa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rotacao_dias_plano_a smallint,
  ADD COLUMN IF NOT EXISTS rotacao_dias_plano_b smallint,
  ADD COLUMN IF NOT EXISTS rotacao_plano_inicial text NOT NULL DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS rotacao_data_inicio date;

ALTER TABLE public.alunos_treinos
  ADD COLUMN IF NOT EXISTS data_retorno date,
  ADD COLUMN IF NOT EXISTS schedule_cycle_id uuid;

CREATE TABLE IF NOT EXISTS public.return_reminder_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain public.automation_domain NOT NULL,
  entity_id uuid NOT NULL,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
  schedule_cycle_id uuid NOT NULL,
  milestone public.return_milestone NOT NULL,
  return_date date NOT NULL,
  notification_channel public.student_notification_channel,
  email_status text NOT NULL DEFAULT 'pending',
  email_provider text,
  email_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT return_reminder_dispatches_unique
    UNIQUE (domain, entity_id, schedule_cycle_id, milestone)
);

-- Lembretes de Agenda para coach (server/migrations/20260521_agenda_coach_reminders.sql)
DO $$ BEGIN
  CREATE TYPE public.agenda_coach_milestone AS ENUM ('D_MINUS_2', 'D_MINUS_1', 'D_DAY', 'OVERDUE_DAILY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.coach_notification_channel AS ENUM ('in_app_only', 'in_app_and_email');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.coach_profiles
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS notification_channel public.coach_notification_channel
    NOT NULL DEFAULT 'in_app_and_email';

ALTER TABLE public.agenda_eventos
  ADD COLUMN IF NOT EXISTS reminder_cycle_id uuid,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id uuid;

CREATE TABLE IF NOT EXISTS public.agenda_coach_reminder_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_evento_id uuid NOT NULL REFERENCES public.agenda_eventos(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
  aluno_id uuid REFERENCES public.alunos(id) ON DELETE SET NULL,
  reminder_cycle_id uuid NOT NULL,
  milestone public.agenda_coach_milestone NOT NULL,
  event_date date NOT NULL,
  event_tipo text NOT NULL,
  dispatch_on date NOT NULL DEFAULT CURRENT_DATE,
  notification_channel public.coach_notification_channel,
  email_status text NOT NULL DEFAULT 'pending',
  email_provider text,
  email_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agenda_coach_reminder_dispatches_cycle_unique
    UNIQUE (agenda_evento_id, reminder_cycle_id, milestone),
  CONSTRAINT agenda_coach_reminder_dispatches_overdue_daily_unique
    UNIQUE (agenda_evento_id, milestone, dispatch_on)
);

-- CRM, equipa, snooze, tipos consulta/acompanhamento (server/migrations/20260522_agenda_crm_team.sql)
DO $$ BEGIN ALTER TYPE public.user_role ADD VALUE 'assistant'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.agenda_eventos DROP CONSTRAINT IF EXISTS agenda_eventos_tipo_check;
ALTER TABLE public.agenda_eventos ADD CONSTRAINT agenda_eventos_tipo_check CHECK (
  tipo = ANY (ARRAY['retorno','ajuste_dieta','alteracao_treino','avaliacao','outro','consulta','acompanhamento']::text[])
);

ALTER TABLE public.agenda_eventos ADD COLUMN IF NOT EXISTS snoozed_until date;
ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS ultimo_contato_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultimo_contato_tipo text,
  ADD COLUMN IF NOT EXISTS ultimo_contato_resumo text,
  ADD COLUMN IF NOT EXISTS ultimo_contato_agenda_evento_id uuid;

CREATE TABLE IF NOT EXISTS public.coach_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_coach_id uuid NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
  member_user_id uuid NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
  team_role text NOT NULL DEFAULT 'assistant' CHECK (team_role IN ('assistant','viewer')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coach_team_members_unique UNIQUE (owner_coach_id, member_user_id)
);
