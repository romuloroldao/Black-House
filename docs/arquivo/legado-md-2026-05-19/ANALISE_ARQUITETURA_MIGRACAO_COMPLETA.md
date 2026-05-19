# 🏗️ Análise Completa da Arquitetura - Migração Supabase → VPS Própria

**Data**: 12 de Janeiro de 2026  
**Projeto**: Black House Coach Platform  
**Status**: 🟡 Migração em Progresso (~85% completo)

---

## 📊 1. Estado Atual do VPS

### Serviços em Execução

| Serviço | Status | Porta | Descrição |
|---------|--------|-------|-----------|
| `blackhouse-api.service` | ✅ Running | 3001 | API Node.js/Express |
| `nginx.service` | ✅ Running | 80/443 | Reverse Proxy |
| `postgresql@15-main.service` | ✅ Running | 5432 | PostgreSQL 15 |

### Infraestrutura Detectada

**Diretórios Principais**:
- `/var/www/blackhouse/dist` - Frontend build (React + Vite)
- `/var/www/blackhouse/server` - Backend API (Node.js/Express)
- `/var/www/blackhouse/public` - Arquivos estáticos

**Configuração Nginx**:
- Frontend: `blackhouse.app.br` → `/var/www/blackhouse/dist`
- API: `api.blackhouse.app.br` → `http://localhost:3001`
- Upload máximo: 50MB
- Timeouts: 60s

**Cron Jobs**:
- Backup do banco: `0 2 * * *` (diário às 2h)

**Systemd Service**:
- Usuário: `www-data`
- Working Directory: `/var/www/blackhouse/server`
- Restart: `always`
- Environment: `.env` carregado

---

## 🔍 2. Gaps Detectados vs Arquitetura Alvo

### ✅ Componentes Implementados

| Componente | Status | Implementação |
|------------|--------|---------------|
| **Auth (JWT)** | ✅ Completo | JWT com `app_auth.users`, middleware `authenticate` |
| **Database (PostgreSQL)** | ✅ Completo | PostgreSQL 15, schema migrado |
| **API REST** | ✅ Completo | Express.js com endpoints REST |
| **File Upload (PDF)** | ✅ Completo | Multer com memória, multipart/form-data |
| **PDF Parsing** | ✅ Completo | `pdf-parse` local + IA multimodal |
| **Importação de Fichas** | ✅ Completo | Arquitetura em camadas completa |

### 🟡 Componentes Parcialmente Implementados

| Componente | Status | O que falta |
|------------|--------|-------------|
| **Realtime** | 🟡 Polling | WebSocket/SSE não implementado |
| **Storage** | 🟡 Básico | Sem sistema de buckets/organização |
| **Background Jobs** | 🟡 Apenas backup | Sem jobs de negócio (reminders, etc) |
| **Webhooks** | 🟡 Não implementado | Asaas webhooks não configurados |
| **Email** | 🟡 Não implementado | Reset password, verificação, etc |

### ❌ Componentes Não Implementados

| Componente | Prioridade | Impacto |
|------------|------------|---------|
| **WebSocket Server** | Alta | Chat, notificações em tempo real |
| **Sistema de Storage** | Média | Organização de arquivos (fotos, PDFs) |
| **Background Job Queue** | Alta | Reminders, cobranças recorrentes |
| **Webhook Handler (Asaas)** | Alta | Atualização de status de pagamentos |
| **Email Service** | Média | Reset password, notificações |
| **Row Level Security** | Média | Validação de acesso no backend |

---

## 🗺️ 3. Mapeamento de Features Supabase → Self-Hosted

### Auth

| Supabase Feature | Status | Substituição |
|------------------|--------|--------------|
| `auth.users` | ✅ Migrado | `app_auth.users` (schema próprio) |
| `signUp()` | ✅ Implementado | `POST /auth/signup` |
| `signIn()` | ✅ Implementado | `POST /auth/login` |
| `signOut()` | ✅ Implementado | Remoção de token |
| `resetPasswordForEmail()` | ❌ Não implementado | **TODO**: Implementar |
| `updateUser()` | ❌ Não implementado | **TODO**: Implementar |
| `verifyEmail()` | ❌ Não implementado | **TODO**: Implementar |
| RLS Policies | 🟡 Parcial | Validação manual no middleware |

