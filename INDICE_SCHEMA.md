# 📚 Índice da Documentação do Schema do Banco de Dados

Este documento serve como índice e guia rápido para todos os arquivos relacionados ao schema do banco de dados do sistema de gestão para coaches.

## 📁 Arquivos Criados

### 1. `schema.sql` ⭐ **PRINCIPAL**
**Descrição:** Script SQL completo com todas as 37 tabelas do banco de dados

**Conteúdo:**
- Definição de todos os tipos (ENUMs)
- Criação de todas as tabelas com colunas, tipos e constraints
- Comentários explicativos em cada tabela
- Índices recomendados para performance
- Triggers automáticos para `updated_at`
- Função auxiliar para atualização de timestamps

**Como usar:**
```bash
# No Supabase SQL Editor ou via psql
psql -U usuario -d banco -f schema.sql
```

**Status:** ✅ Completo e pronto para uso

---

### 2. `rls_policies.sql` 🔐 **SEGURANÇA**
**Descrição:** Políticas RLS (Row Level Security) para isolamento de dados

**Conteúdo:**
- Habilitação de RLS em todas as tabelas
- Funções auxiliares (`is_coach()`, `is_admin()`, `is_student()`)
- Políticas para coaches gerenciarem seus dados
- Políticas para alunos acessarem apenas seus dados
- Políticas para admins terem acesso total

**Como usar:**
```bash
# Execute APÓS criar o schema
psql -U usuario -d banco -f rls_policies.sql
```

**Status:** ✅ Completo com políticas básicas (ajuste conforme necessário)

---

### 3. `exemplos_queries.sql` 🔍 **QUERIES ÚTEIS**
**Descrição:** Exemplos de queries SQL comuns para o sistema

**Conteúdo:**
- 25+ queries prontas para uso
- Queries para coaches (gestão de alunos, treinos, pagamentos)
- Queries para alunos (visualizar seus dados)
- Queries de relatórios e estatísticas
- Queries de manutenção e validação

**Categorias:**
- ✅ Gestão de alunos
- ✅ Treinos e dietas
- ✅ Pagamentos e financeiro
- ✅ Eventos e lives
- ✅ Comunicação (chat, avisos)
- ✅ Relatórios e estatísticas
- ✅ Manutenção do banco

**Status:** ✅ Completo com exemplos práticos

---

### 4. `README.md` 📖 **DOCUMENTAÇÃO**
**Descrição:** Documentação geral do projeto e guia de uso

**Conteúdo:**
- Visão geral do sistema
- Estrutura do banco de dados
- Como usar os arquivos SQL
- Checklist de configuração
- Notas importantes sobre autenticação e multi-tenancy

**Status:** ✅ Completo

---

### 5. `diagrama_relacionamentos.md` 🔗 **DIAGRAMAS**
**Descrição:** Diagramas visuais dos relacionamentos entre tabelas

**Conteúdo:**
- Diagrama ASCII de relacionamentos
- Relacionamentos detalhados por área
- Cardinalidades principais
- Fluxos de dados principais
- Notas sobre multi-tenancy e autenticação

**Status:** ✅ Completo

---

### 6. `configuracao_storage.md` 📦 **STORAGE**
**Descrição:** Guia completo de configuração dos buckets de storage

**Conteúdo:**
- Configuração de 4 buckets necessários:
  - `avatars` - Fotos de perfil
  - `fotos-alunos` - Fotos de progresso
  - `anexos` - Anexos de avisos/mensagens
  - `videos` - Vídeos e thumbnails
- Políticas RLS para cada bucket
- Exemplos de código para upload/download
- Limites recomendados de tamanho
- Checklist de configuração

**Status:** ✅ Completo

---

## 🚀 Ordem de Execução Recomendada

### Passo 1: Criar o Schema
```bash
# Execute o schema principal
psql -U usuario -d banco -f schema.sql
```
**Arquivo:** `schema.sql`

---

### Passo 2: Configurar Segurança (RLS)
```bash
# Execute as políticas de segurança
psql -U usuario -d banco -f rls_policies.sql
```
**Arquivo:** `rls_policies.sql`

**⚠️ IMPORTANTE:** Ajuste as políticas conforme suas necessidades específicas de negócio.

---

### Passo 3: Configurar Storage Buckets
```bash
# Execute os comandos SQL do arquivo de configuração
# Copie e cole as seções relevantes no Supabase SQL Editor
```
**Arquivo:** `configuracao_storage.md`

