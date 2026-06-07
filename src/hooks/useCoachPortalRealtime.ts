/**
 * Socket.io no painel do coach: toast + refresh automático (Fase 2 realtime).
 * Polling longo só como fallback quando o socket estiver desligado.
 */
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.blackhouse.app.br';

export const COACH_REALTIME_EVENT = 'blackhouse:coach-realtime';

export type CoachRealtimeDetail = {
  type: string;
  checkinId?: string;
  alunoId?: string;
  title?: string;
  message?: string;
};

function dispatchCoachRealtime(detail: CoachRealtimeDetail) {
  window.dispatchEvent(new CustomEvent(COACH_REALTIME_EVENT, { detail }));
  window.dispatchEvent(new CustomEvent('blackhouse:checkin-pending-updated'));
}

function extractCheckinKey(payload: {
  type?: string;
  data?: { checkinId?: string; checkin_id?: string };
  checkinId?: string;
}): string | null {
  return (
    payload?.data?.checkinId ||
    payload?.data?.checkin_id ||
    payload?.checkinId ||
    null
  );
}

export function useCoachPortalRealtime() {
  const { user } = useAuth();
  const { toast } = useToast();
  const socketRef = useRef<Socket | null>(null);
  const connectedRef = useRef(false);
  const recentToastKeysRef = useRef<Set<string>>(new Set());

  const showCheckinToast = (payload: {
    title?: string;
    message?: string;
    data?: { checkinId?: string; checkin_id?: string; alunoNome?: string };
    checkinId?: string;
    alunoNome?: string;
  }) => {
    const checkinId = extractCheckinKey(payload);
    const dedupeKey = checkinId || payload?.title || 'new_weekly_checkin';
    if (recentToastKeysRef.current.has(dedupeKey)) return;
    recentToastKeysRef.current.add(dedupeKey);
    window.setTimeout(() => recentToastKeysRef.current.delete(dedupeKey), 5000);

    const aluno = payload?.data?.alunoNome || payload?.alunoNome;
    toast({
      title: payload?.title || 'Novo check-in semanal',
      description:
        payload?.message ||
        (aluno ? `${aluno} enviou o check-in da semana.` : 'Um aluno enviou o check-in da semana.'),
    });

    dispatchCoachRealtime({
      type: 'new_weekly_checkin',
      checkinId: checkinId || undefined,
      alunoId: payload?.data?.alunoId,
      title: payload?.title,
      message: payload?.message,
    });
  };

  useEffect(() => {
    if (!user || (user.role !== 'coach' && user.role !== 'admin')) return;

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

    const onConnect = () => {
      connectedRef.current = true;
    };
    const onDisconnect = () => {
      connectedRef.current = false;
    };

    const handleNotification = (payload: {
      type?: string;
      title?: string;
      message?: string;
      data?: { checkinId?: string; checkin_id?: string; alunoId?: string; alunoNome?: string };
    }) => {
      if (payload?.type !== 'new_weekly_checkin') return;
      showCheckinToast(payload);
    };

    const handleWeeklyCheckin = (payload: {
      type?: string;
      title?: string;
      message?: string;
      data?: { checkinId?: string; checkin_id?: string; alunoId?: string; alunoNome?: string };
      checkinId?: string;
      alunoNome?: string;
    }) => {
      showCheckinToast({ ...payload, type: 'new_weekly_checkin' });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('notification', handleNotification);
    socket.on('new_weekly_checkin', handleWeeklyCheckin);

    const pollFallback = async () => {
      if (connectedRef.current) return;
      const res = await apiClient.getNotificationsSafe({
        tipo: 'new_weekly_checkin',
        lida: false,
        limit: 1,
      });
      if (!res.success || !Array.isArray(res.data) || res.data.length === 0) return;
      window.dispatchEvent(new CustomEvent('blackhouse:checkin-pending-updated'));
    };

    const fallbackIntervalId = window.setInterval(() => {
      void pollFallback();
    }, 120_000);

    const onFocus = () => {
      if (!connectedRef.current) void pollFallback();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(fallbackIntervalId);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('notification', handleNotification);
      socket.off('new_weekly_checkin', handleWeeklyCheckin);
      socket.disconnect();
      socketRef.current = null;
      connectedRef.current = false;
    };
  }, [user, toast]);
}
