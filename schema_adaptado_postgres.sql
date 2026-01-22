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
  refeicao text NOT NULL,
  dia_semana text,
  alimento_id uuid,
  CONSTRAINT itens_dieta_pkey PRIMARY KEY (id),
  CONSTRAINT itens_dieta_dieta_id_fkey FOREIGN KEY (dieta_id) REFERENCES public.dietas(id),
  CONSTRAINT itens_dieta_alimento_id_fkey FOREIGN KEY (alimento_id) REFERENCES public.alimentos(id)
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
  url text NOT NULL,
  descricao text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fotos_alunos_pkey PRIMARY KEY (id),
  CONSTRAINT fotos_alunos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id)
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

ALTER TABLE public.relatorios ADD CONSTRAINT IF NOT EXISTS relatorios_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.relatorio_templates(id);

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
-- COMENTÁRIOS
-- ============================================================================

COMMENT ON TABLE public.alunos IS 'Tabela principal de alunos do sistema';
COMMENT ON TABLE public.treinos IS 'Treinos cadastrados pelos coaches';
COMMENT ON TABLE public.dietas IS 'Dietas prescritas para alunos';
COMMENT ON TABLE public.conversas IS 'Conversas entre coach e aluno';
COMMENT ON TABLE public.weekly_checkins IS 'Check-ins semanais dos alunos';
