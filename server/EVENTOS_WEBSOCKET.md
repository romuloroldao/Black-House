# 📡 Eventos WebSocket - Documentação Completa

**Data**: 12 de Janeiro de 2026

---

## 🔌 Conexão

### Conectar ao WebSocket

```typescript
import { io } from 'socket.io-client';

const socket = io('http://api.blackhouse.app.br', {
  auth: {
    token: localStorage.getItem('auth_token')
  },
  path: '/socket.io'
});

socket.on('connect', () => {
  console.log('Conectado:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Desconectado');
});

socket.on('error', (error) => {
  console.error('Erro:', error);
});
```

---

## 📤 Eventos Enviados pelo Cliente

### `join_conversation`
Entrar em uma sala de conversa.

**Payload**:
```typescript
{
  conversationId: string // UUID da conversa
}
```

**Resposta**: `conversation_joined` ou `error`

---

### `leave_conversation`
Sair de uma sala de conversa.

**Payload**:
```typescript
{
  conversationId: string
}
```

---

### `send_message`
Enviar mensagem de chat.

**Payload**:
```typescript
{
  conversationId?: string,  // Opcional: ID da conversa existente
  recipientId: string,      // ID do destinatário
  message: string           // Texto da mensagem
}
```

**Resposta**: `new_message` (broadcast para a sala)

---

## 📥 Eventos Recebidos pelo Cliente

### `conversation_joined`
Confirmação de entrada em conversa.

**Payload**:
```typescript
{
  conversationId: string
}
```

---

### `new_message`
Nova mensagem recebida.

**Payload**:
```typescript
{
  id: string,
  sender_id: string,
  recipient_id: string,
  message: string,
  created_at: string
}
```

---

### `notification`
Notificação genérica.

**Payload**:
```typescript
{
  type: string,           // Tipo da notificação
  title: string,         // Título
  message: string,       // Mensagem
  data: object,          // Dados adicionais
  timestamp: string      // ISO timestamp
}
```

**Tipos**:
- `payment_status`
- `payment_reminder`
- `checkin_reminder`
- `event_reminder`
- `workout_expired`
- `notification` (genérico)

---

### `payment_status_update`
Atualização de status de pagamento.

**Payload**:
```typescript
{
  paymentId: string,
  alunoId: string,
  alunoNome: string,
  status: 'PENDING' | 'CONFIRMED' | 'RECEIVED' | 'OVERDUE' | 'CANCELLED',
  value: number,
  dueDate: string,
  asaasPaymentId?: string,
  pixCopyPaste?: string,
  invoiceUrl?: string
}
```

---

### `payment_reminder`
Lembrete de pagamento próximo ao vencimento.

**Payload**:
```typescript
{
  paymentId: string,
  alunoId: string,
  alunoNome: string,
  value: number,
  dueDate: string,
  daysUntilDue: number  // Dias até o vencimento
}
```

---

### `checkin_reminder`
Lembrete de check-in semanal.

**Payload**:
```typescript
{
  alunoId: string,
  alunoNome: string
}
```

---

### `event_reminder`
Lembrete de evento próximo.

**Payload**:
```typescript
{
  eventId: string,
  titulo: string,
  dataEvento: string
}
```

---

## 🏠 Salas Automáticas

O sistema automaticamente adiciona o usuário às seguintes salas:

- `user:{userId}` - Notificações pessoais
- `coach:{coachId}` - Notificações do coach (se aplicável)
- `aluno:{alunoId}` - Notificações do aluno (se aplicável)
- `conversation:{conversationId}` - Mensagens da conversa (após join)

---

## 📝 Exemplo de Uso Completo

```typescript
import { io, Socket } from 'socket.io-client';

class WebSocketManager {
  private socket: Socket | null = null;

  connect(token: string) {
    this.socket = io('http://api.blackhouse.app.br', {
      auth: { token },
      path: '/socket.io'
    });

    this.setupListeners();
  }

  private setupListeners() {
    if (!this.socket) return;

    // Conexão
    this.socket.on('connect', () => {
      console.log('WebSocket conectado');
    });

    // Mensagens
    this.socket.on('new_message', (data) => {
      console.log('Nova mensagem:', data);
      // Atualizar UI de chat
    });

    // Notificações
    this.socket.on('notification', (data) => {
      console.log('Notificação:', data);
      // Mostrar toast/notificação
    });

    // Pagamentos
    this.socket.on('payment_status_update', (data) => {
      console.log('Status de pagamento:', data);
      // Atualizar lista de pagamentos
    });

    this.socket.on('payment_reminder', (data) => {
      console.log('Lembrete de pagamento:', data);
      // Mostrar alerta
    });
  }

  joinConversation(conversationId: string) {
    this.socket?.emit('join_conversation', { conversationId });
  }

  sendMessage(recipientId: string, message: string) {
    this.socket?.emit('send_message', {
      recipientId,
      message
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const wsManager = new WebSocketManager();
```

---

**Última atualização**: 12 de Janeiro de 2026
