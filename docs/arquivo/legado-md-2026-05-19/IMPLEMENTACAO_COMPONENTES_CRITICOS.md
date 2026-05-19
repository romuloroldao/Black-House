# 🚀 Implementação dos Componentes Críticos - Backend

**Data**: 12 de Janeiro de 2026  
**Status**: ✅ **IMPLEMENTADO**

---

## 📦 Componentes Implementados

### 1. ✅ WebSocket Server
**Arquivo**: `server/services/websocket.service.js`

**Funcionalidades**:
- Autenticação JWT no handshake
- Identificação de usuário (userId, role, coachId, alunoId)
- Salas por usuário, coach e aluno
- Salas de conversa (chat)
- Eventos: `new_message`, `notification`, `payment_status_update`, etc.

**Eventos Disponíveis**:
- `join_conversation` - Entrar em sala de conversa
- `leave_conversation` - Sair de sala de conversa
- `send_message` - Enviar mensagem de chat
- `new_message` - Nova mensagem recebida
- `notification` - Notificação genérica
- `payment_status_update` - Atualização de status de pagamento
- `payment_reminder` - Lembrete de pagamento
- `checkin_reminder` - Lembrete de check-in
- `event_reminder` - Lembrete de evento

**Uso no Frontend**:
```typescript
import { io } from 'socket.io-client';

const socket = io('http://api.blackhouse.app.br', {
  auth: {
    token: localStorage.getItem('auth_token')
  }
});

socket.on('connect', () => {
  console.log('Conectado ao WebSocket');
});

socket.on('new_message', (data) => {
  console.log('Nova mensagem:', data);
});

socket.on('notification', (data) => {
  console.log('Notificação:', data);
});
```

---

### 2. ✅ Background Jobs
**Diretório**: `server/jobs/`

**Jobs Implementados**:
1. **PaymentRemindersJob** - Lembretes de pagamento (diário às 9h)
2. **CheckinRemindersJob** - Lembretes de check-in (segunda às 10h)
3. **EventRemindersJob** - Lembretes de eventos (diário às 8h)
4. **RecurringChargesJob** - Cobranças recorrentes (dia 1 às 6h)
5. **WorkoutExpirationsJob** - Treinos expirados (diário às 7h)

**Arquivo Principal**: `server/jobs/index.js`

**Agendamento**:
- Todos os jobs são idempotentes
- Proteção contra execução simultânea
- Logs detalhados de execução

---

### 3. ✅ Notification Service
**Arquivo**: `server/services/notification.service.js`

**Funcionalidades**:
- Emitir notificações via WebSocket
- Salvar notificações no banco de dados
- Métodos específicos para cada tipo de notificação

**Métodos**:
- `notifyPaymentStatus()` - Status de pagamento
- `notifyPaymentReminder()` - Lembrete de pagamento
- `notifyCheckinReminder()` - Lembrete de check-in
- `notifyEventReminder()` - Lembrete de evento
- `notifyUser()` - Notificação genérica

---

### 4. ✅ Webhook Handler (Asaas)
**Arquivo**: `server/routes/webhooks.js`

**Endpoint**: `POST /api/webhooks/asaas`

**Eventos Suportados**:
- `PAYMENT_RECEIVED` → Status: `RECEIVED`
- `PAYMENT_CONFIRMED` → Status: `CONFIRMED`
- `PAYMENT_OVERDUE` → Status: `OVERDUE`
- `PAYMENT_DELETED` → Status: `CANCELLED`
- `PAYMENT_RESTORED` → Status: `PENDING`

**Segurança**:
- Validação de token via `ASAAS_WEBHOOK_TOKEN`
- Auditoria de eventos em `webhook_events`

---

### 5. ✅ Asaas Service
**Arquivo**: `server/services/asaas.service.js`

**Funcionalidades**:
- Criar/buscar cliente no Asaas
- Criar pagamento (BOLETO, PIX, CREDIT_CARD)
- Buscar pagamento por ID
- Cancelar pagamento
- Criar pagamento completo (cliente + pagamento)

**Métodos**:
- `createOrGetCustomer()` - Criar ou buscar cliente
- `createPayment()` - Criar pagamento
- `getPayment()` - Buscar pagamento
- `cancelPayment()` - Cancelar pagamento
- `createCompletePayment()` - Criar pagamento completo

---

## 🔧 Configuração

### Variáveis de Ambiente

Adicione ao `.env`:

