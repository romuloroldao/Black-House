import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { Utensils, Replace, Pill } from "lucide-react";
import FoodSubstitutionDialog from "@/components/nutrition/FoodSubstitutionDialog";
import { Food, getAllFoodsSafe } from "@/lib/foodService";

const StudentDietView = () => {
  const { user } = useAuth();
  const [dieta, setDieta] = useState<any>(null);
  const [itensDieta, setItensDieta] = useState<any[]>([]);
  const [farmacos, setFarmacos] = useState<any[]>([]);
  const [todosAlimentos, setTodosAlimentos] = useState<Food[]>([]);
  const [substitutionDialog, setSubstitutionDialog] = useState<{
    open: boolean;
    alimentoAtual: any;
    quantidadeAtual: number;
    itemId: string;
  }>({
    open: false,
    alimentoAtual: null,
    quantidadeAtual: 0,
    itemId: ''
  });

  useEffect(() => {
    if (user) {
      loadDietData();
    }
  }, [user]);

  const loadDietData = async () => {
    const alimentosResult = await getAllFoodsSafe();
    const alimentosData = alimentosResult.success && Array.isArray(alimentosResult.data) ? alimentosResult.data : [];
    const alimentosOrdenados = alimentosData.sort((a, b) => a.name.localeCompare(b.name));
    setTodosAlimentos(alimentosOrdenados);

    const alunoResult = await apiClient.getMeSafe();
    const aluno = alunoResult.success ? alunoResult.data : null;

    if (!aluno) {
      setDieta(null);
      setItensDieta([]);
      setFarmacos([]);
      return;
    }

    const dietasResult = await apiClient.requestSafe<any[]>('/api/dietas');
    const dietas = dietasResult.success && Array.isArray(dietasResult.data) ? dietasResult.data : [];
    const dietaData = dietas
      .filter(d => d.aluno_id === aluno.id)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] || null;

    if (!dietaData) {
      setDieta(null);
      setItensDieta([]);
      setFarmacos([]);
      return;
    }

    setDieta(dietaData);

    const [itensRes, farmacosRes] = await Promise.all([
      apiClient.requestSafe<any[]>(`/api/itens-dieta?dieta_id=${dietaData.id}`),
      apiClient.requestSafe<any[]>(`/api/dieta-farmacos?dieta_id=${dietaData.id}`)
    ]);

    const itensArray = itensRes.success && Array.isArray(itensRes.data) ? itensRes.data : [];
    const farmacosArray = farmacosRes.success && Array.isArray(farmacosRes.data) ? farmacosRes.data : [];

    const alimentosMap = new Map(alimentosData.map((a: Food) => [a.id, a]));
    const itensComAlimentos = itensArray.map((item: any) => ({
      ...item,
      alimentos: alimentosMap.get(item.alimento_id) || null
    }));

    setItensDieta(itensComAlimentos);
    setFarmacos(farmacosArray);
  };

  const agruparPorRefeicao = (itens: any[]) => {
    const refeicoes: { [key: string]: any[] } = {};
    itens.forEach(item => {
      if (!refeicoes[item.refeicao]) {
        refeicoes[item.refeicao] = [];
      }
      refeicoes[item.refeicao].push(item);
    });
    return refeicoes;
  };

  const calcularMacros = (itens: any[]) => {
    return itens.reduce((total, item) => {
      if (!item.alimentos) return total;
      
      const fator = item.quantidade / item.alimentos.portion;
      return {
        totalCalorias: total.totalCalorias + (item.alimentos.calories * fator),
        totalProteinas: total.totalProteinas + (item.alimentos.protein * fator),
        totalCarboidratos: total.totalCarboidratos + (item.alimentos.carbs * fator),
        totalLipidios: total.totalLipidios + (item.alimentos.fat * fator)
      };
    }, { totalCalorias: 0, totalProteinas: 0, totalCarboidratos: 0, totalLipidios: 0 });
  };

  const handleVerSubstitutos = (item: any) => {
    setSubstitutionDialog({
      open: true,
      alimentoAtual: item.alimentos,
      quantidadeAtual: item.quantidade,
      itemId: item.id
    });
  };

  const handleSubstituir = async (novoAlimentoId: string, novaQuantidade: number) => {
    // Aqui você pode implementar a lógica de salvar a substituição no banco se quiser
    // Por enquanto, vamos apenas atualizar localmente
    const novosItens = itensDieta.map(item => {
      if (item.id === substitutionDialog.itemId) {
        const novoAlimento = todosAlimentos.find(a => a.id === novoAlimentoId);
        return {
          ...item,
          alimento_id: novoAlimentoId,
          quantidade: novaQuantidade,
          alimentos: novoAlimento
        };
      }
      return item;
    });
    setItensDieta(novosItens);
  };

  if (!dieta) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Utensils className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma dieta atribuída</h3>
          <p className="text-muted-foreground">
            Entre em contato com seu coach para receber sua dieta personalizada
          </p>
        </div>
      </div>
    );
  }

  const refeicoes = agruparPorRefeicao(itensDieta);
  const macros = calcularMacros(itensDieta);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Minha Dieta</h1>
        <p className="text-muted-foreground">{dieta.nome}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações da Dieta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <span className="font-medium">Objetivo:</span>{" "}
              <span className="text-muted-foreground">{dieta.objetivo || "Não especificado"}</span>
            </div>
            <div>
              <span className="font-medium">Criada em:</span>{" "}
              <span className="text-muted-foreground">
                {new Date(dieta.created_at).toLocaleDateString("pt-BR")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo Nutricional */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumo Nutricional Total</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">
                {Math.round(macros.totalCalorias)}
              </div>
              <div className="text-sm text-muted-foreground">Calorias</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {Math.round(macros.totalProteinas)}g
              </div>
              <div className="text-sm text-muted-foreground">Proteínas</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-warning">
                {Math.round(macros.totalCarboidratos)}g
              </div>
              <div className="text-sm text-muted-foreground">Carboidratos</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-destructive">
                {Math.round(macros.totalLipidios)}g
              </div>
              <div className="text-sm text-muted-foreground">Gorduras</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fármacos */}
      {farmacos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-primary" />
              Fármacos e Suplementos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {farmacos.map((farmaco) => (
                <div key={farmaco.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-lg">{farmaco.nome}</div>
                      <div className="text-muted-foreground">{farmaco.dosagem}</div>
                    </div>
                  </div>
                  {farmaco.observacao && (
                    <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                      {farmaco.observacao}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Refeições */}
      <div className="space-y-4">
        {Object.entries(refeicoes).map(([refeicao, itensRefeicao]) => (
          <Card key={refeicao}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Utensils className="h-5 w-5 text-primary" />
                {refeicao}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {itensRefeicao.map((item: any) => {
                  const fator = item.quantidade / item.alimentos.portion;
                  const calorias = Math.round(item.alimentos.calories * fator);
                  
                  return (
                    <div key={item.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                      <div className="flex-1">
                        <div className="font-medium text-lg">{item.alimentos.name}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {item.quantidade}g
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-sm">
                          {calorias} kcal
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVerSubstitutos(item)}
                        >
                          <Replace className="w-4 h-4 mr-2" />
                          Ver Substitutos
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <FoodSubstitutionDialog
        open={substitutionDialog.open}
        onOpenChange={(open) => setSubstitutionDialog({ ...substitutionDialog, open })}
        alimentoAtual={substitutionDialog.alimentoAtual}
        quantidadeAtual={substitutionDialog.quantidadeAtual}
        alimentosDisponiveis={todosAlimentos}
        onSubstituir={handleSubstituir}
      />
    </div>
  );
};

export default StudentDietView;
