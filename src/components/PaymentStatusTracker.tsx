import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertTriangle,
  DollarSign,
  User
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface StudentPayment {
  aluno_id: string;
  aluno_nome: string;
  aluno_email: string;
  plano_nome: string | null;
  ultimo_pagamento: string | null;
  status_ultimo: string | null;
  total_pago: number;
  pagamentos_pendentes: number;
  pagamentos_atrasados: number;
}

interface Payment {
  id: string;
  aluno_id: string;
  value: number;
  status: string;
  due_date: string;
  description: string | null;
  created_at: string;
}

export default function PaymentStatusTracker() {
  const { user } = useAuth();
  const [studentPayments, setStudentPayments] = useState<StudentPayment[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPaymentData();
    }
  }, [user]);

  const loadPaymentData = async () => {
    setLoading(true);

    const alunosResult = await apiClient.requestSafe<any[]>('/api/alunos');
    const paymentsResult = await apiClient.requestSafe<any[]>('/api/asaas-payments');

    const alunosData = alunosResult.success && Array.isArray(alunosResult.data) ? alunosResult.data : [];
    const paymentsData = paymentsResult.success && Array.isArray(paymentsResult.data) ? paymentsResult.data : [];

    const alunos = alunosData
      .filter((a: any) => a.coach_id === user?.id)
      .sort((a: any, b: any) => String(a?.nome || '').localeCompare(String(b?.nome || '')));

    const payments = paymentsData
      .filter((p: any) => p.coach_id === user?.id)
      .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    setAllPayments(payments);

    const studentPaymentMap = alunos.map(aluno => {
      const alunoPayments = payments.filter(p => p.aluno_id === aluno.id);
      
      const pagamentosPagos = alunoPayments.filter(p => p.status === "RECEIVED");
      const pagamentosPendentes = alunoPayments.filter(p => p.status === "PENDING");
      const pagamentosAtrasados = alunoPayments.filter(
        p => p.status === "PENDING" && new Date(p.due_date) < new Date()
      );
      
      const ultimoPagamento = alunoPayments[0];
      
      const totalPago = pagamentosPagos.reduce((sum, p) => sum + Number(p.value), 0);

      return {
        aluno_id: aluno.id,
        aluno_nome: aluno.nome || "Sem nome",
        aluno_email: aluno.email,
        plano_nome: aluno.plano,
        ultimo_pagamento: ultimoPagamento?.created_at || null,
        status_ultimo: ultimoPagamento?.status || null,
        total_pago: totalPago,
        pagamentos_pendentes: pagamentosPendentes.length,
        pagamentos_atrasados: pagamentosAtrasados.length,
      };
    });

    setStudentPayments(studentPaymentMap);
    setLoading(false);
  };

  const getStatusBadge = (student: StudentPayment) => {
    if (student.pagamentos_atrasados > 0) {
      return <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        Atrasado ({student.pagamentos_atrasados})
      </Badge>;
    }
    if (student.pagamentos_pendentes > 0) {
      return <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        Pendente ({student.pagamentos_pendentes})
      </Badge>;
    }
    if (student.total_pago > 0) {
      return <Badge variant="default" className="gap-1 bg-green-600">
        <CheckCircle2 className="h-3 w-3" />
        Em dia
      </Badge>;
    }
    return <Badge variant="outline">Sem pagamentos</Badge>;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const filterStudents = (filter: string) => {
    switch (filter) {
      case "atrasados":
        return studentPayments.filter(s => s.pagamentos_atrasados > 0);
      case "pendentes":
        return studentPayments.filter(s => s.pagamentos_pendentes > 0 && s.pagamentos_atrasados === 0);
      case "em-dia":
        return studentPayments.filter(s => s.pagamentos_atrasados === 0 && s.pagamentos_pendentes === 0 && s.total_pago > 0);
      default:
        return studentPayments;
    }
  };

  const getPaymentHistory = () => {
    return allPayments.map(payment => {
      const student = studentPayments.find(s => s.aluno_id === payment.aluno_id);
      return {
        ...payment,
        aluno_nome: student?.aluno_nome || "Desconhecido"
      };
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  const metrics = {
    totalAlunos: studentPayments.length,
    atrasados: studentPayments.filter(s => s.pagamentos_atrasados > 0).length,
    pendentes: studentPayments.filter(s => s.pagamentos_pendentes > 0 && s.pagamentos_atrasados === 0).length,
    emDia: studentPayments.filter(s => s.pagamentos_atrasados === 0 && s.pagamentos_pendentes === 0 && s.total_pago > 0).length,
  };

  return (
    <div className="space-y-6">
      {/* Métricas Resumidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Alunos</p>
                <p className="text-2xl font-bold">{metrics.totalAlunos}</p>
              </div>
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Atrasados</p>
                <p className="text-2xl font-bold text-destructive">{metrics.atrasados}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-600">{metrics.pendentes}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em Dia</p>
                <p className="text-2xl font-bold text-green-600">{metrics.emDia}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Status e Histórico */}
      <Card>
        <CardHeader>
          <CardTitle>Acompanhamento de Pagamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="todos" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="atrasados">Atrasados</TabsTrigger>
              <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
              <TabsTrigger value="em-dia">Em Dia</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            {["todos", "atrasados", "pendentes", "em-dia"].map(tab => (
              <TabsContent key={tab} value={tab}>
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-3">
                    {filterStudents(tab).map(student => (
                      <Card key={student.aluno_id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <p className="font-semibold">{student.aluno_nome}</p>
                                {getStatusBadge(student)}
                              </div>
                              <p className="text-sm text-muted-foreground">{student.aluno_email}</p>
                              {student.plano_nome && (
                                <p className="text-sm">
                                  <span className="text-muted-foreground">Plano:</span> {student.plano_nome}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Total Pago</p>
                              <p className="text-lg font-bold text-green-600">
                                {formatCurrency(student.total_pago)}
                              </p>
                              {student.ultimo_pagamento && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Último: {format(new Date(student.ultimo_pagamento), "dd/MM/yyyy", { locale: ptBR })}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {filterStudents(tab).length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhum aluno nesta categoria
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}

            <TabsContent value="historico">
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-3">
                  {getPaymentHistory().map(payment => (
                    <Card key={payment.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <p className="font-semibold">{payment.aluno_nome}</p>
                              <Badge variant={
                                payment.status === "RECEIVED" ? "default" : 
                                payment.status === "PENDING" ? "secondary" : 
                                "destructive"
                              }>
                                {payment.status === "RECEIVED" ? "Pago" :
                                 payment.status === "PENDING" ? "Pendente" :
                                 payment.status === "OVERDUE" ? "Atrasado" : payment.status}
                              </Badge>
                            </div>
                            {payment.description && (
                              <p className="text-sm text-muted-foreground">{payment.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Vencimento: {format(new Date(payment.due_date), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">
                              {formatCurrency(Number(payment.value))}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(payment.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {allPayments.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum pagamento registrado
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
