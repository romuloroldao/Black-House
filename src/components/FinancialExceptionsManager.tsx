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
import { Plus, Pencil, Trash2, AlertCircle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface FinancialException {
  id: string;
  aluno_id: string;
  motivo: string;
  tipo: 'isento' | 'desconto' | 'acordo_pagamento' | 'bolsa';
  valor_desconto?: number;
  percentual_desconto?: number;
  data_inicio: string;
  data_fim?: string;
  observacoes?: string;
  ativo: boolean;
  aluno?: {
    nome: string;
    email: string;
  };
}

interface Aluno {
  id: string;
  nome: string;
  email: string;
}

export default function FinancialExceptionsManager() {
  const { user } = useAuth();
  const [exceptions, setExceptions] = useState<FinancialException[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    aluno_id: string;
    motivo: string;
    tipo: 'isento' | 'desconto' | 'acordo_pagamento' | 'bolsa';
    valor_desconto: string;
    percentual_desconto: string;
    data_inicio: string;
    data_fim: string;
    observacoes: string;
    ativo: boolean;
  }>({
    aluno_id: "",
    motivo: "",
    tipo: "desconto",
    valor_desconto: "",
    percentual_desconto: "",
    data_inicio: "",
    data_fim: "",
    observacoes: "",
    ativo: true,
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [exceptionsRes, alunosRes] = await Promise.all([
        supabase
          .from('financial_exceptions')
          .select(`
            *,
            aluno:alunos(nome, email)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('alunos')
          .select('id, nome, email')
          .order('nome')
      ]);

      if (exceptionsRes.error) throw exceptionsRes.error;
      if (alunosRes.error) throw alunosRes.error;

      setExceptions((exceptionsRes.data || []) as FinancialException[]);
      setAlunos(alunosRes.data || []);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast.error("Erro ao carregar exceções financeiras");
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
        motivo: formData.motivo,
        tipo: formData.tipo,
        valor_desconto: formData.valor_desconto ? parseFloat(formData.valor_desconto) : null,
        percentual_desconto: formData.percentual_desconto ? parseFloat(formData.percentual_desconto) : null,
        data_inicio: formData.data_inicio,
        data_fim: formData.data_fim || null,
        observacoes: formData.observacoes || null,
        ativo: formData.ativo,
      };

      if (editingId) {
        const { error } = await supabase
          .from('financial_exceptions')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
        toast.success("Exceção atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from('financial_exceptions')
          .insert([payload]);

        if (error) throw error;
        toast.success("Exceção criada com sucesso!");
      }

      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Erro ao salvar exceção:', error);
      toast.error("Erro ao salvar exceção financeira");
    }
  };

  const handleEdit = (exception: FinancialException) => {
    setEditingId(exception.id);
    setFormData({
      aluno_id: exception.aluno_id,
      motivo: exception.motivo,
      tipo: exception.tipo,
      valor_desconto: exception.valor_desconto?.toString() || "",
      percentual_desconto: exception.percentual_desconto?.toString() || "",
      data_inicio: exception.data_inicio,
      data_fim: exception.data_fim || "",
      observacoes: exception.observacoes || "",
      ativo: exception.ativo,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta exceção?")) return;

    try {
      const { error } = await supabase
        .from('financial_exceptions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Exceção excluída com sucesso!");
      loadData();
    } catch (error: any) {
      console.error('Erro ao excluir exceção:', error);
      toast.error("Erro ao excluir exceção");
    }
  };

  const resetForm = () => {
    setFormData({
      aluno_id: "",
      motivo: "",
      tipo: "desconto",
      valor_desconto: "",
      percentual_desconto: "",
      data_inicio: "",
      data_fim: "",
      observacoes: "",
      ativo: true,
    });
    setEditingId(null);
    setDialogOpen(false);
  };

  const getTipoBadge = (tipo: string) => {
    const badges = {
      isento: <Badge variant="secondary">Isento</Badge>,
      desconto: <Badge variant="outline">Desconto</Badge>,
      acordo_pagamento: <Badge>Acordo</Badge>,
      bolsa: <Badge variant="secondary">Bolsa</Badge>,
    };
    return badges[tipo as keyof typeof badges];
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Exceções Financeiras</h2>
          <p className="text-muted-foreground">Gerencie acordos especiais e isenções</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Exceção
        </Button>
      </div>

      <div className="grid gap-4">
        {exceptions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Nenhuma exceção cadastrada
            </CardContent>
          </Card>
        ) : (
          exceptions.map((exception) => (
            <Card key={exception.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">
                    {exception.aluno?.nome || 'Aluno não encontrado'}
                  </CardTitle>
                  {getTipoBadge(exception.tipo)}
                  {exception.ativo ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleEdit(exception)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(exception.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p><strong>Motivo:</strong> {exception.motivo}</p>
                  {exception.valor_desconto && (
                    <p><strong>Desconto:</strong> R$ {exception.valor_desconto.toFixed(2)}</p>
                  )}
                  {exception.percentual_desconto && (
                    <p><strong>Desconto:</strong> {exception.percentual_desconto}%</p>
                  )}
                  <p><strong>Período:</strong> {format(new Date(exception.data_inicio), 'dd/MM/yyyy')} 
                    {exception.data_fim && ` até ${format(new Date(exception.data_fim), 'dd/MM/yyyy')}`}
                  </p>
                  {exception.observacoes && (
                    <p><strong>Observações:</strong> {exception.observacoes}</p>
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
            <DialogTitle>{editingId ? 'Editar' : 'Nova'} Exceção Financeira</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="aluno_id">Aluno *</Label>
              <Select value={formData.aluno_id} onValueChange={(value) => setFormData({...formData, aluno_id: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um aluno" />
                </SelectTrigger>
                <SelectContent>
                  {alunos.map((aluno) => (
                    <SelectItem key={aluno.id} value={aluno.id}>
                      {aluno.nome} - {aluno.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Exceção *</Label>
              <Select value={formData.tipo} onValueChange={(value: any) => setFormData({...formData, tipo: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="isento">Isento</SelectItem>
                  <SelectItem value="desconto">Desconto</SelectItem>
                  <SelectItem value="acordo_pagamento">Acordo de Pagamento</SelectItem>
                  <SelectItem value="bolsa">Bolsa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo *</Label>
              <Input
                id="motivo"
                value={formData.motivo}
                onChange={(e) => setFormData({...formData, motivo: e.target.value})}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor_desconto">Valor Desconto (R$)</Label>
                <Input
                  id="valor_desconto"
                  type="number"
                  step="0.01"
                  value={formData.valor_desconto}
                  onChange={(e) => setFormData({...formData, valor_desconto: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="percentual_desconto">Percentual Desconto (%)</Label>
                <Input
                  id="percentual_desconto"
                  type="number"
                  step="0.01"
                  value={formData.percentual_desconto}
                  onChange={(e) => setFormData({...formData, percentual_desconto: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data_inicio">Data Início *</Label>
                <Input
                  id="data_inicio"
                  type="date"
                  value={formData.data_inicio}
                  onChange={(e) => setFormData({...formData, data_inicio: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_fim">Data Fim</Label>
                <Input
                  id="data_fim"
                  type="date"
                  value={formData.data_fim}
                  onChange={(e) => setFormData({...formData, data_fim: e.target.value})}
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

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ativo"
                checked={formData.ativo}
                onChange={(e) => setFormData({...formData, ativo: e.target.checked})}
                className="h-4 w-4"
              />
              <Label htmlFor="ativo">Ativo</Label>
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