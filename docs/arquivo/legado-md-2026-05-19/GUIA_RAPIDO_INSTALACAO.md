# ⚡ Guia Rápido de Instalação - Componentes Críticos

**Data**: 12 de Janeiro de 2026

---

## 🚀 Instalação em 5 Passos

### 1. Instalar Dependências

```bash
cd /var/www/blackhouse/server
npm install socket.io node-cron axios
```

### 2. Executar Migração SQL

```bash
psql -U app_user -d blackhouse_db -f server/migrations/add_websocket_and_webhooks.sql
```

### 3. Configurar Variáveis de Ambiente

Edite `/var/www/blackhouse/server/.env` e adicione:

```env
# WebSocket
ENABLE_WEBSOCKET=true

# Background Jobs
ENABLE_JOBS=true

# Asaas (obtenha em https://www.asaas.com/)
ASAAS_API_KEY=sua_chave_aqui
ASAAS_ENVIRONMENT=production  # ou 'sandbox' para testes
ASAAS_WEBHOOK_TOKEN=token_secreto_aleatorio_aqui
```

### 4. Reiniciar Servidor

```bash
sudo systemctl restart blackhouse-api
sudo systemctl status blackhouse-api  # Verificar se iniciou corretamente
```

### 5. Verificar Logs

```bash
sudo journalctl -u blackhouse-api -f
```

Você deve ver:
```
✅ WebSocket Service inicializado
✅ Asaas Service inicializado
✅ Background Jobs inicializados
✅ Webhook routes configuradas
🚀 API rodando na porta 3001
```

---

## 🔧 Configurar Webhook no Asaas

1. Acesse https://www.asaas.com/
2. Vá em **Configurações** → **Webhooks**
3. Adicione novo webhook:
   - **URL**: `https://api.blackhouse.app.br/api/webhooks/asaas`
   - **Token**: Mesmo valor de `ASAAS_WEBHOOK_TOKEN` no `.env`
   - **Eventos**: Selecione todos os eventos de pagamento

---

## ✅ Verificação

### Testar WebSocket

No console do navegador (com usuário logado):

```javascript
import { io } from 'socket.io-client';

const socket = io('http://api.blackhouse.app.br', {
  auth: { token: localStorage.getItem('auth_token') }
});

socket.on('connect', () => console.log('✅ WebSocket conectado!'));
```

### Testar Jobs

Os jobs executam automaticamente nos horários configurados. Verifique os logs:

```bash
sudo journalctl -u blackhouse-api | grep "Job"
```

### Testar Webhook

Use o webhook tester do Asaas ou envie manualmente:

```bash
curl -X POST https://api.blackhouse.app.br/api/webhooks/asaas \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: SEU_TOKEN_AQUI" \
  -d '{
    "event": "PAYMENT_RECEIVED",
    "payment": {
      "id": "pay_test",
      "externalReference": "payment_123_1234567890"
    }
  }'
```

---

## 📦 Instalar Socket.io no Frontend

```bash
cd /var/www/blackhouse
npm install socket.io-client
```

Depois, use o hook `useWebSocket` criado em `src/hooks/useWebSocket.ts`.

---

## 🐛 Troubleshooting

### WebSocket não conecta
- Verifique se `ENABLE_WEBSOCKET=true` no `.env`
- Verifique se o token JWT é válido
- Verifique logs: `sudo journalctl -u blackhouse-api | grep WebSocket`

### Jobs não executam
- Verifique se `ENABLE_JOBS=true` no `.env`
- Verifique se `notificationService` está inicializado
- Verifique logs: `sudo journalctl -u blackhouse-api | grep Job`

### Webhook retorna 401
- Verifique se `ASAAS_WEBHOOK_TOKEN` está configurado
- Verifique se o token no Asaas é o mesmo do `.env`

### Erro ao criar pagamento no Asaas
- Verifique se `ASAAS_API_KEY` está configurada
- Verifique se a chave é válida
- Teste em sandbox primeiro (`ASAAS_ENVIRONMENT=sandbox`)

---

## 📚 Documentação Completa

- **Eventos WebSocket**: `server/EVENTOS_WEBSOCKET.md`
- **Implementação**: `IMPLEMENTACAO_COMPONENTES_CRITICOS.md`
- **Análise Arquitetura**: `ANALISE_ARQUITETURA_MIGRACAO_COMPLETA.md`

---

**Última atualização**: 12 de Janeiro de 2026
