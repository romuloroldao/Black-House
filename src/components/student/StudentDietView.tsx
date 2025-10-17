import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Utensils } from "lucide-react";

const StudentDietView = () => {
  const { user } = useAuth();
  const [dieta, setDieta] = useState<any>(null);
  const [itensDieta, setItensDieta] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      loadDietData();
    }
  }, [user]);

  const loadDietData = async () => {
    const { data: aluno } = await supabase
      .from("alunos")
      .select("id")
      .eq("email", user?.email)
      .single();

    if (aluno) {
      const { data: dietaData } = await supabase
        .from("dietas")
        .select("*")
        .eq("aluno_id", aluno.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (dietaData) {
        setDieta(dietaData);

        const { data: itens } = await supabase
          .from("itens_dieta")
          .select("*, alimentos(*)")
          .eq("dieta_id", dietaData.id);

        setItensDieta(itens || []);
      }
    }
  };

  const diasSemana = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  
  const getItensPorDia = (dia: string) => {
    return itensDieta.filter(item => item.dia_semana === dia);
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
    let totalCalorias = 0;
    let totalProteinas = 0;
    let totalCarboidratos = 0;
    let totalLipidios = 0;

    itens.forEach(item => {
      const fator = item.quantidade / 100;
      totalCalorias += item.alimentos.kcal * fator;
      totalProteinas += item.alimentos.proteinas * fator;
      totalCarboidratos += item.alimentos.carboidratos * fator;
      totalLipidios += item.alimentos.lipidios * fator;
    });

    return { totalCalorias, totalProteinas, totalCarboidratos, totalLipidios };
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Minha Dieta</h1>
        <p className="text-muted-foreground">{dieta.nome}</p>
      </div>

      <Card className="shadow-card">
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

      <Tabs defaultValue="Segunda" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          {diasSemana.map(dia => (
            <TabsTrigger key={dia} value={dia}>
              {dia.substring(0, 3)}
            </TabsTrigger>
          ))}
        </TabsList>

        {diasSemana.map(dia => {
          const itens = getItensPorDia(dia);
          const refeicoes = agruparPorRefeicao(itens);
          const macros = calcularMacros(itens);

          return (
            <TabsContent key={dia} value={dia} className="space-y-4">
              {itens.length === 0 ? (
                <Card className="shadow-card">
                  <CardContent className="p-6 text-center text-muted-foreground">
                    Nenhuma refeição planejada para este dia
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card className="shadow-card">
                    <CardHeader>
                      <CardTitle className="text-lg">Resumo Diário</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-primary">
                            {Math.round(macros.totalCalorias)}
                          </div>
                          <div className="text-sm text-muted-foreground">Calorias</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold">
                            {Math.round(macros.totalProteinas)}g
                          </div>
                          <div className="text-sm text-muted-foreground">Proteínas</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold">
                            {Math.round(macros.totalCarboidratos)}g
                          </div>
                          <div className="text-sm text-muted-foreground">Carboidratos</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold">
                            {Math.round(macros.totalLipidios)}g
                          </div>
                          <div className="text-sm text-muted-foreground">Gorduras</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {Object.entries(refeicoes).map(([refeicao, itensRefeicao]) => (
                    <Card key={refeicao} className="shadow-card">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Utensils className="h-5 w-5 text-primary" />
                          {refeicao}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {itensRefeicao.map(item => (
                            <div key={item.id} className="flex items-start justify-between p-3 rounded-lg bg-muted/50">
                              <div className="flex-1">
                                <div className="font-medium">{item.alimentos.nome}</div>
                                <div className="text-sm text-muted-foreground">
                                  {item.quantidade}g
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge variant="outline">
                                  {Math.round((item.alimentos.kcal * item.quantidade) / 100)} kcal
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
};

export default StudentDietView;
