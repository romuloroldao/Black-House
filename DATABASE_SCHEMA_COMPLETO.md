# 📊 Mapa Completo do Banco de Dados

> Documentação detalhada de todas as tabelas, colunas, tipos e relacionamentos do projeto.

---

## 📋 Índice de Tabelas

| # | Tabela | Descrição |
|---|--------|-----------|
| 1 | `agenda_eventos` | Eventos agendados do coach com alunos |
| 2 | `alimentos` | Cadastro de alimentos para dietas |
| 3 | `alunos` | Cadastro principal de alunos |
| 4 | `alunos_treinos` | Relação aluno ↔ treino atribuído |
| 5 | `asaas_config` | Configuração da integração Asaas |
| 6 | `asaas_customers` | Clientes cadastrados no Asaas |
| 7 | `asaas_payments` | Pagamentos via Asaas |
| 8 | `avisos` | Avisos enviados pelo coach |
| 9 | `avisos_destinatarios` | Destinatários dos avisos |
| 10 | `checkin_reminders` | Lembretes de check-in semanal |
| 11 | `coach_profiles` | Perfil do coach |
| 12 | `conversas` | Conversas de chat |
| 13 | `dietas` | Dietas criadas para alunos |
| 14 | `dieta_farmacos` | Fármacos associados às dietas |
| 15 | `eventos` | Eventos/lives agendados |
| 16 | `eventos_participantes` | Participantes dos eventos |
| 17 | `expenses` | Despesas do coach |
| 18 | `feedbacks_alunos` | Feedbacks dados aos alunos |
| 19 | `financial_exceptions` | Exceções financeiras (descontos) |
| 20 | `fotos_alunos` | Fotos de progresso dos alunos |
| 21 | `itens_dieta` | Itens/alimentos de cada dieta |
| 22 | `lembretes_eventos` | Lembretes enviados para eventos |
| 23 | `lives` | Lives agendadas |
| 24 | `mensagens` | Mensagens do chat |
| 25 | `notificacoes` | Notificações do sistema |
| 26 | `payment_plans` | Planos de pagamento |
| 27 | `planos_pagamento` | Planos de pagamento (legacy) |
| 28 | `profiles` | Perfis de usuário (auth) |
| 29 | `recurring_charges_config` | Config de cobranças recorrentes |
| 30 | `relatorio_feedbacks` | Feedbacks em relatórios |
| 31 | `relatorio_midias` | Mídias dos relatórios |
| 32 | `treinos` | Treinos cadastrados |
| 33 | `turmas` | Turmas/grupos de alunos |
| 34 | `turmas_alunos` | Relação turma ↔ aluno |
| 35 | `user_roles` | Papéis de usuário |
| 36 | `videos` | Vídeos cadastrados |
| 37 | `weekly_checkins` | Check-ins semanais dos alunos |

---

## 🗄️ Estrutura Detalhada das Tabelas

### 1. `agenda_eventos`
**Descrição:** Eventos agendados na agenda do coach

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `coach_id` | `uuid` | NO | - | FK → auth.users |
| `aluno_id` | `uuid` | YES | - | FK → alunos.id |
| `titulo` | `text` | NO | - | Título do evento |
| `descricao` | `text` | YES | - | Descrição |
| `data_evento` | `date` | NO | - | Data do evento |
| `hora_evento` | `time` | YES | - | Hora do evento |
| `tipo` | `text` | NO | - | Tipo: 'consulta', 'avaliacao', etc |
| `status` | `text` | NO | `'pendente'` | Status: 'pendente', 'concluido', 'cancelado' |
| `prioridade` | `text` | YES | `'normal'` | Prioridade: 'baixa', 'normal', 'alta' |
| `notificacao_enviada` | `boolean` | YES | `false` | Se notificação foi enviada |
| `created_at` | `timestamptz` | YES | `now()` | Data criação |
| `updated_at` | `timestamptz` | YES | `now()` | Data atualização |

---

