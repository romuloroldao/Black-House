/**
 * Socket.io no portal do aluno: toast + refresh automático (Fase 1).
 */
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.blackhouse.app.br';

export const STUDENT_REALTIME_EVENT = 'blackhouse:student-realtime';

export type StudentRealtimeDetail = {
  type: string;
  link?: string;
  title?: string;
  message?: string;
};

function dispatchStudentRealtime(detail: StudentRealtimeDetail) {
  window.dispatchEvent(new CustomEvent(STUDENT_REALTIME_EVENT, { detail }));
}

export function useStudentPortalRealtime(options?: { onNavigate?: (tab: string) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const socketRef = useRef<Socket | null>(null);
  const onNavigateRef = useRef(options?.onNavigate);
  onNavigateRef.current = options?.onNavigate;

  useEffect(() => {
    if (user?.role !== 'aluno') return;

    const token = apiClient.getToken();
    if (!token) return;

    const socket = io(API_URL, {
      auth: { token },
      path: '/socket.io',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 8,
    });

    socketRef.current = socket;

    const handlePayload = (payload: {
      type?: string;
      title?: string;
      message?: string;
      data?: { link?: string };
    }) => {
      const type = payload?.type || 'notification';
      const link = payload?.data?.link;
      const title = payload?.title || 'Nova notificação';
      const message = payload?.message || '';

      toast({
        title,
        description: message,
      });

      dispatchStudentRealtime({ type, link, title, message });

      if (link && onNavigateRef.current) {
        const tabMap: Record<string, string> = {
          checkin: 'checkin',
          diet: 'diet',
          workouts: 'workouts',
          coach: 'coach',
          videos: 'videos',
        };
        const tab = tabMap[link];
        if (tab && (type === 'checkin_respondido' || type === 'dieta_atualizada')) {
          /* utilizador decide se navega — só refresh automático */
        }
      }
    };

    socket.on('notification', handlePayload);
    socket.on('checkin:respondido', handlePayload);
    socket.on('dieta:atualizada', handlePayload);

    return () => {
      socket.off('notification', handlePayload);
      socket.off('checkin:respondido', handlePayload);
      socket.off('dieta:atualizada', handlePayload);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.role, user?.id, toast]);
}
