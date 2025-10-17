import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PaymentPlan {
  id: string;
  nome: string;
  valor: number;
  descricao?: string;
  dia_vencimento: number;
  frequencia: 'mensal' | 'trimestral' | 'semestral' | 'anual';
  ativo: boolean;
}

export default function PaymentPlansConfig() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    nome: string;
    valor: string;
    descricao: string;
    dia_vencimento: string;
    frequencia: 'mensal' | 'trimestral' | 'semestral' | 'anual';
    ativo: boolean;
  }>({
    nome: "",
    valor: "",
    descricao: "",
    dia_vencimento: "10",
    frequencia: "mensal",
    ativo: true,
  });

  useEffect(() => {
    if (user) {
      loadPlans();
    }
  }, [user]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('payment_plans')
        .select('*')
        .order('nome');

      if (error) throw error;
      setPlans((data || []) as PaymentPlan[]);
    } catch (error: any) {
      console.error('Erro ao carregar planos:', error);
      toast.error("Erro ao carregar planos de pagamento");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = {
        coach_id: user?.id,
        nome: formData.nome,
        valor: parseFloat(formData.valor),
        descricao: formData.descricao || null,
        dia_vencimento: parseInt(formData.dia_vencimento),
        frequencia: formData.frequencia,
        ativo: formData.ativo,
      };

      if (editingId) {
        const { error } = await supabase
          .from('payment_plans')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
        toast.success("Plano atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from('payment_plans')
          .insert([payload]);

        if (error) throw error;
        toast.success("Plano criado com sucesso!");
      }

      resetForm();
      loadPlans();
    } catch (error: any) {
      console.error('Erro ao salvar plano:', error);
      toast.error("Erro ao salvar plano de pagamento");
    }
  };

  const handleEdit = (plan: PaymentPlan) => {
    setEditingId(plan.id);
    setFormData({
      nome: plan.nome,
      valor: plan.valor.toString(),
      descricao: plan.descricao || "",
      dia_vencimento: plan.dia_vencimento.toString(),
      frequencia: plan.frequencia,
      ativo: plan.ativo,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este plano?")) return;

    try {
      const { error } = await supabase
        .from('payment_plans')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Plano excluído com sucesso!");
      loadPlans();
    } catch (error: any) {
      console.error('Erro ao excluir plano:', error);
      toast.error("Erro ao excluir plano");
    }
  };

  const resetForm = () => {
    setFormData({
      nome: "",
      valor: "",
      descricao: "",
      dia_vencimento: "10",
      frequencia: "mensal",
      ativo: true,
    });
    setEditingId(null);
    setDialogOpen(false);
  };

  const getFrequenciaLabel = (freq: string) => {
    const labels = {
      mensal: 'Mensal',
      trimestral: 'Trimestral',
      semestral: 'Semestral',
      anual: 'Anual',
    };
    return labels[freq as keyof typeof labels];
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Planos de Pagamento</h2>
          <p className="text-muted-foreground">Configure planos de mensalidade padrão</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Plano
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center text-muted-foreground">
              Nenhum plano cadastrado
            </CardContent>
          </Card>
        ) : (
          plans.map((plan) => (
            <Card key={plan.id} className={!plan.ativo ? 'opacity-60' : ''}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  <CardTitle className="text-lg">{plan.nome}</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleEdit(plan)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(plan.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-primary">
                    R$ {plan.valor.toFixed(2)}
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{getFrequenciaLabel(plan.frequencia)}</Badge>
                    <Badge variant="secondary">Dia {plan.dia_vencimento}</Badge>
                    {plan.ativo && <Badge>Ativo</Badge>}
                  </div>
                  {plan.descricao && (
                    <p className="text-sm text-muted-foreground mt-2">{plan.descricao}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Novo'} Plano de Pagamento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Plano *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({...formData, nome: e.target.value})}
                required
                placeholder="Ex: Plano Mensal Premium"
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
                <Label htmlFor="dia_vencimento">Dia Vencimento *</Label>
                <Input
                  id="dia_vencimento"
                  type="number"
                  min="1"
                  max="31"
                  value={formData.dia_vencimento}
                  onChange={(e) => setFormData({...formData, dia_vencimento: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequencia">Frequência *</Label>
              <Select value={formData.frequencia} onValueChange={(value: any) => setFormData({...formData, frequencia: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="semestral">Semestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                rows={3}
                placeholder="Descreva os benefícios deste plano"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ativo"
                checked={formData.ativo}
                onChange={(e) => setFormData({...formData, ativo: e.target.checked})}
                className="h-4 w-4"
              />
              <Label htmlFor="ativo">Plano Ativo</Label>
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