### 2. `alimentos`
**Descrição:** Cadastro de alimentos para criação de dietas

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `nome` | `text` | NO | - | Nome do alimento |
| `origem_ptn` | `text` | NO | - | Origem proteína: 'animal', 'vegetal', 'mista' |
| `tipo_id` | `uuid` | YES | - | FK → tipo de alimento |
| `quantidade_referencia_g` | `numeric` | NO | `100` | Quantidade de referência em gramas |
| `kcal_por_referencia` | `numeric` | NO | - | Calorias por referência |
| `ptn_por_referencia` | `numeric` | NO | - | Proteína por referência |
| `cho_por_referencia` | `numeric` | NO | - | Carboidrato por referência |
| `lip_por_referencia` | `numeric` | NO | - | Lipídio por referência |
| `info_adicional` | `text` | YES | - | Informações adicionais |
| `autor` | `text` | YES | - | ID do coach que criou |
| `created_at` | `timestamptz` | YES | `now()` | Data criação |

---

### 3. `alunos`
**Descrição:** Cadastro principal de alunos

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `coach_id` | `uuid` | YES | - | FK → auth.users (coach) |
| `nome` | `text` | YES | - | Nome completo |
| `email` | `text` | NO | `''` | Email (usado para login) |
| `telefone` | `text` | YES | - | Telefone |
| `cpf_cnpj` | `text` | YES | - | CPF ou CNPJ |
| `data_nascimento` | `date` | YES | - | Data de nascimento |
| `peso` | `bigint` | YES | - | Peso em kg |
| `objetivo` | `text` | YES | - | Objetivo do aluno |
| `plano` | `text` | YES | - | Plano contratado |
| `created_at` | `timestamptz` | NO | `now()` | Data criação |

**⚠️ IMPORTANTE:** O campo `email` é usado para vincular o aluno ao usuário autenticado via `auth.jwt() ->> 'email'`

---

### 4. `alunos_treinos`
**Descrição:** Relação entre alunos e treinos atribuídos

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `aluno_id` | `uuid` | NO | - | FK → alunos.id |
| `treino_id` | `uuid` | NO | - | FK → treinos.id |
| `data_inicio` | `date` | NO | `CURRENT_DATE` | Data início do treino |
| `data_expiracao` | `date` | YES | - | Data expiração |
| `ativo` | `boolean` | YES | `true` | Se está ativo |
| `dias_antecedencia_notificacao` | `integer` | YES | `7` | Dias antes para notificar |
| `notificacao_expiracao_enviada` | `boolean` | YES | `false` | Se notificação foi enviada |
| `created_at` | `timestamptz` | YES | `now()` | Data criação |

---

### 5. `asaas_config`
**Descrição:** Configuração da integração com Asaas (gateway de pagamento)

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `coach_id` | `uuid` | NO | - | FK → auth.users |
| `is_sandbox` | `boolean` | NO | `true` | Se usa ambiente sandbox |
| `webhook_url` | `text` | YES | - | URL do webhook |
| `created_at` | `timestamptz` | NO | `now()` | Data criação |
| `updated_at` | `timestamptz` | NO | `now()` | Data atualização |

**⚠️ NOTA:** A API Key do Asaas é armazenada como secret, não no banco

---

### 6. `asaas_customers`
**Descrição:** Clientes cadastrados no Asaas

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `aluno_id` | `uuid` | NO | - | FK → alunos.id |
| `asaas_customer_id` | `text` | NO | - | ID do cliente no Asaas |
| `created_at` | `timestamptz` | NO | `now()` | Data criação |
| `updated_at` | `timestamptz` | NO | `now()` | Data atualização |

---

