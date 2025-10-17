import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Calendar, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface RecurringConfig {
  id: string;
  aluno_id: string;
  payment_plan_id?: string;
  valor_customizado?: number;
  dia_vencimento_customizado?: number;
  ativo: boolean;
  enviar_lembrete: boolean;
  dias_antecedencia_lembrete: number;
  alunos?: { nome: string; email: string };
  payment_plans?: { nome: string; valor: number; dia_vencimento: number };
}

interface Aluno {
  id: string;
  nome: string;
  email: string;
}

interface PaymentPlan {
  id: string;
  nome: string;
  valor: number;
  dia_vencimento: number;
}

export default function RecurringChargesConfig() {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<RecurringConfig[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    aluno_id: string;
    payment_plan_id: string;
    valor_customizado: string;
    dia_vencimento_customizado: string;
    ativo: boolean;
    enviar_lembrete: boolean;
    dias_antecedencia_lembrete: string;
  }>({
    aluno_id: "",
    payment_plan_id: "",
    valor_customizado: "",
    dia_vencimento_customizado: "",
    ativo: true,
    enviar_lembrete: true,
    dias_antecedencia_lembrete: "3",
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [configsRes, alunosRes, plansRes] = await Promise.all([
        supabase
          .from('recurring_charges_config')
          .select('*, alunos(nome, email), payment_plans(nome, valor, dia_vencimento)')
          .order('created_at', { ascending: false }),
        supabase
          .from('alunos')
          .select('id, nome, email')
          .eq('coach_id', user?.id)
          .order('nome'),
        supabase
          .from('payment_plans')
          .select('id, nome, valor, dia_vencimento')
          .eq('ativo', true)
          .order('nome'),
      ]);

      if (configsRes.error) throw configsRes.error;
      if (alunosRes.error) throw alunosRes.error;
      if (plansRes.error) throw plansRes.error;

      setConfigs((configsRes.data || []) as RecurringConfig[]);
      setAlunos((alunosRes.data || []) as Aluno[]);
      setPlans((plansRes.data || []) as PaymentPlan[]);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = {
        coach_id: user?.id,
        aluno_id: formData.aluno_id,
        payment_plan_id: formData.payment_plan_id || null,
        valor_customizado: formData.valor_customizado ? parseFloat(formData.valor_customizado) : null,
        dia_vencimento_customizado: formData.dia_vencimento_customizado ? parseInt(formData.dia_vencimento_customizado) : null,
        ativo: formData.ativo,
        enviar_lembrete: formData.enviar_lembrete,
        dias_antecedencia_lembrete: parseInt(formData.dias_antecedencia_lembrete),
      };

      if (editingId) {
        const { error } = await supabase
          .from('recurring_charges_config')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
        toast.success("Configuração atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from('recurring_charges_config')
          .insert([payload]);

        if (error) throw error;
        toast.success("Configuração criada com sucesso!");
      }

      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Erro ao salvar configuração:', error);
      toast.error("Erro ao salvar configuração");
    }
  };

  const handleEdit = (config: RecurringConfig) => {
    setEditingId(config.id);
    setFormData({
      aluno_id: config.aluno_id,
      payment_plan_id: config.payment_plan_id || "",
      valor_customizado: config.valor_customizado?.toString() || "",
      dia_vencimento_customizado: config.dia_vencimento_customizado?.toString() || "",
      ativo: config.ativo,
      enviar_lembrete: config.enviar_lembrete,
      dias_antecedencia_lembrete: config.dias_antecedencia_lembrete.toString(),
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta configuração?")) return;

    try {
      const { error } = await supabase
        .from('recurring_charges_config')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Configuração excluída com sucesso!");
      loadData();
    } catch (error: any) {
      console.error('Erro ao excluir configuração:', error);
      toast.error("Erro ao excluir configuração");
    }
  };

  const resetForm = () => {
    setFormData({
      aluno_id: "",
      payment_plan_id: "",
      valor_customizado: "",
      dia_vencimento_customizado: "",
      ativo: true,
      enviar_lembrete: true,
      dias_antecedencia_lembrete: "3",
    });
    setEditingId(null);
    setDialogOpen(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Cobranças Recorrentes</h2>
          <p className="text-muted-foreground">Configure cobranças automáticas para seus alunos</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Configuração
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {configs.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center text-muted-foreground">
              Nenhuma configuração cadastrada
            </CardContent>
          </Card>
        ) : (
          configs.map((config) => (
            <Card key={config.id} className={!config.ativo ? 'opacity-60' : ''}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg">{config.alunos?.nome}</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleEdit(config)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(config.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {config.payment_plans && (
                    <div className="text-sm text-muted-foreground">
                      {config.payment_plans.nome}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-xl font-bold">
                      R$ {(config.valor_customizado || config.payment_plans?.valor || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4" />
                    <span>Vencimento: Dia {config.dia_vencimento_customizado || config.payment_plans?.dia_vencimento}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {config.ativo && <Badge>Ativo</Badge>}
                    {config.enviar_lembrete && (
                      <Badge variant="outline">
                        Lembrete: {config.dias_antecedencia_lembrete} dias
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Nova'} Configuração</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="aluno_id">Aluno *</Label>
              <Select 
                value={formData.aluno_id} 
                onValueChange={(value) => setFormData({...formData, aluno_id: value})}
                disabled={!!editingId}
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

            <div className="space-y-2">
              <Label htmlFor="payment_plan_id">Plano de Pagamento</Label>
              <Select 
                value={formData.payment_plan_id} 
                onValueChange={(value) => setFormData({...formData, payment_plan_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um plano (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map(plan => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.nome} - R$ {plan.valor.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor_customizado">Valor Customizado (R$)</Label>
                <Input
                  id="valor_customizado"
                  type="number"
                  step="0.01"
                  value={formData.valor_customizado}
                  onChange={(e) => setFormData({...formData, valor_customizado: e.target.value})}
                  placeholder="Deixe vazio para usar do plano"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dia_vencimento_customizado">Dia Vencimento</Label>
                <Input
                  id="dia_vencimento_customizado"
                  type="number"
                  min="1"
                  max="31"
                  value={formData.dia_vencimento_customizado}
                  onChange={(e) => setFormData({...formData, dia_vencimento_customizado: e.target.value})}
                  placeholder="Deixe vazio para usar do plano"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dias_antecedencia_lembrete">Dias de Antecedência (Lembrete)</Label>
              <Input
                id="dias_antecedencia_lembrete"
                type="number"
                min="1"
                max="30"
                value={formData.dias_antecedencia_lembrete}
                onChange={(e) => setFormData({...formData, dias_antecedencia_lembrete: e.target.value})}
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="enviar_lembrete">Enviar Lembretes</Label>
              <Switch
                id="enviar_lembrete"
                checked={formData.enviar_lembrete}
                onCheckedChange={(checked) => setFormData({...formData, enviar_lembrete: checked})}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="ativo">Configuração Ativa</Label>
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({...formData, ativo: checked})}
              />
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
