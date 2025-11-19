import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DollarSign, CreditCard, Calendar, Plus, AlertCircle, Clock, CheckCircle, Download, Copy, Trash2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Props {
  studentId: string;
  studentName: string;
}

const StudentFinancialManagement = ({ studentId, studentName }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [planos, setPlanos] = useState<any[]>([]);
  const [excecoes, setExcecoes] = useState<any[]>([]);
  const [configCobranca, setConfigCobranca] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Diálogos
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isExceptionDialogOpen, setIsExceptionDialogOpen] = useState(false);
  const [isRecurringDialogOpen, setIsRecurringDialogOpen] = useState(false);
  
  // Form states
  const [paymentForm, setPaymentForm] = useState({
    value: "",
    billingType: "PIX",
    dueDate: "",
    description: "",
  });
  
  const [exceptionForm, setExceptionForm] = useState({
    tipo: "desconto",
    motivo: "",
    percentual_desconto: "",
    valor_desconto: "",
    data_inicio: "",
    data_fim: "",
    observacoes: "",
  });
  
  const [recurringForm, setRecurringForm] = useState({
    payment_plan_id: "",
    dia_vencimento_customizado: "",
    valor_customizado: "",
    ativo: true,
  });

  useEffect(() => {
    loadFinancialData();
  }, [studentId]);

  const loadFinancialData = async () => {
    try {
      setLoading(true);
      
      // Carregar pagamentos
      const { data: pagamentosData } = await supabase
        .from("asaas_payments")
        .select("*")
        .eq("aluno_id", studentId)
        .order("due_date", { ascending: false });
      
      setPagamentos(pagamentosData || []);
      
      // Carregar planos de pagamento
      const { data: planosData } = await supabase
        .from("payment_plans")
        .select("*")
        .eq("coach_id", user?.id)
        .eq("ativo", true);
      
      setPlanos(planosData || []);
      
      // Carregar exceções financeiras
      const { data: excecoesData } = await supabase
        .from("financial_exceptions")
        .select("*")
        .eq("aluno_id", studentId)
        .eq("ativo", true);
      
      setExcecoes(excecoesData || []);
      
      // Carregar configuração de cobrança recorrente
      const { data: configData } = await supabase
        .from("recurring_charges_config")
        .select("*, payment_plans(*)")
        .eq("aluno_id", studentId)
        .maybeSingle();
      
      setConfigCobranca(configData);
    } catch (error) {
      console.error("Erro ao carregar dados financeiros:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados financeiros",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayment = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('create-asaas-payment', {
        body: {
          alunoId: studentId,
          value: parseFloat(paymentForm.value),
          billingType: paymentForm.billingType,
          dueDate: paymentForm.dueDate,
          description: paymentForm.description,
        },
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Pagamento criado com sucesso",
      });
      
      setIsPaymentDialogOpen(false);
      setPaymentForm({ value: "", billingType: "PIX", dueDate: "", description: "" });
      loadFinancialData();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar pagamento",
        variant: "destructive",
      });
    }
  };

  const handleCreateException = async () => {
    try {
      const { error } = await supabase
        .from("financial_exceptions")
        .insert({
          aluno_id: studentId,
          coach_id: user?.id,
          ...exceptionForm,
          percentual_desconto: exceptionForm.percentual_desconto ? parseFloat(exceptionForm.percentual_desconto) : null,
          valor_desconto: exceptionForm.valor_desconto ? parseFloat(exceptionForm.valor_desconto) : null,
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Exceção financeira criada",
      });
      
      setIsExceptionDialogOpen(false);
      setExceptionForm({
        tipo: "desconto",
        motivo: "",
        percentual_desconto: "",
        valor_desconto: "",
        data_inicio: "",
        data_fim: "",
        observacoes: "",
      });
      loadFinancialData();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar exceção",
        variant: "destructive",
      });
    }
  };

  const handleSaveRecurring = async () => {
    try {
      const data: any = {
        aluno_id: studentId,
        coach_id: user?.id,
        payment_plan_id: recurringForm.payment_plan_id || null,
        dia_vencimento_customizado: recurringForm.dia_vencimento_customizado ? parseInt(recurringForm.dia_vencimento_customizado) : null,
        valor_customizado: recurringForm.valor_customizado ? parseFloat(recurringForm.valor_customizado) : null,
        ativo: recurringForm.ativo,
      };

      if (configCobranca) {
        const { error } = await supabase
          .from("recurring_charges_config")
          .update(data)
          .eq("id", configCobranca.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("recurring_charges_config")
          .insert(data);
        
        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: "Configuração de cobrança salva",
      });
      
      setIsRecurringDialogOpen(false);
      loadFinancialData();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar configuração",
        variant: "destructive",
      });
    }
  };

  const handleRemoveRecurring = async () => {
    try {
      if (!configCobranca) return;

      const { error } = await supabase
        .from("recurring_charges_config")
        .update({ ativo: false })
        .eq("id", configCobranca.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Cobrança recorrente removida",
      });
      
      loadFinancialData();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao remover cobrança recorrente",
        variant: "destructive",
      });
    }
  };

  const handleDeleteException = async (id: string) => {
    try {
      const { error } = await supabase
        .from("financial_exceptions")
        .update({ ativo: false })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Exceção removida",
      });
      
      loadFinancialData();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao remover exceção",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; variant: any } } = {
      PENDING: { label: "Pendente", variant: "outline" },
      CONFIRMED: { label: "Pago", variant: "default" },
      RECEIVED: { label: "Recebido", variant: "default" },
      OVERDUE: { label: "Vencido", variant: "destructive" },
    };

    const statusInfo = statusMap[status] || { label: status, variant: "outline" };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Código PIX copiado para área de transferência",
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Resumo Financeiro */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Plano Ativo</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {configCobranca?.ativo ? configCobranca?.payment_plans?.nome : "Nenhum"}
                </div>
                {configCobranca?.ativo && (
                  <p className="text-xs text-muted-foreground mt-1">
                    R$ {configCobranca.valor_customizado || configCobranca.payment_plans?.valor} / {configCobranca.payment_plans?.frequencia}
                  </p>
                )}
              </div>
              {configCobranca?.ativo && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveRecurring}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Pagamentos</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagamentos.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {pagamentos.filter(p => p.status === "PENDING").length} pendentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Exceções Ativas</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{excecoes.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Descontos/Isenções
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ações Rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>Ações</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Pagamento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Pagamento para {studentName}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={paymentForm.value}
                    onChange={(e) => setPaymentForm({ ...paymentForm, value: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Forma de Pagamento</Label>
                  <Select value={paymentForm.billingType} onValueChange={(value) => setPaymentForm({ ...paymentForm, billingType: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="BOLETO">Boleto</SelectItem>
                      <SelectItem value="CREDIT_CARD">Cartão de Crédito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data de Vencimento</Label>
                  <Input
                    type="date"
                    value={paymentForm.dueDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, dueDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={paymentForm.description}
                    onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
                  />
                </div>
                <Button onClick={handleCreatePayment} className="w-full">
                  Criar Pagamento
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isRecurringDialogOpen} onOpenChange={setIsRecurringDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Clock className="h-4 w-4 mr-2" />
                Cobrança Recorrente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configurar Cobrança Recorrente</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Plano de Pagamento</Label>
                  <Select value={recurringForm.payment_plan_id} onValueChange={(value) => setRecurringForm({ ...recurringForm, payment_plan_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um plano" />
                    </SelectTrigger>
                    <SelectContent>
                      {planos.map((plano) => (
                        <SelectItem key={plano.id} value={plano.id}>
                          {plano.nome} - R$ {plano.valor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Dia de Vencimento Customizado (opcional)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="Ex: 10"
                    value={recurringForm.dia_vencimento_customizado}
                    onChange={(e) => setRecurringForm({ ...recurringForm, dia_vencimento_customizado: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Valor Customizado (opcional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Deixe vazio para usar o valor do plano"
                    value={recurringForm.valor_customizado}
                    onChange={(e) => setRecurringForm({ ...recurringForm, valor_customizado: e.target.value })}
                  />
                </div>
                <Button onClick={handleSaveRecurring} className="w-full">
                  Salvar Configuração
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isExceptionDialogOpen} onOpenChange={setIsExceptionDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <AlertCircle className="h-4 w-4 mr-2" />
                Nova Exceção
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Exceção Financeira</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Tipo</Label>
                  <Select value={exceptionForm.tipo} onValueChange={(value) => setExceptionForm({ ...exceptionForm, tipo: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desconto">Desconto</SelectItem>
                      <SelectItem value="isencao">Isenção</SelectItem>
                      <SelectItem value="bolsa">Bolsa</SelectItem>
                      <SelectItem value="plano_personalizado">Plano Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Motivo</Label>
                  <Input
                    value={exceptionForm.motivo}
                    onChange={(e) => setExceptionForm({ ...exceptionForm, motivo: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>% Desconto</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={exceptionForm.percentual_desconto}
                      onChange={(e) => setExceptionForm({ ...exceptionForm, percentual_desconto: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>R$ Desconto</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={exceptionForm.valor_desconto}
                      onChange={(e) => setExceptionForm({ ...exceptionForm, valor_desconto: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Data Início</Label>
                    <Input
                      type="date"
                      value={exceptionForm.data_inicio}
                      onChange={(e) => setExceptionForm({ ...exceptionForm, data_inicio: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Data Fim</Label>
                    <Input
                      type="date"
                      value={exceptionForm.data_fim}
                      onChange={(e) => setExceptionForm({ ...exceptionForm, data_fim: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={exceptionForm.observacoes}
                    onChange={(e) => setExceptionForm({ ...exceptionForm, observacoes: e.target.value })}
                  />
                </div>
                <Button onClick={handleCreateException} className="w-full">
                  Criar Exceção
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Exceções Ativas */}
      {excecoes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Exceções Financeiras Ativas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {excecoes.map((excecao) => (
              <div key={excecao.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge>{excecao.tipo}</Badge>
                    <span className="font-medium">{excecao.motivo}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {excecao.percentual_desconto && `${excecao.percentual_desconto}% de desconto`}
                    {excecao.valor_desconto && `R$ ${excecao.valor_desconto} de desconto`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(excecao.data_inicio), "dd/MM/yyyy")} até {excecao.data_fim ? format(new Date(excecao.data_fim), "dd/MM/yyyy") : "Indefinido"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteException(excecao.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Histórico de Pagamentos */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Pagamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {pagamentos.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">Nenhum pagamento registrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pagamentos.map((pagamento) => (
                <div
                  key={pagamento.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:border-primary/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold">
                        {pagamento.description || "Pagamento"}
                      </h4>
                      {getStatusBadge(pagamento.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Venc: {format(new Date(pagamento.due_date), "dd/MM/yyyy")}
                      </span>
                      <span className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        {pagamento.billing_type}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-primary">
                      R$ {Number(pagamento.value).toFixed(2)}
                    </div>
                    {pagamento.pix_copy_paste && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(pagamento.pix_copy_paste)}
                        className="mt-1"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copiar PIX
                      </Button>
                    )}
                    {pagamento.invoice_url && (
                      <a
                        href={pagamento.invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-1"
                      >
                        <Download className="h-3 w-3" />
                        Ver fatura
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentFinancialManagement;
