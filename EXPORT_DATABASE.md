# Exportação Completa do Banco de Dados

## Opção 1: Usando pg_dump (Recomendado)

Execute no terminal com acesso ao PostgreSQL:

```bash
# Exportar estrutura + dados completos
pg_dump "postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres" \
  --no-owner \
  --no-acl \
  --schema=public \
  --schema=storage \
  --schema=auth \
  -F c \
  -f backup_completo.dump

# OU exportar como SQL puro (mais fácil de ler/editar)
pg_dump "postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres" \
  --no-owner \
  --no-acl \
  --schema=public \
  -f backup_public.sql
```

### Credenciais de Conexão
- **Host**: `db.cghzttbggklhuyqxzabq.supabase.co`
- **Port**: `5432`
- **Database**: `postgres`
- **User**: `postgres`
- **Password**: Encontre em Supabase Dashboard → Settings → Database → Connection string

---

## Opção 2: Pelo Supabase Dashboard

1. Acesse: https://supabase.com/dashboard/project/cghzttbggklhuyqxzabq/settings/database
2. Vá em **Backups** (menu lateral)
3. Clique em **Download backup**

---

## Opção 3: Queries Manuais por Tabela

### Exportar Estrutura (DDL)

```sql
-- Ver estrutura de todas as tabelas
SELECT 
  'CREATE TABLE ' || schemaname || '.' || tablename || ' (' ||
  string_agg(
    column_name || ' ' || data_type || 
    CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
    CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
    ', '
  ) || ');'
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY schemaname, tablename;
```

### Exportar Dados (Execute cada query e salve o resultado)

```sql
-- ALIMENTOS
SELECT * FROM public.alimentos;

-- ALUNOS
SELECT * FROM public.alunos;

-- ALUNOS_TREINOS
SELECT * FROM public.alunos_treinos;

-- AGENDA_EVENTOS
SELECT * FROM public.agenda_eventos;

-- ASAAS_CONFIG
SELECT * FROM public.asaas_config;

-- ASAAS_CUSTOMERS
SELECT * FROM public.asaas_customers;

-- ASAAS_PAYMENTS
SELECT * FROM public.asaas_payments;

-- AVISOS
SELECT * FROM public.avisos;

-- AVISOS_DESTINATARIOS
SELECT * FROM public.avisos_destinatarios;

-- CHECKIN_REMINDERS
SELECT * FROM public.checkin_reminders;

-- COACH_PROFILES
SELECT * FROM public.coach_profiles;

-- CONVERSAS
SELECT * FROM public.conversas;

-- DIETAS
SELECT * FROM public.dietas;

-- DIETA_FARMACOS
SELECT * FROM public.dieta_farmacos;

-- EVENTOS
SELECT * FROM public.eventos;

-- EVENTOS_PARTICIPANTES
SELECT * FROM public.eventos_participantes;

-- EXPENSES
SELECT * FROM public.expenses;

-- FEEDBACKS_ALUNOS
SELECT * FROM public.feedbacks_alunos;

-- FINANCIAL_EXCEPTIONS
SELECT * FROM public.financial_exceptions;

-- FOTOS_ALUNOS
SELECT * FROM public.fotos_alunos;

-- ITENS_DIETA
SELECT * FROM public.itens_dieta;

-- LEMBRETES_EVENTOS
SELECT * FROM public.lembretes_eventos;

-- LIVES
SELECT * FROM public.lives;

-- MENSAGENS
SELECT * FROM public.mensagens;

-- NOTIFICACOES
SELECT * FROM public.notificacoes;

-- PAYMENT_PLANS
SELECT * FROM public.payment_plans;

-- PLANOS_PAGAMENTO
SELECT * FROM public.planos_pagamento;

-- PROFILES
SELECT * FROM public.profiles;

-- RECURRING_CHARGES_CONFIG
SELECT * FROM public.recurring_charges_config;

-- RELATORIO_FEEDBACKS
SELECT * FROM public.relatorio_feedbacks;

-- RELATORIO_MIDIAS
SELECT * FROM public.relatorio_midias;

-- TREINOS
SELECT * FROM public.treinos;

-- TURMAS
SELECT * FROM public.turmas;

-- TURMAS_ALUNOS
SELECT * FROM public.turmas_alunos;

-- USER_ROLES
SELECT * FROM public.user_roles;

-- VIDEOS
SELECT * FROM public.videos;

-- WEEKLY_CHECKINS
SELECT * FROM public.weekly_checkins;
```

### Exportar Usuários (Auth)

```sql
-- ATENÇÃO: Esta query precisa de acesso admin (service_role)
SELECT 
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data
FROM auth.users;
```

---

## Opção 4: Script Node.js para Exportar JSON

Crie um arquivo `export-db.js`:

```javascript
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://cghzttbggklhuyqxzabq.supabase.co',
  'SUA_SERVICE_ROLE_KEY' // Use a service_role key aqui
);

const tables = [
  'alimentos', 'alunos', 'alunos_treinos', 'agenda_eventos',
  'asaas_config', 'asaas_customers', 'asaas_payments',
  'avisos', 'avisos_destinatarios', 'checkin_reminders',
  'coach_profiles', 'conversas', 'dietas', 'dieta_farmacos',
  'eventos', 'eventos_participantes', 'expenses',
  'feedbacks_alunos', 'financial_exceptions', 'fotos_alunos',
  'itens_dieta', 'lembretes_eventos', 'lives', 'mensagens',
  'notificacoes', 'payment_plans', 'planos_pagamento',
  'profiles', 'recurring_charges_config', 'relatorio_feedbacks',
  'relatorio_midias', 'treinos', 'turmas', 'turmas_alunos',
  'user_roles', 'videos', 'weekly_checkins'
];

async function exportAll() {
  const backup = {};
  
  for (const table of tables) {
    console.log(`Exportando ${table}...`);
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.error(`Erro em ${table}:`, error.message);
      backup[table] = [];
    } else {
      backup[table] = data;
    }
  }
  
  fs.writeFileSync('backup.json', JSON.stringify(backup, null, 2));
  console.log('Backup salvo em backup.json');
}

exportAll();
```

Execute:
```bash
npm install @supabase/supabase-js
node export-db.js
```

---

## Importar no Novo Servidor

### Com pg_dump backup:
```bash
pg_restore -h localhost -U postgres -d seu_banco -v backup_completo.dump
```

### Com SQL puro:
```bash
psql -h localhost -U postgres -d seu_banco -f backup_public.sql
```

### Com JSON:
Crie um script de importação similar ao de exportação, usando `.insert()` para cada tabela.

---

## Notas Importantes

1. **Ordem de importação**: Respeite as foreign keys (importe tabelas pai antes das filhas)
2. **auth.users**: Precisará recriar os usuários manualmente ou adaptar a estrutura de autenticação
3. **Storage**: Os arquivos no bucket precisam ser baixados separadamente via API ou Dashboard
4. **RLS Policies**: Serão exportadas com pg_dump, mas podem precisar de ajustes
5. **Functions/Triggers**: Também são exportados com pg_dump
