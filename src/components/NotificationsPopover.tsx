import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useApiSafeList } from "@/hooks/useApiSafe";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, X, Users, Dumbbell, MessageSquare, Calendar, DollarSign } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

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

// DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001: NotificationsPopover deve renderizar mesmo com user null
const NotificationsPopover = ({ onNavigate }: NotificationsPopoverProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  // REACT-API-RESILIENCE-FIX-008: Usar hook resiliente para notificações
  // Só buscar se user for aluno
  const shouldFetch = user?.role === 'aluno';
  const { data: notifications, loading, error, refetch } = useApiSafeList(
    () => apiClient.getNotificationsSafe({ limit: 10 }),
    { autoFetch: shouldFetch, endpointKey: '/api/notificacoes', availabilityKey: 'notificacoes' }
  );
  
  const unreadCount = notifications.filter(n => !n.lida).length;

  // REACT-API-RESILIENCE-FIX-008: Polling periódico (apenas se for aluno)
  useEffect(() => {
    if (!shouldFetch) return;
    
    const interval = setInterval(() => {
      refetch();
    }, 10000); // Atualizar a cada 10 segundos

    return () => {
      clearInterval(interval);
    };
  }, [shouldFetch, refetch]);

  const markAsRead = async (notificationId: string) => {
    try {
      await apiClient.updateNotification(notificationId, { lida: true });
      // REACT-API-RESILIENCE-FIX-008: Recarregar após atualizar
      refetch();
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const result = await apiClient.getNotificationsSafe({ lida: false });
      if (!result.success) {
        throw new Error(result.error);
      }
      
      // Atualizar cada uma individualmente
      for (const notif of result.data) {
        await apiClient.updateNotification(notif.id, { lida: true });
      }

      toast({
        title: "Sucesso",
        description: "Todas as notificações foram marcadas como lidas"
      });
      
      // REACT-API-RESILIENCE-FIX-008: Recarregar após atualizar
      refetch();
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível marcar todas como lidas",
        variant: "destructive"
      });
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await apiClient.deleteNotification(notificationId);

      toast({
        title: "Sucesso",
        description: "Notificação excluída"
      });
      
      // REACT-API-RESILIENCE-FIX-008: Recarregar após deletar
      refetch();
    } catch (error) {
      console.error('Erro ao excluir notificação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a notificação",
        variant: "destructive"
      });
    }
  };

  const getNotificationIcon = (tipo: string) => {
    switch (tipo) {
      case 'aluno': return Users;
      case 'treino': return Dumbbell;
      case 'mensagem': return MessageSquare;
      case 'agenda': return Calendar;
      case 'pagamento': return DollarSign;
      default: return Bell;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
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
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notificações</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs"
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[400px]">
          {/* DESIGN-ROOT-RENDER-UNBLOCK-001: Validar notifications antes de .length e .map() */}
          {Array.isArray(notifications) && notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((notification) => {
                // DESIGN-ROOT-RENDER-UNBLOCK-001: Validar notification antes de renderizar
                if (!notification || !notification.id) {
                  return null;
                }
                const Icon = getNotificationIcon(notification.tipo);
                return (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-muted/50 transition-colors ${
                      !notification.lida ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="mt-1">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            onClick={() => handleNotificationClick(notification)}
                            className="text-left flex-1"
                          >
                            <p className="font-medium text-sm">
                              {notification.titulo}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {notification.mensagem}
                            </p>
                          </button>
                          <div className="flex gap-1">
                            {!notification.lida && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => markAsRead(notification.id)}
                              >
                                <Check className="w-3 h-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => deleteNotification(notification.id)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
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
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma notificação</p>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsPopover;
