import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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
    nome: string;
    quantidade: number;
    kcal: number;
    carboidratos: number;
    proteinas: number;
    lipidios: number;
    grupo: string;
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
      const { data, error } = await supabase
        .from('dietas')
        .select(`
          id,
          nome,
          objetivo,
          data_criacao,
          alunos:aluno_id (
            nome,
            email
          )
        `)
        .order('data_criacao', { ascending: false });

      if (error) throw error;
      
      const dietasFormatadas = data?.map(dieta => ({
        ...dieta,
        aluno: dieta.alunos as any
      })) || [];
      
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
      const { data: dieta, error: dietaError } = await supabase
        .from('dietas')
        .select(`
          id,
          nome,
          objetivo,
          data_criacao,
          alunos:aluno_id (
            nome,
            email
          )
        `)
        .eq('id', dietaId)
        .single();

      if (dietaError) throw dietaError;

      const { data: itens, error: itensError } = await supabase
        .from('itens_dieta')
        .select(`
          id,
          quantidade,
          refeicao,
          alimentos:alimento_id (
            id,
            nome,
            quantidade,
            kcal,
            carboidratos,
            proteinas,
            lipidios,
            grupo
          )
        `)
        .eq('dieta_id', dietaId);

      if (itensError) throw itensError;

      const dietaCompleta: DietaCompleta = {
        ...dieta,
        aluno: dieta.alunos as any,
        itens: itens?.map(item => ({
          ...item,
          alimento: item.alimentos as any
        })) || []
      };

      setDietaSelecionada(dietaCompleta);
    } catch (error) {
      console.error('Erro ao carregar detalhes da dieta:', error);
    } finally {
      setLoadingDetalhes(false);
    }
  };

  const calcularSubstituicoes = (item: ItemDieta, alimentos: any[]) => {
    const alimento = item.alimento;
    let nutrienteDominante: keyof Pick<typeof alimento, 'proteinas' | 'carboidratos' | 'lipidios'> = 'proteinas';
    
    if (alimento.grupo === 'Carboidrato') nutrienteDominante = 'carboidratos';
    if (alimento.grupo === 'Lipídio') nutrienteDominante = 'lipidios';

    const valorOriginal = alimento[nutrienteDominante];
    if (valorOriginal === 0) return [];

    return alimentos
      .filter(a => 
        a.grupo === alimento.grupo && 
        a.id !== alimento.id &&
        a[nutrienteDominante] > 0
      )
      .map(sub => {
        const valorSub = sub[nutrienteDominante];
        const qtdEquivalente = (item.quantidade * valorOriginal) / valorSub;
        return {
          nome: sub.nome,
          quantidade: Math.round(qtdEquivalente * 10) / 10,
          nutriente: nutrienteDominante === 'proteinas' ? 'Proteínas' : 
                    nutrienteDominante === 'carboidratos' ? 'Carboidratos' : 'Lipídios'
        };
      })
      .slice(0, 3);
  };

  const calcularTotaisRefeicao = (itens: ItemDieta[], refeicao: string) => {
    return itens
      .filter(item => item.refeicao === refeicao)
      .reduce((total, item) => {
        const fator = item.quantidade / item.alimento.quantidade;
        return {
          kcal: total.kcal + (item.alimento.kcal * fator),
          proteinas: total.proteinas + (item.alimento.proteinas * fator),
          carboidratos: total.carboidratos + (item.alimento.carboidratos * fator),
          lipidios: total.lipidios + (item.alimento.lipidios * fator)
        };
      }, { kcal: 0, proteinas: 0, carboidratos: 0, lipidios: 0 });
  };

  const calcularTotaisDieta = (itens: ItemDieta[]) => {
    return itens.reduce((total, item) => {
      const fator = item.quantidade / item.alimento.quantidade;
      return {
        kcal: total.kcal + (item.alimento.kcal * fator),
        proteinas: total.proteinas + (item.alimento.proteinas * fator),
        carboidratos: total.carboidratos + (item.alimento.carboidratos * fator),
        lipidios: total.lipidios + (item.alimento.lipidios * fator)
      };
    }, { kcal: 0, proteinas: 0, carboidratos: 0, lipidios: 0 });
  };

  const handleEditarDieta = (dietaId: string) => {
    navigate(`/dieta/${dietaId}`);
  };

  const handleExcluirDieta = async (dietaId: string) => {
    try {
      // Primeiro excluir os itens da dieta
      const { error: itensError } = await supabase
        .from('itens_dieta')
        .delete()
        .eq('dieta_id', dietaId);

      if (itensError) throw itensError;

      // Depois excluir a dieta
      const { error: dietaError } = await supabase
        .from('dietas')
        .delete()
        .eq('id', dietaId);

      if (dietaError) throw dietaError;

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
                                          <span className="font-medium">{item.alimento.nome}</span>
                                          <span className="text-sm text-muted-foreground">
                                            {item.quantidade}g - {Math.round((item.alimento.kcal * item.quantidade) / item.alimento.quantidade)} kcal
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