import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, TrendingDown, Clock, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Expense {
  id: string;
  descricao: string;
  valor: number;
  categoria: string;
  data_vencimento: string;
  data_pagamento?: string;
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
  forma_pagamento?: string;
  observacoes?: string;
  recorrente: boolean;
  frequencia_recorrencia?: string;
}

export default function ExpenseManager() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const [formData, setFormData] = useState<{
    descricao: string;
    valor: string;
    categoria: string;
    data_vencimento: string;
    data_pagamento: string;
    status: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
    forma_pagamento: string;
    observacoes: string;
    recorrente: boolean;
    frequencia_recorrencia: string;
  }>({
    descricao: "",
    valor: "",
    categoria: "",
    data_vencimento: "",
    data_pagamento: "",
    status: "pendente",
    forma_pagamento: "",
    observacoes: "",
    recorrente: false,
    frequencia_recorrencia: "",
  });

  useEffect(() => {
    if (user) {
      loadExpenses();
    }
  }, [user]);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const result = await apiClient.requestSafe<any[]>('/api/expenses');
      const data = result.success && Array.isArray(result.data) ? result.data : [];

      // Converter valor para número se vier como string
      const expensesData = data.map((expense: any) => ({
        ...expense,
        valor: typeof expense.valor === 'string' ? parseFloat(expense.valor) || 0 : (expense.valor || 0),
      }));

      setExpenses(expensesData as Expense[]);
    } catch (error: any) {
      console.error('Erro ao carregar despesas:', error);
      toast.error("Erro ao carregar despesas");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = {
        coach_id: user?.id,
        descricao: formData.descricao,
        valor: parseFloat(formData.valor),
        categoria: formData.categoria,
        data_vencimento: formData.data_vencimento,
        data_pagamento: formData.data_pagamento || null,
        status: formData.status,
        forma_pagamento: formData.forma_pagamento || null,
        observacoes: formData.observacoes || null,
        recorrente: formData.recorrente,
        frequencia_recorrencia: formData.recorrente ? formData.frequencia_recorrencia : null,
      };

      if (editingId) {
        const result = await apiClient.requestSafe(`/api/expenses/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        if (!result.success) {
          throw new Error(result.error || 'Erro ao atualizar despesa');
        }
        toast.success("Despesa atualizada com sucesso!");
      } else {
        const result = await apiClient.requestSafe('/api/expenses', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (!result.success) {
          throw new Error(result.error || 'Erro ao criar despesa');
        }
        toast.success("Despesa criada com sucesso!");
      }

      resetForm();
      loadExpenses();
    } catch (error: any) {
      console.error('Erro ao salvar despesa:', error);
      toast.error("Erro ao salvar despesa");
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setFormData({
      descricao: expense.descricao,
      valor: expense.valor.toString(),
      categoria: expense.categoria,
      data_vencimento: expense.data_vencimento,
      data_pagamento: expense.data_pagamento || "",
      status: expense.status,
      forma_pagamento: expense.forma_pagamento || "",
      observacoes: expense.observacoes || "",
      recorrente: expense.recorrente,
      frequencia_recorrencia: expense.frequencia_recorrencia || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta despesa?")) return;

    try {
      const result = await apiClient.requestSafe(`/api/expenses/${id}`, { method: 'DELETE' });
      if (!result.success) {
        throw new Error(result.error || 'Erro ao excluir despesa');
      }
      toast.success("Despesa excluída com sucesso!");
      loadExpenses();
    } catch (error: any) {
      console.error('Erro ao excluir despesa:', error);
      toast.error("Erro ao excluir despesa");
    }
  };

  const resetForm = () => {
    setFormData({
      descricao: "",
      valor: "",
      categoria: "",
      data_vencimento: "",
      data_pagamento: "",
      status: "pendente",
      forma_pagamento: "",
      observacoes: "",
      recorrente: false,
      frequencia_recorrencia: "",
    });
    setEditingId(null);
    setDialogOpen(false);
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pendente: <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>,
      pago: <Badge variant="secondary"><CheckCircle className="h-3 w-3 mr-1" />Pago</Badge>,
      atrasado: <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Atrasado</Badge>,
      cancelado: <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Cancelado</Badge>,
    };
    return badges[status as keyof typeof badges];
  };

  const filteredExpenses = expenses.filter(expense => {
    if (filter === 'all') return true;
    return expense.status === filter;
  });

  // Garantir que valores sejam números antes de calcular totais
  const totalPendente = expenses
    .filter(e => e.status === 'pendente')
    .reduce((sum, e) => {
      const valor = typeof e.valor === 'string' ? parseFloat(e.valor) || 0 : (e.valor || 0);
      return sum + valor;
    }, 0);
  
  const totalPago = expenses
    .filter(e => e.status === 'pago')
    .reduce((sum, e) => {
      const valor = typeof e.valor === 'string' ? parseFloat(e.valor) || 0 : (e.valor || 0);
      return sum + valor;
    }, 0);

  if (loading) {
    return <div className="flex items-center justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gestão de Despesas</h2>
          <p className="text-muted-foreground">Controle suas saídas e custos operacionais</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Despesa
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pendente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              R$ {totalPendente.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              R$ {totalPago.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {(totalPendente + totalPago).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>
          Todas
        </Button>
        <Button variant={filter === 'pendente' ? 'default' : 'outline'} onClick={() => setFilter('pendente')}>
          Pendentes
        </Button>
        <Button variant={filter === 'pago' ? 'default' : 'outline'} onClick={() => setFilter('pago')}>
          Pagas
        </Button>
        <Button variant={filter === 'atrasado' ? 'default' : 'outline'} onClick={() => setFilter('atrasado')}>
          Atrasadas
        </Button>
      </div>

      <div className="grid gap-4">
        {filteredExpenses.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Nenhuma despesa encontrada
            </CardContent>
          </Card>
        ) : (
          filteredExpenses.map((expense) => (
            <Card key={expense.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                  <CardTitle className="text-lg">{expense.descricao}</CardTitle>
                  {getStatusBadge(expense.status)}
                  {expense.recorrente && <Badge variant="outline">Recorrente</Badge>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleEdit(expense)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(expense.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span><strong>Valor:</strong> R$ {(() => {
                      const valor = typeof expense.valor === 'string' ? parseFloat(expense.valor) || 0 : (expense.valor || 0);
                      return valor.toFixed(2);
                    })()}</span>
                    <span><strong>Categoria:</strong> {expense.categoria}</span>
                  </div>
                  <div className="flex justify-between">
                    <span><strong>Vencimento:</strong> {format(new Date(expense.data_vencimento), 'dd/MM/yyyy')}</span>
                    {expense.data_pagamento && (
                      <span><strong>Pagamento:</strong> {format(new Date(expense.data_pagamento), 'dd/MM/yyyy')}</span>
                    )}
                  </div>
                  {expense.forma_pagamento && (
                    <p><strong>Forma de Pagamento:</strong> {expense.forma_pagamento}</p>
                  )}
                  {expense.observacoes && (
                    <p><strong>Observações:</strong> {expense.observacoes}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Nova'} Despesa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição *</Label>
              <Input
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor">Valor (R$) *</Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  value={formData.valor}
                  onChange={(e) => setFormData({...formData, valor: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria *</Label>
                <Input
                  id="categoria"
                  value={formData.categoria}
                  onChange={(e) => setFormData({...formData, categoria: e.target.value})}
                  required
                  placeholder="Ex: Aluguel, Equipamento, Salário"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data_vencimento">Data Vencimento *</Label>
                <Input
                  id="data_vencimento"
                  type="date"
                  value={formData.data_vencimento}
                  onChange={(e) => setFormData({...formData, data_vencimento: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_pagamento">Data Pagamento</Label>
                <Input
                  id="data_pagamento"
                  type="date"
                  value={formData.data_pagamento}
                  onChange={(e) => setFormData({...formData, data_pagamento: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select value={formData.status} onValueChange={(value: any) => setFormData({...formData, status: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="atrasado">Atrasado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="forma_pagamento">Forma de Pagamento</Label>
                <Input
                  id="forma_pagamento"
                  value={formData.forma_pagamento}
                  onChange={(e) => setFormData({...formData, forma_pagamento: e.target.value})}
                  placeholder="Ex: PIX, Cartão, Boleto"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                rows={3}
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="recorrente"
                  checked={formData.recorrente}
                  onChange={(e) => setFormData({...formData, recorrente: e.target.checked})}
                  className="h-4 w-4"
                />
                <Label htmlFor="recorrente">Despesa Recorrente</Label>
              </div>

              {formData.recorrente && (
                <Select value={formData.frequencia_recorrencia} onValueChange={(value) => setFormData({...formData, frequencia_recorrencia: value})}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Frequência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="semestral">Semestral</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingId ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}