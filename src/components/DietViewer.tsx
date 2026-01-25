import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { Food, getAllFoodsSafe, getMacroGroup } from '@/lib/foodService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Calendar, Eye, Calculator, ChefHat, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface Dieta {
  id: string;
  nome: string;
  objetivo: string;
  data_criacao: string;
  aluno: {
    nome: string;
    email: string;
  };
}

interface ItemDieta {
  id: string;
  quantidade: number;
  refeicao: string;
  alimento: {
    id: number;
    name: string;
    portion: number;
    calories: number;
    carbs: number;
    protein: number;
    fat: number;
    group: string;
  };
}

interface DietaCompleta extends Dieta {
  itens: ItemDieta[];
}

const DietViewer = () => {
  const navigate = useNavigate();
  const [dietas, setDietas] = useState<Dieta[]>([]);
  const [dietaSelecionada, setDietaSelecionada] = useState<DietaCompleta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);

  useEffect(() => {
    carregarDietas();
  }, []);

  const carregarDietas = async () => {
    try {
      const [dietasRes, alunosRes] = await Promise.all([
        apiClient.requestSafe<any[]>('/api/dietas'),
        apiClient.requestSafe<any[]>('/api/alunos'),
      ]);
      const dietasData = dietasRes.success && Array.isArray(dietasRes.data) ? dietasRes.data : [];
      const alunosData = alunosRes.success && Array.isArray(alunosRes.data) ? alunosRes.data : [];
      const alunosMap = new Map(alunosData.map((a: any) => [a.id, a]));

      const dietasFormatadas = dietasData
        .sort((a: any, b: any) => new Date(b.data_criacao || 0).getTime() - new Date(a.data_criacao || 0).getTime())
        .map((dieta: any) => {
          const aluno = alunosMap.get(dieta.aluno_id);
          return {
            ...dieta,
            aluno: aluno || { nome: 'Aluno não encontrado', email: '' }
          };
        });
      setDietas(dietasFormatadas);
    } catch (error) {
      console.error('Erro ao carregar dietas:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarDetalhesDieta = async (dietaId: string) => {
    setLoadingDetalhes(true);
    try {
      const dietaRes = await apiClient.requestSafe<any>(`/api/dietas/${dietaId}`);
      const dieta = dietaRes.success ? dietaRes.data : null;
      if (!dieta) throw new Error('Dieta não encontrada');

      // Buscar dados do aluno
      const alunoRes = await apiClient.requestSafe<any>(`/api/alunos/${dieta.aluno_id}`);
      const aluno = alunoRes.success ? alunoRes.data : null;

      // Buscar itens da dieta
      const itensRes = await apiClient.requestSafe<any[]>(`/api/itens-dieta?dieta_id=${dietaId}`);
      const itens = itensRes.success && Array.isArray(itensRes.data) ? itensRes.data : [];

      const alimentosRes = await getAllFoodsSafe();
      const alimentosData = alimentosRes.success && Array.isArray(alimentosRes.data) ? alimentosRes.data : [];
      const alimentosMap = new Map(alimentosData.map((a: Food) => [a.id, a]));

      // Buscar dados dos alimentos para cada item
      const itensCompletos = await Promise.all(
        itens.map(async (item: any) => {
          const alimento = alimentosMap.get(item.alimento_id) || null;
          
          // Garantir que quantidade seja número
          const quantidade = typeof item.quantidade === 'string' ? parseFloat(item.quantidade) || 0 : (item.quantidade || 0);
          
          return {
            ...item,
            quantidade: quantidade,
            alimento: alimento ? {
              id: Number(alimento.id),
              name: alimento.name,
              portion: alimento.portion,
              calories: alimento.calories,
              carbs: alimento.carbs,
              protein: alimento.protein,
              fat: alimento.fat,
              group: getMacroGroup(alimento)
            } : { id: 0, name: 'Alimento não encontrado', portion: 0, calories: 0, carbs: 0, protein: 0, fat: 0, group: 'mixed' }
          };
        })
      );

      const dietaCompleta: DietaCompleta = {
        ...dieta,
        aluno: aluno || { nome: 'Aluno não encontrado', email: '' },
        itens: itensCompletos
      };

      setDietaSelecionada(dietaCompleta);
    } catch (error) {
      console.error('Erro ao carregar detalhes da dieta:', error);
    } finally {
      setLoadingDetalhes(false);
    }
  };

  const calcularSubstituicoes = (item: ItemDieta, alimentos: Food[]) => {
    const alimento = item.alimento;
    let nutrienteDominante: keyof Pick<typeof alimento, 'protein' | 'carbs' | 'fat'> = 'protein';
    
    if (alimento.group === 'carb') nutrienteDominante = 'carbs';
    if (alimento.group === 'fat') nutrienteDominante = 'fat';

    const valorOriginal = alimento[nutrienteDominante];
    if (valorOriginal === 0) return [];

    return alimentos
      .filter(a => 
        getMacroGroup(a) === alimento.group && 
        a.id !== String(alimento.id) &&
        (nutrienteDominante === 'protein' ? a.protein : nutrienteDominante === 'carbs' ? a.carbs : a.fat) > 0
      )
      .map(sub => {
        const valorSub = nutrienteDominante === 'protein' ? sub.protein : nutrienteDominante === 'carbs' ? sub.carbs : sub.fat;
        const qtdEquivalente = (item.quantidade * valorOriginal) / valorSub;
        return {
          nome: sub.name,
          quantidade: Math.round(qtdEquivalente * 10) / 10,
          nutriente: nutrienteDominante === 'protein' ? 'Proteínas' : 
                    nutrienteDominante === 'carbs' ? 'Carboidratos' : 'Lipídios'
        };
      })
      .slice(0, 3);
  };

  const calcularTotaisRefeicao = (itens: ItemDieta[], refeicao: string) => {
    return itens
      .filter(item => item.refeicao === refeicao)
      .reduce((total, item) => {
        const fator = item.quantidade / item.alimento.portion;
        return {
          kcal: total.kcal + (item.alimento.calories * fator),
          proteinas: total.proteinas + (item.alimento.protein * fator),
          carboidratos: total.carboidratos + (item.alimento.carbs * fator),
          lipidios: total.lipidios + (item.alimento.fat * fator)
        };
      }, { kcal: 0, proteinas: 0, carboidratos: 0, lipidios: 0 });
  };

  const calcularTotaisDieta = (itens: ItemDieta[]) => {
    return itens.reduce((total, item) => {
      const fator = item.quantidade / item.alimento.portion;
      return {
        kcal: total.kcal + (item.alimento.calories * fator),
        proteinas: total.proteinas + (item.alimento.protein * fator),
        carboidratos: total.carboidratos + (item.alimento.carbs * fator),
        lipidios: total.lipidios + (item.alimento.fat * fator)
      };
    }, { kcal: 0, proteinas: 0, carboidratos: 0, lipidios: 0 });
  };

  const handleEditarDieta = (dietaId: string) => {
    navigate(`/dieta/${dietaId}`);
  };

  const handleExcluirDieta = async (dietaId: string) => {
    try {
      // Primeiro excluir os itens da dieta
      // Nota: apiClient.delete() pode precisar de filtro diferente, então vamos buscar IDs primeiro
      const itensRes = await apiClient.requestSafe<any[]>(`/api/itens-dieta?dieta_id=${dietaId}`);
      const itens = itensRes.success && Array.isArray(itensRes.data) ? itensRes.data : [];
      for (const item of itens) {
        await apiClient.requestSafe(`/api/itens-dieta/${item.id}`, { method: 'DELETE' });
      }

      // Depois excluir a dieta
      await apiClient.requestSafe(`/api/dietas/${dietaId}`, { method: 'DELETE' });

      toast.success('Dieta excluída com sucesso!');
      carregarDietas();
    } catch (error) {
      console.error('Erro ao excluir dieta:', error);
      toast.error('Erro ao excluir dieta. Tente novamente.');
    }
  };

  const refeicoesPadrao = ['Café da Manhã', 'Lanche da Manhã', 'Almoço', 'Lanche da Tarde', 'Jantar', 'Ceia'];

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <ChefHat className="w-8 h-8" />
          Dietas Criadas
        </h1>
        <p className="text-muted-foreground mt-2">
          Visualize e gerencie as dietas dos seus alunos
        </p>
      </div>

      {dietas.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Nenhuma dieta criada ainda. Comece criando uma nova dieta!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dietas.map((dieta) => (
            <Card key={dieta.id} className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">{dieta.nome}</CardTitle>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{dieta.aluno?.nome}</p>
                  <Badge variant="outline">{dieta.objetivo}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Calendar className="w-4 h-4" />
                  {new Date(dieta.data_criacao).toLocaleDateString('pt-BR')}
                </div>
                
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditarDieta(dieta.id)}
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja excluir a dieta "{dieta.nome}"? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleExcluirDieta(dieta.id)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => carregarDetalhesDieta(dieta.id)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Ver Dieta
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{dietaSelecionada?.nome}</DialogTitle>
                      </DialogHeader>
                      
                      {loadingDetalhes ? (
                        <div className="space-y-4">
                          <div className="animate-pulse">
                            <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                            <div className="h-4 bg-muted rounded w-3/4"></div>
                          </div>
                        </div>
                      ) : dietaSelecionada && (
                        <div className="space-y-6">
                          {/* Informações da dieta */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-medium">Aluno:</p>
                              <p className="text-sm text-muted-foreground">{dietaSelecionada.aluno.nome}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Objetivo:</p>
                              <p className="text-sm text-muted-foreground">{dietaSelecionada.objetivo}</p>
                            </div>
                          </div>

                          {/* Totais gerais */}
                          {dietaSelecionada.itens.length > 0 && (
                            <Card>
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                  <Calculator className="w-4 h-4" />
                                  Resumo Nutricional Total
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                {(() => {
                                  const totais = calcularTotaisDieta(dietaSelecionada.itens);
                                  return (
                                    <div className="grid grid-cols-4 gap-4 text-center">
                                      <div>
                                        <div className="text-lg font-bold text-primary">{Math.round(totais.kcal)}</div>
                                        <div className="text-xs text-muted-foreground">Calorias</div>
                                      </div>
                                      <div>
                                        <div className="text-lg font-bold text-primary">{Math.round(totais.proteinas)}g</div>
                                        <div className="text-xs text-muted-foreground">Proteínas</div>
                                      </div>
                                      <div>
                                        <div className="text-lg font-bold text-warning">{Math.round(totais.carboidratos)}g</div>
                                        <div className="text-xs text-muted-foreground">Carboidratos</div>
                                      </div>
                                      <div>
                                        <div className="text-lg font-bold text-destructive">{Math.round(totais.lipidios)}g</div>
                                        <div className="text-xs text-muted-foreground">Lipídios</div>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </CardContent>
                            </Card>
                          )}

                          {/* Refeições */}
                          <div className="space-y-4">
                            {refeicoesPadrao.map(nomeRefeicao => {
                              const itensRefeicao = dietaSelecionada.itens.filter(item => item.refeicao === nomeRefeicao);
                              if (itensRefeicao.length === 0) return null;

                              const totaisRefeicao = calcularTotaisRefeicao(dietaSelecionada.itens, nomeRefeicao);

                              return (
                                <div key={nomeRefeicao} className="border rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-semibold">{nomeRefeicao}</h3>
                                    <div className="flex gap-2 text-xs">
                                      <Badge variant="outline">{Math.round(totaisRefeicao.kcal)} kcal</Badge>
                                      <Badge variant="outline">{Math.round(totaisRefeicao.proteinas)}g prot</Badge>
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    {itensRefeicao.map(item => (
                                      <div key={item.id} className="border rounded p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <span className="font-medium">{item.alimento.name}</span>
                                          <span className="text-sm text-muted-foreground">
                                            {item.quantidade}g - {Math.round((item.alimento.calories * item.quantidade) / item.alimento.portion)} kcal
                                          </span>
                                        </div>

                                        {/* Substituições */}
                                        <div className="text-xs">
                                          <p className="font-medium text-muted-foreground mb-1">Pode substituir por:</p>
                                          <div className="flex flex-wrap gap-1">
                                            {calcularSubstituicoes(item, []).map((sub, idx) => (
                                              <Badge key={idx} variant="secondary" className="text-xs">
                                                {sub.nome} - {sub.quantidade}g
                                              </Badge>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DietViewer;