### 7. `asaas_payments`
**Descrição:** Pagamentos registrados via Asaas

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `coach_id` | `uuid` | NO | - | FK → auth.users |
| `aluno_id` | `uuid` | NO | - | FK → alunos.id |
| `asaas_payment_id` | `text` | NO | - | ID do pagamento no Asaas |
| `asaas_customer_id` | `text` | NO | - | ID do cliente no Asaas |
| `value` | `numeric` | NO | - | Valor do pagamento |
| `due_date` | `date` | NO | - | Data de vencimento |
| `billing_type` | `text` | NO | - | Tipo: 'PIX', 'BOLETO', 'CREDIT_CARD' |
| `status` | `text` | NO | `'PENDING'` | Status do pagamento |
| `description` | `text` | YES | - | Descrição |
| `invoice_url` | `text` | YES | - | URL da fatura |
| `bank_slip_url` | `text` | YES | - | URL do boleto |
| `pix_qr_code` | `text` | YES | - | QR Code PIX (base64) |
| `pix_copy_paste` | `text` | YES | - | Código PIX copia e cola |
| `created_at` | `timestamptz` | NO | `now()` | Data criação |
| `updated_at` | `timestamptz` | NO | `now()` | Data atualização |

**Status possíveis:** `PENDING`, `RECEIVED`, `CONFIRMED`, `OVERDUE`, `REFUNDED`, `RECEIVED_IN_CASH`, `REFUND_REQUESTED`, `REFUND_IN_PROGRESS`, `CHARGEBACK_REQUESTED`, `CHARGEBACK_DISPUTE`, `AWAITING_CHARGEBACK_REVERSAL`, `DUNNING_REQUESTED`, `DUNNING_RECEIVED`, `AWAITING_RISK_ANALYSIS`

---

### 8. `avisos`
**Descrição:** Avisos enviados pelo coach

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `coach_id` | `uuid` | NO | - | FK → auth.users |
| `titulo` | `text` | NO | - | Título do aviso |
| `mensagem` | `text` | NO | - | Conteúdo do aviso |
| `tipo` | `text` | NO | `'individual'` | Tipo: 'individual', 'turma', 'geral' |
| `anexo_url` | `text` | YES | - | URL do anexo |
| `created_at` | `timestamptz` | NO | `now()` | Data criação |

---

### 9. `avisos_destinatarios`
**Descrição:** Destinatários dos avisos

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `aviso_id` | `uuid` | NO | - | FK → avisos.id |
| `aluno_id` | `uuid` | YES | - | FK → alunos.id (se individual) |
| `turma_id` | `uuid` | YES | - | FK → turmas.id (se turma) |
| `lido` | `boolean` | NO | `false` | Se foi lido |
| `lido_em` | `timestamptz` | YES | - | Data da leitura |
| `created_at` | `timestamptz` | NO | `now()` | Data criação |

---

### 10. `checkin_reminders`
**Descrição:** Lembretes de check-in semanal

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `aluno_id` | `uuid` | NO | - | FK → alunos.id |
| `ativo` | `boolean` | YES | `true` | Se está ativo |
| `proximo_lembrete` | `timestamptz` | NO | - | Data do próximo lembrete |
| `ultima_notificacao` | `timestamptz` | YES | - | Data última notificação |
| `created_at` | `timestamptz` | YES | `now()` | Data criação |

---

### 11. `coach_profiles`
**Descrição:** Perfil do coach

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | NO | - | FK → auth.users |
| `nome_completo` | `text` | YES | - | Nome completo |
| `bio` | `text` | YES | - | Biografia |
| `avatar_url` | `text` | YES | - | URL do avatar |
| `especialidades` | `text[]` | YES | `'{}'` | Array de especialidades |
| `anos_experiencia` | `integer` | YES | `0` | Anos de experiência |
| `total_alunos_acompanhados` | `integer` | YES | `0` | Total de alunos |
| `principais_resultados` | `text` | YES | - | Principais resultados |
| `conquistas` | `jsonb` | YES | `'[]'` | Array JSON de conquistas |
| `created_at` | `timestamptz` | YES | `now()` | Data criação |
| `updated_at` | `timestamptz` | YES | `now()` | Data atualização |

---

