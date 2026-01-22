import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { Utensils, Replace, Pill } from "lucide-react";
import FoodSubstitutionDialog from "@/components/nutrition/FoodSubstitutionDialog";

const StudentDietView = () => {
  const { user } = useAuth();
  const [dieta, setDieta] = useState<any>(null);
  const [itensDieta, setItensDieta] = useState<any[]>([]);
  const [farmacos, setFarmacos] = useState<any[]>([]);
  const [todosAlimentos, setTodosAlimentos] = useState<any[]>([]);
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
    try {
      // Carregar todos os alimentos para substituições
      const alimentosData = await apiClient
        .from("alimentos")
        .select("*")
        .order("nome");
      
      setTodosAlimentos(Array.isArray(alimentosData) ? alimentosData : []);

      // DESIGN-ALUNO-CANONICO-MIGRATION-006: Usar rota canônica GET /api/alunos/me
      const aluno = await apiClient.getMe();

      if (aluno) {
        const dietas = await apiClient
          .from("dietas")
          .select("*")
          .eq("aluno_id", aluno.id)
          .order("created_at", { ascending: false })
          .limit(1);
        
        const dietaData = Array.isArray(dietas) && dietas.length > 0 ? dietas[0] : null;

        if (dietaData) {
          setDieta(dietaData);

          const [itensArray, farmacosArray] = await Promise.all([
            apiClient
              .from("itens_dieta")
              .select("*")
              .eq("dieta_id", dietaData.id),
            apiClient
              .from("dieta_farmacos")
              .select("*")
              .eq("dieta_id", dietaData.id)
          ]);

          // Buscar alimentos para cada item
          const itensComAlimentos = await Promise.all(
            (Array.isArray(itensArray) ? itensArray : []).map(async (item) => {
              if (item.alimento_id) {
                const alimentos = await apiClient
                  .from("alimentos")
                  .select("*")
                  .eq("id", item.alimento_id);
                return {
                  ...item,
                  alimentos: Array.isArray(alimentos) && alimentos.length > 0 ? alimentos[0] : null
                };
              }
              return { ...item, alimentos: null };
            })
          );

          setItensDieta(itensComAlimentos);
          setFarmacos(Array.isArray(farmacosArray) ? farmacosArray : []);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dieta:", error);
    }
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
      
      const fator = item.quantidade / item.alimentos.quantidade_referencia_g;
      return {
        totalCalorias: total.totalCalorias + (item.alimentos.kcal_por_referencia * fator),
        totalProteinas: total.totalProteinas + (item.alimentos.ptn_por_referencia * fator),
        totalCarboidratos: total.totalCarboidratos + (item.alimentos.cho_por_referencia * fator),
        totalLipidios: total.totalLipidios + (item.alimentos.lip_por_referencia * fator)
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
                  const fator = item.quantidade / item.alimentos.quantidade_referencia_g;
                  const calorias = Math.round(item.alimentos.kcal_por_referencia * fator);
                  
                  return (
                    <div key={item.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                      <div className="flex-1">
                        <div className="font-medium text-lg">{item.alimentos.nome}</div>
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
