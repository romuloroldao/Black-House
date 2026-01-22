# 📋 Pendências da Migração para PostgreSQL Puro

**Última atualização**: 12 de Janeiro de 2026  
**Status geral**: ✅ **MIGRAÇÃO AVANÇADA - INFRAESTRUTURA COMPLETA**

---

## ✅ O QUE JÁ FOI FEITO

### Parte 1: Clonar Repositório
- ✅ Repositório já está no servidor

### Parte 2: Instalar e Configurar PostgreSQL
- ✅ **PostgreSQL 15.13 instalado e rodando** (atualizado de 12 para 15)
- ✅ Usuário `app_user` criado
- ✅ Banco `blackhouse_db` criado
- ✅ Extensões `uuid-ossp` e `pgcrypto` instaladas
- ✅ Migração de dados do PostgreSQL 12 para 15 concluída
- ⚠️ **PENDENTE**: Configurar acesso remoto (se necessário)

### Parte 3: Exportar Dados do Supabase
- ❌ **PENDENTE**: Exportar schema (estrutura) do Supabase
- ❌ **PENDENTE**: Exportar dados do Supabase
- ❌ **PENDENTE**: Exportar arquivos do Storage do Supabase
- ✅ **ALTERNATIVA**: Schema apenas estrutura criado (`schema_apenas_estrutura.sql`) - pronto para inserir dados manualmente

### Parte 4: Adaptar Schema para PostgreSQL Puro
- ✅ Schema `app_auth` criado
- ✅ Tabelas `users` e `sessions` criadas
- ✅ Funções de autenticação implementadas
- ✅ **Schema completo importado: 43 tabelas** (2 em app_auth + 41 em public)
- ✅ Todas as referências de `auth.users` adaptadas para `app_auth.users`
- ✅ Índices criados (72 índices)
- ✅ Triggers configurados (22 triggers)
- ✅ Arquivo `schema_apenas_estrutura.sql` criado (apenas estrutura, sem dados)
- ⚠️ **PENDENTE**: Importar dados do Supabase (ou inserir manualmente)
- ⚠️ **PENDENTE**: Migrar arquivos do Storage do Supabase

### Parte 5: Criar API de Autenticação
- ✅ Servidor Express criado (`server/index.js`)
- ✅ Rotas de autenticação implementadas
- ✅ Rotas REST genéricas implementadas
- ✅ Storage local implementado
- ✅ Serviço systemd configurado e rodando
- ✅ Todas as dependências instaladas e verificadas
- ✅ Endpoints básicos testados (health, auth/signup, auth/login, auth/user)
- ✅ Permissões do banco de dados configuradas
- ✅ **API expandida com suporte a filtros e queries complexas**
  - Filtros: eq, neq, gt, gte, lt, lte, like, ilike, in, is
  - Ordenação, limite, offset
  - Query builder no apiClient
- ⚠️ **PENDENTE**: Testar endpoints REST completos (GET, POST, PATCH, DELETE)
- ⚠️ **PENDENTE**: Testar upload de arquivos no storage
- ⚠️ **PENDENTE**: Implementar reset password na API
- ⚠️ **PENDENTE**: Implementar update user na API
- ⚠️ **PENDENTE**: Implementar Edge Functions migradas (11 funções identificadas)
- 📄 Documentação: `VERIFICACAO_API.md`, `EXPANSAO_API_FILTROS.md`

### Parte 6: Adaptar Frontend
- ✅ Cliente de API criado (`src/lib/api-client.ts`)
- ✅ Plano de migração criado (`PLANO_MIGRACAO_FRONTEND.md`)
- ✅ **Autenticação migrada completamente**
  - AuthContext migrado para usar `apiClient`
  - Página Auth.tsx migrada (login e signup funcionando)
  - Suporte a eventos customizados para sincronização
  - Build do frontend sem erros
- ✅ Variáveis de ambiente atualizadas
  - `VITE_API_URL=http://localhost:3001` no `.env`
  - `VITE_API_URL=https://api.blackhouse.app.br` no `.env.production`
