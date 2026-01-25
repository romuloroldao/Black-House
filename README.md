# 📊 Sistema de Gestão para Coaches

Este projeto contém a estrutura completa do banco de dados para um sistema de gestão de coaches que gerenciam alunos, treinos, dietas, pagamentos e muito mais.

## 📁 Arquivos

- **`schema.sql`** - Script SQL completo com todas as tabelas, índices e triggers
- **`DOCUMENTACAO.md`** - Documentação detalhada de todas as tabelas (fornecida pelo usuário)

## 🗄️ Estrutura do Banco de Dados

O sistema possui **37 tabelas** organizadas nas seguintes áreas:

### 👥 Gestão de Usuários
- `profiles` - Perfis de usuário
- `user_roles` - Papéis (admin, coach, student)
- `coach_profiles` - Perfis detalhados dos coaches

### 🎓 Gestão de Alunos
- `alunos` - Cadastro principal
- `turmas` - Grupos de alunos
- `turmas_alunos` - Relação turma ↔ aluno
- `fotos_alunos` - Fotos de progresso
- `weekly_checkins` - Check-ins semanais
- `checkin_reminders` - Lembretes de check-in

### 💪 Treinos e Dietas
- `treinos` - Treinos cadastrados
- `alunos_treinos` - Relação aluno ↔ treino
- `dietas` - Dietas criadas
- `itens_dieta` - Itens de cada dieta
- `alimentos` - Cadastro de alimentos
- `dieta_farmacos` - Suplementos/fármacos

### 💰 Financeiro
- `payment_plans` - Planos de pagamento
- `recurring_charges_config` - Cobranças recorrentes
- `financial_exceptions` - Descontos/isenções
- `expenses` - Despesas do coach
- `asaas_config` - Configuração Asaas
- `asaas_customers` - Clientes no Asaas
- `asaas_payments` - Pagamentos via Asaas

### 💬 Comunicação
- `conversas` - Conversas de chat
- `mensagens` - Mensagens do chat
- `avisos` - Avisos do coach
- `avisos_destinatarios` - Destinatários
- `notificacoes` - Notificações do sistema

### 📅 Eventos e Lives
- `eventos` - Eventos agendados
- `eventos_participantes` - Participantes
- `lembretes_eventos` - Lembretes
- `lives` - Lives agendadas
- `agenda_eventos` - Agenda do coach

### 📊 Conteúdo e Relatórios
- `videos` - Vídeos cadastrados
- `feedbacks_alunos` - Feedbacks
- `relatorio_feedbacks` - Feedbacks em relatórios
- `relatorio_midias` - Mídias dos relatórios

## 🚀 Como Usar

### 1. Criar o Banco de Dados

Execute o arquivo `schema.sql` no seu banco PostgreSQL/Supabase:

```bash
psql -U seu_usuario -d seu_banco -f schema.sql
```

Ou no Supabase SQL Editor, copie e cole o conteúdo de `schema.sql`.

### 2. Configurar Storage Buckets

No Supabase, crie os seguintes buckets de storage:

- `avatars` - Fotos de perfil
- `fotos-alunos` - Fotos de progresso
- `anexos` - Anexos de avisos/mensagens
- `videos` - Thumbnails de vídeos

### 3. Configurar RLS (Row Level Security)

⚠️ **IMPORTANTE**: Este schema não inclui políticas RLS. Você precisará criar políticas de segurança para garantir que cada coach só acesse seus próprios dados.

Exemplo de política básica:

```sql
-- Exemplo para tabela alunos
ALTER TABLE alunos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches podem ver apenas seus alunos"
ON alunos FOR SELECT
USING (coach_id = auth.uid());
```

## 🔐 Autenticação

O sistema usa **Supabase Auth**:
- Alunos são identificados pelo **email** (não pelo user_id)
- A query `auth.jwt() ->> 'email'` é usada para vincular alunos
- Coaches têm seus dados isolados via `coach_id`

## 📝 Notas Importantes

1. **Multi-tenancy**: Cada coach tem seus dados isolados via `coach_id`
2. **UUIDs**: Todas as PKs são UUID com `gen_random_uuid()`
3. **Timestamps**: Todas as tabelas usam `timestamptz` (com timezone)
4. **Triggers**: O schema inclui triggers automáticos para `updated_at`
5. **Índices**: Índices básicos foram criados para melhorar performance

## 🔗 Relacionamentos Principais

```
auth.users
  ├── profiles
  ├── user_roles
  ├── coach_profiles
  └── alunos (via coach_id)
      ├── dietas
      ├── treinos (via alunos_treinos)
      ├── conversas
      ├── weekly_checkins
      └── fotos_alunos
```

## 📚 Documentação Completa

Para detalhes completos de cada tabela, consulte a documentação fornecida que inclui:
- Descrição de cada tabela
- Todas as colunas com tipos e constraints
- Relacionamentos entre tabelas
- Enums e tipos customizados
- Exemplos de estruturas JSONB

## ⚠️ Tabelas Legacy

- `planos_pagamento` - Tabela legada (use `payment_plans`)

## 🔍 Tabelas Referenciadas mas Não Documentadas

- `relatorios` - Referenciada por `relatorio_feedbacks` e `relatorio_midias`, mas não documentada

## 🛠️ Próximos Passos

1. Criar políticas RLS para segurança
2. Criar funções e procedures necessárias
3. Configurar webhooks do Asaas
4. Implementar triggers para notificações automáticas
5. Criar views para relatórios complexos
