// Hook React para WebSocket
// Substitui polling por conexão WebSocket real

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface WebSocketMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  created_at: string;
}

interface Notification {
  type: string;
  title: string;
  message: string;
  data?: any;
  timestamp: string;
}

interface PaymentStatusUpdate {
  paymentId: string;
  alunoId: string;
  alunoNome: string;
  status: 'PENDING' | 'CONFIRMED' | 'RECEIVED' | 'OVERDUE' | 'CANCELLED';
  value: number;
  dueDate: string;
  asaasPaymentId?: string;
  pixCopyPaste?: string;
  invoiceUrl?: string;
}

export function useWebSocket() {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Conectar ao WebSocket
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    const socket = io(API_URL, {
      auth: { token },
      path: '/socket.io',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket conectado');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket desconectado');
      setIsConnected(false);
    });

    socket.on('error', (error) => {
      console.error('Erro no WebSocket:', error);
    });

    // Mensagens
    socket.on('new_message', (data: WebSocketMessage) => {
      setMessages((prev) => [...prev, data]);
    });

    // Notificações
    socket.on('notification', (data: Notification) => {
      setNotifications((prev) => [data, ...prev]);
    });

    socket.on('payment_status_update', (data: PaymentStatusUpdate) => {
      setNotifications((prev) => [
        {
          type: 'payment_status',
          title: `Pagamento ${data.status}`,
          message: `Pagamento de ${data.alunoNome}: ${data.status}`,
          data,
          timestamp: new Date().toISOString()
        },
        ...prev
      ]);
    });

    socket.on('payment_reminder', (data: any) => {
      setNotifications((prev) => [
        {
          type: 'payment_reminder',
          title: 'Lembrete de Pagamento',
          message: `Pagamento de ${data.alunoNome} vence em ${data.daysUntilDue} dia(s)`,
          data,
          timestamp: new Date().toISOString()
        },
        ...prev
      ]);
    });

    socket.on('checkin_reminder', (data: any) => {
      setNotifications((prev) => [
        {
          type: 'checkin_reminder',
          title: 'Lembrete de Check-in',
          message: `${data.alunoNome} precisa fazer check-in semanal`,
          data,
          timestamp: new Date().toISOString()
        },
        ...prev
      ]);
    });

    socket.on('event_reminder', (data: any) => {
      setNotifications((prev) => [
        {
          type: 'event_reminder',
          title: 'Lembrete de Evento',
          message: `Evento "${data.titulo}" está próximo`,
          data,
          timestamp: new Date().toISOString()
        },
        ...prev
      ]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  // Entrar em conversa
  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('join_conversation', { conversationId });
  }, []);

  // Sair de conversa
  const leaveConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('leave_conversation', { conversationId });
  }, []);

  // Enviar mensagem
  const sendMessage = useCallback((recipientId: string, message: string, conversationId?: string) => {
    socketRef.current?.emit('send_message', {
      recipientId,
      message,
      conversationId
    });
  }, []);

  return {
    isConnected,
    messages,
    notifications,
    joinConversation,
    leaveConversation,
    sendMessage
  };
}