### 12. `conversas`
**Descrição:** Conversas de chat entre coach e aluno

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `coach_id` | `uuid` | NO | - | FK → auth.users |
| `aluno_id` | `uuid` | NO | - | FK → alunos.id |
| `ultima_mensagem` | `text` | YES | - | Prévia da última mensagem |
| `ultima_mensagem_em` | `timestamptz` | YES | - | Data da última mensagem |
| `created_at` | `timestamptz` | NO | `now()` | Data criação |
| `updated_at` | `timestamptz` | NO | `now()` | Data atualização |

---

### 13. `dietas`
**Descrição:** Dietas criadas para alunos

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `aluno_id` | `uuid` | NO | `auth.uid()` | FK → alunos.id |
| `nome` | `text` | NO | - | Nome da dieta |
| `objetivo` | `text` | YES | - | Objetivo da dieta |
| `data_criacao` | `timestamptz` | YES | `now() AT TIME ZONE 'utc'` | Data criação |
| `created_at` | `timestamptz` | NO | `now()` | Data criação |

---

### 14. `dieta_farmacos`
**Descrição:** Fármacos/suplementos associados às dietas

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `dieta_id` | `uuid` | NO | - | FK → dietas.id |
| `nome` | `text` | NO | - | Nome do fármaco |
| `dosagem` | `text` | NO | - | Dosagem |
| `observacao` | `text` | YES | - | Observações |
| `created_at` | `timestamptz` | NO | `now()` | Data criação |

---

### 15. `eventos`
**Descrição:** Eventos/lives do coach

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `coach_id` | `uuid` | NO | - | FK → auth.users |
| `turma_id` | `uuid` | YES | - | FK → turmas.id |
| `titulo` | `text` | NO | - | Título do evento |
| `descricao` | `text` | YES | - | Descrição |
| `data_inicio` | `timestamptz` | NO | - | Data/hora início |
| `hora_inicio` | `time` | NO | - | Hora início |
| `duracao_minutos` | `integer` | NO | `60` | Duração em minutos |
| `status` | `text` | NO | `'agendado'` | Status: 'agendado', 'em_andamento', 'concluido', 'cancelado' |
| `recorrencia` | `text` | NO | `'unica'` | Recorrência: 'unica', 'semanal', 'mensal' |
| `recorrencia_config` | `jsonb` | YES | `'{}'` | Configuração de recorrência |
| `link_online` | `text` | YES | - | Link para evento online |
| `created_at` | `timestamptz` | NO | `now()` | Data criação |
| `updated_at` | `timestamptz` | NO | `now()` | Data atualização |

---

### 16. `eventos_participantes`
**Descrição:** Participantes dos eventos

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `evento_id` | `uuid` | NO | - | FK → eventos.id |
| `aluno_id` | `uuid` | NO | - | FK → alunos.id |
| `confirmado` | `boolean` | YES | `false` | Se confirmou presença |
| `created_at` | `timestamptz` | NO | `now()` | Data criação |

---

### 17. `expenses`
**Descrição:** Despesas do coach

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `coach_id` | `uuid` | NO | - | FK → auth.users |
| `descricao` | `text` | NO | - | Descrição da despesa |
| `valor` | `numeric` | NO | - | Valor |
| `categoria` | `text` | NO | - | Categoria |
| `data_vencimento` | `date` | NO | - | Data vencimento |
| `data_pagamento` | `date` | YES | - | Data pagamento |
| `status` | `text` | NO | `'pendente'` | Status: 'pendente', 'pago', 'atrasado' |
| `forma_pagamento` | `text` | YES | - | Forma de pagamento |
| `recorrente` | `boolean` | YES | `false` | Se é recorrente |
| `frequencia_recorrencia` | `text` | YES | - | Frequência: 'mensal', 'semanal', etc |
| `observacoes` | `text` | YES | - | Observações |
| `created_at` | `timestamptz` | NO | `now()` | Data criação |
| `updated_at` | `timestamptz` | NO | `now()` | Data atualização |

---

### 18. `feedbacks_alunos`
**Descrição:** Feedbacks dados pelo coach aos alunos

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `coach_id` | `uuid` | NO | - | FK → auth.users |
| `aluno_id` | `uuid` | NO | - | FK → alunos.id |
| `feedback` | `text` | NO | - | Conteúdo do feedback |
| `created_at` | `timestamptz` | YES | `now()` | Data criação |
| `updated_at` | `timestamptz` | YES | `now()` | Data atualização |

