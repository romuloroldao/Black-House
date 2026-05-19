# 🔗 Diagrama de Relacionamentos do Banco de Dados

## Visão Geral

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AUTH.USERS                                      │
│                         (Supabase Auth)                                      │
│                         ┌──────────────┐                                    │
│                         │   id (PK)    │                                    │
│                         │   email      │                                    │
│                         └──────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           │                        │                        │
           ▼                        ▼                        ▼
    ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
    │  profiles   │          │ user_roles  │          │coach_profiles│
    │  id (PK)    │          │ user_id (FK)│          │ user_id (FK)│
    │  avatar_url │          │   role      │          │ nome_completo│
    └─────────────┘          └─────────────┘          └─────────────┘
           │
           │ coach_id
           ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                           ALUNOS                                 │
    │                    ┌──────────────┐                              │
    │                    │   id (PK)   │                              │
    │                    │ coach_id(FK)│                              │
    │                    │    email     │                              │
    │                    │    nome     │                              │
    │                    └──────────────┘                              │
    └─────────────────────────────────────────────────────────────────┘
           │
           ├──────────────┬──────────────┬──────────────┬──────────────┐
           │              │              │              │              │
           ▼              ▼              ▼              ▼              ▼
    ┌────────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────┐
    │   dietas   │  │ treinos  │  │ conversas │  │weekly_   │  │fotos_     │
    │aluno_id(FK)│  │coach_id  │  │aluno_id   │  │checkins  │  │alunos     │
    │            │  │          │  │coach_id   │  │aluno_id  │  │aluno_id   │
    └────────────┘  └──────────┘  └───────────┘  └──────────┘  └───────────┘
           │              │              │
           │              │              │
           ▼              ▼              ▼
    ┌────────────┐  ┌────────────┐  ┌───────────┐
    │itens_dieta │  │alunos_     │  │ mensagens │
    │dieta_id(FK)│  │treinos     │  │conversa_id│
    │alimento_id │  │aluno_id(FK)│  │           │
    └────────────┘  │treino_id(FK)│  └───────────┘
           │        └────────────┘
           ▼
    ┌────────────┐
    │ alimentos  │
    │            │
    └────────────┘
```

## Relacionamentos Detalhados

### 1. Gestão de Usuários e Autenticação

```
auth.users (Supabase)
    │
    ├──► profiles (1:1)
    │       └── id = auth.users.id
    │
    ├──► user_roles (1:N)
    │       └── user_id → auth.users.id
    │
    ├──► coach_profiles (1:1)
    │       └── user_id → auth.users.id
    │
    └──► [Como coach] alunos (1:N)
            └── coach_id → auth.users.id
```

### 2. Gestão de Alunos

```
alunos
    │
    ├──► turmas_alunos (N:M via turmas)
    │       └── aluno_id → alunos.id
    │
    ├──► dietas (1:N)
    │       └── aluno_id → alunos.id
    │
    ├──► alunos_treinos (N:M via treinos)
    │       └── aluno_id → alunos.id
    │
    ├──► conversas (1:N)
    │       └── aluno_id → alunos.id
    │
    ├──► weekly_checkins (1:N)
    │       └── aluno_id → alunos.id
    │
    ├──► fotos_alunos (1:N)
    │       └── aluno_id → alunos.id
    │
    ├──► asaas_customers (1:1)
    │       └── aluno_id → alunos.id
    │
    ├──► asaas_payments (1:N)
    │       └── aluno_id → alunos.id
    │
    ├──► feedbacks_alunos (1:N)
    │       └── aluno_id → alunos.id
    │
    ├──► financial_exceptions (1:N)
    │       └── aluno_id → alunos.id
    │
    ├──► recurring_charges_config (1:N)
    │       └── aluno_id → alunos.id
    │
    ├──► checkin_reminders (1:1)
    │       └── aluno_id → alunos.id
    │
    └──► eventos_participantes (N:M via eventos)
            └── aluno_id → alunos.id
```

### 3. Treinos e Exercícios

```
treinos
    │
    ├──► alunos_treinos (N:M via alunos)
    │       └── treino_id → treinos.id
    │
    └──► [exercicios JSONB]
            └── Array de objetos com:
                - nome
                - series
                - repeticoes
                - descanso
                - observacoes
```

### 4. Dietas e Alimentos

```
dietas
    │
    ├──► itens_dieta (1:N)
    │       ├── dieta_id → dietas.id
    │       └── alimento_id → alimentos.id
    │
    └──► dieta_farmacos (1:N)
            └── dieta_id → dietas.id

alimentos
    └──► itens_dieta (1:N)
            └── alimento_id → alimentos.id
```

### 5. Comunicação

```
conversas
    │
    ├──► mensagens (1:N)
    │       └── conversa_id → conversas.id
    │
    ├──► coach_id → auth.users.id
    └──► aluno_id → alunos.id