```env
# WebSocket
ENABLE_WEBSOCKET=true

# Background Jobs
ENABLE_JOBS=true

# Asaas
ASAAS_API_KEY=sua_chave_asaas_aqui
ASAAS_ENVIRONMENT=production  # ou 'sandbox'
ASAAS_WEBHOOK_TOKEN=token_secreto_webhook

# JWT (já deve estar configurado)
JWT_SECRET=seu_secret_jwt
```

### Instalação de Dependências

```bash
cd /var/www/blackhouse/server
npm install socket.io node-cron axios
```

### Migração do Banco de Dados

```bash
psql -U app_user -d blackhouse_db -f server/migrations/add_websocket_and_webhooks.sql
```

---

## 📡 Integração no index.js

O `index.js` foi atualizado para:

1. **Inicializar WebSocket** quando `ENABLE_WEBSOCKET=true`
2. **Inicializar Background Jobs** quando `ENABLE_JOBS=true`
3. **Inicializar Asaas Service** quando `ASAAS_API_KEY` estiver configurada
4. **Configurar Webhook Routes** quando `ASAAS_WEBHOOK_TOKEN` estiver configurada
5. **Atualizar endpoint de pagamento** para usar Asaas Service completo

---

## 🎯 Endpoints Atualizados

### POST /api/payments/create-asaas

**Antes**: Apenas registro local  
**Agora**: Cria cliente e pagamento no Asaas + registro local

**Resposta**:
```json
{
  "success": true,
  "payment": {
    "id": "uuid",
    "asaas_payment_id": "pay_xxx",
    "pix_copy_paste": "00020126...",
    "invoice_url": "https://www.asaas.com/...",
    ...
  }
}
```

---

## 🔄 Fluxo Completo

### Criação de Pagamento

```
Frontend → POST /api/payments/create-asaas
    ↓
Backend → AsaasService.createCompletePayment()
    ↓
Asaas API → Cria cliente + pagamento
    ↓
Backend → Salva no banco com dados do Asaas
    ↓
Backend → NotificationService.notifyPaymentStatus()
    ↓
WebSocket → Emite para coach
```

### Webhook do Asaas

```
Asaas → POST /api/webhooks/asaas
    ↓
Backend → Valida token
    ↓
Backend → Atualiza status no banco
    ↓
Backend → NotificationService.notifyPaymentStatus()
    ↓
WebSocket → Emite para coach
```

### Background Job (Exemplo: Payment Reminders)

```
Cron (9h) → PaymentRemindersJob.execute()
    ↓
Backend → Busca pagamentos vencendo em 3 dias
    ↓
Backend → NotificationService.notifyPaymentReminder()
    ↓
WebSocket → Emite para coach
    ↓
Backend → Salva notificação no banco
```

---

## 📊 Estrutura de Arquivos

```
server/
├── services/
│   ├── websocket.service.js      ✅ Novo
│   ├── notification.service.js   ✅ Novo
│   └── asaas.service.js           ✅ Novo
├── jobs/
│   ├── index.js                   ✅ Novo
│   ├── payment-reminders.job.js   ✅ Novo
│   ├── checkin-reminders.job.js   ✅ Novo
│   ├── event-reminders.job.js     ✅ Novo
│   ├── recurring-charges.job.js  ✅ Novo
│   └── workout-expirations.job.js ✅ Novo
├── routes/
│   └── webhooks.js                ✅ Novo
├── migrations/
│   └── add_websocket_and_webhooks.sql ✅ Novo
└── index.js                        ✅ Atualizado
```

---

## ✅ Checklist de Implementação

- [x] WebSocket Server com autenticação JWT
- [x] Notification Service compartilhado
- [x] Background Jobs (5 jobs)
- [x] Webhook Handler para Asaas
- [x] Asaas Service completo
- [x] Integração no index.js
- [x] Migrações SQL
- [x] Atualização do endpoint de pagamento

---

## 🚀 Próximos Passos

1. **Instalar dependências**: `npm install socket.io node-cron axios`
2. **Executar migração**: `psql -U app_user -d blackhouse_db -f server/migrations/add_websocket_and_webhooks.sql`
3. **Configurar variáveis de ambiente** no `.env`
4. **Reiniciar servidor**: `sudo systemctl restart blackhouse-api`
5. **Configurar webhook no Asaas**: URL: `https://api.blackhouse.app.br/api/webhooks/asaas`
6. **Testar WebSocket** no frontend
7. **Monitorar logs** dos jobs

---

**Última atualização**: 12 de Janeiro de 2026
