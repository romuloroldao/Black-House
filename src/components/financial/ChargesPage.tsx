import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInputBR } from "@/components/ui/date-input-br";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ExternalLink, Copy } from "lucide-react";
import { format } from "date-fns";
import { FinancialPageLayout } from "./FinancialPageLayout";
import { FinancialFiltersBar } from "./FinancialFiltersBar";
import { FinancialDataTable, type ColumnDef } from "./FinancialDataTable";
import { FinancialStatusBadge } from "./FinancialStatusBadge";
import { MoneyDisplay } from "./MoneyDisplay";
import { useFinancialPayments, useFinancialAlunos } from "@/hooks/useFinancialData";
import { useApiSafeList } from "@/hooks/useApiSafe";

interface PaymentRow {
  id: string;
  aluno_id: string;
  aluno_nome: string;
  value: number;
  description: string | null;
  billing_type: string;
  status: string;
  due_date: string;
  invoice_url: string | null;
  bank_slip_url: string | null;
  pix_copy_paste: string | null;
}

type StatusFilter = "all" | "pending" | "overdue" | "received" | "cancelled";

function classifyPayment(p: PaymentRow): StatusFilter {
  const s = p.status.toUpperCase();
  if (s === "RECEIVED" || s === "CONFIRMED") return "received";
  if (s === "CANCELLED" || s === "REFUNDED") return "cancelled";
  if (s === "PENDING" && new Date(p.due_date) < new Date()) return "overdue";
  if (s === "PENDING" || s === "OVERDUE") return "pending";
  return "all";
}

