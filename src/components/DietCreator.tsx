import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Users, Pill } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Food,
  getAllFoodsSafe,
  macroScaleFactor,
  QuantityUnit,
} from '@/lib/foodService';
import { listarSubstituicoesIsocaloricas } from '@/lib/foodEquivalence';
import { getAlunoDisplayName } from '@/lib/aluno-display';
import { DietReturnDateFields } from '@/components/DietReturnDateFields';
import DietRefeicaoLivreFields from '@/components/diet/DietRefeicaoLivreFields';
import DietCreatorMealsSection from '@/components/diet/DietCreatorMealsSection';
import DietCreatorNutritionSummary from '@/components/diet/DietCreatorNutritionSummary';
import {
  DietRotationFields,
  dietRotationFromRow,
  dietRotationToPayload,
  type DietRotationFormState,
} from '@/components/DietRotationFields';
import { DietRotationBadge } from '@/components/DietRotationBadge';
import {
  buildRefeicaoStorageLabel,
  splitRefeicaoForEditor,
  type DietPlano,
} from '@/lib/diet-student-utils';
type Alimento = Food;

interface Aluno {
  id: string;
  nome: string;
  email: string;
  objetivo: string;
}

interface ItemRefeicao {
  id: string;
  alimento_id: string;
  quantidade: number;
  /** Base da quantidade vs `food.portion` (ver macroScaleFactor em foodService). */
  unidade_quantidade: QuantityUnit;
  refeicao: string;
  alimento?: Alimento;
}

interface Refeicao {
  nome: string;
  /** Letra do cardápio (A, B, C…); vazio = refeição única / todos os dias */
  plano: DietPlano | '';
  itens: ItemRefeicao[];
}

function emptyRefeicao(nome: string): Refeicao {
  return { nome, plano: '', itens: [] };
}

function refeicaoLabel(refeicao: Refeicao): string {
  return buildRefeicaoStorageLabel(refeicao.nome, refeicao.plano || null);
}

function syncItensRefeicao(refeicao: Refeicao): Refeicao {
  const label = refeicaoLabel(refeicao);
  return {
    ...refeicao,
    itens: refeicao.itens.map((item) => ({ ...item, refeicao: label })),
  };
}

interface Farmaco {
  id: string;
  nome: string;
  dosagem: string;
  observacao: string;
}

interface DietCreatorProps {
  dietaId?: string;
}

function normalizeUnidadeItem(raw: unknown): QuantityUnit {
  const s = String(raw ?? 'g').toLowerCase().trim();
  if (s === 'ml' || s === 'un') return s;
  return 'g';
}

const DietCreator = ({ dietaId }: DietCreatorProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [alimentos, setAlimentos] = useState<Alimento[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [selectedAluno, setSelectedAluno] = useState<string>('');
  const [dietName, setDietName] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [refeicoes, setRefeicoes] = useState<Refeicao[]>([
    emptyRefeicao('Café da Manhã'),
    emptyRefeicao('Almoço'),
    emptyRefeicao('Jantar'),
  ]);
  const [farmacos, setFarmacos] = useState<Farmaco[]>([]);
  const [dataRetorno, setDataRetorno] = useState('');
  const [diasValidade, setDiasValidade] = useState('');
  const [rotacao, setRotacao] = useState<DietRotationFormState>({
    rotacao_ativa: false,
    blocos: [
      { plano: 'A', dias: '3' },
      { plano: 'B', dias: '1' },
    ],
    rotacao_data_inicio: '',
  });
  const [refeicaoLivreAtiva, setRefeicaoLivreAtiva] = useState(false);
  const [refeicaoLivreObservacao, setRefeicaoLivreObservacao] = useState('');
  const [refeicaoLivreContentId, setRefeicaoLivreContentId] = useState<string | null>(null);
  const [editingDietaId, setEditingDietaId] = useState<string | null>(null);
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
        getAllFoodsSafe(),
        apiClient.getAlunosByCoachSafe()
      ]);

      setAlimentos(alimentosRes.success && Array.isArray(alimentosRes.data) ? alimentosRes.data : []);
      setAlunos(alunosRes.success && Array.isArray(alunosRes.data) ? alunosRes.data : []);
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

      // O parâmetro da rota pode ser ID da dieta OU ID do aluno.
      // Primeiro tenta por ID da dieta; se não encontrar, tenta pela dieta mais recente do aluno.
      let dieta: any = null;
      let dietaIdResolvido: string | null = null;

      const dietaByIdResult = await apiClient.requestSafe<any>(`/api/dietas/${dietaId}`);
      if (dietaByIdResult.success && dietaByIdResult.data) {
        dieta = dietaByIdResult.data;
        dietaIdResolvido = dieta.id;
      } else {
        const dietasAlunoResult = await apiClient.requestSafe<any[]>(`/api/dietas?aluno_id=${dietaId}`);
        const dietasAluno = dietasAlunoResult.success && Array.isArray(dietasAlunoResult.data)
          ? dietasAlunoResult.data
          : [];
        const maisRecente = dietasAluno.sort(
          (a, b) => new Date(b.data_criacao || 0).getTime() - new Date(a.data_criacao || 0).getTime()
        )[0] || null;

        if (maisRecente) {
          dieta = maisRecente;
          dietaIdResolvido = maisRecente.id;
        }
      }

      if (!dieta || !dietaIdResolvido) {
        // Sem dieta existente: tratar rota como criação para aluno específico.
        setEditingDietaId(null);
        setSelectedAluno(dietaId);
        return;
      }
      setEditingDietaId(dietaIdResolvido);

      // Buscar dados do aluno separadamente (joins não suportados ainda)
      const alunoResult = await apiClient.requestSafe<any>(`/api/alunos/${dieta.aluno_id}`);
      const aluno = alunoResult.success ? alunoResult.data : null;

      // Carregar itens da dieta e fármacos
      const [itensRes, farmacosRes] = await Promise.all([
        apiClient.requestSafe<any[]>(`/api/itens-dieta?dieta_id=${dietaIdResolvido}`),
        apiClient.requestSafe<any[]>(`/api/dieta-farmacos?dieta_id=${dietaIdResolvido}`)
      ]);

      const itens = itensRes.success && Array.isArray(itensRes.data) ? itensRes.data : [];
      const farmacosData = farmacosRes.success && Array.isArray(farmacosRes.data) ? farmacosRes.data : [];

      // Buscar alimentos para cada item
      let alimentosBase: Alimento[] = alimentos;
      if (alimentosBase.length === 0) {
        const alimentosRes = await getAllFoodsSafe();
        alimentosBase = alimentosRes.success && Array.isArray(alimentosRes.data) ? alimentosRes.data : [];
      }
      const alimentosMap = new Map((Array.isArray(alimentosBase) ? alimentosBase : []).map((a: Alimento) => [a.id, a]));
      const itensComAlimentos = await Promise.all(
        itens.map(async (item) => {
          if (item.alimento_id) {
            return {
              ...item,
              alimentos: alimentosMap.get(item.alimento_id) || null
            };
          }
          return { ...item, alimentos: null };
        })
      );

      // Preencher os dados
      setDietName(dieta.nome);
      setObjetivo(dieta.objetivo || '');
      setSelectedAluno(dieta.aluno_id);
      const retornoRaw = dieta.data_retorno;
      setDataRetorno(
        retornoRaw ? String(retornoRaw).slice(0, 10) : '',
      );
      setDiasValidade('');
      setRotacao(dietRotationFromRow(dieta));
      setRefeicaoLivreAtiva(Boolean(dieta.refeicao_livre_ativa));
      setRefeicaoLivreObservacao(dieta.refeicao_livre_observacao || '');
      setRefeicaoLivreContentId(dieta.refeicao_livre_content_id || null);

      // Reorganizar itens por refeição - usar nomes únicos do banco
      const nomesRefeicoesBanco = [...new Set(itensComAlimentos.map(item => item.refeicao))];
      
      // Se não houver itens, usar refeições padrão
      const nomesRefeicoes = nomesRefeicoesBanco.length > 0 
        ? nomesRefeicoesBanco 
        : ['Café da Manhã', 'Almoço', 'Jantar'];
      
      const novasRefeicoes = nomesRefeicoes.map((nomeRefeicao) => {
        const { nome, plano } = splitRefeicaoForEditor(nomeRefeicao);
        const itensRefeicao = itensComAlimentos
          .filter((item) => item.refeicao === nomeRefeicao)
          .map((item) => ({
            id: item.id,
            alimento_id: item.alimento_id || '',
            quantidade: typeof item.quantidade === 'string' ? parseFloat(item.quantidade) || 0 : (item.quantidade || 0),
            unidade_quantidade: normalizeUnidadeItem(item.unidade_quantidade),
            refeicao: nomeRefeicao,
            alimento: item.alimentos as Alimento,
          }));

        return syncItensRefeicao({ nome, plano, itens: itensRefeicao });
      });

      setRefeicoes(novasRefeicoes);

      // Carregar fármacos
      if (farmacosData) {
        setFarmacos(farmacosData.map(f => ({
          id: f.id,
          nome: f.nome,
          dosagem: f.dosagem,
          observacao: f.observacao || ''
        })));
      }

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

  const adicionarFarmaco = () => {
    const novoFarmaco: Farmaco = {
      id: Math.random().toString(36).substr(2, 9),
      nome: '',
      dosagem: '',
      observacao: ''
    };
    setFarmacos([...farmacos, novoFarmaco]);
  };

  const removerFarmaco = (farmacoIndex: number) => {
    setFarmacos(farmacos.filter((_, index) => index !== farmacoIndex));
  };

  const atualizarFarmaco = (farmacoIndex: number, campo: keyof Farmaco, valor: string) => {
    const novosFarmacos = [...farmacos];
    novosFarmacos[farmacoIndex] = {
      ...novosFarmacos[farmacoIndex],
      [campo]: valor
    };
    setFarmacos(novosFarmacos);
  };

  const calcularSubstituicoes = (item: ItemRefeicao): Array<{nome: string, quantidade: number, nutriente: string}> => {
    if (!item.alimento) return [];
    const quantidade = typeof item.quantidade === 'string'
      ? parseFloat(item.quantidade) || 0
      : (item.quantidade || 0);

    return listarSubstituicoesIsocaloricas(
      item.alimento,
      quantidade,
      item.unidade_quantidade || 'g',
      alimentos,
      { limit: 3 },
    ).map((s) => ({
      nome: s.alimento.name,
      quantidade: Math.round(s.quantidadeEquivalente),
      nutriente: `${s.kcalEquivalente.toFixed(0)} kcal`,
    }));
  };

  const calcularTotaisRefeicao = (refeicao: Refeicao) => {
    return refeicao.itens.reduce((total, item) => {
      if (!item.alimento) return total;
      
      // Garantir que quantidade seja número
      const quantidade = typeof item.quantidade === 'string' ? parseFloat(item.quantidade) || 0 : (item.quantidade || 0);
      const quantidadeRef = item.alimento.portion || 100;

      const fator = macroScaleFactor(quantidade, item.unidade_quantidade, quantidadeRef);
      
      // Garantir que valores nutricionais sejam números
      const kcal = item.alimento.calories || 0;
      const ptn = item.alimento.protein || 0;
      const cho = item.alimento.carbs || 0;
      const lip = item.alimento.fat || 0;
      
      return {
        kcal: total.kcal + (kcal * fator),
        proteinas: total.proteinas + (ptn * fator),
        carboidratos: total.carboidratos + (cho * fator),
        lipidios: total.lipidios + (lip * fator)
      };
    }, { kcal: 0, proteinas: 0, carboidratos: 0, lipidios: 0 });
  };

  const salvarDieta = async () => {
    // Se estamos editando uma dieta existente, não precisa validar aluno/nome
    if (!editingDietaId) {
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
      let dietaIdAtual = editingDietaId;

      // Se não há dietaId, criar nova dieta
      if (!dietaIdAtual) {
        const createResult = await apiClient.requestSafe<any>('/api/dietas', {
          method: 'POST',
          body: JSON.stringify({
            nome: dietName,
            objetivo: objetivo,
            aluno_id: selectedAluno,
            data_retorno: dataRetorno || null,
            ...dietRotationToPayload(rotacao),
            refeicao_livre_ativa: refeicaoLivreAtiva,
            refeicao_livre_observacao: refeicaoLivreObservacao.trim() || null,
            refeicao_livre_content_id: refeicaoLivreContentId,
          }),
        });
        dietaIdAtual = createResult.success ? createResult.data?.id : null;
        if (!dietaIdAtual) throw new Error('Erro ao criar dieta');
      } else {
        // Atualizar dieta existente
        const updateResult = await apiClient.requestSafe(`/api/dietas/${dietaIdAtual}`, {
          method: 'PATCH',
          body: JSON.stringify({
            nome: dietName,
            objetivo: objetivo,
            data_retorno: dataRetorno || null,
            ...dietRotationToPayload(rotacao),
            refeicao_livre_ativa: refeicaoLivreAtiva,
            refeicao_livre_observacao: refeicaoLivreObservacao.trim() || null,
            refeicao_livre_content_id: refeicaoLivreContentId,
          }),
        });
        if (!updateResult.success) {
          throw new Error(updateResult.error || 'Erro ao atualizar dieta');
        }

        // Remover itens e fármacos antigos
        // Buscar IDs primeiro
        const itensRes = await apiClient.requestSafe<any[]>(`/api/itens-dieta?dieta_id=${dietaIdAtual}`);
        const farmacosRes = await apiClient.requestSafe<any[]>(`/api/dieta-farmacos?dieta_id=${dietaIdAtual}`);
        const itensAntigos = itensRes.success && Array.isArray(itensRes.data) ? itensRes.data : [];
        const farmacosAntigos = farmacosRes.success && Array.isArray(farmacosRes.data) ? farmacosRes.data : [];
        
        // Deletar cada um
        if (Array.isArray(itensAntigos)) {
          for (const item of itensAntigos) {
            await apiClient.requestSafe(`/api/itens-dieta/${item.id}`, { method: 'DELETE' });
          }
        }
        if (Array.isArray(farmacosAntigos)) {
          for (const farmaco of farmacosAntigos) {
            await apiClient.requestSafe(`/api/dieta-farmacos/${farmaco.id}`, { method: 'DELETE' });
          }
        }
      }

      // Salvar itens da dieta
      const itensParaSalvar = refeicoes.flatMap(refeicao =>
        refeicao.itens
          .filter(item => item.alimento_id !== '')
          .map(item => ({
            dieta_id: dietaIdAtual,
            alimento_id: item.alimento_id,
            quantidade: item.quantidade,
            unidade_quantidade: item.unidade_quantidade || 'g',
            refeicao: refeicaoLabel(refeicao),
          }))
      );

      if (itensParaSalvar.length > 0) {
        const itensResult = await apiClient.requestSafe('/api/itens-dieta', {
          method: 'POST',
          body: JSON.stringify(itensParaSalvar),
        });
        if (!itensResult.success) {
          throw new Error(itensResult.error || 'Erro ao salvar itens');
        }
      }

      // Salvar fármacos
      const farmacosParaSalvar = farmacos
        .filter(f => f.nome.trim() !== '' && f.dosagem.trim() !== '')
        .map(f => ({
          dieta_id: dietaIdAtual,
          nome: f.nome,
          dosagem: f.dosagem,
          observacao: f.observacao || null
        }));

      if (farmacosParaSalvar.length > 0) {
        const farmacosResult = await apiClient.requestSafe('/api/dieta-farmacos', {
          method: 'POST',
          body: JSON.stringify(farmacosParaSalvar),
        });
        if (!farmacosResult.success) {
          throw new Error(farmacosResult.error || 'Erro ao salvar fármacos');
        }
      }

      toast({
        title: "Sucesso!",
        description: editingDietaId ? "Dieta atualizada com sucesso" : "Dieta criada com sucesso"
      });

      // Se estamos editando, voltar para a lista de dietas
      if (editingDietaId) {
        setTimeout(() => {
          navigate('/?tab=nutrition');
        }, 1000);
      } else {
        // Se criamos nova, limpar formulário
        setDietName('');
        setObjetivo('');
        setSelectedAluno('');
        setRefeicoes([
          emptyRefeicao('Café da Manhã'),
          emptyRefeicao('Almoço'),
          emptyRefeicao('Jantar'),
        ]);
        setFarmacos([]);
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
        <div className="motion-safe:animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    );
  }

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
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Informações da Dieta</CardTitle>
            {editingDietaId ? <DietRotationBadge config={rotacao} /> : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aluno">Aluno</Label>
              <Combobox
                options={alunos.map((aluno) => ({
                  value: aluno.id,
                  label: getAlunoDisplayName(aluno),
                  description: aluno.objetivo?.trim() || undefined,
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

          <DietReturnDateFields
            dataRetorno={dataRetorno}
            diasValidade={diasValidade}
            onDataRetornoChange={setDataRetorno}
            onDiasValidadeChange={setDiasValidade}
          />

          <DietRotationFields value={rotacao} onChange={setRotacao} />
        </CardContent>
      </Card>

      <DietRefeicaoLivreFields
        ativa={refeicaoLivreAtiva}
        observacao={refeicaoLivreObservacao}
        contentId={refeicaoLivreContentId}
        onAtivaChange={setRefeicaoLivreAtiva}
        onObservacaoChange={setRefeicaoLivreObservacao}
        onContentIdChange={setRefeicaoLivreContentId}
      />

      <DietCreatorNutritionSummary
        refeicoes={refeicoes}
        calcularTotaisRefeicao={calcularTotaisRefeicao}
      />

      {/* Fármacos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="w-5 h-5" />
            Fármacos e Suplementos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {farmacos.length === 0 ? (
            <Alert>
              <AlertDescription>
                Nenhum fármaco adicionado ainda. Clique no botão abaixo para adicionar.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {farmacos.map((farmaco, index) => (
                <div key={farmaco.id} className="border rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Nome</Label>
                      <Input
                        value={farmaco.nome}
                        onChange={(e) => atualizarFarmaco(index, 'nome', e.target.value)}
                        placeholder="Ex: Vitamina D3"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Dosagem</Label>
                      <Input
                        value={farmaco.dosagem}
                        onChange={(e) => atualizarFarmaco(index, 'dosagem', e.target.value)}
                        placeholder="Ex: 2000 UI/dia"
                      />
                    </div>

                    <div className="flex items-end">
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => removerFarmaco(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Observação</Label>
                    <Textarea
                      value={farmaco.observacao}
                      onChange={(e) => atualizarFarmaco(index, 'observacao', e.target.value)}
                      placeholder="Ex: Tomar pela manhã junto com o café"
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            onClick={adicionarFarmaco}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Fármaco
          </Button>
        </CardContent>
      </Card>

      <DietCreatorMealsSection
        refeicoes={refeicoes}
        alimentos={alimentos}
        rotacao={rotacao}
        onRefeicoesChange={setRefeicoes}
        calcularSubstituicoes={calcularSubstituicoes}
        calcularTotaisRefeicao={calcularTotaisRefeicao}
        refeicaoLabel={refeicaoLabel}
        syncItensRefeicao={syncItensRefeicao}
        emptyRefeicao={emptyRefeicao}
      />

      <div className="flex justify-end">
        <Button onClick={salvarDieta} size="lg" className="px-8">
          Salvar Dieta
        </Button>
      </div>
    </div>
  );
};

export default DietCreator;