---

### 19. `financial_exceptions`
**Descrição:** Exceções financeiras (descontos, isenções)

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `coach_id` | `uuid` | NO | - | FK → auth.users |
| `aluno_id` | `uuid` | NO | - | FK → alunos.id |
| `tipo` | `text` | NO | - | Tipo: 'desconto_percentual', 'desconto_valor', 'isencao' |
| `motivo` | `text` | NO | - | Motivo da exceção |
| `percentual_desconto` | `numeric` | YES | - | Percentual (se aplicável) |
| `valor_desconto` | `numeric` | YES | - | Valor fixo (se aplicável) |
| `data_inicio` | `date` | NO | - | Data início |
| `data_fim` | `date` | YES | - | Data fim (null = indefinido) |
| `ativo` | `boolean` | NO | `true` | Se está ativo |
| `observacoes` | `text` | YES | - | Observações |
| `created_at` | `timestamptz` | NO | `now()` | Data criação |
| `updated_at` | `timestamptz` | NO | `now()` | Data atualização |

---

### 20. `fotos_alunos`
**Descrição:** Fotos de progresso dos alunos

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `aluno_id` | `uuid` | NO | - | FK → alunos.id |
| `url` | `text` | NO | - | URL da foto no storage |
| `descricao` | `text` | YES | - | Descrição/legenda |
| `created_at` | `timestamptz` | YES | `now()` | Data criação |

---

### 21. `itens_dieta`
**Descrição:** Itens/alimentos de cada dieta

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `dieta_id` | `uuid` | YES | `auth.uid()` | FK → dietas.id |
| `alimento_id` | `uuid` | YES | - | FK → alimentos.id |
| `refeicao` | `text` | NO | - | Nome da refeição |
| `quantidade` | `double precision` | NO | - | Quantidade em gramas |
| `dia_semana` | `text` | YES | - | Dia da semana (null = todos) |
| `created_at` | `timestamptz` | NO | `now()` | Data criação |

---

### 22. `lembretes_eventos`
**Descrição:** Lembretes enviados para eventos

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `evento_id` | `uuid` | NO | - | FK → eventos.id |
| `aluno_id` | `uuid` | NO | - | FK → alunos.id |
| `tipo_lembrete` | `text` | NO | - | Tipo: '24h', '1h', etc |
| `enviado` | `boolean` | NO | `false` | Se foi enviado |
| `enviado_em` | `timestamptz` | YES | - | Data do envio |
| `created_at` | `timestamptz` | NO | `now()` | Data criação |

---

### 23. `lives`
**Descrição:** Lives agendadas pelo coach

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `coach_id` | `uuid` | YES | - | FK → auth.users |
| `titulo` | `text` | NO | - | Título da live |
| `descricao` | `text` | YES | - | Descrição |
| `data_agendamento` | `date` | NO | - | Data agendada |
| `hora_agendamento` | `time` | NO | - | Hora agendada |
| `duracao` | `integer` | NO | `60` | Duração em minutos |
| `status` | `text` | NO | - | Status: 'agendada', 'ao_vivo', 'encerrada', 'cancelada' |
| `visibilidade` | `text` | NO | - | Visibilidade: 'publica', 'privada', 'turma' |
| `youtube_url` | `text` | YES | - | URL do YouTube |
| `youtube_stream_key` | `text` | YES | - | Chave de transmissão |
| `max_participantes` | `integer` | YES | `100` | Máximo de participantes |
| `num_inscricoes` | `integer` | YES | `0` | Número de inscrições |
| `tags` | `text[]` | YES | `'{}'` | Array de tags |
| `auto_gravar` | `boolean` | YES | `true` | Se grava automaticamente |
| `lembretes_ativados` | `boolean` | YES | `true` | Se envia lembretes |
| `created_at` | `timestamptz` | NO | `now()` | Data criação |
| `updated_at` | `timestamptz` | NO | `now()` | Data atualização |