### Database

| Supabase Feature | Status | Substituição |
|------------------|--------|--------------|
| `from('table').select()` | ✅ Implementado | `GET /rest/v1/:table` com filtros |
| `from('table').insert()` | ✅ Implementado | `POST /rest/v1/:table` |
| `from('table').update()` | ✅ Implementado | `PATCH /rest/v1/:table` |
| `from('table').delete()` | ✅ Implementado | `DELETE /rest/v1/:table` |
| RPC Functions | 🟡 Parcial | Endpoints REST específicos |
| Realtime Subscriptions | ❌ Não implementado | **TODO**: WebSocket |

### Storage

| Supabase Feature | Status | Substituição |
|------------------|--------|--------------|
| `storage.from('bucket').upload()` | 🟡 Básico | `POST /api/storage/upload` (TODO) |
| `storage.from('bucket').download()` | ❌ Não implementado | **TODO**: Implementar |
| `storage.from('bucket').remove()` | ❌ Não implementado | **TODO**: Implementar |
| Public URLs | ❌ Não implementado | **TODO**: Nginx serve arquivos |

### Edge Functions

| Supabase Feature | Status | Substituição |
|------------------|--------|--------------|
| `parse-student-pdf` | ✅ Migrado | `POST /api/import/parse-pdf` |
| `create-asaas-payment` | ✅ Migrado | `POST /api/payments/create-asaas` |
| Outras Edge Functions | ✅ Migradas | Endpoints REST na API |

### Realtime

| Supabase Feature | Status | Substituição |
|------------------|--------|--------------|
| `channel().subscribe()` | 🟡 Polling | Polling a cada 10s (temporário) |
| `channel().on('INSERT')` | 🟡 Polling | Polling periódico |
| WebSocket nativo | ❌ Não implementado | **TODO**: WebSocket Server |

---

## 🔧 4. Serviços e Componentes Faltantes

### Alta Prioridade

#### 4.1 WebSocket Server
**Descrição**: Servidor WebSocket para realtime (chat, notificações)  
**Tecnologia**: `ws` (Node.js) ou Socket.io  
**Uso**: Chat aluno-coach, notificações em tempo real  
**Status**: ❌ Não implementado

**Implementação Necessária**:
```javascript
// server/services/websocket.service.js
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3002 });

wss.on('connection', (ws, req) => {
  // Autenticar via JWT
  // Criar canais por usuário/coach/aluno
  // Broadcast de mensagens
});
```

#### 4.2 Background Job Queue
**Descrição**: Sistema de filas para jobs assíncronos  
**Tecnologia**: `bull` + Redis ou `node-cron` (simples)  
**Jobs Necessários**:
- Enviar lembretes de pagamento
- Enviar lembretes de check-in
- Enviar lembretes de eventos
- Gerar cobranças recorrentes
- Verificar expiração de treinos

**Status**: ❌ Não implementado

**Implementação Necessária**:
```javascript
// server/jobs/payment-reminders.js
const cron = require('node-cron');

cron.schedule('0 9 * * *', async () => {
  // Buscar pagamentos vencendo em 3 dias
  // Enviar email/SMS de lembrete
});
```

#### 4.3 Webhook Handler (Asaas)
**Descrição**: Endpoint para receber webhooks do Asaas  
**Uso**: Atualizar status de pagamentos automaticamente  
**Status**: ❌ Não implementado

**Implementação Necessária**:
```javascript
// server/routes/webhooks.js
app.post('/api/webhooks/asaas', async (req, res) => {
  // Validar assinatura do webhook
  // Atualizar status do pagamento no banco
  // Notificar usuário via WebSocket
});
```

### Média Prioridade

#### 4.4 Sistema de Storage Organizado
**Descrição**: Sistema de buckets/organização de arquivos  
**Tecnologia**: Sistema de arquivos local ou MinIO  
**Uso**: Fotos de alunos, PDFs, relatórios  
**Status**: 🟡 Básico (sem organização)

