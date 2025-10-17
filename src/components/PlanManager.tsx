import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Calendar, CreditCard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Plan {
  id: string;
  nome: string;
  valor: number;
  descricao?: string;
  dia_vencimento: number;
  frequencia: string;
  ativo: boolean;
}

const FREQUENCIAS = [
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

export default function PlanManager() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    valor: "",
    descricao: "",
    dia_vencimento: "10",
    frequencia: "mensal",
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
        .from("payment_plans")
        .select("*")
        .order("nome");

      if (error) throw error;
      setPlans(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar planos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome || !formData.valor || !formData.frequencia) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      const planData = {
        nome: formData.nome,
        valor: parseFloat(formData.valor),
        descricao: formData.descricao || null,
        dia_vencimento: parseInt(formData.dia_vencimento),
        frequencia: formData.frequencia,
        coach_id: user?.id,
        ativo: true,
      };

      if (editingPlan) {
        const { error } = await supabase
          .from("payment_plans")
          .update(planData)
          .eq("id", editingPlan.id);

        if (error) throw error;
        toast.success("Plano atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("payment_plans")
          .insert([planData]);

        if (error) throw error;
        toast.success("Plano criado com sucesso!");
      }

      setIsDialogOpen(false);
      resetForm();
      loadPlans();
    } catch (error: any) {
      toast.error("Erro ao salvar plano: " + error.message);
    }
  };

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      nome: plan.nome,
      valor: plan.valor.toString(),
      descricao: plan.descricao || "",
      dia_vencimento: plan.dia_vencimento.toString(),
      frequencia: plan.frequencia,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (planId: string) => {
    if (!confirm("Tem certeza que deseja excluir este plano?")) return;

    try {
      const { error } = await supabase
        .from("payment_plans")
        .delete()
        .eq("id", planId);

      if (error) throw error;
      toast.success("Plano excluído com sucesso!");
      loadPlans();
    } catch (error: any) {
      toast.error("Erro ao excluir plano: " + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      nome: "",
      valor: "",
      descricao: "",
      dia_vencimento: "10",
      frequencia: "mensal",
    });
    setEditingPlan(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getFrequenciaLabel = (freq: string) => {
    return FREQUENCIAS.find((f) => f.value === freq)?.label || freq;
  };

  if (loading) {
    return <div className="p-8">Carregando planos...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Planos de Pagamento</h1>
        <Button
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo Plano
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <Card key={plan.id} className={!plan.ativo ? 'opacity-60' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                <CardTitle className="text-lg">{plan.nome}</CardTitle>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleEdit(plan)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleDelete(plan.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(plan.valor)}
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
        ))}
      </div>

      {plans.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Nenhum plano cadastrado ainda.
          </p>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? "Editar Plano" : "Novo Plano"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome do Plano *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                  placeholder="Ex: Plano Mensal Premium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="valor">Valor (R$) *</Label>
                  <Input
                    id="valor"
                    type="number"
                    step="0.01"
                    value={formData.valor}
                    onChange={(e) =>
                      setFormData({ ...formData, valor: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="dia_vencimento">Dia Vencimento *</Label>
                  <Input
                    id="dia_vencimento"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.dia_vencimento}
                    onChange={(e) =>
                      setFormData({ ...formData, dia_vencimento: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="frequencia">Frequência *</Label>
                <Select
                  value={formData.frequencia}
                  onValueChange={(value) =>
                    setFormData({ ...formData, frequencia: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIAS.map((freq) => (
                      <SelectItem key={freq.value} value={freq.value}>
                        {freq.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) =>
                    setFormData({ ...formData, descricao: e.target.value })
                  }
                  rows={3}
                  placeholder="Descreva os benefícios deste plano"
                />
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {editingPlan ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