---

### 24. `mensagens`
**Descrição:** Mensagens do chat

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `conversa_id` | `uuid` | NO | - | FK → conversas.id |
| `remetente_id` | `uuid` | NO | - | ID do remetente (coach ou aluno) |
| `conteudo` | `text` | NO | - | Conteúdo da mensagem |
| `lida` | `boolean` | YES | `false` | Se foi lida |
| `created_at` | `timestamptz` | NO | `now()` | Data criação |

---

### 25. `notificacoes`
**Descrição:** Notificações do sistema

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `coach_id` | `uuid` | NO | - | FK → auth.users |
| `aluno_id` | `uuid` | YES | - | FK → alunos.id (se relacionado) |
| `titulo` | `text` | NO | - | Título da notificação |
| `mensagem` | `text` | NO | - | Mensagem |
| `tipo` | `text` | NO | - | Tipo: 'info', 'alerta', 'sucesso', 'erro' |
| `link` | `text` | YES | - | Link para ação |
| `lida` | `boolean` | NO | `false` | Se foi lida |
| `created_at` | `timestamptz` | NO | `now()` | Data criação |
| `updated_at` | `timestamptz` | NO | `now()` | Data atualização |

---

### 26. `payment_plans`
**Descrição:** Planos de pagamento

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `coach_id` | `uuid` | NO | - | FK → auth.users |
| `nome` | `text` | NO | - | Nome do plano |
| `descricao` | `text` | YES | - | Descrição |
| `valor` | `numeric` | NO | - | Valor do plano |
| `frequencia` | `text` | NO | - | Frequência: 'mensal', 'trimestral', 'anual' |
| `dia_vencimento` | `integer` | NO | - | Dia do vencimento (1-31) |
| `ativo` | `boolean` | NO | `true` | Se está ativo |
| `created_at` | `timestamptz` | NO | `now()` | Data criação |
| `updated_at` | `timestamptz` | NO | `now()` | Data atualização |

---

### 27. `planos_pagamento` (LEGACY)
**Descrição:** Planos de pagamento (tabela legada)

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `coach_id` | `uuid` | NO | - | FK → auth.users |
| `nome` | `text` | NO | - | Nome do plano |
| `valor` | `numeric` | NO | - | Valor |
| `frequencia` | `text` | NO | - | Frequência |
| `ativo` | `boolean` | NO | `true` | Se está ativo |
| `created_at` | `timestamptz` | NO | `now()` | Data criação |
| `updated_at` | `timestamptz` | NO | `now()` | Data atualização |

---

### 28. `profiles`
**Descrição:** Perfis de usuário (vinculado ao auth)

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | - | PK (mesmo ID do auth.users) |
| `avatar_url` | `text` | YES | - | URL do avatar |
| `created_at` | `timestamptz` | YES | `now()` | Data criação |
| `updated_at` | `timestamptz` | YES | `now()` | Data atualização |

---

### 29. `recurring_charges_config`
**Descrição:** Configuração de cobranças recorrentes

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `coach_id` | `uuid` | NO | - | FK → auth.users |
| `aluno_id` | `uuid` | NO | - | FK → alunos.id |
| `payment_plan_id` | `uuid` | YES | - | FK → payment_plans.id |
| `valor_customizado` | `numeric` | YES | - | Valor customizado (sobrescreve plano) |
| `dia_vencimento_customizado` | `integer` | YES | - | Dia vencimento customizado |
| `ativo` | `boolean` | NO | `true` | Se está ativo |
| `enviar_lembrete` | `boolean` | YES | `true` | Se envia lembrete |
| `dias_antecedencia_lembrete` | `integer` | YES | `3` | Dias antes para lembrete |
| `created_at` | `timestamptz` | NO | `now()` | Data criação |
| `updated_at` | `timestamptz` | NO | `now()` | Data atualização |

---