**Estrutura Proposta**:
```
/var/www/blackhouse/storage/
  ├── alunos/
  │   └── {aluno_id}/
  │       ├── fotos/
  │       └── documentos/
  ├── relatorios/
  └── public/
```

#### 4.5 Email Service
**Descrição**: Serviço de envio de emails  
**Tecnologia**: Nodemailer + SMTP ou SendGrid/Resend  
**Uso**: Reset password, verificação de email, notificações  
**Status**: ❌ Não implementado

**Implementação Necessária**:
```javascript
// server/services/email.service.js
const nodemailer = require('nodemailer');

async function sendPasswordReset(email, token) {
  // Enviar email com link de reset
}
```

#### 4.6 Row Level Security (Application Layer)
**Descrição**: Validação de acesso no backend  
**Status**: 🟡 Parcial (apenas `coach_id`)

**Implementação Necessária**:
```javascript
// server/middleware/rls.js
async function checkRLS(req, res, next) {
  // Verificar se usuário tem acesso ao recurso
  // Baseado em role e relacionamentos
}
```

### Baixa Prioridade

#### 4.7 Monitoring & Logging
**Descrição**: Sistema de monitoramento e logs centralizados  
**Tecnologia**: Winston + ELK ou simples file logging  
**Status**: 🟡 Básico (console.log)

#### 4.8 Rate Limiting
**Descrição**: Limitação de requisições por IP/usuário  
**Tecnologia**: `express-rate-limit`  
**Status**: ❌ Não implementado

---

## 🔄 5. Refatorações Necessárias (Alto Nível)

### Frontend

#### 5.1 Remover Dependências Supabase
**Arquivos Afetados**:
- `src/integrations/supabase/client.ts` - **Manter temporariamente** (scripts)
- `src/integrations/supabase/types.ts` - **Manter temporariamente** (referência)
- Componentes que ainda usam `supabase` diretamente

**Ação**: Migrar para `apiClient` (já feito em ~95% dos componentes)

#### 5.2 Substituir Realtime por WebSocket
**Arquivos Afetados**:
- `src/components/MessageManager.tsx`
- `src/components/NotificationsPopover.tsx`
- `src/components/Sidebar.tsx`
- `src/components/student/StudentChatView.tsx`

**Ação**: Criar hook `useWebSocket` e substituir polling

#### 5.3 Atualizar Storage Calls
**Arquivos Afetados**:
- `src/lib/api-client.ts` - Método `uploadFile()`
- Componentes que fazem upload de arquivos

**Ação**: Usar endpoints REST da API própria

### Backend

#### 5.4 Implementar WebSocket Server
**Arquivo**: `server/services/websocket.service.js` (novo)  
**Integração**: Adicionar ao `index.js`

#### 5.5 Implementar Background Jobs
**Arquivos**: `server/jobs/*.js` (novos)  
**Integração**: Iniciar junto com API

#### 5.6 Implementar Webhook Handler
**Arquivo**: `server/routes/webhooks.js` (novo)  
**Integração**: Adicionar ao `index.js`

#### 5.7 Implementar Email Service
**Arquivo**: `server/services/email.service.js` (novo)  
**Integração**: Usar em auth e jobs

#### 5.8 Implementar Storage Service
**Arquivo**: `server/services/storage.service.js` (novo)  
**Endpoints**: `POST /api/storage/upload`, `GET /api/storage/:path`

---

## 🗄️ 6. Notas de Migração do Banco de Dados

### Schema Atual

**Schemas Identificados**:
- `public` - Tabelas principais (alunos, dietas, alimentos, etc)
- `app_auth` - Autenticação (users, sessions)

**Tabelas Principais**:
- `alunos` - Dados dos alunos
- `dietas` - Planos alimentares
- `alimentos` - Base de alimentos
- `itens_dieta` - Itens das dietas
- `asaas_payments` - Pagamentos
- `app_auth.users` - Usuários autenticados

### Migrações Necessárias

#### 6.1 Tabela de Storage
```sql
CREATE TABLE IF NOT EXISTS public.storage_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket VARCHAR(100) NOT NULL,
    path VARCHAR(500) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    size BIGINT,
    owner_id UUID REFERENCES app_auth.users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(bucket, path, filename)
);
```