avisos
    └──► avisos_destinatarios (1:N)
            ├── aviso_id → avisos.id
            ├── aluno_id → alunos.id (opcional)
            └── turma_id → turmas.id (opcional)
```

### 6. Eventos e Lives

```
eventos
    │
    ├──► eventos_participantes (1:N)
    │       ├── evento_id → eventos.id
    │       └── aluno_id → alunos.id
    │
    ├──► lembretes_eventos (1:N)
    │       └── evento_id → eventos.id
    │
    ├──► coach_id → auth.users.id
    └──► turma_id → turmas.id (opcional)

lives
    └──► coach_id → auth.users.id
```

### 7. Financeiro

```
payment_plans
    │
    └──► recurring_charges_config (1:N)
            └── payment_plan_id → payment_plans.id

recurring_charges_config
    ├──► payment_plan_id → payment_plans.id
    └──► aluno_id → alunos.id

asaas_config
    └──► coach_id → auth.users.id

asaas_customers
    └──► aluno_id → alunos.id

asaas_payments
    ├──► coach_id → auth.users.id
    └──► aluno_id → alunos.id

financial_exceptions
    ├──► coach_id → auth.users.id
    └──► aluno_id → alunos.id

expenses
    └──► coach_id → auth.users.id
```

### 8. Turmas

```
turmas
    │
    ├──► turmas_alunos (1:N)
    │       ├── turma_id → turmas.id
    │       └── aluno_id → alunos.id
    │
    ├──► eventos (1:N)
    │       └── turma_id → turmas.id
    │
    └──► coach_id → auth.users.id
```

### 9. Conteúdo

```
videos
    └──► coach_id → auth.users.id

feedbacks_alunos
    ├──► coach_id → auth.users.id
    └──► aluno_id → alunos.id
```

### 10. Agenda e Notificações

```
agenda_eventos
    ├──► coach_id → auth.users.id
    └──► aluno_id → alunos.id (opcional)

notificacoes
    ├──► coach_id → auth.users.id
    └──► aluno_id → alunos.id (opcional)
```

## Cardinalidades Principais

| Tabela Origem | Relacionamento | Tabela Destino | Tipo |
|---------------|----------------|----------------|------|
| auth.users | possui | profiles | 1:1 |
| auth.users | possui | user_roles | 1:N |
| auth.users | possui | coach_profiles | 1:1 |
| auth.users | gerencia | alunos | 1:N |
| alunos | pertence a | turmas | N:M |
| alunos | possui | dietas | 1:N |
| alunos | possui | treinos | N:M |
| alunos | possui | conversas | 1:N |
| alunos | possui | weekly_checkins | 1:N |
| alunos | possui | fotos_alunos | 1:N |
| dietas | contém | itens_dieta | 1:N |
| itens_dieta | referencia | alimentos | N:1 |
| treinos | atribuído a | alunos | N:M |
| conversas | contém | mensagens | 1:N |
| eventos | tem | eventos_participantes | 1:N |
| turmas | contém | alunos | N:M |
| payment_plans | usado em | recurring_charges_config | 1:N |
| alunos | tem | asaas_customers | 1:1 |
| alunos | tem | asaas_payments | 1:N |

## Fluxos Principais

### Fluxo de Criação de Aluno
```
1. Coach cria aluno → alunos (coach_id = auth.uid())
2. Coach atribui treino → alunos_treinos
3. Coach cria dieta → dietas → itens_dieta → alimentos
4. Sistema cria cliente Asaas → asaas_customers
5. Sistema configura cobrança → recurring_charges_config
```

### Fluxo de Check-in Semanal
```
1. Aluno faz check-in → weekly_checkins
2. Sistema verifica se há lembrete → checkin_reminders
3. Coach visualiza dados → Query de estatísticas
4. Coach pode dar feedback → feedbacks_alunos
```

### Fluxo de Pagamento
```
1. Sistema gera cobrança → asaas_payments
2. Webhook Asaas atualiza status → asaas_payments.status
3. Coach visualiza receita → Query financeira
4. Aluno visualiza pagamentos → Query de pagamentos
```

### Fluxo de Comunicação
```
1. Coach cria aviso → avisos
2. Sistema define destinatários → avisos_destinatarios
3. Aluno visualiza → Query de avisos não lidos
4. Chat: conversas → mensagens
```

## Notas Importantes

1. **Multi-tenancy**: Todos os dados são isolados por `coach_id`
2. **Autenticação de Alunos**: Alunos são identificados por `email` via `auth.jwt() ->> 'email'`
3. **RLS**: Políticas de segurança garantem isolamento de dados
4. **JSONB**: `treinos.exercicios` e `coach_profiles.conquistas` usam JSONB
5. **Arrays**: Várias tabelas usam arrays (`TEXT[]`) para múltiplos valores