### 30. `relatorio_feedbacks`
**Descrição:** Feedbacks em relatórios

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `relatorio_id` | `uuid` | NO | - | FK → relatorios.id |
| `aluno_id` | `uuid` | NO | - | FK → alunos.id |
| `comentario` | `text` | NO | - | Comentário |
| `created_at` | `timestamptz` | NO | `now()` | Data criação |

---

### 31. `relatorio_midias`
**Descrição:** Mídias dos relatórios

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `relatorio_id` | `uuid` | NO | - | FK → relatorios.id |
| `url` | `text` | NO | - | URL da mídia |
| `tipo` | `text` | NO | - | Tipo: 'imagem', 'video' |
| `legenda` | `text` | YES | - | Legenda |
| `ordem` | `integer` | YES | `0` | Ordem de exibição |
| `created_at` | `timestamptz` | NO | `now()` | Data criação |

---

### 32. `treinos`
**Descrição:** Treinos cadastrados

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `coach_id` | `uuid` | NO | - | FK → auth.users |
| `nome` | `text` | NO | - | Nome do treino |
| `descricao` | `text` | YES | - | Descrição |
| `exercicios` | `jsonb` | YES | `'[]'` | Array JSON de exercícios |
| `dias_semana` | `text[]` | YES | `'{}'` | Dias da semana |
| `ativo` | `boolean` | YES | `true` | Se está ativo |
| `created_at` | `timestamptz` | YES | `now()` | Data criação |
| `updated_at` | `timestamptz` | YES | `now()` | Data atualização |

**Estrutura do `exercicios` (JSONB):**
```json
[
  {
    "nome": "Supino Reto",
    "series": 4,
    "repeticoes": "8-12",
    "descanso": "90s",
    "observacoes": "Manter cotovelos a 45°"
  }
]
```

---

### 33. `turmas`
**Descrição:** Turmas/grupos de alunos

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `coach_id` | `uuid` | NO | - | FK → auth.users |
| `nome` | `text` | NO | - | Nome da turma |
| `descricao` | `text` | YES | - | Descrição |
| `cor` | `text` | YES | - | Cor para identificação |
| `ativa` | `boolean` | YES | `true` | Se está ativa |
| `created_at` | `timestamptz` | YES | `now()` | Data criação |
| `updated_at` | `timestamptz` | YES | `now()` | Data atualização |

---

### 34. `turmas_alunos`
**Descrição:** Relação turma ↔ aluno

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `turma_id` | `uuid` | NO | - | FK → turmas.id |
| `aluno_id` | `uuid` | NO | - | FK → alunos.id |
| `created_at` | `timestamptz` | YES | `now()` | Data criação |

---

### 35. `user_roles`
**Descrição:** Papéis de usuário

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | NO | - | FK → auth.users |
| `role` | `user_role` | NO | `'student'` | Enum: 'admin', 'coach', 'student' |
| `created_at` | `timestamptz` | YES | `now()` | Data criação |
| `updated_at` | `timestamptz` | YES | `now()` | Data atualização |

**Enum `user_role`:** `'admin'`, `'coach'`, `'student'`

---

### 36. `videos`
**Descrição:** Vídeos cadastrados pelo coach

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `coach_id` | `uuid` | NO | - | FK → auth.users |
| `titulo` | `text` | NO | - | Título |
| `descricao` | `text` | YES | - | Descrição |
| `url` | `text` | NO | - | URL do vídeo |
| `thumbnail_url` | `text` | YES | - | URL da thumbnail |
| `categoria` | `text` | YES | - | Categoria |
| `tags` | `text[]` | YES | `'{}'` | Array de tags |
| `visibilidade` | `text` | YES | `'privado'` | Visibilidade: 'publico', 'privado', 'turma' |
| `duracao_segundos` | `integer` | YES | - | Duração em segundos |
| `created_at` | `timestamptz` | YES | `now()` | Data criação |
| `updated_at` | `timestamptz` | YES | `now()` | Data atualização |

---

