import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Plan {
  id: string;
  nome: string;
  valor: number;
  frequencia: string;
  ativo: boolean;
}

const FREQUENCIAS = [
  { value: "mensal", label: "Mensal" },
  { value: "bimestral", label: "Bimestral" },
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
        .from("planos_pagamento")
        .select("*")
        .eq("ativo", true)
        .order("created_at", { ascending: false });

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
      toast.error("Preencha todos os campos");
      return;
    }

    try {
      const planData = {
        nome: formData.nome,
        valor: parseFloat(formData.valor),
        frequencia: formData.frequencia,
        coach_id: user?.id,
      };

      if (editingPlan) {
        const { error } = await supabase
          .from("planos_pagamento")
          .update(planData)
          .eq("id", editingPlan.id);

        if (error) throw error;
        toast.success("Plano atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("planos_pagamento")
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
      frequencia: plan.frequencia,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (planId: string) => {
    if (!confirm("Tem certeza que deseja excluir este plano?")) return;

    try {
      const { error } = await supabase
        .from("planos_pagamento")
        .update({ ativo: false })
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
          <Card key={plan.id}>
            <CardHeader>
              <CardTitle className="flex justify-between items-start">
                <span>{plan.nome}</span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(plan)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(plan.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(plan.valor)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {getFrequenciaLabel(plan.frequencia)}
                  </p>
                </div>
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
                  placeholder="Ex: Plano Bronze"
                  required
                />
              </div>

              <div>
                <Label htmlFor="valor">Valor (R$) *</Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valor}
                  onChange={(e) =>
                    setFormData({ ...formData, valor: e.target.value })
                  }
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <Label htmlFor="frequencia">Frequência de Pagamento *</Label>
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