---

### Passo 4: Testar Queries
```bash
# Use as queries de exemplo para validar o schema
# Execute queries individuais conforme necessário
```
**Arquivo:** `exemplos_queries.sql`

---

## 📊 Estrutura do Banco de Dados

### Tabelas por Categoria

#### 👥 Gestão de Usuários (3 tabelas)
- `profiles`
- `user_roles`
- `coach_profiles`

#### 🎓 Gestão de Alunos (7 tabelas)
- `alunos`
- `turmas`
- `turmas_alunos`
- `fotos_alunos`
- `weekly_checkins`
- `checkin_reminders`
- `feedbacks_alunos`

#### 💪 Treinos e Dietas (6 tabelas)
- `treinos`
- `alunos_treinos`
- `dietas`
- `itens_dieta`
- `alimentos`
- `dieta_farmacos`

#### 💰 Financeiro (7 tabelas)
- `payment_plans`
- `planos_pagamento` (legacy)
- `recurring_charges_config`
- `financial_exceptions`
- `expenses`
- `asaas_config`
- `asaas_customers`
- `asaas_payments`

#### 💬 Comunicação (4 tabelas)
- `conversas`
- `mensagens`
- `avisos`
- `avisos_destinatarios`

#### 📅 Eventos e Lives (4 tabelas)
- `eventos`
- `eventos_participantes`
- `lembretes_eventos`
- `lives`
- `agenda_eventos`

#### 📊 Conteúdo e Relatórios (4 tabelas)
- `videos`
- `relatorio_feedbacks`
- `relatorio_midias`
- `notificacoes`

**Total: 37 tabelas**

---

## 🔍 Referência Rápida

### Tabelas Mais Importantes

| Tabela | Uso Principal | Relacionamentos |
|--------|---------------|-----------------|
| `alunos` | Cadastro principal | Central para maioria das relações |
| `treinos` | Treinos prescritos | N:M com alunos via `alunos_treinos` |
| `dietas` | Dietas prescritas | 1:N com alunos, contém `itens_dieta` |
| `conversas` | Chat coach-aluno | 1:N com `mensagens` |
| `asaas_payments` | Pagamentos | 1:N com alunos |
| `weekly_checkins` | Check-ins semanais | 1:N com alunos |

---

## ⚠️ Notas Importantes

### 1. Autenticação
- Alunos são identificados por **email** via `auth.jwt() ->> 'email'`
- Coaches são identificados por `auth.uid()`
- Multi-tenancy garantido por `coach_id`

### 2. Segurança
- RLS habilitado em todas as tabelas
- Políticas garantem isolamento de dados por coach
- Ajuste políticas conforme necessário

### 3. Performance
- Índices criados nas colunas mais consultadas
- Triggers automáticos para `updated_at`
- Considere adicionar mais índices conforme uso

### 4. Storage
- 4 buckets necessários configurados
- Políticas RLS para cada bucket
- Validação de tipos/tamanhos na aplicação

### 5. Tabelas Legacy
- `planos_pagamento` - Use `payment_plans` em novos desenvolvimentos

### 6. Tabelas Não Documentadas
- `relatorios` - Referenciada mas não documentada
- Considere criar esta tabela se necessário

---

## 🛠️ Próximos Passos Sugeridos

1. ✅ Criar schema completo
2. ✅ Configurar RLS
3. ✅ Configurar storage buckets
4. ⏳ Criar funções e procedures necessárias
5. ⏳ Configurar webhooks do Asaas
6. ⏳ Implementar triggers para notificações automáticas
7. ⏳ Criar views para relatórios complexos
8. ⏳ Implementar rotinas de backup
9. ⏳ Configurar monitoramento e alertas
10. ⏳ Documentar APIs e endpoints

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Consulte a documentação específica de cada arquivo
2. Verifique os comentários no código SQL
3. Revise os exemplos de queries
4. Consulte o diagrama de relacionamentos

---

## 📝 Changelog

### Versão 1.0 (Data Atual)
- ✅ Schema completo com 37 tabelas
- ✅ Políticas RLS básicas
- ✅ Exemplos de queries
- ✅ Documentação completa
- ✅ Configuração de storage
- ✅ Diagramas de relacionamento

---

## 📄 Licença

Este schema e documentação foram criados com base na documentação fornecida pelo usuário.

---

**Última atualização:** Data atual  
**Versão:** 1.0  
**Status:** ✅ Completo e pronto para uso