### 37. `weekly_checkins`
**Descrição:** Check-ins semanais dos alunos

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `aluno_id` | `uuid` | NO | - | FK → alunos.id |
| `peso` | `numeric` | YES | - | Peso atual |
| `nivel_energia` | `integer` | YES | - | Nível energia (1-10) |
| `qualidade_sono` | `integer` | YES | - | Qualidade sono (1-10) |
| `nivel_estresse` | `integer` | YES | - | Nível estresse (1-10) |
| `adesao_dieta` | `integer` | YES | - | Adesão dieta (1-10) |
| `adesao_treino` | `integer` | YES | - | Adesão treino (1-10) |
| `observacoes` | `text` | YES | - | Observações gerais |
| `escala_bristol` | `integer` | YES | - | Escala Bristol (1-7) |
| `data_checkin` | `date` | YES | `CURRENT_DATE` | Data do check-in |
| `created_at` | `timestamptz` | YES | `now()` | Data criação |
| `updated_at` | `timestamptz` | YES | `now()` | Data atualização |

---

## 🔗 Diagrama de Relacionamentos

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AUTH.USERS                                      │
│                         (Supabase Auth)                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           │                        │                        │
           ▼                        ▼                        ▼
    ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
    │  profiles   │          │ user_roles  │          │coach_profiles│
    └─────────────┘          └─────────────┘          └─────────────┘
           │
           │ coach_id
           ▼
    ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
    │   alunos    │◄───►│turmas_alunos │◄───►│   turmas    │
    └─────────────┘     └──────────────┘     └─────────────┘
           │
           ├──────────────┬──────────────┬──────────────┬──────────────┐
           │              │              │              │              │
           ▼              ▼              ▼              ▼              ▼
    ┌────────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────┐
    │   dietas   │  │ treinos  │  │ conversas │  │weekly_   │  │fotos_     │
    └────────────┘  └──────────┘  └───────────┘  │checkins  │  │alunos     │
           │              │              │       └──────────┘  └───────────┘
           │              │              │
           ▼              ▼              ▼
    ┌────────────┐  ┌────────────┐  ┌───────────┐
    │itens_dieta │  │alunos_     │  │ mensagens │
    └────────────┘  │treinos     │  └───────────┘
           │        └────────────┘
           ▼
    ┌────────────┐
    │ alimentos  │
    └────────────┘

    ┌─────────────┐     ┌─────────────────┐     ┌────────────────┐
    │asaas_config │     │recurring_charges│     │ payment_plans  │
    └─────────────┘     │_config          │     └────────────────┘
                        └─────────────────┘
                               │
                               ▼
    ┌─────────────┐     ┌─────────────────┐
    │asaas_       │     │ asaas_payments  │
    │customers    │     └─────────────────┘
    └─────────────┘
```

---

## 🔐 Enums

### `user_role`
```sql
CREATE TYPE user_role AS ENUM ('admin', 'coach', 'student');
```

---

## 📝 Notas Importantes

### 1. Autenticação
- O projeto usa Supabase Auth
- Alunos são identificados pelo **email** (não pelo user_id)
- A query `auth.jwt() ->> 'email'` é usada para vincular alunos

### 2. Multi-tenancy
- Coaches têm seus dados isolados via `coach_id`
- RLS policies garantem que cada coach só vê seus dados

### 3. Timestamps
- Todas as tabelas usam `timestamptz` (com timezone)
- Default é `now()` para `created_at`

### 4. UUIDs
- Todas as PKs são UUID com `gen_random_uuid()`

### 5. Storage Buckets
Buckets de storage necessários:
- `avatars` - Fotos de perfil
- `fotos-alunos` - Fotos de progresso
- `anexos` - Anexos de avisos/mensagens
- `videos` - Thumbnails de vídeos

---

## 🚀 SQL para Criar Estrutura

Para gerar o SQL completo de criação, execute no Supabase:

```sql
-- Exportar estrutura completa
SELECT 
  'CREATE TABLE ' || schemaname || '.' || tablename || ';' as ddl
FROM pg_tables 
WHERE schemaname = 'public';
```

Ou use `pg_dump --schema-only` para exportar apenas a estrutura.
