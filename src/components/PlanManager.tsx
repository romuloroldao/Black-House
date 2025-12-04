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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Edit, Trash2, CreditCard, Users, UserPlus, X } from "lucide-react";
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

interface Aluno {
  id: string;
  nome: string | null;
  email: string;
}

interface RecurringConfig {
  id: string;
  aluno_id: string;
  payment_plan_id: string;
  valor_customizado: number | null;
  dia_vencimento_customizado: number | null;
  enviar_lembrete: boolean;
  dias_antecedencia_lembrete: number;
  ativo: boolean;
  aluno?: Aluno;
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
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [recurringConfigs, setRecurringConfigs] = useState<RecurringConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    valor: "",
    descricao: "",
    dia_vencimento: "10",
    frequencia: "mensal",
  });
  const [assignFormData, setAssignFormData] = useState({
    aluno_id: "",
    valor_customizado: "",
    dia_vencimento_customizado: "",
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
      
      const [plansRes, alunosRes, configsRes] = await Promise.all([
        supabase.from("payment_plans").select("*").order("nome"),
        supabase.from("alunos").select("id, nome, email").eq("coach_id", user?.id),
        supabase.from("recurring_charges_config").select(`
          *,
          aluno:alunos(id, nome, email)
        `).eq("ativo", true)
      ]);

      if (plansRes.error) throw plansRes.error;
      if (alunosRes.error) throw alunosRes.error;
      if (configsRes.error) throw configsRes.error;

      setPlans(plansRes.data || []);
      setAlunos(alunosRes.data || []);
      setRecurringConfigs(configsRes.data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar dados: " + error.message);
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
      loadData();
    } catch (error: any) {
      toast.error("Erro ao salvar plano: " + error.message);
    }
  };

  const handleAssignStudent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!assignFormData.aluno_id || !selectedPlan) {
      toast.error("Selecione um aluno");
      return;
    }

    try {
      // Check if student already has an active config
      const existingConfig = recurringConfigs.find(
        c => c.aluno_id === assignFormData.aluno_id && c.ativo
      );

      if (existingConfig) {
        // Update existing config to the new plan
        const { error } = await supabase
          .from("recurring_charges_config")
          .update({
            payment_plan_id: selectedPlan.id,
            valor_customizado: assignFormData.valor_customizado ? parseFloat(assignFormData.valor_customizado) : null,
            dia_vencimento_customizado: assignFormData.dia_vencimento_customizado ? parseInt(assignFormData.dia_vencimento_customizado) : null,
            enviar_lembrete: assignFormData.enviar_lembrete,
            dias_antecedencia_lembrete: parseInt(assignFormData.dias_antecedencia_lembrete),
          })
          .eq("id", existingConfig.id);

        if (error) throw error;
        toast.success("Plano do aluno atualizado!");
      } else {
        // Create new config
        const { error } = await supabase
          .from("recurring_charges_config")
          .insert([{
            aluno_id: assignFormData.aluno_id,
            payment_plan_id: selectedPlan.id,
            coach_id: user?.id,
            valor_customizado: assignFormData.valor_customizado ? parseFloat(assignFormData.valor_customizado) : null,
            dia_vencimento_customizado: assignFormData.dia_vencimento_customizado ? parseInt(assignFormData.dia_vencimento_customizado) : null,
            enviar_lembrete: assignFormData.enviar_lembrete,
            dias_antecedencia_lembrete: parseInt(assignFormData.dias_antecedencia_lembrete),
            ativo: true,
          }]);

        if (error) throw error;
        toast.success("Aluno atribuído ao plano!");
      }

      setIsAssignDialogOpen(false);
      resetAssignForm();
      loadData();
    } catch (error: any) {
      toast.error("Erro ao atribuir aluno: " + error.message);
    }
  };

  const handleRemoveStudent = async (configId: string) => {
    if (!confirm("Remover este aluno do plano?")) return;

    try {
      const { error } = await supabase
        .from("recurring_charges_config")
        .update({ ativo: false })
        .eq("id", configId);

      if (error) throw error;
      toast.success("Aluno removido do plano!");
      loadData();
    } catch (error: any) {
      toast.error("Erro ao remover aluno: " + error.message);
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
      loadData();
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

  const resetAssignForm = () => {
    setAssignFormData({
      aluno_id: "",
      valor_customizado: "",
      dia_vencimento_customizado: "",
      enviar_lembrete: true,
      dias_antecedencia_lembrete: "3",
    });
    setSelectedPlan(null);
  };

  const openAssignDialog = (plan: Plan) => {
    setSelectedPlan(plan);
    setIsAssignDialogOpen(true);
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

  const getStudentsForPlan = (planId: string) => {
    return recurringConfigs.filter(c => c.payment_plan_id === planId && c.ativo);
  };

  const getAvailableStudents = () => {
    const assignedStudentIds = recurringConfigs
      .filter(c => c.ativo)
      .map(c => c.aluno_id);
    return alunos.filter(a => !assignedStudentIds.includes(a.id));
  };

  if (loading) {
    return <div className="p-8">Carregando planos...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Planos de Pagamento</h1>
          <p className="text-muted-foreground">Gerencie seus planos e atribua alunos diretamente</p>
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {plans.map((plan) => {
          const planStudents = getStudentsForPlan(plan.id);
          
          return (
            <Card key={plan.id} className={!plan.ativo ? 'opacity-60' : ''}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{plan.nome}</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openAssignDialog(plan)}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Adicionar Aluno
                  </Button>
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
                <div className="space-y-4">
                  <div>
                    <div className="text-2xl font-bold text-primary">
                      {formatCurrency(plan.valor)}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">{getFrequenciaLabel(plan.frequencia)}</Badge>
                      <Badge variant="secondary">Dia {plan.dia_vencimento}</Badge>
                      {plan.ativo && <Badge>Ativo</Badge>}
                    </div>
                    {plan.descricao && (
                      <p className="text-sm text-muted-foreground mt-2">{plan.descricao}</p>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        Alunos ({planStudents.length})
                      </span>
                    </div>
                    
                    {planStudents.length > 0 ? (
                      <ScrollArea className="max-h-[200px]">
                        <div className="space-y-2">
                          {planStudents.map((config) => (
                            <div
                              key={config.id}
                              className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                            >
                              <div>
                                <p className="font-medium text-sm">
                                  {config.aluno?.nome || config.aluno?.email}
                                </p>
                                {config.valor_customizado && (
                                  <p className="text-xs text-muted-foreground">
                                    Valor: {formatCurrency(config.valor_customizado)}
                                  </p>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => handleRemoveStudent(config.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        Nenhum aluno atribuído
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {plans.length === 0 && (
        <div className="text-center py-12">
          <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Nenhum plano cadastrado ainda.
          </p>
          <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Criar Primeiro Plano
          </Button>
        </div>
      )}

      {/* Dialog para criar/editar plano */}
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

      {/* Dialog para atribuir aluno */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Adicionar Aluno ao Plano "{selectedPlan?.nome}"
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssignStudent}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="aluno">Aluno *</Label>
                <Select
                  value={assignFormData.aluno_id}
                  onValueChange={(value) =>
                    setAssignFormData({ ...assignFormData, aluno_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um aluno" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableStudents().map((aluno) => (
                      <SelectItem key={aluno.id} value={aluno.id}>
                        {aluno.nome || aluno.email}
                      </SelectItem>
                    ))}
                    {getAvailableStudents().length === 0 && (
                      <SelectItem value="none" disabled>
                        Todos os alunos já possuem plano
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="text-sm text-muted-foreground">
                Configurações opcionais (deixe em branco para usar valores do plano)
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="valor_customizado">Valor Customizado (R$)</Label>
                  <Input
                    id="valor_customizado"
                    type="number"
                    step="0.01"
                    value={assignFormData.valor_customizado}
                    onChange={(e) =>
                      setAssignFormData({ ...assignFormData, valor_customizado: e.target.value })
                    }
                    placeholder={selectedPlan?.valor.toString()}
                  />
                </div>
                <div>
                  <Label htmlFor="dia_customizado">Dia Vencimento Customizado</Label>
                  <Input
                    id="dia_customizado"
                    type="number"
                    min="1"
                    max="31"
                    value={assignFormData.dia_vencimento_customizado}
                    onChange={(e) =>
                      setAssignFormData({ ...assignFormData, dia_vencimento_customizado: e.target.value })
                    }
                    placeholder={selectedPlan?.dia_vencimento.toString()}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="enviar_lembrete">Enviar lembrete de pagamento</Label>
                <Switch
                  id="enviar_lembrete"
                  checked={assignFormData.enviar_lembrete}
                  onCheckedChange={(checked) =>
                    setAssignFormData({ ...assignFormData, enviar_lembrete: checked })
                  }
                />
              </div>

              {assignFormData.enviar_lembrete && (
                <div>
                  <Label htmlFor="dias_lembrete">Dias de antecedência para lembrete</Label>
                  <Input
                    id="dias_lembrete"
                    type="number"
                    min="1"
                    max="15"
                    value={assignFormData.dias_antecedencia_lembrete}
                    onChange={(e) =>
                      setAssignFormData({ ...assignFormData, dias_antecedencia_lembrete: e.target.value })
                    }
                  />
                </div>
              )}
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAssignDialogOpen(false);
                  resetAssignForm();
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={!assignFormData.aluno_id}>
                Adicionar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