- ✅ API expandida com suporte a filtros e queries complexas
- ✅ Guia de migração criado (`GUIA_MIGRACAO_COMPONENTES.md`)
- ⚠️ **56 arquivos ainda usam Supabase** (32 arquivos principais identificados)
  - 24 componentes que fazem queries ao banco
  - Componentes que fazem upload de arquivos
  - Scripts de importação
  - Arquivos de integração base (`src/integrations/supabase/`)
- ❌ **PENDENTE**: Migrar componentes principais (Dashboard, StudentManager, etc.)
- ❌ **PENDENTE**: Migrar storage (uploads/downloads)
- ❌ **PENDENTE**: Testar autenticação no frontend em produção
- ❌ **PENDENTE**: Testar queries de banco no frontend
- ❌ **PENDENTE**: Testar upload de arquivos no frontend
- 📄 Documentação: `RESUMO_MIGRACAO_AUTH.md`, `GUIA_MIGRACAO_COMPONENTES.md`

### Parte 7: Deploy da Aplicação
- ✅ Configuração Nginx criada (`deployment/nginx.conf`)
- ✅ **Build de produção do frontend feito** (`npm run build`)
- ✅ **Build copiado para `/var/www/blackhouse/dist/`** (atualizado em 12/01/2026)
- ✅ **Nginx configurado e ativo** no servidor
- ✅ **Site Nginx ativado** (link simbólico criado)
- ✅ **Configuração Nginx testada** (`nginx -t` passou)
- ✅ **Nginx rodando e ativo**
- ✅ **Frontend servido corretamente**
- ✅ **DNS configurado e funcionando** (`blackhouse.app.br` → `177.153.64.95`)
- ✅ **Domínio acessível**: `http://blackhouse.app.br` retorna 200 OK
- ✅ **API acessível**: `http://api.blackhouse.app.br/health` retorna 200 OK
- ✅ **SSL/HTTPS configurado** (Certificados Let's Encrypt válidos até 12/04/2026)
- ✅ **Redirecionamento HTTP → HTTPS** funcionando
- ✅ **Variáveis de ambiente atualizadas** para HTTPS
- ✅ **Build do frontend atualizado** com HTTPS

**Status Atual**:
- ✅ Servidor funcionando
- ✅ Nginx configurado e rodando
- ✅ API rodando na porta 3001
- ✅ Frontend buildado e servido
- ✅ **DNS configurado e funcionando** (`blackhouse.app.br` → `177.153.64.95`)
- ✅ **Domínio acessível externamente** (testado e funcionando)
- ✅ **HTTPS funcionando** (`https://blackhouse.app.br` e `https://api.blackhouse.app.br`)
- ⚠️ Credenciais ainda temporárias (ALTERAR URGENTEMENTE)

### Parte 8: Edge Functions
- ✅ **Identificadas**: 11 Edge Functions encontradas em `/root/supabase/functions/`
  1. `asaas-webhook` - Webhook do Asaas
  2. `reset-password` - Reset de senha
  3. `parse-student-pdf` - Parse de PDF de aluno
  4. `check-workout-expirations` - Verificar expirações de treinos
  5. `send-checkin-reminders` - Enviar lembretes de check-in
  6. `generate-recurring-charges` - Gerar cobranças recorrentes
  7. `create-asaas-payment` - Criar pagamento Asaas
  8. `create-asaas-customer` - Criar cliente Asaas
  9. `create-user` - Criar usuário
  10. `send-payment-reminders` - Enviar lembretes de pagamento
  11. `send-event-reminders` - Enviar lembretes de eventos
- ❌ **PENDENTE**: Migrar Edge Functions para endpoints Express
- ❌ **PENDENTE**: Testar Edge Functions migradas

### Parte 9: Monitoramento e Backup
- ✅ Script de backup criado (`/usr/local/bin/backup-db.sh`)
- ✅ **Crontab configurado para backup automático diário (02:00)**
- ✅ Diretório de backup criado (`/var/backups/postgresql/`)
- ✅ Backup manual testado e funcionando
- ✅ Rotação automática configurada (mantém últimos 7 dias)
- ✅ Logs disponíveis e acessíveis (API, Nginx, PostgreSQL, Backup)
- ✅ Tamanho do banco: ~9.3 MB
- ✅ Tamanho dos backups: ~20 KB (comprimidos)
- ⏳ **PENDENTE**: Testar restauração completa de backup
- ⏳ **PENDENTE**: Configurar backup externo (S3, outro servidor)
- ⏳ **PENDENTE**: Configurar alertas de falha de backup
- ⏳ **PENDENTE**: Configurar rotação de logs (logrotate)
- 📄 Documentação: `CONFIGURACAO_BACKUP.md`, `MONITORAMENTO_LOGS.md`

---

## 🔴 TAREFAS CRÍTICAS PENDENTES

### 1. Segurança (URGENTE) 🔴
**Status**: Credenciais temporárias ainda em uso

**Tarefas**:
- [ ] **URGENTE**: Alterar senha do PostgreSQL
- [ ] **URGENTE**: Gerar JWT_SECRET seguro (mínimo 32 caracteres)
- [ ] **URGENTE**: Atualizar `.env` do servidor com credenciais seguras
- [ ] Reiniciar API após alterações

**Comandos**:
```bash
# Gerar senha PostgreSQL
openssl rand -base64 24

# Gerar JWT_SECRET
openssl rand -base64 32

# Alterar no PostgreSQL
sudo -u postgres psql -c "ALTER USER app_user WITH PASSWORD 'nova_senha';"

# Atualizar .env
sudo nano /var/www/blackhouse/server/.env

# Reiniciar API
sudo systemctl restart blackhouse-api
```

**Documentação**: Ver `URGENTE_SEGURANCA.md`

---

### 2. Configurar SSL 🔴
**Status**: DNS funcionando, pode configurar SSL AGORA

**Tarefas**:
- [ ] Instalar Certbot (se não estiver instalado)
- [ ] Configurar SSL: `sudo certbot --nginx -d blackhouse.app.br -d www.blackhouse.app.br -d api.blackhouse.app.br`
- [ ] Verificar renovação automática
- [ ] Testar HTTPS
- [ ] Atualizar Nginx para redirecionar HTTP → HTTPS

**Comando**:
```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx -y

# Configurar SSL
sudo certbot --nginx -d blackhouse.app.br -d www.blackhouse.app.br -d api.blackhouse.app.br

# Verificar certificados
sudo certbot certificates
```

**Status DNS**: ✅ Funcionando - `blackhouse.app.br` e `api.blackhouse.app.br` acessíveis

---

### 3. Exportar/Importar Dados do Supabase ⚠️
**Status**: Opcional - você pode inserir dados manualmente

**Opção A: Exportar do Supabase**
- [ ] Exportar schema público do Supabase
- [ ] Exportar dados de todas as tabelas
- [ ] Baixar arquivos dos buckets de storage
- [ ] Adaptar e importar dados

**Opção B: Inserir Dados Manualmente** (Recomendado)
- ✅ Schema apenas estrutura disponível (`schema_apenas_estrutura.sql`)
- [ ] Inserir dados manualmente conforme necessário
- [ ] Migrar arquivos do storage manualmente

**Documentação**: Ver `INSTRUCOES_IMPORTAR_ESTRUTURA.md`

---

### 4. Adaptar Frontend (Queries) ⚠️
**Status**: Autenticação migrada, queries pendentes

**Progresso**:
- ✅ Autenticação completa (AuthContext + Auth.tsx)
- ⚠️ 56 arquivos ainda usam Supabase

**Tarefas**:
- [ ] Migrar componentes principais (Dashboard, StudentManager, etc.)
- [ ] Migrar componentes de storage
- [ ] Testar funcionalidades migradas

**Documentação**: Ver `GUIA_MIGRACAO_COMPONENTES.md`

---

### 5. Edge Functions ⚠️
**Status**: Identificadas, não migradas

**Tarefas**:
- [ ] Migrar cada função para endpoint Express
- [ ] Testar cada função migrada
- [ ] Atualizar frontend para usar novos endpoints

---

## 📊 RESUMO DO STATUS ATUAL

### ✅ Completo
- ✅ PostgreSQL 15.13 instalado e rodando
- ✅ Schema completo importado (43 tabelas)
- ✅ API funcionando com filtros avançados
- ✅ Autenticação migrada no frontend
- ✅ Nginx configurado e rodando
- ✅ Frontend buildado e servido
- ✅ **DNS configurado e funcionando** (`blackhouse.app.br` → `177.153.64.95`)
- ✅ **Domínio acessível externamente** (HTTP 200 OK)
- ✅ **API acessível externamente** (`api.blackhouse.app.br` funcionando)
- ✅ **SSL/HTTPS configurado** (Certificados Let's Encrypt válidos até 12/04/2026)
- ✅ **Redirecionamento HTTP → HTTPS** funcionando
- ✅ **Variáveis de ambiente atualizadas** para HTTPS
- ✅ **Build do frontend atualizado** com HTTPS
- ✅ Backup automático configurado
- ✅ Logs disponíveis

### ⚠️ Pendências Críticas
- 🔴 **URGENTE**: Alterar credenciais (PostgreSQL + JWT_SECRET)
- ✅ **CONCLUÍDO**: Configurar SSL (DNS funcionando, SSL configurado e funcionando)
- 🟡 **IMPORTANTE**: Migrar componentes do frontend (56 arquivos)
- 🟡 **IMPORTANTE**: Migrar Edge Functions (11 funções)

### 📋 Opcional
- ⏳ Exportar dados do Supabase (ou inserir manualmente)
- ⏳ Configurar backup externo
- ⏳ Configurar alertas de monitoramento

---

## 🎯 PRÓXIMOS PASSOS IMEDIATOS

### 1. URGENTE - Segurança (Hoje)
1. Gerar senha PostgreSQL segura
2. Gerar JWT_SECRET seguro
3. Atualizar `.env` do servidor
4. Reiniciar API
5. Testar funcionamento

### 2. IMPORTANTE - SSL (Pode fazer AGORA - DNS já funciona)
1. Instalar Certbot: `sudo apt install certbot python3-certbot-nginx -y`
2. Configurar SSL: `sudo certbot --nginx -d blackhouse.app.br -d www.blackhouse.app.br -d api.blackhouse.app.br`
3. Testar HTTPS: `curl -I https://blackhouse.app.br`
4. Verificar renovação automática: `sudo certbot certificates`

### 3. IMPORTANTE - Frontend (Esta Semana)
1. Migrar componentes principais
2. Testar funcionalidades
3. Remover dependências do Supabase

### 4. IMPORTANTE - Edge Functions (Esta Semana)
1. Migrar funções críticas primeiro
2. Testar cada função
3. Atualizar frontend

---

## 📊 Estatísticas

### Banco de Dados
- **Versão**: PostgreSQL 15.13
- **Tabelas**: 43 (2 app_auth + 41 public)
- **Índices**: 72
- **Triggers**: 22
- **Tamanho**: ~9.3 MB

### API
- **Status**: ✅ Rodando
- **Porta**: 3001
- **Endpoints**: Health, Auth, REST, Storage
- **Filtros**: 10 operadores suportados

### Frontend
- **Build**: ✅ Atualizado (12/01/2026)
- **Autenticação**: ✅ Migrada
- **Arquivos Supabase**: 56 arquivos pendentes
- **Status Build**: ✅ Sem erros

### Infraestrutura
- **Nginx**: ✅ Ativo
- **DNS**: ✅ Configurado (`blackhouse.app.br` → `177.153.64.95`)
- **SSL**: ❌ Não configurado (pode configurar agora)
- **Backup**: ✅ Automático (diário às 02:00)

---

## 📄 ARQUIVOS DE REFERÊNCIA

### Documentação Principal
- `README_MIGRACAO.md` - Guia rápido
- `RESUMO_MIGRACAO.md` - Status anterior
- `STATUS_PRODUCAO.md` - Status de produção
- `STATUS_DNS.md` - Status do DNS
- `STATUS_SCHEMA.md` - Status do schema

### Segurança
- `URGENTE_SEGURANCA.md` - Ações urgentes de segurança

### API
- `VERIFICACAO_API.md` - Verificação da API
- `EXPANSAO_API_FILTROS.md` - Filtros e queries

### Frontend
- `PLANO_MIGRACAO_FRONTEND.md` - Plano de migração
- `GUIA_MIGRACAO_COMPONENTES.md` - Guia de migração
- `RESUMO_MIGRACAO_AUTH.md` - Migração de autenticação
- `VARIAVEIS_AMBIENTE_FRONTEND.md` - Variáveis de ambiente

### Banco de Dados
- `schema_apenas_estrutura.sql` - Schema apenas estrutura (sem dados)
- `INSTRUCOES_IMPORTAR_ESTRUTURA.md` - Instruções de importação
- `ATUALIZACAO_POSTGRESQL.md` - Atualização do PostgreSQL
- `SCHEMA_APENAS_ESTRUTURA.md` - Documentação do schema

### Backup e Monitoramento
- `CONFIGURACAO_BACKUP.md` - Configuração de backup
- `MONITORAMENTO_LOGS.md` - Monitoramento de logs

### Arquivos de Código
- `server/index.js` - API implementada
- `src/lib/api-client.ts` - Cliente de API
- `deployment/nginx.conf` - Configuração Nginx
- `deployment/blackhouse-api.service` - Serviço systemd

---

## 🔐 SEGURANÇA - AÇÕES URGENTES

### Credenciais Temporárias (ALTERAR IMEDIATAMENTE!)
```
DB_PASSWORD=temp_password_change_me_123!
JWT_SECRET=change_this_to_a_very_long_and_secure_random_string_minimum_32_characters_long_for_production
```

**Ações necessárias**:
1. Alterar senha do PostgreSQL
2. Gerar JWT_SECRET seguro
3. Atualizar `/var/www/blackhouse/server/.env`
4. Reiniciar API

**Ver**: `URGENTE_SEGURANCA.md` para instruções detalhadas

---

## 📊 RESUMO POR PRIORIDADE

### 🔴 CRÍTICO (Fazer AGORA)
1. **URGENTE**: Alterar credenciais (PostgreSQL + JWT_SECRET)
2. ✅ **CONCLUÍDO**: Configurar SSL (SSL configurado e funcionando)

### 🟡 IMPORTANTE (Esta Semana)
3. Migrar componentes do frontend (queries)
4. Migrar Edge Functions
5. Testar todas as funcionalidades

### 🟢 OPCIONAL (Quando Conveniente)
6. Exportar dados do Supabase (ou inserir manualmente)
7. Configurar backup externo
8. Configurar alertas de monitoramento
9. Otimizações de performance

---

## ✅ CHECKLIST FINAL

### Infraestrutura
- [x] PostgreSQL 15.13 instalado e rodando
- [x] Banco de dados criado
- [x] Schema completo importado (43 tabelas)
- [x] API configurada e rodando
- [x] Nginx configurado e ativo
- [x] Frontend buildado e servido
- [x] DNS configurado e funcionando (blackhouse.app.br acessível)
- [x] Domínio respondendo externamente (HTTP 200 OK)
- [x] API acessível externamente (api.blackhouse.app.br funcionando)
- [x] Backup automático configurado

### Segurança
- [ ] **URGENTE**: Credenciais alteradas
- [ ] SSL configurado
- [ ] Firewall configurado (verificar)

### Funcionalidades
- [x] Autenticação migrada
- [ ] Queries do frontend migradas
- [ ] Storage migrado
- [ ] Edge Functions migradas

### Dados
- [ ] Dados do Supabase exportados OU inseridos manualmente
- [ ] Arquivos do storage migrados

---

**Última atualização**: 12 de Janeiro de 2026  
**Status geral**: ✅ **INFRAESTRUTURA COMPLETA - PENDÊNCIAS DE SEGURANÇA E MIGRAÇÃO DE CÓDIGO**