#### 6.2 Tabela de Webhooks
```sql
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(50) NOT NULL, -- 'asaas', 'outro'
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 6.3 Tabela de Jobs
```sql
CREATE TABLE IF NOT EXISTS public.background_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(100) NOT NULL,
    payload JSONB,
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔒 7. Considerações de Segurança

### Implementado

✅ **JWT Authentication** - Tokens assinados com secret  
✅ **Helmet** - Headers de segurança  
✅ **CORS** - Configurado para domínios específicos  
✅ **Password Hashing** - bcrypt com salt  
✅ **SQL Injection Protection** - Prepared statements (pg)

### A Implementar

❌ **Rate Limiting** - Prevenir abuso de API  
❌ **Webhook Signature Validation** - Validar webhooks do Asaas  
❌ **File Upload Validation** - Validar tipos e tamanhos  
❌ **HTTPS** - Certificado SSL (Let's Encrypt)  
❌ **Input Sanitization** - Sanitizar inputs do usuário  
❌ **Audit Logging** - Log de ações sensíveis

---

## 📋 8. Plano de Migração Passo a Passo

### Fase 1: Completar Infraestrutura Crítica (Prioridade Alta)

#### ✅ 1.1 WebSocket Server
**Estimativa**: 2-3 dias  
**Dependências**: Nenhuma

**Tarefas**:
1. Instalar `ws` ou `socket.io`
2. Criar `server/services/websocket.service.js`
3. Integrar autenticação JWT
4. Criar canais por usuário/coach/aluno
5. Atualizar frontend para usar WebSocket
6. Remover polling temporário

**Arquivos**:
- `server/services/websocket.service.js` (novo)
- `server/index.js` (modificar)
- `src/hooks/useWebSocket.ts` (novo)
- Componentes de chat/notificações (modificar)

#### ✅ 1.2 Background Job Queue
**Estimativa**: 3-4 dias  
**Dependências**: Nenhuma (usar `node-cron`)

**Tarefas**:
1. Instalar `node-cron`
2. Criar `server/jobs/` com jobs:
   - `payment-reminders.js`
   - `checkin-reminders.js`
   - `event-reminders.js`
   - `recurring-charges.js`
   - `workout-expirations.js`
3. Criar tabela `background_jobs`
4. Integrar com email service (quando disponível)
5. Adicionar logs e monitoramento

**Arquivos**:
- `server/jobs/*.js` (novos)
- `server/services/job-runner.service.js` (novo)
- Migração SQL (nova)

#### ✅ 1.3 Webhook Handler (Asaas)
**Estimativa**: 1-2 dias  
**Dependências**: Integração Asaas SDK

**Tarefas**:
1. Instalar SDK do Asaas
2. Criar `server/routes/webhooks.js`
3. Implementar validação de assinatura
4. Processar eventos do Asaas:
   - `PAYMENT_CONFIRMED`
   - `PAYMENT_OVERDUE`
   - `PAYMENT_RECEIVED`
5. Atualizar `asaas_payments` no banco
6. Notificar usuário via WebSocket
7. Configurar URL no painel Asaas

**Arquivos**:
- `server/routes/webhooks.js` (novo)
- `server/services/asaas.service.js` (novo)
- `server/index.js` (modificar)

### Fase 2: Infraestrutura de Suporte (Prioridade Média)

#### ✅ 2.1 Email Service
**Estimativa**: 2-3 dias  
**Dependências**: SMTP ou SendGrid/Resend

**Tarefas**:
1. Escolher provedor (SendGrid/Resend/SMTP próprio)
2. Instalar `nodemailer` ou SDK do provedor
3. Criar `server/services/email.service.js`
4. Implementar templates:
   - Reset password
   - Verificação de email
   - Notificações
5. Integrar com auth (reset password)
6. Integrar com jobs (lembretes)

**Arquivos**:
- `server/services/email.service.js` (novo)
- `server/templates/email/*.html` (novos)
- `server/index.js` (modificar - auth)

#### ✅ 2.2 Sistema de Storage
**Estimativa**: 2-3 dias  
**Dependências**: Nenhuma

**Tarefas**:
1. Criar estrutura de diretórios
2. Criar `server/services/storage.service.js`
3. Implementar endpoints:
   - `POST /api/storage/upload`
   - `GET /api/storage/:bucket/:path`
   - `DELETE /api/storage/:bucket/:path`
4. Criar tabela `storage_files`
5. Configurar Nginx para servir arquivos públicos
6. Migrar uploads existentes

**Arquivos**:
- `server/services/storage.service.js` (novo)
- `server/routes/storage.js` (novo)
- Migração SQL (nova)
- Configuração Nginx (modificar)

#### ✅ 2.3 Row Level Security (Application Layer)
**Estimativa**: 2 dias  
**Dependências**: Nenhuma

**Tarefas**:
1. Criar `server/middleware/rls.js`
2. Implementar validações:
   - Coach só acessa seus alunos
   - Aluno só acessa seus dados
   - Admin acessa tudo
3. Aplicar em todos os endpoints
4. Adicionar testes

**Arquivos**:
- `server/middleware/rls.js` (novo)
- Endpoints existentes (modificar)

### Fase 3: Melhorias e Otimizações (Prioridade Baixa)

#### ✅ 3.1 Rate Limiting
**Estimativa**: 1 dia

**Tarefas**:
1. Instalar `express-rate-limit`
2. Configurar limites por endpoint
3. Adicionar ao `index.js`

#### ✅ 3.2 Monitoring & Logging
**Estimativa**: 2-3 dias

**Tarefas**:
1. Instalar `winston`
2. Configurar logs estruturados
3. Adicionar métricas básicas
4. Dashboard simples (opcional)

#### ✅ 3.3 HTTPS/SSL
**Estimativa**: 1 dia

**Tarefas**:
1. Instalar Certbot
2. Configurar Let's Encrypt
3. Atualizar Nginx para HTTPS
4. Redirecionar HTTP → HTTPS

---

## 📊 9. Checklist de Migração (Ordenado por Prioridade)

### Crítico (Bloqueadores)

- [ ] **WebSocket Server** - Chat e notificações em tempo real
- [ ] **Background Jobs** - Reminders e cobranças recorrentes
- [ ] **Webhook Handler (Asaas)** - Atualização automática de pagamentos
- [ ] **Completar Integração Asaas** - SDK e criação real de pagamentos

### Importante (Funcionalidades Core)

- [ ] **Email Service** - Reset password e notificações
- [ ] **Sistema de Storage** - Organização de arquivos
- [ ] **Row Level Security** - Validação de acesso no backend
- [ ] **Remover Supabase do Frontend** - Limpar últimos componentes

### Desejável (Melhorias)

- [ ] **Rate Limiting** - Prevenir abuso
- [ ] **Monitoring & Logging** - Observabilidade
- [ ] **HTTPS/SSL** - Segurança em produção
- [ ] **Input Sanitization** - Prevenir XSS/SQL Injection
- [ ] **Audit Logging** - Rastreabilidade

---

## 🎯 10. Estimativas e Recursos

### Tempo Total Estimado

- **Fase 1 (Crítica)**: 6-9 dias
- **Fase 2 (Suporte)**: 6-9 dias
- **Fase 3 (Melhorias)**: 4-5 dias
- **Total**: 16-23 dias úteis

### Dependências Externas

- **Asaas SDK**: Integração completa
- **Provedor de Email**: SendGrid/Resend ou SMTP
- **Certificado SSL**: Let's Encrypt (gratuito)

### Riscos Identificados

1. **WebSocket**: Complexidade de escalabilidade
2. **Background Jobs**: Necessidade de monitoramento
3. **Webhooks**: Confiabilidade e retry logic
4. **Storage**: Gerenciamento de espaço em disco

---

## 📝 11. Próximos Passos Imediatos

1. **Implementar WebSocket Server** (2-3 dias)
2. **Implementar Background Jobs** (3-4 dias)
3. **Implementar Webhook Handler** (1-2 dias)
4. **Completar Integração Asaas** (1-2 dias)

**Total**: 7-11 dias para completar infraestrutura crítica

---

**Última atualização**: 12 de Janeiro de 2026
