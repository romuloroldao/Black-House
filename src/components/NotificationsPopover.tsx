import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

const NotificationsPopover = ({ onNavigate }: NotificationsPopoverProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadNotifications();
      
      // Subscribe to real-time notifications
      const channel = supabase
        .channel('notifications-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notificacoes',
            filter: `coach_id=eq.${user.id}`
          },
          () => {
            loadNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Erro ao carregar notificações:', error);
      return;
    }

    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.lida).length);
    }
  };

  const markAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from('notificacoes')
      .update({ lida: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Erro ao marcar como lida:', error);
      return;
    }

    loadNotifications();
  };

  const markAllAsRead = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('notificacoes')
      .update({ lida: true })
      .eq('coach_id', user.id)
      .eq('lida', false);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível marcar todas como lidas",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Sucesso",
      description: "Todas as notificações foram marcadas como lidas"
    });
    
    loadNotifications();
  };

  const deleteNotification = async (notificationId: string) => {
    const { error } = await supabase
      .from('notificacoes')
      .delete()
      .eq('id', notificationId);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir a notificação",
        variant: "destructive"
      });
      return;
    }

    loadNotifications();
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
          {notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((notification) => {
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
              })}
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
