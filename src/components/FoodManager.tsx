import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Edit, Trash2, Apple } from "lucide-react";

interface TipoAlimento {
  id: string;
  nome_tipo: string;
}

interface Alimento {
  id: string;
  nome: string;
  tipo_id: string | null;
  quantidade_referencia_g: number;
  kcal_por_referencia: number;
  cho_por_referencia: number;
  ptn_por_referencia: number;
  lip_por_referencia: number;
  origem_ptn: string;
  autor: string | null;
  info_adicional: string | null;
}

export default function FoodManager() {
  const [alimentos, setAlimentos] = useState<Alimento[]>([]);
  const [tipos, setTipos] = useState<TipoAlimento[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFood, setEditingFood] = useState<Alimento | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nome: "",
    tipo_id: "",
    quantidade_referencia_g: "100",
    kcal_por_referencia: "",
    cho_por_referencia: "",
    ptn_por_referencia: "",
    lip_por_referencia: "",
    origem_ptn: "mista",
    info_adicional: "",
  });

  useEffect(() => {
    carregarDados();
    carregarUsuario();
  }, []);

  const carregarUsuario = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [alimentosData, tiposData] = await Promise.all([
        supabase.from("alimentos").select("*").order("nome"),
        supabase.from("tipos_alimentos").select("*").order("nome_tipo"),
      ]);

      if (alimentosData.error) throw alimentosData.error;
      if (tiposData.error) throw tiposData.error;

      setAlimentos(alimentosData.data || []);
      setTipos(tiposData.data || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar alimentos");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nome: "",
      tipo_id: "",
      quantidade_referencia_g: "100",
      kcal_por_referencia: "",
      cho_por_referencia: "",
      ptn_por_referencia: "",
      lip_por_referencia: "",
      origem_ptn: "mista",
      info_adicional: "",
    });
    setEditingFood(null);
  };

  const handleSave = async () => {
    try {
      // Validação básica
      if (!formData.nome || !formData.tipo_id) {
        toast.error("Preencha os campos obrigatórios");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar autenticado");
        return;
      }

      const alimentoData = {
        nome: formData.nome.trim(),
        tipo_id: formData.tipo_id,
        quantidade_referencia_g: parseFloat(formData.quantidade_referencia_g) || 100,
        kcal_por_referencia: parseFloat(formData.kcal_por_referencia) || 0,
        cho_por_referencia: parseFloat(formData.cho_por_referencia) || 0,
        ptn_por_referencia: parseFloat(formData.ptn_por_referencia) || 0,
        lip_por_referencia: parseFloat(formData.lip_por_referencia) || 0,
        origem_ptn: formData.origem_ptn,
        info_adicional: formData.info_adicional || null,
        autor: user.id,
      };

      if (editingFood) {
        const { error } = await supabase
          .from("alimentos")
          .update(alimentoData)
          .eq("id", editingFood.id);

        if (error) throw error;
        toast.success("Alimento atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("alimentos")
          .insert([alimentoData]);

        if (error) throw error;
        toast.success("Alimento cadastrado com sucesso!");
      }

      setIsDialogOpen(false);
      resetForm();
      carregarDados();
    } catch (error: any) {
      console.error("Erro ao salvar alimento:", error);
      toast.error(error.message || "Erro ao salvar alimento");
    }
  };

  const handleEdit = (alimento: Alimento) => {
    setEditingFood(alimento);
    setFormData({
      nome: alimento.nome,
      tipo_id: alimento.tipo_id || "",
      quantidade_referencia_g: alimento.quantidade_referencia_g.toString(),
      kcal_por_referencia: alimento.kcal_por_referencia.toString(),
      cho_por_referencia: alimento.cho_por_referencia.toString(),
      ptn_por_referencia: alimento.ptn_por_referencia.toString(),
      lip_por_referencia: alimento.lip_por_referencia.toString(),
      origem_ptn: alimento.origem_ptn,
      info_adicional: alimento.info_adicional || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este alimento?")) return;

    try {
      const { error } = await supabase.from("alimentos").delete().eq("id", id);
      if (error) throw error;

      toast.success("Alimento excluído com sucesso!");
      carregarDados();
    } catch (error: any) {
      console.error("Erro ao excluir alimento:", error);
      toast.error(error.message || "Erro ao excluir alimento");
    }
  };

  const filteredAlimentos = alimentos.filter((alimento) =>
    alimento.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTipoNome = (tipoId: string | null) => {
    const tipo = tipos.find((t) => t.id === tipoId);
    return tipo?.nome_tipo || "Sem categoria";
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Apple className="w-8 h-8 text-primary" />
            Gerenciar Alimentos
          </h1>
          <p className="text-muted-foreground mt-1">
            Adicione e gerencie alimentos para criar dietas personalizadas
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Alimento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingFood ? "Editar Alimento" : "Cadastrar Novo Alimento"}
              </DialogTitle>
              <DialogDescription>
                Preencha as informações nutricionais do alimento
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do Alimento *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Frango grelhado"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo">Categoria *</Label>
                  <Select
                    value={formData.tipo_id}
                    onValueChange={(value) => setFormData({ ...formData, tipo_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {tipos.map((tipo) => (
                        <SelectItem key={tipo.id} value={tipo.id}>
                          {tipo.nome_tipo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantidade_ref">Quantidade Referência (g)</Label>
                  <Input
                    id="quantidade_ref"
                    type="number"
                    value={formData.quantidade_referencia_g}
                    onChange={(e) => setFormData({ ...formData, quantidade_referencia_g: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Padrão: 100g</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="origem_ptn">Origem da Proteína</Label>
                  <Select
                    value={formData.origem_ptn}
                    onValueChange={(value) => setFormData({ ...formData, origem_ptn: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="animal">Animal</SelectItem>
                      <SelectItem value="vegetal">Vegetal</SelectItem>
                      <SelectItem value="mista">Mista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Informações Nutricionais</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="kcal">Calorias (kcal)</Label>
                    <Input
                      id="kcal"
                      type="number"
                      step="0.1"
                      value={formData.kcal_por_referencia}
                      onChange={(e) => setFormData({ ...formData, kcal_por_referencia: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cho">Carboidratos (g)</Label>
                    <Input
                      id="cho"
                      type="number"
                      step="0.1"
                      value={formData.cho_por_referencia}
                      onChange={(e) => setFormData({ ...formData, cho_por_referencia: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ptn">Proteínas (g)</Label>
                    <Input
                      id="ptn"
                      type="number"
                      step="0.1"
                      value={formData.ptn_por_referencia}
                      onChange={(e) => setFormData({ ...formData, ptn_por_referencia: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lip">Lipídios (g)</Label>
                    <Input
                      id="lip"
                      type="number"
                      step="0.1"
                      value={formData.lip_por_referencia}
                      onChange={(e) => setFormData({ ...formData, lip_por_referencia: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="info">Informações Adicionais</Label>
                <Textarea
                  id="info"
                  value={formData.info_adicional}
                  onChange={(e) => setFormData({ ...formData, info_adicional: e.target.value })}
                  placeholder="Ex: Rico em ômega-3, fonte de ferro..."
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingFood ? "Atualizar" : "Cadastrar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar alimento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Carregando alimentos...</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredAlimentos.map((alimento) => {
            const isAutor = alimento.autor === currentUserId;
            
            return (
              <Card key={alimento.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {alimento.nome}
                        {isAutor && (
                          <Badge variant="secondary" className="text-xs">
                            Seu alimento
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        <Badge variant="outline">{getTipoNome(alimento.tipo_id)}</Badge>
                        <span className="mx-2">•</span>
                        <span className="text-xs">
                          Origem proteína: <span className="font-medium">{alimento.origem_ptn}</span>
                        </span>
                      </CardDescription>
                    </div>
                    {isAutor && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(alimento)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(alimento.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Porção</p>
                      <p className="font-semibold">{alimento.quantidade_referencia_g}g</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Calorias</p>
                      <p className="font-semibold">{alimento.kcal_por_referencia} kcal</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Carboidratos</p>
                      <p className="font-semibold">{alimento.cho_por_referencia}g</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Proteínas</p>
                      <p className="font-semibold">{alimento.ptn_por_referencia}g</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Lipídios</p>
                      <p className="font-semibold">{alimento.lip_por_referencia}g</p>
                    </div>
                  </div>
                  {alimento.info_adicional && (
                    <p className="text-sm text-muted-foreground mt-3 pt-3 border-t">
                      {alimento.info_adicional}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {filteredAlimentos.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  {searchTerm
                    ? "Nenhum alimento encontrado com esse nome"
                    : "Nenhum alimento cadastrado"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
