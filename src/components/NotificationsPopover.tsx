import { useState, useEffect, useMemo, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useApiSafeList } from "@/hooks/useApiSafe";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, X, Users, Dumbbell, MessageSquare, Calendar, DollarSign, ClipboardCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import {
  getStudentNotificationCategory,
  STUDENT_NOTIFICATION_CATEGORY_LABELS,
} from "@/lib/student-notification-utils";

interface Notification {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  created_at: string;
  link?: string;
}

interface NotificationsPopoverProps {
  onNavigate?: (section: string) => void;
}

const NotificationsPopover = ({ onNavigate }: NotificationsPopoverProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());

  const shouldFetch =
    user?.role === "aluno" || user?.role === "coach" || user?.role === "admin";

  const fetchUnread = useCallback(
    () => apiClient.getNotificationsSafe({ lida: false, limit: 30 }),
    [],
  );

  const { data: notifications, refetch } = useApiSafeList(
    fetchUnread,
    { autoFetch: shouldFetch, endpointKey: '/api/notificacoes?lida=false', availabilityKey: 'notificacoes' }
  );

  const visibleNotifications = useMemo(
    () => notifications.filter((n) => n?.id && !dismissedIds.has(n.id)),
    [notifications, dismissedIds],
  );

  const unreadCount = visibleNotifications.length;

  useEffect(() => {
    if (!shouldFetch) return;

    const interval = setInterval(() => {
      refetch();
    }, 10000);

    const onCheckinUpdated = () => {
      refetch();
    };
    const onStudentRealtime = () => {
      refetch();
    };
    window.addEventListener("blackhouse:checkin-pending-updated", onCheckinUpdated);
    window.addEventListener("blackhouse:student-realtime", onStudentRealtime);

    return () => {
      clearInterval(interval);
      window.removeEventListener("blackhouse:checkin-pending-updated", onCheckinUpdated);
      window.removeEventListener("blackhouse:student-realtime", onStudentRealtime);
    };
  }, [shouldFetch, refetch]);

  const dismissLocally = (notificationId: string) => {
    setDismissedIds((prev) => new Set(prev).add(notificationId));
  };

  const restoreLocally = (notificationId: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.delete(notificationId);
      return next;
    });
  };

  const markAsRead = async (notificationId: string) => {
    dismissLocally(notificationId);

    const result = await apiClient.updateNotificationSafe(notificationId, { lida: true });
    if (!result.success) {
      restoreLocally(notificationId);
      toast({
        title: "Erro",
        description: result.error || "Não foi possível marcar como vista",
        variant: "destructive",
      });
      return;
    }

    void refetch();
  };

  const markAllAsRead = async () => {
    if (!user || visibleNotifications.length === 0) return;

    const ids = visibleNotifications.map((n) => n.id);
    setDismissedIds((prev) => new Set([...prev, ...ids]));

    try {
      for (const notif of visibleNotifications) {
        const result = await apiClient.updateNotificationSafe(notif.id, { lida: true });
        if (!result.success) {
          throw new Error(result.error);
        }
      }

      toast({
        title: "Sucesso",
        description: "Todas as notificações foram marcadas como vistas",
      });

      void refetch();
    } catch (error) {
      setDismissedIds(new Set());
      console.error('Erro ao marcar todas como lidas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível marcar todas como vistas",
        variant: "destructive",
      });
      void refetch();
    }
  };

  const dismissNotification = (notificationId: string) => {
    void markAsRead(notificationId);
  };

  const getNotificationIcon = (tipo: string) => {
    switch (tipo) {
      case 'aluno':
        return Users;
      case 'treino':
      case 'workout_expiration_reminder':
        return Dumbbell;
      case 'mensagem':
      case 'aviso':
        return MessageSquare;
      case 'agenda':
      case 'agenda_coach_reminder':
      case 'agenda_coach_overdue':
      case 'event_reminder':
      case 'novo_evento':
      case 'evento_cancelado':
        return Calendar;
      case 'pagamento':
      case 'payment_status':
      case 'payment_reminder':
        return DollarSign;
      case 'checkin_reminder':
      case 'task_reminder':
      case 'checkin_missed':
      case 'new_weekly_checkin':
      case 'checkin_respondido':
        return ClipboardCheck;
      default:
        return Bell;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    void markAsRead(notification.id);

    if (notification.link) {
      onNavigate?.(notification.link);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full text-xs flex items-center justify-center text-destructive-foreground font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[150] flex w-[min(24rem,calc(100vw-1rem))] max-h-[min(32rem,calc(100dvh-5.5rem))] flex-col overflow-hidden p-0"
        align="end"
        sideOffset={8}
        collisionPadding={16}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b p-3 sm:p-4">
          <div className="min-w-0">
            <h3 className="font-semibold">Notificações</h3>
            {unreadCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {unreadCount} não {unreadCount === 1 ? "lida" : "lidas"}
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="shrink-0 text-xs"
            >
              Marcar todas como vistas
            </Button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          {visibleNotifications.length > 0 ? (
            <div className="divide-y">
              {visibleNotifications.map((notification) => {
                if (!notification || !notification.id) {
                  return null;
                }
                const Icon = getNotificationIcon(notification.tipo);
                const category =
                  user?.role === "aluno"
                    ? getStudentNotificationCategory(notification.tipo)
                    : null;
                return (
                  <div
                    key={notification.id}
                    className="p-3 transition-colors hover:bg-muted/50 sm:p-4 bg-primary/5"
                  >
                    <div className="flex gap-3">
                      <div className="mt-1">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleNotificationClick(notification)}
                            className="text-left flex-1"
                          >
                            {category && (
                              <Badge variant="outline" className="mb-1.5 text-[10px] font-normal">
                                {STUDENT_NOTIFICATION_CATEGORY_LABELS[category]}
                              </Badge>
                            )}
                            <p className="font-medium text-sm">
                              {notification.titulo}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {notification.mensagem}
                            </p>
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            title="Marcar como vista"
                            aria-label="Marcar como vista"
                            onClick={() => dismissNotification(notification.id)}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: ptBR
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }).filter(Boolean)}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Bell className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>Nenhuma notificação nova</p>
            </div>
          )}
        </div>

        {unreadCount > 3 && (
          <div className="shrink-0 border-t px-3 py-2 text-center text-[11px] text-muted-foreground">
            Role para ver todas · use ✓ ou &quot;Marcar todas como vistas&quot;
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsPopover;
