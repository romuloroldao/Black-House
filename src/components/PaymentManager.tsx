import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useApiSafeList } from "@/hooks/useApiSafe";
import { safeArray } from "@/lib/data-safe-utils";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  DollarSign,
  Plus,
  CreditCard,
  Smartphone,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Payment {
  id: string;
  aluno_id: string;
  value: number;
  description: string | null;
  billing_type: string;
  status: string;
  due_date: string;
  invoice_url: string | null;
  bank_slip_url: string | null;
  pix_qr_code: string | null;
  pix_copy_paste: string | null;
  created_at: string;
  aluno_nome?: string;
}

interface Plan {
  id: string;
  nome: string;
  valor: number;
  frequencia: string;
}

const PaymentManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [usePlan, setUsePlan] = useState(false);
  const { data: alunosRaw, loading: loadingAlunos, error: errorAlunos } = useApiSafeList(
    () => apiClient.requestSafe<any[]>('/api/alunos'),
    { autoFetch: !!user, endpointKey: '/api/alunos', availabilityKey: 'alunosList' }
  );
  const { data: plansRaw, loading: loadingPlans, error: errorPlans } = useApiSafeList(
    () => apiClient.requestSafe<any[]>('/api/payment-plans'),
    { autoFetch: !!user, endpointKey: '/api/payment-plans', availabilityKey: 'paymentPlans' }
  );
  const { data: paymentsRaw, loading: loadingPayments, error: errorPayments, refetch: refetchPayments } = useApiSafeList(
    () => apiClient.requestSafe<any[]>('/api/asaas-payments'),
    { autoFetch: !!user, endpointKey: '/api/asaas-payments' }
  );
  
  const [formData, setFormData] = useState({
    aluno_id: "",
    plan_id: "",
    value: "",
    description: "",
    billing_type: "PIX",
    due_date: format(new Date(), "yyyy-MM-dd"),
  });

  useEffect(() => {
    if (!user) {
      setAlunos([]);
      setPlans([]);
      setPayments([]);
      return;
    }

    const alunosFiltrados = safeArray(alunosRaw)
      .filter((aluno: any) => aluno && aluno.coach_id === user.id)
      .sort((a: any, b: any) => String(a?.nome || '').localeCompare(String(b?.nome || '')));
    setAlunos(alunosFiltrados);

    const planosFiltrados = safeArray(plansRaw)
      .filter((plan: any) => plan && plan.coach_id === user.id && plan.ativo === true)
      .sort((a: any, b: any) => String(a?.nome || '').localeCompare(String(b?.nome || '')));
    setPlans(planosFiltrados);

    const pagamentosFiltrados = safeArray(paymentsRaw)
      .filter((payment: any) => payment && payment.coach_id === user.id)
      .sort((a: any, b: any) => {
        const aTime = new Date(a?.created_at || 0).getTime();
        const bTime = new Date(b?.created_at || 0).getTime();
        return bTime - aTime;
      });

    const pagamentosComNomes = pagamentosFiltrados.map((payment: any) => {
      const aluno = alunosFiltrados.find((a: any) => a.id === payment.aluno_id);
      return {
        ...payment,
        aluno_nome: aluno?.nome || "Aluno",
      };
    });

    setPayments(pagamentosComNomes);

    if (errorAlunos || errorPlans || errorPayments) {
      console.warn('[REACT-SUPABASE-LEGACY-PURGE-FIX-010] Erro ao carregar dados de pagamento (fallback vazio):', {
        errorAlunos,
        errorPlans,
        errorPayments
      });
    }
  }, [user, alunosRaw, plansRaw, paymentsRaw, errorAlunos, errorPlans, errorPayments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.aluno_id || !formData.due_date) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (usePlan && !formData.plan_id) {
      toast({
        title: "Erro",
        description: "Selecione um plano",
        variant: "destructive",
      });
      return;
    }

    if (!usePlan && !formData.value) {
      toast({
        title: "Erro",
        description: "Informe o valor da cobrança",
        variant: "destructive",
      });
      return;
    }

    if (!usePlan && parseFloat(formData.value) < 5) {
      toast({
        title: "Valor inválido",
        description: "O valor mínimo para cobranças é R$ 5,00",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    let value = formData.value;
    let description = formData.description;

    if (usePlan && formData.plan_id) {
      const selectedPlan = plans.find(p => p.id === formData.plan_id);
      if (selectedPlan) {
        value = selectedPlan.valor.toString();
        description = description || selectedPlan.nome;
      }
    }

    const result = await apiClient.requestSafe('/functions/create-asaas-payment', {
      method: 'POST',
      body: JSON.stringify({
        alunoId: formData.aluno_id,
        value: parseFloat(value),
        description: description,
        billingType: formData.billing_type,
        dueDate: formData.due_date,
      }),
    });

    if (!result.success) {
      toast({
        title: "Erro",
        description: result.error || 'Erro ao criar cobrança',
        variant: "destructive"
      });
      setIsCreating(false);
      return;
    }

    toast({
      title: "Cobrança criada!",
      description: "A cobrança foi criada com sucesso.",
    });

    setIsDialogOpen(false);
    resetForm();
    refetchPayments();
    setIsCreating(false);
  };

  const resetForm = () => {
    setFormData({
      aluno_id: "",
      plan_id: "",
      value: "",
      description: "",
      billing_type: "PIX",
      due_date: format(new Date(), "yyyy-MM-dd"),
    });
    setUsePlan(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Código PIX copiado para a área de transferência",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status.toUpperCase()) {
      case "RECEIVED":
      case "CONFIRMED":
        return <CheckCircle2 className="w-4 h-4 text-primary" />;
      case "PENDING":
        return <Clock className="w-4 h-4 text-warning" />;
      case "OVERDUE":
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING: "Pendente",
      RECEIVED: "Recebido",
      CONFIRMED: "Confirmado",
      OVERDUE: "Vencido",
      REFUNDED: "Reembolsado",
    };
    return labels[status] || status;
  };

  const getBillingTypeIcon = (type: string) => {
    switch (type) {
      case "PIX":
        return <Smartphone className="w-4 h-4" />;
      case "BOLETO":
        return <FileText className="w-4 h-4" />;
      case "CREDIT_CARD":
        return <CreditCard className="w-4 h-4" />;
      default:
        return <DollarSign className="w-4 h-4" />;
    }
  };

  const loading = loadingAlunos || loadingPlans || loadingPayments;
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Pagamentos
        </h1>
        <p className="text-muted-foreground">
          Gerencie cobranças e pagamentos dos seus alunos
        </p>
      </div>

      {/* Lista de Pagamentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Cobranças
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            {payments.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                <p className="text-muted-foreground">Nenhuma cobrança criada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <Card key={payment.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(payment.status)}
                            <h3 className="font-semibold">{payment.aluno_nome}</h3>
                            <Badge variant="outline">
                              R$ {payment.value.toFixed(2)}
                            </Badge>
                          </div>

                          {payment.description && (
                            <p className="text-sm text-muted-foreground">{payment.description}</p>
                          )}

                          <div className="flex flex-wrap gap-2 text-sm">
                            <Badge variant="outline" className="gap-1">
                              {getBillingTypeIcon(payment.billing_type)}
                              {payment.billing_type}
                            </Badge>

                            <Badge 
                              variant="outline"
                              className={
                                payment.status === "RECEIVED" || payment.status === "CONFIRMED"
                                  ? "text-primary"
                                  : payment.status === "OVERDUE"
                                  ? "text-destructive"
                                  : ""
                              }
                            >
                              {getStatusLabel(payment.status)}
                            </Badge>

                            <Badge variant="outline">
                              Venc: {format(new Date(payment.due_date), "dd/MM/yyyy", { locale: ptBR })}
                            </Badge>
                          </div>

                          {/* Links de pagamento */}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {payment.invoice_url && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => window.open(payment.invoice_url!, '_blank')}
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                Fatura
                              </Button>
                            )}
                            
                            {payment.bank_slip_url && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => window.open(payment.bank_slip_url!, '_blank')}
                              >
                                <FileText className="w-3 h-3 mr-1" />
                                Boleto
                              </Button>
                            )}

                            {payment.pix_copy_paste && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => copyToClipboard(payment.pix_copy_paste!)}
                              >
                                <Copy className="w-3 h-3 mr-1" />
                                Copiar PIX
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Dialog para Criar Cobrança */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Cobrança</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="aluno_id">Aluno *</Label>
                <Select 
                  value={formData.aluno_id} 
                  onValueChange={(value) => setFormData({ ...formData, aluno_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um aluno" />
                  </SelectTrigger>
                  <SelectContent>
                    {alunos.map(aluno => (
                      <SelectItem key={aluno.id} value={aluno.id}>
                        {aluno.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 flex items-center space-x-2 py-2">
                <input
                  type="checkbox"
                  id="usePlan"
                  checked={usePlan}
                  onChange={(e) => {
                    setUsePlan(e.target.checked);
                    if (e.target.checked) {
                      setFormData({ ...formData, value: "" });
                    } else {
                      setFormData({ ...formData, plan_id: "" });
                    }
                  }}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="usePlan" className="cursor-pointer">
                  Usar plano de pagamento
                </Label>
              </div>

              {usePlan ? (
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="plan_id">Plano *</Label>
                  <Select
                    value={formData.plan_id}
                    onValueChange={(value) => setFormData({ ...formData, plan_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um plano" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.nome} - R$ {plan.valor.toFixed(2)} ({plan.frequencia})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="value">Valor (R$) *</Label>
                  <Input
                    id="value"
                    type="number"
                    step="0.01"
                    min="5"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    placeholder="5.00"
                  />
                  <p className="text-xs text-muted-foreground">Valor mínimo: R$ 5,00</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="billing_type">Forma de Pagamento *</Label>
                <Select 
                  value={formData.billing_type} 
                  onValueChange={(value) => setFormData({ ...formData, billing_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="BOLETO">Boleto</SelectItem>
                    <SelectItem value="CREDIT_CARD">Cartão de Crédito</SelectItem>
                    <SelectItem value="UNDEFINED">Cliente Escolhe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="due_date">Data de Vencimento *</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  required
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva a cobrança..."
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Criando..." : "Criar Cobrança"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentManager;