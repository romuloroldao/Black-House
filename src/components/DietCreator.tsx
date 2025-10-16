import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, Calculator, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Alimento {
  id: number;
  nome: string;
  quantidade: number;
  kcal: number;
  carboidratos: number;
  proteinas: number;
  lipidios: number;
  grupo: string;
}

interface Aluno {
  id: string;
  nome: string;
  email: string;
  objetivo: string;
}

interface ItemRefeicao {
  id: string;
  alimento_id: number;
  quantidade: number;
  refeicao: string;
  alimento?: Alimento;
}

interface Refeicao {
  nome: string;
  itens: ItemRefeicao[];
}

interface DietCreatorProps {
  dietaId?: string;
}

const DietCreator = ({ dietaId }: DietCreatorProps) => {
  const navigate = useNavigate();
  const [alimentos, setAlimentos] = useState<Alimento[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [selectedAluno, setSelectedAluno] = useState<string>('');
  const [dietName, setDietName] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [refeicoes, setRefeicoes] = useState<Refeicao[]>([
    { nome: 'Café da Manhã', itens: [] },
    { nome: 'Almoço', itens: [] },
    { nome: 'Jantar', itens: [] }
  ]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    if (dietaId) {
      carregarDietaExistente();
    }
  }, [dietaId]);

  const carregarDados = async () => {
    try {
      const [alimentosRes, alunosRes] = await Promise.all([
        supabase.from('alimentos').select('*').order('nome'),
        supabase.from('alunos').select('*').order('nome')
      ]);

      if (alimentosRes.error) throw alimentosRes.error;
      if (alunosRes.error) throw alunosRes.error;

      setAlimentos(alimentosRes.data || []);
      setAlunos(alunosRes.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar dados",
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    } finally {
      setLoading(false);
    }
  };

  const carregarDietaExistente = async () => {
    if (!dietaId) return;
    
    try {
      setLoading(true);

      // Carregar dados da dieta
      const { data: dieta, error: dietaError } = await supabase
        .from('dietas')
        .select('*, alunos(id, nome, email, objetivo)')
        .eq('id', dietaId)
        .single();

      if (dietaError) throw dietaError;

      // Carregar itens da dieta
      const { data: itens, error: itensError } = await supabase
        .from('itens_dieta')
        .select('*, alimentos(*)')
        .eq('dieta_id', dietaId);

      if (itensError) throw itensError;

      // Preencher os dados
      setDietName(dieta.nome);
      setObjetivo(dieta.objetivo || '');
      setSelectedAluno(dieta.aluno_id);

      // Reorganizar itens por refeição
      const refeicoesPadrao = ['Café da Manhã', 'Almoço', 'Jantar'];
      const novasRefeicoes = refeicoesPadrao.map(nomeRefeicao => {
        const itensRefeicao = (itens || [])
          .filter(item => item.refeicao === nomeRefeicao)
          .map(item => ({
            id: item.id,
            alimento_id: item.alimento_id || 0,
            quantidade: item.quantidade,
            refeicao: nomeRefeicao,
            alimento: item.alimentos as Alimento
          }));

        return {
          nome: nomeRefeicao,
          itens: itensRefeicao
        };
      });

      setRefeicoes(novasRefeicoes);

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar dieta",
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    } finally {
      setLoading(false);
    }
  };

  const adicionarItem = (refeicaoIndex: number) => {
    const novoItem: ItemRefeicao = {
      id: Math.random().toString(36).substr(2, 9),
      alimento_id: 0,
      quantidade: 100,
      refeicao: refeicoes[refeicaoIndex].nome
    };

    const novasRefeicoes = [...refeicoes];
    novasRefeicoes[refeicaoIndex].itens.push(novoItem);
    setRefeicoes(novasRefeicoes);
  };

  const removerItem = (refeicaoIndex: number, itemIndex: number) => {
    const novasRefeicoes = [...refeicoes];
    novasRefeicoes[refeicaoIndex].itens.splice(itemIndex, 1);
    setRefeicoes(novasRefeicoes);
  };

  const adicionarRefeicao = () => {
    const novaRefeicao: Refeicao = {
      nome: `Refeição ${refeicoes.length + 1}`,
      itens: []
    };
    setRefeicoes([...refeicoes, novaRefeicao]);
  };

  const removerRefeicao = (refeicaoIndex: number) => {
    if (refeicoes.length > 1) {
      const novasRefeicoes = refeicoes.filter((_, index) => index !== refeicaoIndex);
      setRefeicoes(novasRefeicoes);
    }
  };

  const editarNomeRefeicao = (refeicaoIndex: number, novoNome: string) => {
    const novasRefeicoes = [...refeicoes];
    novasRefeicoes[refeicaoIndex].nome = novoNome;
    setRefeicoes(novasRefeicoes);
  };

  const atualizarItem = (refeicaoIndex: number, itemIndex: number, campo: keyof ItemRefeicao, valor: any) => {
    const novasRefeicoes = [...refeicoes];
    novasRefeicoes[refeicaoIndex].itens[itemIndex] = {
      ...novasRefeicoes[refeicaoIndex].itens[itemIndex],
      [campo]: valor
    };

    // Se mudou o alimento, buscar os dados
    if (campo === 'alimento_id') {
      const alimento = alimentos.find(a => a.id === Number(valor));
      if (alimento) {
        novasRefeicoes[refeicaoIndex].itens[itemIndex].alimento = alimento;
      }
    }

    setRefeicoes(novasRefeicoes);
  };

  const calcularSubstituicoes = (item: ItemRefeicao): Array<{nome: string, quantidade: number, nutriente: string}> => {
    if (!item.alimento) return [];
    
    const alimento = item.alimento;
    let nutrienteDominante: keyof Pick<Alimento, 'proteinas' | 'carboidratos' | 'lipidios'> = 'proteinas';
    
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

  const calcularTotaisRefeicao = (refeicao: Refeicao) => {
    return refeicao.itens.reduce((total, item) => {
      if (!item.alimento) return total;
      
      const fator = item.quantidade / item.alimento.quantidade;
      return {
        kcal: total.kcal + (item.alimento.kcal * fator),
        proteinas: total.proteinas + (item.alimento.proteinas * fator),
        carboidratos: total.carboidratos + (item.alimento.carboidratos * fator),
        lipidios: total.lipidios + (item.alimento.lipidios * fator)
      };
    }, { kcal: 0, proteinas: 0, carboidratos: 0, lipidios: 0 });
  };

  const calcularTotaisDieta = () => {
    return refeicoes.reduce((total, refeicao) => {
      const totaisRefeicao = calcularTotaisRefeicao(refeicao);
      return {
        kcal: total.kcal + totaisRefeicao.kcal,
        proteinas: total.proteinas + totaisRefeicao.proteinas,
        carboidratos: total.carboidratos + totaisRefeicao.carboidratos,
        lipidios: total.lipidios + totaisRefeicao.lipidios
      };
    }, { kcal: 0, proteinas: 0, carboidratos: 0, lipidios: 0 });
  };

  const salvarDieta = async () => {
    // Se estamos editando uma dieta existente, não precisa validar aluno/nome
    if (!dietaId) {
      if (!selectedAluno || !dietName) {
        toast({
          variant: "destructive",
          title: "Dados incompletos",
          description: "Selecione um aluno e digite o nome da dieta"
        });
        return;
      }
    }

    try {
      let dietaIdAtual = dietaId;

      // Se não há dietaId, criar nova dieta
      if (!dietaIdAtual) {
        const { data: dieta, error: dietaError } = await supabase
          .from('dietas')
          .insert({
            nome: dietName,
            objetivo: objetivo,
            aluno_id: selectedAluno
          })
          .select()
          .single();

        if (dietaError) throw dietaError;
        dietaIdAtual = dieta.id;
      } else {
        // Atualizar dieta existente
        const { error: updateError } = await supabase
          .from('dietas')
          .update({
            nome: dietName,
            objetivo: objetivo
          })
          .eq('id', dietaIdAtual);

        if (updateError) throw updateError;

        // Remover itens antigos
        await supabase
          .from('itens_dieta')
          .delete()
          .eq('dieta_id', dietaIdAtual);
      }

      // Salvar itens da dieta
      const itensParaSalvar = refeicoes.flatMap(refeicao =>
        refeicao.itens
          .filter(item => item.alimento_id > 0)
          .map(item => ({
            dieta_id: dietaIdAtual,
            alimento_id: item.alimento_id,
            quantidade: item.quantidade,
            refeicao: refeicao.nome
          }))
      );

      if (itensParaSalvar.length > 0) {
        const { error: itensError } = await supabase
          .from('itens_dieta')
          .insert(itensParaSalvar);

        if (itensError) throw itensError;
      }

      toast({
        title: "Sucesso!",
        description: dietaId ? "Dieta atualizada com sucesso" : "Dieta criada com sucesso"
      });

      // Se estamos editando, voltar para página do aluno
      if (dietaId && selectedAluno) {
        setTimeout(() => {
          navigate(`/alunos/${selectedAluno}`);
        }, 1000);
      } else if (!dietaId) {
        // Se criamos nova, limpar formulário
        setDietName('');
        setObjetivo('');
        setSelectedAluno('');
        setRefeicoes([
          { nome: 'Café da Manhã', itens: [] },
          { nome: 'Almoço', itens: [] },
          { nome: 'Jantar', itens: [] }
        ]);
      }

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar dieta",
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const totaisDieta = calcularTotaisDieta();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Users className="w-8 h-8" />
          Criador de Dietas
        </h1>
        <p className="text-muted-foreground mt-2">
          Crie dietas personalizadas com substituições automáticas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações da Dieta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aluno">Aluno</Label>
              <Combobox
                options={alunos.map(aluno => ({
                  value: aluno.id,
                  label: aluno.nome,
                  description: aluno.objetivo
                }))}
                value={selectedAluno}
                onSelect={setSelectedAluno}
                placeholder="Selecione um aluno"
                searchPlaceholder="Buscar aluno..."
                emptyText="Nenhum aluno encontrado."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome da Dieta</Label>
              <Input
                id="nome"
                value={dietName}
                onChange={(e) => setDietName(e.target.value)}
                placeholder="Ex: Dieta para Ganho de Massa"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="objetivo">Objetivo</Label>
            <Input
              id="objetivo"
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              placeholder="Ex: Ganho de massa muscular"
            />
          </div>
        </CardContent>
      </Card>

      {/* Resumo Nutricional */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Resumo Nutricional Total
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{Math.round(totaisDieta.kcal)}</div>
              <div className="text-sm text-muted-foreground">Calorias</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{Math.round(totaisDieta.proteinas)}g</div>
              <div className="text-sm text-muted-foreground">Proteínas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-warning">{Math.round(totaisDieta.carboidratos)}g</div>
              <div className="text-sm text-muted-foreground">Carboidratos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-destructive">{Math.round(totaisDieta.lipidios)}g</div>
              <div className="text-sm text-muted-foreground">Lipídios</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Refeições */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Refeições</h2>
          <Button onClick={adicionarRefeicao} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Refeição
          </Button>
        </div>
        
        {refeicoes.map((refeicao, refeicaoIndex) => {
          const totaisRefeicao = calcularTotaisRefeicao(refeicao);
          
          return (
            <Card key={refeicaoIndex}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={refeicao.nome}
                      onChange={(e) => editarNomeRefeicao(refeicaoIndex, e.target.value)}
                      className="font-semibold bg-transparent border-none p-0 h-auto text-lg"
                    />
                    {refeicoes.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removerRefeicao(refeicaoIndex)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2 text-sm">
                    <Badge variant="outline">{Math.round(totaisRefeicao.kcal)} kcal</Badge>
                    <Badge variant="outline">{Math.round(totaisRefeicao.proteinas)}g prot</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {refeicao.itens.map((item, itemIndex) => (
                  <div key={item.id} className="border rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="space-y-2">
                        <Label>Alimento</Label>
                        <Combobox
                          options={alimentos.map(alimento => ({
                            value: alimento.id.toString(),
                            label: alimento.nome,
                            description: `${alimento.grupo} - ${alimento.kcal}kcal/100g`
                          }))}
                          value={item.alimento_id > 0 ? item.alimento_id.toString() : ''}
                          onSelect={(value) => atualizarItem(refeicaoIndex, itemIndex, 'alimento_id', Number(value))}
                          placeholder="Selecione um alimento"
                          searchPlaceholder="Buscar alimento..."
                          emptyText="Nenhum alimento encontrado."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Quantidade (g/ml)</Label>
                        <Input
                          type="number"
                          value={item.quantidade}
                          onChange={(e) => atualizarItem(refeicaoIndex, itemIndex, 'quantidade', Number(e.target.value))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Calorias</Label>
                        <div className="flex items-center h-10 px-3 border rounded-md bg-muted">
                          {item.alimento ? Math.round((item.alimento.kcal * item.quantidade) / item.alimento.quantidade) : 0}
                        </div>
                      </div>

                      <div className="flex items-end">
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => removerItem(refeicaoIndex, itemIndex)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Substituições */}
                    {item.alimento && (
                      <div className="pt-3 border-t">
                        <Label className="text-sm font-medium text-muted-foreground">Substituições equivalentes:</Label>
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                          {calcularSubstituicoes(item).map((sub, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                              <span>{sub.nome}</span>
                              <Badge variant="secondary">{sub.quantidade}g ({sub.nutriente})</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <Button
                  variant="outline"
                  onClick={() => adicionarItem(refeicaoIndex)}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Alimento
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={salvarDieta} size="lg" className="px-8">
          Salvar Dieta
        </Button>
      </div>
    </div>
  );
};

export default DietCreator;