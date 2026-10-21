import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";

/**
 * BH-CHECKIN-010: detecta novos check-ins do coach (polling leve).
 * WebSocket no servidor continua disponível; o painel usa polling para compatibilidade.
 */
export function useCoachCheckinNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const lastSeenIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!user || (user.role !== "coach" && user.role !== "admin")) return;

    const poll = async () => {
      const res = await apiClient.getNotificationsSafe({
        tipo: "new_weekly_checkin",
        lida: false,
        limit: 1,
      });
      if (!res.success || !Array.isArray(res.data) || res.data.length === 0) return;

      const latest = res.data[0] as { id?: string; mensagem?: string; titulo?: string };
      if (!latest.id) return;

      if (!initializedRef.current) {
        initializedRef.current = true;
        lastSeenIdRef.current = latest.id;
        return;
      }

      if (lastSeenIdRef.current === latest.id) return;

      lastSeenIdRef.current = latest.id;
      toast({
        title: latest.titulo || "Novo check-in semanal",
        description: latest.mensagem || "Um aluno enviou o check-in da semana.",
      });
      window.dispatchEvent(new CustomEvent("blackhouse:checkin-pending-updated"));
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, 25_000);

    const onFocus = () => {
      void poll();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, toast]);
}
