import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Upload, 
  FileText, 
  User, 
  Utensils, 
  Pill, 
  Check, 
  AlertCircle,
  ChevronRight,
  Loader2,
  Trash2,
  Plus,
  Edit2
} from 'lucide-react';

interface ParsedStudentData {
  aluno: {
    nome: string;
    peso?: number;
    altura?: number;
    idade?: number;
    objetivo?: string;
  };
  dieta?: {
    nome: string;
    objetivo?: string;
    refeicoes: Array<{
      nome: string;
      alimentos: Array<{
        nome: string;
        quantidade: string;
      }>;
    }>;
    macros?: {
      proteina?: number;
      carboidrato?: number;
      gordura?: number;
      calorias?: number;
    };
  };
  suplementos?: Array<{
    nome: string;
    dosagem: string;
    observacao?: string;
  }>;
  farmacos?: Array<{
    nome: string;
    dosagem: string;
    observacao?: string;
  }>;
  orientacoes?: string;
}

interface StudentImporterProps {
  onImportComplete?: () => void;
  onClose?: () => void;
}

const StudentImporter = ({ onImportComplete, onClose }: StudentImporterProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedStudentData | null>(null);
  const [editableData, setEditableData] = useState<ParsedStudentData | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'review' | 'complete'>('upload');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast.error('Por favor, selecione um arquivo PDF');
        return;
      }
      setFile(selectedFile);
      setParsedData(null);
      setEditableData(null);
      setCurrentStep('upload');
    }
  };

  const processFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke('parse-student-pdf', {
        body: { pdfBase64: base64, fileName: file.name }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setParsedData(data.data);
      setEditableData(JSON.parse(JSON.stringify(data.data))); // Deep clone
      setCurrentStep('review');
      toast.success('PDF processado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao processar PDF:', error);
      toast.error(error.message || 'Erro ao processar PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  // Update functions for editable data
  const updateAluno = (field: keyof ParsedStudentData['aluno'], value: string | number) => {
    if (!editableData) return;
    setEditableData({
      ...editableData,
      aluno: { ...editableData.aluno, [field]: value }
    });
  };

  const updateDieta = (field: 'nome' | 'objetivo', value: string) => {
    if (!editableData?.dieta) return;
    setEditableData({
      ...editableData,
      dieta: { ...editableData.dieta, [field]: value }
    });
  };

  const updateRefeicao = (refeicaoIdx: number, field: 'nome', value: string) => {
    if (!editableData?.dieta) return;
    const newRefeicoes = [...editableData.dieta.refeicoes];
    newRefeicoes[refeicaoIdx] = { ...newRefeicoes[refeicaoIdx], [field]: value };
    setEditableData({
      ...editableData,
      dieta: { ...editableData.dieta, refeicoes: newRefeicoes }
    });
  };

  const updateAlimento = (refeicaoIdx: number, alimentoIdx: number, field: 'nome' | 'quantidade', value: string) => {
    if (!editableData?.dieta) return;
    const newRefeicoes = [...editableData.dieta.refeicoes];
    const newAlimentos = [...newRefeicoes[refeicaoIdx].alimentos];
    newAlimentos[alimentoIdx] = { ...newAlimentos[alimentoIdx], [field]: value };
    newRefeicoes[refeicaoIdx] = { ...newRefeicoes[refeicaoIdx], alimentos: newAlimentos };
    setEditableData({
      ...editableData,
      dieta: { ...editableData.dieta, refeicoes: newRefeicoes }
    });
  };

  const removeAlimento = (refeicaoIdx: number, alimentoIdx: number) => {
    if (!editableData?.dieta) return;
    const newRefeicoes = [...editableData.dieta.refeicoes];
    newRefeicoes[refeicaoIdx].alimentos = newRefeicoes[refeicaoIdx].alimentos.filter((_, i) => i !== alimentoIdx);
    setEditableData({
      ...editableData,
      dieta: { ...editableData.dieta, refeicoes: newRefeicoes }
    });
  };

  const addAlimento = (refeicaoIdx: number) => {
    if (!editableData?.dieta) return;
    const newRefeicoes = [...editableData.dieta.refeicoes];
    newRefeicoes[refeicaoIdx].alimentos.push({ nome: '', quantidade: '' });
    setEditableData({
      ...editableData,
      dieta: { ...editableData.dieta, refeicoes: newRefeicoes }
    });
  };

  const updateFarmaco = (idx: number, field: 'nome' | 'dosagem' | 'observacao', value: string) => {
    if (!editableData?.farmacos) return;
    const newFarmacos = [...editableData.farmacos];
    newFarmacos[idx] = { ...newFarmacos[idx], [field]: value };
    setEditableData({ ...editableData, farmacos: newFarmacos });
  };

  const removeFarmaco = (idx: number) => {
    if (!editableData?.farmacos) return;
    setEditableData({
      ...editableData,
      farmacos: editableData.farmacos.filter((_, i) => i !== idx)
    });
  };

  const addFarmaco = () => {
    setEditableData({
      ...editableData!,
      farmacos: [...(editableData?.farmacos || []), { nome: '', dosagem: '', observacao: '' }]
    });
  };

  const updateSuplemento = (idx: number, field: 'nome' | 'dosagem' | 'observacao', value: string) => {
    if (!editableData?.suplementos) return;
    const newSupl = [...editableData.suplementos];
    newSupl[idx] = { ...newSupl[idx], [field]: value };
    setEditableData({ ...editableData, suplementos: newSupl });
  };

  const removeSuplemento = (idx: number) => {
    if (!editableData?.suplementos) return;
    setEditableData({
      ...editableData,
      suplementos: editableData.suplementos.filter((_, i) => i !== idx)
    });
  };

  const addSuplemento = () => {
    setEditableData({
      ...editableData!,
      suplementos: [...(editableData?.suplementos || []), { nome: '', dosagem: '', observacao: '' }]
    });
  };

  const importStudent = async () => {
    if (!editableData) return;

    // Validation
    if (!editableData.aluno.nome.trim()) {
      toast.error('Nome do aluno é obrigatório');
      return;
    }

    setIsImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: aluno, error: alunoError } = await supabase
        .from('alunos')
        .insert({
          nome: editableData.aluno.nome.trim(),
          peso: editableData.aluno.peso || null,
          objetivo: editableData.aluno.objetivo?.trim() || null,
          coach_id: user.id,
          email: `${editableData.aluno.nome.toLowerCase().replace(/\s+/g, '.')}@importado.temp`
        })
        .select()
        .single();

      if (alunoError) throw alunoError;

      if (editableData.dieta && editableData.dieta.refeicoes?.length > 0) {
        const { data: dieta, error: dietaError } = await supabase
          .from('dietas')
          .insert({
            nome: editableData.dieta.nome?.trim() || 'Plano Alimentar Importado',
            objetivo: editableData.dieta.objetivo?.trim() || null,
            aluno_id: aluno.id
          })
          .select()
          .single();

        if (dietaError) throw dietaError;

        // Fetch existing foods to match
        const { data: alimentosExistentes } = await supabase
          .from('alimentos')
          .select('id, nome');

        const alimentosMap = new Map<string, string>();
        const alimentosList: Array<{ id: string; nome: string; nomeNorm: string }> = [];
        (alimentosExistentes || []).forEach(a => {
          const nomeNorm = a.nome.toLowerCase().trim()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remove acentos
          alimentosMap.set(nomeNorm, a.id);
          alimentosList.push({ id: a.id, nome: a.nome, nomeNorm });
        });

        // Helper function to normalize text for comparison
        const normalizeText = (text: string): string => {
          return text.toLowerCase().trim()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/[^a-z0-9\s]/g, ' ') // Remove caracteres especiais
            .replace(/\s+/g, ' '); // Normaliza espaços
        };

        // Mapeamento de grupos genéricos para alimentos específicos
        const gruposParaAlimentos: Record<string, string[]> = {
          'carnes e proteinas': ['peito de frango', 'carne bovina', 'carne vermelha', 'patinho'],
          'feijao e leguminosas': ['feijao', 'feijão', 'feijao carioca', 'feijao preto'],
          'vegetais a': ['brocolis', 'alface', 'couve', 'espinafre', 'tomate'],
          'vegetais b': ['cenoura', 'beterraba', 'abobora', 'chuchu'],
          'paes e variedades': ['pao de forma', 'pao frances', 'tapioca'],
          'personalizado - prot': ['peito de frango', 'carne bovina'],
          'personalizado - carb': ['arroz branco', 'batata doce', 'macarrao'],
          'personalizado - lip': ['azeite', 'oleaginosas', 'castanha'],
        };

        // Helper function to find matching food with improved algorithm
        const findMatchingAlimento = (nomeAlimento: string): string | null => {
          const nomeNormalizado = normalizeText(nomeAlimento);
          
          // 1. Exact match
          if (alimentosMap.has(nomeNormalizado)) {
            return alimentosMap.get(nomeNormalizado)!;
          }
          
          // 2. Check if it's a generic group and map to first available food
          for (const [grupo, opcoes] of Object.entries(gruposParaAlimentos)) {
            if (nomeNormalizado.includes(grupo) || grupo.includes(nomeNormalizado)) {
              for (const opcao of opcoes) {
                const opcaoNorm = normalizeText(opcao);
                for (const alimento of alimentosList) {
                  if (alimento.nomeNorm.includes(opcaoNorm) || opcaoNorm.includes(alimento.nomeNorm)) {
                    return alimento.id;
                  }
                }
              }
            }
          }
          
          // 3. Word-based matching - find foods that share significant words
          const palavrasAlimento = nomeNormalizado.split(' ').filter(p => p.length > 2);
          let melhorMatch: { id: string; score: number } | null = null;
          
          for (const alimento of alimentosList) {
            const palavrasBase = alimento.nomeNorm.split(' ').filter(p => p.length > 2);
            let score = 0;
            
            for (const palavra of palavrasAlimento) {
              for (const palavraBase of palavrasBase) {
                if (palavraBase.includes(palavra) || palavra.includes(palavraBase)) {
                  score += palavra.length; // Pontuação baseada no tamanho da palavra
                }
              }
            }
            
            if (score > 0 && (!melhorMatch || score > melhorMatch.score)) {
              melhorMatch = { id: alimento.id, score };
            }
          }
          
          // Retorna apenas se tiver um score mínimo significativo
          if (melhorMatch && melhorMatch.score >= 4) {
            return melhorMatch.id;
          }
          
          // 4. Partial string match as fallback
          for (const alimento of alimentosList) {
            if (alimento.nomeNorm.includes(nomeNormalizado) || nomeNormalizado.includes(alimento.nomeNorm)) {
              return alimento.id;
            }
          }
          
          return null;
        };

        // Map meal names to standard names
        const mapRefeicaoName = (nome: string): string => {
          const nomeNormalizado = nome.toLowerCase().trim();
          
          // Direct mappings
          const mappings: Record<string, string> = {
            'refeição 1': 'Café da Manhã',
            'refeicao 1': 'Café da Manhã',
            'ref 1': 'Café da Manhã',
            'refeição 2': 'Lanche da Manhã',
            'refeicao 2': 'Lanche da Manhã',
            'ref 2': 'Lanche da Manhã',
            'refeição 3': 'Almoço',
            'refeicao 3': 'Almoço',
            'ref 3': 'Almoço',
            'refeição 4': 'Lanche da Tarde',
            'refeicao 4': 'Lanche da Tarde',
            'ref 4': 'Lanche da Tarde',
            'refeição 5': 'Jantar',
            'refeicao 5': 'Jantar',
            'ref 5': 'Jantar',
            'refeição 6': 'Ceia',
            'refeicao 6': 'Ceia',
            'ref 6': 'Ceia',
            'café da manhã': 'Café da Manhã',
            'cafe da manha': 'Café da Manhã',
            'lanche da manhã': 'Lanche da Manhã',
            'lanche da manha': 'Lanche da Manhã',
            'almoço': 'Almoço',
            'almoco': 'Almoço',
            'lanche da tarde': 'Lanche da Tarde',
            'jantar': 'Jantar',
            'ceia': 'Ceia',
          };
          
          return mappings[nomeNormalizado] || nome;
        };

        // Import diet items (refeicoes)
        const itensToInsert: Array<{
          dieta_id: string;
          alimento_id: string;
          quantidade: number;
          refeicao: string;
        }> = [];

        const alimentosCadastrados: string[] = [];

        // Helper to determine food type based on name
        const inferirTipoAlimento = (nome: string): string => {
          const nomeNorm = normalizeText(nome);
          
          // Proteínas
          if (/frango|carne|peixe|atum|sardinha|ovo|peito|patinho|file|tilapia|salmao|camarao|lagosta|porco|peru|chester|linguica|bacon|presunto|mortadela|salsicha|whey|albumina|caseina/.test(nomeNorm)) {
            return '33acba74-bbc2-446a-8476-401693c56baf'; // Proteínas
          }
          
          // Carboidratos
          if (/arroz|batata|macarrao|pao|aveia|tapioca|mandioca|inhame|milho|cereal|granola|biscoito|bolacha|torrada|cuscuz|quinoa|feijao|lentilha|grao de bico/.test(nomeNorm)) {
            return 'dea776a3-f586-40bb-a945-6f466b8c3e31'; // Carboidratos
          }
          
          // Lipídeos
          if (/azeite|oleo|manteiga|castanha|amendoim|nozes|amendoa|abacate|coco|linhaça|chia|gergelim|pasta de amendoim|oleaginosa/.test(nomeNorm)) {
            return 'e5863a2d-695d-46a7-9ef5-d7e3cf87ee1c'; // Lipídeos
          }
          
          // Frutas
          if (/banana|maca|laranja|morango|uva|manga|mamao|melao|melancia|abacaxi|pera|pessego|kiwi|limao|acerola|goiaba|maracuja|framboesa|mirtilo|amora|fruta/.test(nomeNorm)) {
            return 'c0a07056-794b-424a-acd6-14215b9be248'; // Frutas
          }
          
          // Vegetais
          if (/alface|tomate|cenoura|brocolis|couve|espinafre|pepino|abobrinha|berinjela|pimentao|cebola|alho|rucula|agriã|repolho|beterraba|vegetal|legume|salada|verdura/.test(nomeNorm)) {
            return '92b02101-c685-4fd7-956d-51fd21673690'; // Vegetais
          }
          
          // Laticínios
          if (/leite|queijo|iogurte|requeijao|cream cheese|ricota|cottage|nata|creme de leite/.test(nomeNorm)) {
            return 'b46fa5f1-7333-4313-a747-9ea6efbfe3a7'; // Laticínios
          }
          
          // Default: Carboidratos (mais comum em dietas)
          return 'dea776a3-f586-40bb-a945-6f466b8c3e31';
        };

        // Helper to infer protein origin
        const inferirOrigemPtn = (nome: string): string => {
          const nomeNorm = normalizeText(nome);
          
          if (/frango|carne|peixe|ovo|atum|sardinha|peito|patinho|file|tilapia|salmao|camarao|porco|peru|presunto|whey|albumina|caseina|leite|queijo|iogurte/.test(nomeNorm)) {
            return 'animal';
          }
          
          if (/feijao|lentilha|grao de bico|soja|tofu|quinoa|ervilha|amendoim|castanha/.test(nomeNorm)) {
            return 'vegetal';
          }
          
          return 'misto';
        };

        // Function to create new food automatically
        const criarAlimentoAutomatico = async (nomeAlimento: string, quantidade: string): Promise<string | null> => {
          try {
            const tipoId = inferirTipoAlimento(nomeAlimento);
            const origemPtn = inferirOrigemPtn(nomeAlimento);
            
            // Parse quantity to determine reference amount
            const qtdMatch = quantidade.match(/[\d.,]+/);
            const qtdReferencia = qtdMatch ? parseFloat(qtdMatch[0].replace(',', '.')) : 100;
            
            // Default nutritional values (can be edited later)
            const { data: novoAlimento, error } = await supabase
              .from('alimentos')
              .insert({
                nome: nomeAlimento.trim(),
                tipo_id: tipoId,
                origem_ptn: origemPtn,
                quantidade_referencia_g: qtdReferencia || 100,
                kcal_por_referencia: 100, // Valor padrão
                ptn_por_referencia: 10,   // Valor padrão
                cho_por_referencia: 10,   // Valor padrão
                lip_por_referencia: 5,    // Valor padrão
                info_adicional: 'Cadastrado automaticamente via importação de PDF',
                autor: user.id
              })
              .select('id')
              .single();

            if (error) {
              console.error('Erro ao criar alimento:', nomeAlimento, error);
              return null;
            }

            alimentosCadastrados.push(nomeAlimento);
            return novoAlimento.id;
          } catch (err) {
            console.error('Erro ao criar alimento automaticamente:', err);
            return null;
          }
        };

        for (const refeicao of editableData.dieta.refeicoes) {
          const refeicaoNome = mapRefeicaoName(refeicao.nome);
          
          for (const alimento of refeicao.alimentos) {
            if (!alimento.nome.trim()) continue;
            
            let alimentoId = findMatchingAlimento(alimento.nome);
            
            // Se não encontrou, cria automaticamente
            if (!alimentoId) {
              alimentoId = await criarAlimentoAutomatico(alimento.nome, alimento.quantidade);
            }
            
            if (alimentoId) {
              // Parse quantity - extract number from string like "100g" or "2 unidades"
              const qtdMatch = alimento.quantidade.match(/[\d.,]+/);
              const quantidade = qtdMatch ? parseFloat(qtdMatch[0].replace(',', '.')) : 100;
              
              itensToInsert.push({
                dieta_id: dieta.id,
                alimento_id: alimentoId,
                quantidade: quantidade,
                refeicao: refeicaoNome
              });
            }
          }
        }

        if (itensToInsert.length > 0) {
          const { error: itensError } = await supabase.from('itens_dieta').insert(itensToInsert);
          if (itensError) {
            console.error('Erro ao inserir itens da dieta:', itensError);
            toast.error('Erro ao salvar alguns itens da dieta');
          }
        }

        // Import farmacos
        if (editableData.farmacos && editableData.farmacos.length > 0) {
          const farmacosInsert = editableData.farmacos
            .filter(f => f.nome.trim())
            .map(f => ({
              dieta_id: dieta.id,
              nome: f.nome.trim(),
              dosagem: f.dosagem.trim(),
              observacao: f.observacao?.trim() || null
            }));

          if (farmacosInsert.length > 0) {
            await supabase.from('dieta_farmacos').insert(farmacosInsert);
          }
        }

        // Import suplementos
        if (editableData.suplementos && editableData.suplementos.length > 0) {
          const suplementosInsert = editableData.suplementos
            .filter(s => s.nome.trim())
            .map(s => ({
              dieta_id: dieta.id,
              nome: s.nome.trim(),
              dosagem: s.dosagem.trim(),
              observacao: s.observacao?.trim() || 'Suplemento'
            }));

          if (suplementosInsert.length > 0) {
            await supabase.from('dieta_farmacos').insert(suplementosInsert);
          }
        }

        // Show detailed feedback
        const totalAlimentos = editableData.dieta.refeicoes.reduce(
          (acc, r) => acc + r.alimentos.filter(a => a.nome.trim()).length, 0
        );
        const importados = itensToInsert.length;
        
        if (alimentosCadastrados.length > 0) {
          toast.info(
            `${alimentosCadastrados.length} novo(s) alimento(s) cadastrado(s): ${alimentosCadastrados.slice(0, 3).join(', ')}${alimentosCadastrados.length > 3 ? ` e mais ${alimentosCadastrados.length - 3}` : ''}`
          );
        }
        
        if (importados === totalAlimentos) {
          toast.success(`Todos os ${totalAlimentos} alimentos foram importados!`);
        } else if (importados > 0) {
          toast.success(`${importados} de ${totalAlimentos} alimentos importados com sucesso!`);
        } else if (totalAlimentos > 0) {
          toast.error('Erro ao importar alimentos da dieta.');
        }
      }

      setCurrentStep('complete');
      toast.success(`Aluno "${editableData.aluno.nome}" importado com sucesso!`);
      onImportComplete?.();
    } catch (error: any) {
      console.error('Erro ao importar:', error);
      toast.error(error.message || 'Erro ao importar aluno');
    } finally {
      setIsImporting(false);
    }
  };

  const resetImporter = () => {
    setFile(null);
    setParsedData(null);
    setEditableData(null);
    setCurrentStep('upload');
  };

  return (
    <div className="space-y-6">
      {/* Steps indicator */}
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 ${currentStep === 'upload' ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-green-500 text-white'}`}>
            {currentStep === 'upload' ? '1' : <Check className="w-4 h-4" />}
          </div>
          <span className="font-medium text-sm">Upload</span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
        <div className={`flex items-center gap-2 ${currentStep === 'review' ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'review' ? 'bg-primary text-primary-foreground' : currentStep === 'complete' ? 'bg-green-500 text-white' : 'bg-muted'}`}>
            {currentStep === 'complete' ? <Check className="w-4 h-4" /> : '2'}
          </div>
          <span className="font-medium text-sm">Revisar</span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
        <div className={`flex items-center gap-2 ${currentStep === 'complete' ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'complete' ? 'bg-green-500 text-white' : 'bg-muted'}`}>
            {currentStep === 'complete' ? <Check className="w-4 h-4" /> : '3'}
          </div>
          <span className="font-medium text-sm">Concluído</span>
        </div>
      </div>

      {/* Upload Step */}
      {currentStep === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload do PDF
            </CardTitle>
            <CardDescription>
              Faça upload da ficha do aluno em formato PDF. O sistema irá extrair automaticamente os dados usando IA.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                id="pdf-upload"
                disabled={isProcessing}
              />
              <label htmlFor="pdf-upload" className="cursor-pointer">
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="text-muted-foreground">Processando PDF com IA...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <FileText className="w-12 h-12 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Clique para selecionar ou arraste o PDF</p>
                      <p className="text-sm text-muted-foreground">Apenas arquivos PDF são aceitos</p>
                    </div>
                  </div>
                )}
              </label>
            </div>

            {file && !isProcessing && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
                <Button onClick={processFile} size="sm">
                  Processar PDF
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>O sistema extrai automaticamente: dados do aluno, dieta, refeições, suplementos e fármacos.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Step */}
      {currentStep === 'review' && editableData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              Revisar e Editar Dados
            </CardTitle>
            <CardDescription>
              Revise e corrija os dados extraídos antes de importar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[450px] pr-4">
              <div className="space-y-6">
                {/* Student Info */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    <h4 className="font-medium">Dados do Aluno</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3 p-4 bg-muted/50 rounded-lg">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Nome *</Label>
                      <Input
                        value={editableData.aluno.nome}
                        onChange={(e) => updateAluno('nome', e.target.value)}
                        placeholder="Nome do aluno"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Peso (kg)</Label>
                      <Input
                        type="number"
                        value={editableData.aluno.peso || ''}
                        onChange={(e) => updateAluno('peso', e.target.value ? Number(e.target.value) : 0)}
                        placeholder="Peso"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Altura (cm)</Label>
                      <Input
                        type="number"
                        value={editableData.aluno.altura || ''}
                        onChange={(e) => updateAluno('altura', e.target.value ? Number(e.target.value) : 0)}
                        placeholder="Altura"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Objetivo</Label>
                      <Textarea
                        value={editableData.aluno.objetivo || ''}
                        onChange={(e) => updateAluno('objetivo', e.target.value)}
                        placeholder="Objetivo do aluno"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Diet Info */}
                {editableData.dieta && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Utensils className="h-4 w-4 text-primary" />
                      <h4 className="font-medium">Dieta</h4>
                    </div>
                    
                    <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome da Dieta</Label>
                        <Input
                          value={editableData.dieta.nome}
                          onChange={(e) => updateDieta('nome', e.target.value)}
                          placeholder="Nome do plano alimentar"
                        />
                      </div>

                      {editableData.dieta.macros && (
                        <div className="flex gap-2 flex-wrap">
                          {editableData.dieta.macros.calorias && (
                            <Badge variant="outline">{editableData.dieta.macros.calorias} kcal</Badge>
                          )}
                          {editableData.dieta.macros.proteina && (
                            <Badge variant="outline">P: {editableData.dieta.macros.proteina}g</Badge>
                          )}
                          {editableData.dieta.macros.carboidrato && (
                            <Badge variant="outline">C: {editableData.dieta.macros.carboidrato}g</Badge>
                          )}
                          {editableData.dieta.macros.gordura && (
                            <Badge variant="outline">G: {editableData.dieta.macros.gordura}g</Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Meals */}
                    <div className="space-y-3">
                      {editableData.dieta.refeicoes.map((refeicao, rIdx) => (
                        <div key={rIdx} className="p-4 bg-muted/50 rounded-lg space-y-3">
                          <Input
                            value={refeicao.nome}
                            onChange={(e) => updateRefeicao(rIdx, 'nome', e.target.value)}
                            className="font-medium"
                            placeholder="Nome da refeição"
                          />
                          <div className="space-y-2">
                            {refeicao.alimentos.map((alimento, aIdx) => (
                              <div key={aIdx} className="flex gap-2 items-center">
                                <Input
                                  value={alimento.nome}
                                  onChange={(e) => updateAlimento(rIdx, aIdx, 'nome', e.target.value)}
                                  placeholder="Nome do alimento"
                                  className="flex-1"
                                />
                                <Input
                                  value={alimento.quantidade}
                                  onChange={(e) => updateAlimento(rIdx, aIdx, 'quantidade', e.target.value)}
                                  placeholder="Qtd"
                                  className="w-24"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeAlimento(rIdx, aIdx)}
                                  className="h-8 w-8 text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addAlimento(rIdx)}
                              className="w-full"
                            >
                              <Plus className="h-4 w-4 mr-1" /> Adicionar Alimento
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Supplements/Pharma */}
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Pill className="h-4 w-4 text-primary" />
                      <h4 className="font-medium">Fármacos</h4>
                    </div>
                    <Button variant="outline" size="sm" onClick={addFarmaco}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {editableData.farmacos?.map((farmaco, idx) => (
                      <div key={idx} className="flex gap-2 items-center p-2 bg-muted/50 rounded">
                        <Input
                          value={farmaco.nome}
                          onChange={(e) => updateFarmaco(idx, 'nome', e.target.value)}
                          placeholder="Nome"
                          className="flex-1"
                        />
                        <Input
                          value={farmaco.dosagem}
                          onChange={(e) => updateFarmaco(idx, 'dosagem', e.target.value)}
                          placeholder="Dosagem"
                          className="w-32"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFarmaco(idx)}
                          className="h-8 w-8 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {(!editableData.farmacos || editableData.farmacos.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-2">Nenhum fármaco</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Pill className="h-4 w-4 text-green-500" />
                      <h4 className="font-medium">Suplementos</h4>
                    </div>
                    <Button variant="outline" size="sm" onClick={addSuplemento}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {editableData.suplementos?.map((sup, idx) => (
                      <div key={idx} className="flex gap-2 items-center p-2 bg-muted/50 rounded">
                        <Input
                          value={sup.nome}
                          onChange={(e) => updateSuplemento(idx, 'nome', e.target.value)}
                          placeholder="Nome"
                          className="flex-1"
                        />
                        <Input
                          value={sup.dosagem}
                          onChange={(e) => updateSuplemento(idx, 'dosagem', e.target.value)}
                          placeholder="Dosagem"
                          className="w-32"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSuplemento(idx)}
                          className="h-8 w-8 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {(!editableData.suplementos || editableData.suplementos.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-2">Nenhum suplemento</p>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="flex justify-between gap-2 mt-4 pt-4 border-t">
              <Button variant="outline" onClick={resetImporter}>
                Voltar
              </Button>
              <Button onClick={importStudent} disabled={isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  'Importar Aluno'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Complete Step */}
      {currentStep === 'complete' && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Importação Concluída!</h3>
                <p className="text-muted-foreground">
                  O aluno "{editableData?.aluno.nome}" foi importado com sucesso.
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={resetImporter}>
                  Importar Outro
                </Button>
                <Button onClick={onClose}>
                  Fechar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StudentImporter;
