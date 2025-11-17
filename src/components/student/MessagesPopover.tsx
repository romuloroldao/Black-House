import { useState, useEffect } from "react";
import { Bell, Check, Trash2, X, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Message {
  id: string;
  conteudo: string;
  created_at: string;
  lida: boolean;
  remetente_id: string;
}

interface MessagesPopoverProps {
  unreadCount: number;
  onCountChange: (count: number) => void;
}

const MessagesPopover = ({ unreadCount, onCountChange }: MessagesPopoverProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [open, setOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "read">("all");

  useEffect(() => {
    if (user && open) {
      loadMessages();
    }
  }, [user, open, sortOrder, statusFilter]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('messages-popover-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mensagens',
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadMessages = async () => {
    if (!user) return;

    const { data: alunoData } = await supabase
      .from("alunos")
      .select("id")
      .eq("email", user.email)
      .single();

    if (!alunoData) return;

    const { data: conversaData } = await supabase
      .from("conversas")
      .select("id")
      .eq("aluno_id", alunoData.id)
      .single();

    if (!conversaData) return;

    let query = supabase
      .from("mensagens")
      .select("*")
      .eq("conversa_id", conversaData.id)
      .neq("remetente_id", user.id);

    // Apply status filter
    if (statusFilter === "unread") {
      query = query.eq("lida", false);
    } else if (statusFilter === "read") {
      query = query.eq("lida", true);
    }

    // Apply sort order
    query = query.order("created_at", { ascending: sortOrder === "asc" }).limit(20);

    const { data } = await query;

    if (data) {
      setMessages(data);
      const unread = data.filter(m => !m.lida).length;
      onCountChange(unread);
    }
  };

  const markAsRead = async (messageId: string) => {
    const { error } = await supabase
      .from("mensagens")
      .update({ lida: true })
      .eq("id", messageId);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível marcar a mensagem como lida.",
        variant: "destructive",
      });
      return;
    }

    loadMessages();
  };

  const markAllAsRead = async () => {
    if (!user) return;

    const { data: alunoData } = await supabase
      .from("alunos")
      .select("id")
      .eq("email", user.email)
      .single();

    if (!alunoData) return;

    const { data: conversaData } = await supabase
      .from("conversas")
      .select("id")
      .eq("aluno_id", alunoData.id)
      .single();

    if (!conversaData) return;

    const { error } = await supabase
      .from("mensagens")
      .update({ lida: true })
      .eq("conversa_id", conversaData.id)
      .neq("remetente_id", user.id)
      .eq("lida", false);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível marcar as mensagens como lidas.",
        variant: "destructive",
      });
      return;
    }

    loadMessages();
    toast({
      title: "Sucesso",
      description: "Todas as mensagens foram marcadas como lidas.",
    });
  };

  const handleMessageClick = (message: Message) => {
    if (!message.lida) {
      markAsRead(message.id);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Mensagens do Chat</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-8 text-xs"
              >
                Marcar todas como lidas
              </Button>
            )}
          </div>
          
          {/* Filters */}
          <div className="flex items-center gap-2">
            <Select value={sortOrder} onValueChange={(value: "desc" | "asc") => setSortOrder(value)}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Mais recentes</SelectItem>
                <SelectItem value="asc">Mais antigas</SelectItem>
              </SelectContent>
            </Select>

            <Tabs value={statusFilter} onValueChange={(value: "all" | "unread" | "read") => setStatusFilter(value)} className="flex-1">
              <TabsList className="grid w-full grid-cols-3 h-9">
                <TabsTrigger value="all" className="text-xs">Todas</TabsTrigger>
                <TabsTrigger value="unread" className="text-xs">Não lidas</TabsTrigger>
                <TabsTrigger value="read" className="text-xs">Lidas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        <ScrollArea className="h-[400px]">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2" />
              <p className="text-sm">Nenhuma mensagem</p>
            </div>
          ) : (
            <div className="divide-y">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                    !message.lida ? "bg-muted/30" : ""
                  }`}
                  onClick={() => handleMessageClick(message)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">Coach</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {message.conteudo}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(message.created_at), "dd/MM/yyyy HH:mm")}
                      </p>
                    </div>
                    {!message.lida && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(message.id);
                        }}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default MessagesPopover;