export default function ChargesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: paymentsRaw = [], isLoading: loadingPayments } = useFinancialPayments();
  const { data: alunos = [] } = useFinancialAlunos();

  const { data: plansRaw } = useApiSafeList(
    () => apiClient.requestSafe<any[]>("/api/payment-plans"),
    { autoFetch: !!user, endpointKey: "/api/payment-plans", availabilityKey: "paymentPlans" },
  );

  const plans = (plansRaw ?? []).filter((p: any) => p?.coach_id === user?.id && p.ativo);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewMode, setViewMode] = useState<"charges" | "students">("charges");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [usePlan, setUsePlan] = useState(false);
  const [formData, setFormData] = useState({
    aluno_id: "",
    plan_id: "",
    value: "",
    description: "",
    billing_type: "PIX",
    due_date: format(new Date(), "yyyy-MM-dd"),
  });

  const payments: PaymentRow[] = useMemo(
    () =>
      paymentsRaw.map((p: any) => {
        const aluno = alunos.find((a) => a.id === p.aluno_id);
        return {
          id: p.id,
          aluno_id: p.aluno_id,
          aluno_nome: aluno?.nome || "Aluno",
          value: Number(p.value),
          description: p.description,
          billing_type: p.billing_type,
          status: p.status,
          due_date: p.due_date,
          invoice_url: p.invoice_url,
          bank_slip_url: p.bank_slip_url,
          pix_copy_paste: p.pix_copy_paste,
        };
      }),
    [paymentsRaw, alunos],
  );

  const filtered = useMemo(() => {
    let list = payments;
    if (statusFilter !== "all") {
      list = list.filter((p) => classifyPayment(p) === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.aluno_nome.toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [payments, statusFilter, search]);

  const counts = useMemo(() => ({
    all: payments.length,
    pending: payments.filter((p) => classifyPayment(p) === "pending").length,
    overdue: payments.filter((p) => classifyPayment(p) === "overdue").length,
    received: payments.filter((p) => classifyPayment(p) === "received").length,
    cancelled: payments.filter((p) => classifyPayment(p) === "cancelled").length,
  }), [payments]);

  const studentSummaries = useMemo(() => {
    const today = new Date();
    return alunos.map((aluno) => {
      const ap = payments.filter((p) => p.aluno_id === aluno.id);
      const overdue = ap.filter((p) => p.status === "PENDING" && new Date(p.due_date) < today).length;
      const pending = ap.filter((p) => p.status === "PENDING" && new Date(p.due_date) >= today).length;
      const totalPaid = ap
        .filter((p) => p.status === "RECEIVED" || p.status === "CONFIRMED")
        .reduce((s, p) => s + p.value, 0);
      return { ...aluno, overdue, pending, totalPaid };
    }).filter((s) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return s.nome?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
    });
  }, [alunos, payments, search]);

  const columns: ColumnDef<PaymentRow, unknown>[] = [
    {
      accessorKey: "aluno_nome",
      header: "Aluno",
      cell: ({ row }) => (
        <button
          type="button"
          className="font-medium hover:underline text-left"
          onClick={() => navigate(`/alunos/${row.original.aluno_id}`)}
        >
          {row.original.aluno_nome}
        </button>
      ),
    },
    {
      accessorKey: "value",
      header: "Valor",
      cell: ({ row }) => <MoneyDisplay value={row.original.value} />,
    },
    {
      accessorKey: "due_date",
      header: "Vencimento",
      cell: ({ row }) => format(new Date(row.original.due_date), "dd/MM/yyyy"),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <FinancialStatusBadge status={row.original.status} dueDate={row.original.due_date} />
      ),
    },
    {
      accessorKey: "billing_type",
      header: "Forma",
      cell: ({ row }) => <Badge variant="outline">{row.original.billing_type}</Badge>,
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex gap-1">
            {p.invoice_url && (
              <Button size="sm" variant="ghost" aria-label="Abrir fatura" onClick={() => window.open(p.invoice_url!, "_blank")}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
            {p.pix_copy_paste && (
              <Button
                size="sm"
                variant="ghost"
                aria-label="Copiar PIX"
                onClick={() => {
                  navigator.clipboard.writeText(p.pix_copy_paste!);
                  toast({ title: "PIX copiado" });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.aluno_id || !formData.due_date) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    let value = formData.value;
    let description = formData.description;
    if (usePlan && formData.plan_id) {
      const plan = plans.find((p: any) => p.id === formData.plan_id);
      if (plan) {
        value = String(plan.valor);
        description = description || plan.nome;
      }
    } else if (!value || parseFloat(value) < 5) {
      toast({ title: "Valor mínimo R$ 5,00", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    const result = await apiClient.requestSafe("/api/payments/create-asaas", {
      method: "POST",
      body: JSON.stringify({
        alunoId: formData.aluno_id,
        value: parseFloat(value),
        description,
        billingType: formData.billing_type,
        dueDate: formData.due_date,
      }),
    });
    setIsCreating(false);

    if (!result.success) {
      toast({ title: "Erro", description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: "Cobrança criada!" });
    setIsDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["financial", "payments"] });
  };

  if (loadingPayments) {
    return (
      <FinancialPageLayout title="Cobranças">
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full motion-safe:animate-spin" />
        </div>
      </FinancialPageLayout>
    );
  }

  return (
    <FinancialPageLayout
      title="Cobranças"
      description="Gerencie cobranças e acompanhe pagamentos dos alunos"
      actions={
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova cobrança
        </Button>
      }
    >
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "charges" | "students")}>
        <TabsList>
          <TabsTrigger value="charges">Por cobrança</TabsTrigger>
          <TabsTrigger value="students">Por aluno</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <FinancialFiltersBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Buscar aluno ou descrição..."
            chips={
              viewMode === "charges"
                ? [
                    { id: "all", label: "Todas", count: counts.all },
                    { id: "pending", label: "Pendentes", count: counts.pending },
                    { id: "overdue", label: "Atrasadas", count: counts.overdue },
                    { id: "received", label: "Recebidas", count: counts.received },
                  ]
                : undefined
            }
            activeChip={statusFilter}
            onChipChange={(id) => setStatusFilter(id as StatusFilter)}
          />
        </div>

        <TabsContent value="charges" className="mt-4">
          <FinancialDataTable data={filtered} columns={columns} emptyMessage="Nenhuma cobrança encontrada" />
        </TabsContent>

        <TabsContent value="students" className="mt-4">
          <FinancialDataTable
            data={studentSummaries.filter((s) => {
              if (statusFilter === "all") return true;
              if (statusFilter === "overdue") return s.overdue > 0;
              if (statusFilter === "pending") return s.pending > 0 && s.overdue === 0;
              if (statusFilter === "received") return s.overdue === 0 && s.pending === 0 && s.totalPaid > 0;
              return true;
            })}
            columns={[
              {
                accessorKey: "nome",
                header: "Aluno",
                cell: ({ row }) => (
                  <button
                    type="button"
                    className="font-medium hover:underline"
                    onClick={() => navigate(`/alunos/${row.original.id}`)}
                  >
                    {row.original.nome}
                  </button>
                ),
              },
              { accessorKey: "plano", header: "Plano", cell: ({ row }) => row.original.plano || "—" },
              {
                accessorKey: "totalPaid",
                header: "Total pago",
                cell: ({ row }) => <MoneyDisplay value={row.original.totalPaid} />,
              },
              {
                id: "status",
                header: "Situação",
                cell: ({ row }) => (
                  <FinancialStatusBadge
                    status=""
                    type="student"
                    overdueCount={row.original.overdue}
                    pendingCount={row.original.pending}
                    totalPaid={row.original.totalPaid}
                  />
                ),
              },
            ]}
            emptyMessage="Nenhum aluno encontrado"
          />
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova cobrança</DialogTitle>
            <DialogDescription>Crie uma cobrança via Asaas para um aluno.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Aluno *</Label>
              <Select value={formData.aluno_id} onValueChange={(v) => setFormData({ ...formData, aluno_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {alunos.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="usePlan" checked={usePlan} onChange={(e) => setUsePlan(e.target.checked)} />
              <Label htmlFor="usePlan">Usar plano de pagamento</Label>
            </div>
            {usePlan ? (
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select value={formData.plan_id} onValueChange={(v) => setFormData({ ...formData, plan_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {plans.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome} — R$ {p.valor}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input type="number" min="5" step="0.01" value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <Select value={formData.billing_type} onValueChange={(v) => setFormData({ ...formData, billing_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="BOLETO">Boleto</SelectItem>
                    <SelectItem value="CREDIT_CARD">Cartão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vencimento</Label>
                <DateInputBR value={formData.due_date} onChange={(v) => setFormData({ ...formData, due_date: v })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isCreating}>{isCreating ? "Criando..." : "Criar cobrança"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </FinancialPageLayout>
  );
}
