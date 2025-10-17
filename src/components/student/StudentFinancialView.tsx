import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DollarSign, CreditCard, Calendar, Download } from "lucide-react";

const StudentFinancialView = () => {
  const { user } = useAuth();
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [alunoData, setAlunoData] = useState<any>(null);

  useEffect(() => {
    if (user) {
      loadFinancialData();
    }
  }, [user]);

  const loadFinancialData = async () => {
    const { data: aluno } = await supabase
      .from("alunos")
      .select("*")
      .eq("email", user?.email)
      .single();

    if (aluno) {
      setAlunoData(aluno);

      const { data: pagamentosData } = await supabase
        .from("asaas_payments")
        .select("*")
        .eq("aluno_id", aluno.id)
        .order("due_date", { ascending: false });

      setPagamentos(pagamentosData || []);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; variant: any } } = {
      PENDING: { label: "Pendente", variant: "outline" },
      CONFIRMED: { label: "Pago", variant: "premium" },
      RECEIVED: { label: "Recebido", variant: "premium" },
      OVERDUE: { label: "Vencido", variant: "destructive" },
    };

    const statusInfo = statusMap[status] || { label: status, variant: "outline" };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const getBillingTypeLabel = (type: string) => {
    const types: { [key: string]: string } = {
      BOLETO: "Boleto",
      CREDIT_CARD: "Cartão de Crédito",
      PIX: "PIX",
    };
    return types[type] || type;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Financeiro</h1>
        <p className="text-muted-foreground">
          Gerencie seus pagamentos e histórico financeiro
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Plano Atual</CardTitle>
            <CreditCard className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alunoData?.plano || "Premium"}</div>
            <p className="text-xs text-muted-foreground mt-1">Ativo</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pagamentos</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagamentos.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Total de transações</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <Badge variant="premium" className="mt-1">Em dia</Badge>
            <p className="text-xs text-muted-foreground mt-2">
              Nenhuma pendência
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
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
            <div className="space-y-4">
              {pagamentos.map((pagamento) => (
                <div
                  key={pagamento.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/50 transition-colors"
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
                        Venc: {new Date(pagamento.due_date).toLocaleDateString("pt-BR")}
                      </span>
                      <span className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        {getBillingTypeLabel(pagamento.billing_type)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-primary">
                      R$ {Number(pagamento.value).toFixed(2)}
                    </div>
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

export default StudentFinancialView;
