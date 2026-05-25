import { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Edit2,
  ArrowUp,
  ArrowDown,
  Copy,
  Info,
  ShieldCheck,
  Sparkles,
  Clock,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { maskCpfCnpj, onlyNumbers } from '@/utils/MaskFormat';
import { cn } from '@/lib/utils';
import { getAllFoodsSafe, type Food } from '@/lib/foodService';
import {
  FoodNameAutocomplete,
  findBestFoodMatch,
} from '@/components/nutrition/FoodNameAutocomplete';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  ImportStepper,
  ImportExtractionSummary,
  ProtocolItemRow,
} from '@/components/import/ImportDialogParts';
import { DietReturnDateFields } from '@/components/DietReturnDateFields';

interface Alternativa {
  nome: string;
  quantidade: string;
  alimento_id?: string | null;
  tipo_id?: string | null;
  tipo_nome?: string | null;
}

interface Alimento {
  nome: string;
  quantidade: string;
  alimento_id?: string | null;
  tipo_id?: string | null;
  tipo_nome?: string | null;
  alternativas?: Alternativa[];
}

interface Refeicao {
  nome: string;
  horario?: string | null;
  observacao?: string | null;
  dia_semana?: string | null;
  plano?: string | null;
  macros?: {
    proteina?: number | null;
    carboidrato?: number | null;
    gordura?: number | null;
    calorias?: number | null;
  } | null;
  alimentos: Alimento[];
}

interface ParsedStudentData {
  aluno: {
    nome: string;
    email?: string;
    telefone?: string;
    peso?: number;
    altura?: number;
    idade?: number;
    objetivo?: string;
    cpf_cnpj?: string;
  };
  dieta?: {
    nome: string;
    objetivo?: string;
    data_retorno?: string | null;
    refeicoes: Refeicao[];
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
    horario?: string | null;
    observacao?: string;
  }>;
  farmacos?: Array<{
    nome: string;
    dosagem: string;
    horario?: string | null;
    observacao?: string;
  }>;
  orientacoes?: string;
}

interface ImportMeta {
  aiUsed?: boolean;
  source?: 'ai' | 'local_structured' | 'local_fallback' | 'none' | string;
  fallback?: boolean;
  requestId?: string;
  numPages?: number;
  provider?: { provider?: string; model?: string } | null;
  confidence?: {
    overall: number;
    sections: {
      aluno: number;
      dieta: number;
      protocolo: number | null;
      paginas: number | null;
    };
    warnings: string[];
    meta?: Record<string, unknown>;
  };
  fileName?: string;
}

interface StudentImporterProps {
  onImportComplete?: () => void;
  onClose?: () => void;
}

const normalizeAlimento = (alimento: Alimento): Alimento => ({
  nome: String(alimento?.nome ?? '').trim(),
  quantidade: String(alimento?.quantidade ?? '').trim(),
  alimento_id: alimento?.alimento_id ?? null,
  tipo_id: alimento?.tipo_id ?? null,
  tipo_nome: alimento?.tipo_nome ?? null,
  alternativas: (alimento?.alternativas || []).map((alt) => ({
    nome: String(alt?.nome ?? '').trim(),
    quantidade: String(alt?.quantidade ?? '').trim(),
    alimento_id: alt?.alimento_id ?? null,
    tipo_id: alt?.tipo_id ?? null,
    tipo_nome: alt?.tipo_nome ?? null,
  })),
});

const catalogFieldsFromFood = (food: Food) => ({
  nome: food.name,
  alimento_id: food.id,
  tipo_id: food.tipo_id ?? null,
  tipo_nome: food.tipo_nome ?? null,
});

const linkAlimentosToCatalog = (data: ParsedStudentData, foods: Food[]): ParsedStudentData => {
  if (!data.dieta?.refeicoes?.length || foods.length === 0) return data;
  const refeicoes = data.dieta.refeicoes.map((refeicao) => ({
    ...refeicao,
    alimentos: refeicao.alimentos.map((alimento) => {
      if (alimento.alimento_id) return alimento;
      const match = findBestFoodMatch(alimento.nome, foods);
      if (!match) return alimento;
      return { ...alimento, ...catalogFieldsFromFood(match) };
    }),
  }));
  return { ...data, dieta: { ...data.dieta, refeicoes } };
};

const normalizeRefeicao = (refeicao: Refeicao): Refeicao => ({
  ...refeicao,
  nome: String(refeicao?.nome ?? '').trim() || 'Refeição',
  horario: refeicao?.horario != null ? String(refeicao.horario) : null,
  observacao: refeicao?.observacao != null ? String(refeicao.observacao) : null,
  dia_semana: refeicao?.dia_semana != null ? String(refeicao.dia_semana) : null,
  plano: refeicao?.plano != null ? String(refeicao.plano) : null,
  alimentos: Array.isArray(refeicao?.alimentos)
    ? refeicao.alimentos.map(normalizeAlimento)
    : [],
});

const normalizeParsedStudentData = (data: ParsedStudentData): ParsedStudentData => ({
  ...data,
  aluno: {
    ...data.aluno,
    nome: data.aluno?.nome || '',
    email: data.aluno?.email || '',
    telefone: data.aluno?.telefone || '',
    cpf_cnpj: data.aluno?.cpf_cnpj || '',
  },
  dieta: data.dieta
    ? {
        ...data.dieta,
        nome: String(data.dieta.nome || 'Plano Alimentar Importado'),
        refeicoes: Array.isArray(data.dieta.refeicoes)
          ? data.dieta.refeicoes.map(normalizeRefeicao)
          : [],
      }
    : undefined,
  suplementos: data.suplementos || [],
  farmacos: data.farmacos || [],
});

const refeicoesDisponiveis = [
  'Café da Manhã',
  'Lanche da Manhã',
  'Almoço',
  'Lanche da Tarde',
  'Pré-Treino',
  'Pós-Treino',
  'Jantar',
  'Ceia',
];

const diasDaSemana = [
  'Todos os dias',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
  'Domingo',
];

const parseQuantidadeNumber = (qtd: string | undefined | null): number => {
  if (!qtd) return 0;
  const s = String(qtd);
  const rangeMatch = s.match(/(\d+[.,]?\d*)\s*[~\-–—]\s*(\d+[.,]?\d*)/);
  if (rangeMatch) {
    const a = parseFloat(rangeMatch[1].replace(',', '.'));
    const b = parseFloat(rangeMatch[2].replace(',', '.'));
    if (!isNaN(a) && !isNaN(b)) return (a + b) / 2;
  }
  const parenMatch = s.match(/\((\d+[.,]?\d*)\s*(?:g|ml)\)/i);
  if (parenMatch) {
    const v = parseFloat(parenMatch[1].replace(',', '.'));
    if (!isNaN(v)) return v;
  }
  const m = s.match(/[\d]+[.,]?\d*/);
  return m ? parseFloat(m[0].replace(',', '.')) : 0;
};

const StudentImporter = ({ onImportComplete, onClose }: StudentImporterProps) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedStudentData | null>(null);
  const [editableData, setEditableData] = useState<ParsedStudentData | null>(null);
  const [importMeta, setImportMeta] = useState<ImportMeta | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'review' | 'complete'>('upload');
  const [reviewTab, setReviewTab] = useState<'aluno' | 'dieta' | 'protocolo'>('aluno');
  const [diasValidadeDieta, setDiasValidadeDieta] = useState('');
  const [catalogFoods, setCatalogFoods] = useState<Food[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const catalogLinkedRef = useRef(false);

  useEffect(() => {
    if (currentStep !== 'review') return;
    let cancelled = false;
    (async () => {
      setCatalogLoading(true);
      const result = await getAllFoodsSafe();
      if (cancelled) return;
      if (result.success && result.data) {
        setCatalogFoods(result.data);
      } else {
        toast.error('Não foi possível carregar o catálogo de alimentos para sugestões.');
        setCatalogFoods([]);
      }
      setCatalogLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentStep]);

  useEffect(() => {
    if (catalogFoods.length === 0 || !editableData?.dieta || catalogLinkedRef.current) return;
    catalogLinkedRef.current = true;
    setEditableData((prev) => (prev ? linkAlimentosToCatalog(prev, catalogFoods) : prev));
  }, [catalogFoods, editableData?.dieta]);

  const isAcceptedImportFile = (f: File) => {
    const name = f.name.toLowerCase();
  const mime = (f.type || '').toLowerCase();
    return (
      name.endsWith('.pdf') ||
      name.endsWith('.csv') ||
      name.endsWith('.xlsx') ||
      mime === 'application/pdf' ||
      mime === 'text/csv' ||
      mime === 'application/csv' ||
      mime === 'text/comma-separated-values' ||
      mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mime === 'application/vnd.ms-excel'
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!isAcceptedImportFile(selectedFile)) {
        toast.error('Selecione um arquivo PDF, CSV ou XLSX');
        return;
      }
      setFile(selectedFile);
      setParsedData(null);
      setEditableData(null);
      setImportMeta(null);
      setImportWarnings([]);
      setCurrentStep('upload');
      catalogLinkedRef.current = false;
      setCatalogFoods([]);
    }
  };

  const processFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const token = apiClient.getToken();

      if (!token) {
        throw new Error('Usuário não autenticado');
      }

      const formData = new FormData();
      formData.append('pdf', file);

      const response = await fetch(`${API_URL}/api/import/parse-pdf`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Erro ao processar ficha';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          if (response.status === 413) {
            errorMessage = 'Arquivo muito grande. Tamanho máximo: 50MB.';
          } else {
            const text = await response.text();
            if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
              errorMessage = `Erro do servidor (${response.status}). Tente novamente.`;
            } else {
              errorMessage = text.substring(0, 200) || errorMessage;
            }
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      const meta: ImportMeta = data.meta || {};
      setImportMeta(meta);
      setImportWarnings(Array.isArray(data.warnings) ? data.warnings : []);

      const conf = meta.confidence?.overall ?? null;
      if (meta.source === 'local_structured' || meta.source === 'csv_blackhouse' || meta.source === 'xlsx_blackhouse') {
        const spreadsheetMsg =
          meta.source === 'xlsx_blackhouse'
            ? 'Plano Excel (XLSX) Black House reconhecido — extração estruturada. Revise os dados antes de salvar.'
            : meta.source === 'csv_blackhouse'
              ? 'Plano CSV Black House reconhecido — extração estruturada. Revise os dados antes de salvar.'
              : 'Plano Black House reconhecido — extração estruturada (rápida, sem IA). Revise os dados antes de salvar.';
        toast.info(spreadsheetMsg, { duration: 5000 });
      } else if (meta.aiUsed) {
        if (conf !== null && conf < 70) {
          toast.warning(`PDF processado com IA, mas a confiança está em ${conf}%. Revise atentamente.`);
        } else {
          toast.success('PDF processado com IA com sucesso!');
        }
      } else if (meta.source === 'local_fallback') {
        toast.info(
          'IA indisponível ou falhou — usámos o parser local. Revise os dados antes de salvar.',
          { duration: 5000 },
        );
      } else {
        toast.info('PDF processado. Revise os dados antes de salvar.', { duration: 4000 });
      }

      catalogLinkedRef.current = false;
      setDiasValidadeDieta('');
      const normalizedData = normalizeParsedStudentData(data.data);
      setParsedData(normalizedData);
      setEditableData(JSON.parse(JSON.stringify(normalizedData)));
      setReviewTab('aluno');
      setCurrentStep('review');
    } catch (error: any) {
      console.error('Erro ao processar ficha:', error);
      toast.error(error.message || 'Erro ao processar ficha');
    } finally {
      setIsProcessing(false);
    }
  };

  // -------- Update helpers ---------
  const updateAluno = (field: keyof ParsedStudentData['aluno'], value: string | number | undefined) => {
    if (!editableData) return;
    setEditableData({
      ...editableData,
      aluno: { ...editableData.aluno, [field]: value },
    });
  };

  const updateDieta = (field: 'nome' | 'objetivo' | 'data_retorno', value: string) => {
    if (!editableData?.dieta) return;
    setEditableData({
      ...editableData,
      dieta: { ...editableData.dieta, [field]: value || null },
    });
  };

  const updateRefeicao = (
    refeicaoIdx: number,
    field: keyof Refeicao,
    value: string,
  ) => {
    if (!editableData?.dieta) return;
    const newRefeicoes = [...editableData.dieta.refeicoes];
    newRefeicoes[refeicaoIdx] = { ...newRefeicoes[refeicaoIdx], [field]: value };
    setEditableData({
      ...editableData,
      dieta: { ...editableData.dieta, refeicoes: newRefeicoes },
    });
  };

  const moveRefeicao = (refeicaoIdx: number, direction: -1 | 1) => {
    if (!editableData?.dieta) return;
    const target = refeicaoIdx + direction;
    if (target < 0 || target >= editableData.dieta.refeicoes.length) return;
    const newRefeicoes = [...editableData.dieta.refeicoes];
    const [moved] = newRefeicoes.splice(refeicaoIdx, 1);
    newRefeicoes.splice(target, 0, moved);
    setEditableData({
      ...editableData,
      dieta: { ...editableData.dieta, refeicoes: newRefeicoes },
    });
  };

  const duplicateRefeicao = (refeicaoIdx: number) => {
    if (!editableData?.dieta) return;
    const newRefeicoes = [...editableData.dieta.refeicoes];
    const copy = JSON.parse(JSON.stringify(newRefeicoes[refeicaoIdx])) as Refeicao;
    newRefeicoes.splice(refeicaoIdx + 1, 0, copy);
    setEditableData({
      ...editableData,
      dieta: { ...editableData.dieta, refeicoes: newRefeicoes },
    });
  };

  const resolveFoodForAlimento = (alimento: Alimento): Food | null => {
    if (alimento.alimento_id) {
      return catalogFoods.find((f) => f.id === alimento.alimento_id) ?? null;
    }
    return findBestFoodMatch(alimento.nome, catalogFoods);
  };

  const updateAlimento = (
    refeicaoIdx: number,
    alimentoIdx: number,
    field: 'nome' | 'quantidade',
    value: string,
  ) => {
    setEditableData((prev) => {
      if (!prev?.dieta?.refeicoes?.[refeicaoIdx]?.alimentos) return prev;
      const newRefeicoes = prev.dieta.refeicoes.map((refeicao, rIdx) => {
        if (rIdx !== refeicaoIdx) return refeicao;
        const newAlimentos = refeicao.alimentos.map((alimento, aIdx) => {
          if (aIdx !== alimentoIdx) return alimento;
          if (field === 'quantidade') return { ...alimento, quantidade: value };
          const match = findBestFoodMatch(value, catalogFoods);
          const exact =
            match && match.name.toLowerCase().trim() === value.toLowerCase().trim();
          if (exact && match) {
            return { ...alimento, nome: value, ...catalogFieldsFromFood(match) };
          }
          return {
            ...alimento,
            nome: value,
            alimento_id: null,
            tipo_id: null,
            tipo_nome: null,
          };
        });
        return { ...refeicao, alimentos: newAlimentos };
      });
      return { ...prev, dieta: { ...prev.dieta, refeicoes: newRefeicoes } };
    });
  };

  const selectAlimentoFromCatalog = (
    refeicaoIdx: number,
    alimentoIdx: number,
    food: Food,
  ) => {
    setEditableData((prev) => {
      if (!prev?.dieta?.refeicoes?.[refeicaoIdx]?.alimentos) return prev;
      const newRefeicoes = prev.dieta.refeicoes.map((refeicao, rIdx) => {
        if (rIdx !== refeicaoIdx) return refeicao;
        const newAlimentos = refeicao.alimentos.map((alimento, aIdx) =>
          aIdx === alimentoIdx ? { ...alimento, ...catalogFieldsFromFood(food) } : alimento,
        );
        return { ...refeicao, alimentos: newAlimentos };
      });
      return { ...prev, dieta: { ...prev.dieta, refeicoes: newRefeicoes } };
    });
  };

  const selectAlternativaFromCatalog = (
    refeicaoIdx: number,
    alimentoIdx: number,
    altIdx: number,
    food: Food,
  ) => {
    setEditableData((prev) => {
      if (!prev?.dieta?.refeicoes?.[refeicaoIdx]?.alimentos?.[alimentoIdx]) return prev;
      const newRefeicoes = prev.dieta.refeicoes.map((refeicao, rIdx) => {
        if (rIdx !== refeicaoIdx) return refeicao;
        const alimentos = refeicao.alimentos.map((alimento, aIdx) => {
          if (aIdx !== alimentoIdx) return alimento;
          const alts = (alimento.alternativas || []).map((alt, i) =>
            i === altIdx ? { ...alt, ...catalogFieldsFromFood(food) } : alt,
          );
          return { ...alimento, alternativas: alts };
        });
        return { ...refeicao, alimentos };
      });
      return { ...prev, dieta: { ...prev.dieta, refeicoes: newRefeicoes } };
    });
  };

  const removeAlimento = (refeicaoIdx: number, alimentoIdx: number) => {
    if (!editableData?.dieta) return;
    const newRefeicoes = [...editableData.dieta.refeicoes];
    newRefeicoes[refeicaoIdx].alimentos = newRefeicoes[refeicaoIdx].alimentos.filter(
      (_, i) => i !== alimentoIdx,
    );
    setEditableData({
      ...editableData,
      dieta: { ...editableData.dieta, refeicoes: newRefeicoes },
    });
  };

  const addAlimento = (refeicaoIdx: number) => {
    if (!editableData?.dieta) return;
    const newRefeicoes = [...editableData.dieta.refeicoes];
    newRefeicoes[refeicaoIdx].alimentos.push({ nome: '', quantidade: '' });
    setEditableData({
      ...editableData,
      dieta: { ...editableData.dieta, refeicoes: newRefeicoes },
    });
  };

  const updateAlternativa = (
    refeicaoIdx: number,
    alimentoIdx: number,
    altIdx: number,
    field: 'nome' | 'quantidade',
    value: string,
  ) => {
    setEditableData((prev) => {
      if (!prev?.dieta?.refeicoes?.[refeicaoIdx]?.alimentos?.[alimentoIdx]) return prev;
      const newRefeicoes = prev.dieta.refeicoes.map((refeicao, rIdx) => {
        if (rIdx !== refeicaoIdx) return refeicao;
        const alimentos = refeicao.alimentos.map((alimento, aIdx) => {
          if (aIdx !== alimentoIdx) return alimento;
          const alts = (alimento.alternativas || []).map((alt, i) => {
            if (i !== altIdx) return alt;
            if (field === 'quantidade') return { ...alt, quantidade: value };
            const match = findBestFoodMatch(value, catalogFoods);
            const exact =
              match && match.name.toLowerCase().trim() === value.toLowerCase().trim();
            if (exact && match) {
              return { ...alt, nome: value, ...catalogFieldsFromFood(match) };
            }
            return {
              ...alt,
              nome: value,
              alimento_id: null,
              tipo_id: null,
              tipo_nome: null,
            };
          });
          return { ...alimento, alternativas: alts };
        });
        return { ...refeicao, alimentos };
      });
      return { ...prev, dieta: { ...prev.dieta, refeicoes: newRefeicoes } };
    });
  };

  const removeAlternativa = (refeicaoIdx: number, alimentoIdx: number, altIdx: number) => {
    if (!editableData?.dieta) return;
    const newRefeicoes = [...editableData.dieta.refeicoes];
    const alimentos = [...newRefeicoes[refeicaoIdx].alimentos];
    const alts = (alimentos[alimentoIdx].alternativas || []).filter((_, i) => i !== altIdx);
    alimentos[alimentoIdx] = { ...alimentos[alimentoIdx], alternativas: alts };
    newRefeicoes[refeicaoIdx] = { ...newRefeicoes[refeicaoIdx], alimentos };
    setEditableData({
      ...editableData,
      dieta: { ...editableData.dieta, refeicoes: newRefeicoes },
    });
  };

  const addAlternativa = (refeicaoIdx: number, alimentoIdx: number) => {
    if (!editableData?.dieta) return;
    const newRefeicoes = [...editableData.dieta.refeicoes];
    const alimentos = [...newRefeicoes[refeicaoIdx].alimentos];
    const alts = [...(alimentos[alimentoIdx].alternativas || []), { nome: '', quantidade: '' }];
    alimentos[alimentoIdx] = { ...alimentos[alimentoIdx], alternativas: alts };
    newRefeicoes[refeicaoIdx] = { ...newRefeicoes[refeicaoIdx], alimentos };
    setEditableData({
      ...editableData,
      dieta: { ...editableData.dieta, refeicoes: newRefeicoes },
    });
  };

  const updateFarmaco = (
    idx: number,
    field: 'nome' | 'dosagem' | 'observacao' | 'horario',
    value: string,
  ) => {
    if (!editableData?.farmacos) return;
    const newFarmacos = [...editableData.farmacos];
    newFarmacos[idx] = { ...newFarmacos[idx], [field]: value };
    setEditableData({ ...editableData, farmacos: newFarmacos });
  };

  const removeFarmaco = (idx: number) => {
    if (!editableData?.farmacos) return;
    setEditableData({
      ...editableData,
      farmacos: editableData.farmacos.filter((_, i) => i !== idx),
    });
  };

  const addFarmaco = () => {
    setEditableData({
      ...editableData!,
      farmacos: [...(editableData?.farmacos || []), { nome: '', dosagem: '', observacao: '' }],
    });
  };

  const updateSuplemento = (
    idx: number,
    field: 'nome' | 'dosagem' | 'observacao' | 'horario',
    value: string,
  ) => {
    if (!editableData?.suplementos) return;
    const newSupl = [...editableData.suplementos];
    newSupl[idx] = { ...newSupl[idx], [field]: value };
    setEditableData({ ...editableData, suplementos: newSupl });
  };

  const removeSuplemento = (idx: number) => {
    if (!editableData?.suplementos) return;
    setEditableData({
      ...editableData,
      suplementos: editableData.suplementos.filter((_, i) => i !== idx),
    });
  };

  const addSuplemento = () => {
    setEditableData({
      ...editableData!,
      suplementos: [...(editableData?.suplementos || []), { nome: '', dosagem: '', observacao: '' }],
    });
  };

  const addRefeicao = () => {
    if (!editableData?.dieta) {
      setEditableData({
        ...editableData!,
        dieta: {
          nome: 'Plano Alimentar',
          objetivo: '',
          refeicoes: [{ nome: '', alimentos: [{ nome: '', quantidade: '' }] }],
          macros: {},
        },
      });
    } else {
      const newRefeicoes = [
        ...editableData.dieta.refeicoes,
        { nome: '', alimentos: [{ nome: '', quantidade: '' }] } as Refeicao,
      ];
      setEditableData({
        ...editableData,
        dieta: { ...editableData.dieta, refeicoes: newRefeicoes },
      });
    }
  };

  const removeRefeicao = (refeicaoIdx: number) => {
    if (!editableData?.dieta) return;
    const newRefeicoes = editableData.dieta.refeicoes.filter((_, i) => i !== refeicaoIdx);
    setEditableData({
      ...editableData,
      dieta: { ...editableData.dieta, refeicoes: newRefeicoes },
    });
  };

  // Macros calculados vs declarados (estimativa simples — apenas para alerta)
  const macroStats = useMemo(() => {
    if (!editableData?.dieta) return null;
    const refeicoes = editableData.dieta.refeicoes || [];
    const totals = { proteina: 0, carboidrato: 0, gordura: 0, calorias: 0 };
    for (const r of refeicoes) {
      if (r.macros) {
        totals.proteina += Number(r.macros.proteina || 0);
        totals.carboidrato += Number(r.macros.carboidrato || 0);
        totals.gordura += Number(r.macros.gordura || 0);
        totals.calorias += Number(r.macros.calorias || 0);
      }
    }
    const declared = editableData.dieta.macros || {};
    return { totals, declared };
  }, [editableData]);

  const importStudent = async () => {
    if (!editableData) return;

    // Apenas nome do aluno é obrigatório. Email e CPF/CNPJ são opcionais — o
    // backend gera email temporário quando necessário.
    const alunoNome = editableData.aluno.nome?.trim() || '';
    if (!alunoNome) {
      toast.error('Nome do aluno é obrigatório');
      return;
    }

    setIsImporting(true);
    try {
      if (!user) throw new Error('Usuário não autenticado');

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const token = apiClient.getToken();

      if (!token) {
        throw new Error('Usuário não autenticado');
      }

      const cleanCpf = onlyNumbers(editableData.aluno.cpf_cnpj || '');
      const cleanTel = onlyNumbers(editableData.aluno.telefone || '');
      const toOptionalNum = (v: unknown) => {
        if (v === null || v === undefined) return undefined;
        const n = Number(v);
        if (!Number.isFinite(n) || n <= 0) return undefined;
        return n;
      };
      const payload = {
        ...editableData,
        aluno: {
          ...editableData.aluno,
          cpf_cnpj: cleanCpf || null,
          telefone: cleanTel || null,
          email: editableData.aluno.email?.trim() || null,
          peso: toOptionalNum(editableData.aluno.peso),
          altura: toOptionalNum(editableData.aluno.altura),
          idade: toOptionalNum(editableData.aluno.idade),
        },
      };

      const response = await fetch(`${API_URL}/api/import/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ data: payload, user: { id: user.id } }),
      });

      if (!response.ok) {
        let errorMessage = 'Erro ao importar aluno';
        try {
          const errorData = await response.json();
          const detailList = Array.isArray(errorData.errors)
            ? errorData.errors
                .slice(0, 5)
                .map((e: { path?: string; message?: string }) =>
                  e.path ? `${e.path}: ${e.message}` : e.message,
                )
                .filter(Boolean)
            : [];
          errorMessage = errorData.error || errorData.message || errorMessage;
          if (detailList.length > 0) {
            errorMessage = `${errorMessage} — ${detailList.join('; ')}`;
          }
        } catch {
          const text = await response.text();
          errorMessage = text.substring(0, 200) || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Erro ao importar aluno');
      }

      const stats = result.stats;
      if (stats) {
        if (stats.alimentos_criados && stats.alimentos_criados.length > 0) {
          toast.info(
            `${stats.alimentos_criados.length} novo(s) alimento(s) cadastrado(s): ${stats.alimentos_criados
              .slice(0, 3)
              .join(', ')}${
              stats.alimentos_criados.length > 3 ? ` e mais ${stats.alimentos_criados.length - 3}` : ''
            }`,
          );
        }

        if (stats.itens_criados > 0) {
          toast.success(`${stats.itens_criados} item(ns) de dieta criado(s) com sucesso!`);
        }
        if (stats.alternativas_criadas > 0) {
          toast.info(`${stats.alternativas_criadas} alternativa(s) salva(s) como substituto`);
        }
        if (stats.farmacos_criados > 0) {
          toast.success(`${stats.farmacos_criados} fármaco(s) cadastrado(s)`);
        }
        if (stats.suplementos_criados > 0) {
          toast.success(`${stats.suplementos_criados} suplemento(s) cadastrado(s)`);
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
    setImportMeta(null);
    setImportWarnings([]);
    setCurrentStep('upload');
    setReviewTab('aluno');
    setDiasValidadeDieta('');
  };

  const handleCpfCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCpfCnpj(e.target.value);
    updateAluno('cpf_cnpj', masked);
  };

  const confidence = importMeta?.confidence;
  const confColor =
    !confidence
      ? 'bg-muted text-muted-foreground'
      : confidence.overall >= 85
      ? 'bg-green-500/10 text-green-600 border-green-500/30 dark:text-green-400'
      : confidence.overall >= 70
      ? 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400'
      : 'bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400';

  const extractionLabel =
    importMeta?.source === 'xlsx_blackhouse'
      ? 'Excel Black House'
      : importMeta?.source === 'csv_blackhouse'
      ? 'CSV Black House'
      : importMeta?.source === 'local_structured'
      ? 'Parser estruturado'
      : importMeta?.aiUsed
        ? `IA (${importMeta.provider?.provider || 'configurada'})`
        : importMeta?.source === 'local_fallback'
          ? 'Parser local (fallback)'
          : 'Parser local';

  return (
    <div
      className={cn(
        'space-y-4',
        currentStep === 'review' && 'flex flex-col flex-1 min-h-0 overflow-hidden',
      )}
    >
      <ImportStepper currentStep={currentStep} />
      {currentStep === 'upload' && (
        <Card className="border-dashed shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload da ficha
            </CardTitle>
            <CardDescription>
              Envie a ficha em PDF, CSV ou Excel (XLSX). O modelo Black House é lido directamente — aba A ou B.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                accept=".pdf,.csv,.xlsx"
                onChange={handleFileChange}
                className="hidden"
                id="pdf-upload"
                disabled={isProcessing}
              />
              <label htmlFor="pdf-upload" className="cursor-pointer">
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-primary motion-safe:animate-spin" />
                    <p className="text-muted-foreground">Processando ficha...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <FileText className="w-12 h-12 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Clique para selecionar ou arraste o ficheiro</p>
                      <p className="text-sm text-muted-foreground">
                        PDF, CSV ou XLSX (modelo Black House) · até 50MB
                      </p>
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
                  Processar ficha
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>
                Extraímos: dados do aluno, dieta, refeições com horário/observação, substitutos, fármacos, suplementos e orientações.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 'review' && editableData && (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <p className="shrink-0 text-sm text-muted-foreground">
            Revise os dados extraídos. Apenas o <strong className="text-foreground">nome</strong> é obrigatório.
          </p>
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden pt-0">
            {importMeta && (
              <div className="mt-3 shrink-0">
                <ImportExtractionSummary
                  confidence={confidence}
                  extractionLabel={extractionLabel}
                  numPages={importMeta.numPages}
                  confColor={confColor}
                  warnings={importWarnings}
                />
              </div>
            )}

            <Tabs
              value={reviewTab}
              onValueChange={(v) => setReviewTab(v as typeof reviewTab)}
              className="mt-3 flex flex-col flex-1 min-h-0 overflow-hidden"
            >
              <TabsList className="shrink-0 grid h-10 w-full grid-cols-3">
                <TabsTrigger value="aluno" className="text-xs sm:text-sm">Aluno</TabsTrigger>
                <TabsTrigger value="dieta" className="gap-1.5 text-xs sm:text-sm">
                  Dieta
                  {editableData.dieta?.refeicoes?.length ? (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      {editableData.dieta.refeicoes.length}
                    </Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="protocolo" className="text-xs sm:text-sm">Protocolo</TabsTrigger>
              </TabsList>
              <div
                className="mt-3 flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y pr-1 -mr-1"
                onWheel={(e) => e.stopPropagation()}
              >
                <TabsContent value="aluno" className="mt-0 space-y-3 focus-visible:outline-none">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    <h4 className="font-medium">Dados do Aluno</h4>
                    <Badge variant="outline" className="text-[10px] ml-2">
                      apenas <span className="font-semibold mx-1">Nome</span> é obrigatório
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-3 rounded-lg bg-muted/40 p-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome *</Label>
                      <Input
                        value={editableData.aluno.nome}
                        onChange={(e) => updateAluno('nome', e.target.value)}
                        placeholder="Nome do aluno"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">CPF/CNPJ</Label>
                      <Input
                        value={editableData.aluno.cpf_cnpj || ''}
                        onChange={handleCpfCnpjChange}
                        placeholder="Opcional"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email</Label>
                      <Input
                        value={editableData.aluno.email || ''}
                        onChange={(e) => updateAluno('email', e.target.value)}
                        placeholder="Opcional (gerado se vazio)"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Objetivo</Label>
                      <Select
                        value={editableData.aluno.objetivo || ''}
                        onValueChange={(value) => updateAluno('objetivo', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Emagrecimento">Emagrecimento</SelectItem>
                          <SelectItem value="Hipertrofia">Hipertrofia</SelectItem>
                          <SelectItem value="Condicionamento">Condicionamento</SelectItem>
                          <SelectItem value="Reabilitação">Reabilitação</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Peso (kg)</Label>
                      <Input
                        type="number"
                        value={editableData.aluno.peso || ''}
                        onChange={(e) =>
                          updateAluno('peso', e.target.value ? Number(e.target.value) : undefined)
                        }
                        placeholder="Peso"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Altura (cm)</Label>
                      <Input
                        type="number"
                        value={editableData.aluno.altura || ''}
                        onChange={(e) =>
                          updateAluno('altura', e.target.value ? Number(e.target.value) : undefined)
                        }
                        placeholder="Altura"
                      />
                    </div>
                  </div>
                </div>

                </TabsContent>

                <TabsContent value="dieta" className="mt-0 space-y-4 focus-visible:outline-none">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Utensils className="h-4 w-4 text-primary" />
                      <h4 className="font-medium">Dieta</h4>
                      {editableData.dieta && editableData.dieta.refeicoes.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {editableData.dieta.refeicoes.length} refeição(ões)
                        </Badge>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={addRefeicao}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar Refeição
                    </Button>
                  </div>

                  {editableData.dieta && editableData.dieta.refeicoes.length < 4 && editableData.dieta.refeicoes.length > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span>
                        Apenas {editableData.dieta.refeicoes.length} refeição(ões) detectada(s). Se a ficha tem mais, clique em "Adicionar Refeição".
                      </span>
                    </div>
                  )}

                  {editableData.dieta && (
                    <div className="flex flex-wrap gap-2">
                      {refeicoesDisponiveis
                        .filter(
                          (ref) =>
                            !editableData.dieta?.refeicoes.some((r) =>
                              r.nome.toLowerCase().includes(ref.toLowerCase().split(' ')[0]),
                            ),
                        )
                        .slice(0, 4)
                        .map((ref) => (
                          <Button
                            key={ref}
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              const newRefeicoes = [
                                ...editableData.dieta!.refeicoes,
                                { nome: ref, alimentos: [{ nome: '', quantidade: '' }] } as Refeicao,
                              ];
                              setEditableData({
                                ...editableData,
                                dieta: { ...editableData.dieta!, refeicoes: newRefeicoes },
                              });
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" /> {ref}
                          </Button>
                        ))}
                    </div>
                  )}

                  {editableData.dieta && (
                    <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome da Dieta</Label>
                        <Input
                          value={editableData.dieta.nome}
                          onChange={(e) => updateDieta('nome', e.target.value)}
                          placeholder="Nome do plano alimentar"
                        />
                      </div>

                      <DietReturnDateFields
                        dataRetorno={editableData.dieta.data_retorno || ''}
                        diasValidade={diasValidadeDieta}
                        onDataRetornoChange={(iso) => updateDieta('data_retorno', iso)}
                        onDiasValidadeChange={setDiasValidadeDieta}
                      />

                      {editableData.dieta.macros && (
                        <div className="flex gap-2 flex-wrap">
                          {editableData.dieta.macros.calorias ? (
                            <Badge variant="outline">{editableData.dieta.macros.calorias} kcal</Badge>
                          ) : null}
                          {editableData.dieta.macros.proteina ? (
                            <Badge variant="outline">P: {editableData.dieta.macros.proteina}g</Badge>
                          ) : null}
                          {editableData.dieta.macros.carboidrato ? (
                            <Badge variant="outline">C: {editableData.dieta.macros.carboidrato}g</Badge>
                          ) : null}
                          {editableData.dieta.macros.gordura ? (
                            <Badge variant="outline">G: {editableData.dieta.macros.gordura}g</Badge>
                          ) : null}
                          {macroStats && macroStats.totals.calorias > 0 && macroStats.declared.calorias ? (
                            <Badge variant="outline" className="border-blue-500/40 text-blue-600 dark:text-blue-400">
                              Soma refeições: {Math.round(macroStats.totals.calorias)} kcal
                            </Badge>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}

                  {editableData.dieta && editableData.dieta.refeicoes.length > 0 && (
                    <Accordion type="multiple" defaultValue={['meal-0']} className="w-full space-y-2">
                      {editableData.dieta.refeicoes.map((refeicao, rIdx) => (
                        <AccordionItem key={rIdx} value={`meal-${rIdx}`} className="rounded-lg border bg-muted/30 px-3">
                          <AccordionTrigger className="py-3 hover:no-underline [&[data-state=open]]:pb-2">
                            <span className="flex flex-1 items-center gap-2 text-left text-sm font-medium">
                              {refeicao.nome || `Refeição ${rIdx + 1}`}
                              <Badge variant="secondary" className="text-[10px] font-normal">
                                {refeicao.alimentos.length} item(ns)
                              </Badge>
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-3 pb-4 pt-0">
                          <div className="flex items-center gap-2">
                            <Input
                              value={refeicao.nome}
                              onChange={(e) => updateRefeicao(rIdx, 'nome', e.target.value)}
                              className="font-medium flex-1"
                              placeholder="Nome da refeição (ex: Café da Manhã, Almoço...)"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0"
                              title="Mover para cima"
                              onClick={() => moveRefeicao(rIdx, -1)}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0"
                              title="Mover para baixo"
                              onClick={() => moveRefeicao(rIdx, 1)}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0"
                              title="Duplicar refeição"
                              onClick={() => duplicateRefeicao(rIdx)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeRefeicao(rIdx)}
                              className="h-8 w-8 text-destructive flex-shrink-0"
                              title="Remover refeição"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Metadados opcionais */}
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <div className="space-y-1">
                              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Horário
                              </Label>
                              <Input
                                value={refeicao.horario || ''}
                                onChange={(e) => updateRefeicao(rIdx, 'horario', e.target.value)}
                                placeholder="ex: 07:00"
                                className="h-8"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Dia da semana</Label>
                              <Select
                                value={refeicao.dia_semana || ''}
                                onValueChange={(v) => updateRefeicao(rIdx, 'dia_semana', v)}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent>
                                  {diasDaSemana.map((d) => (
                                    <SelectItem key={d} value={d}>
                                      {d}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Plano/Fase</Label>
                              <Input
                                value={refeicao.plano || ''}
                                onChange={(e) => updateRefeicao(rIdx, 'plano', e.target.value)}
                                placeholder="ex: Cutting, Treino"
                                className="h-8"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Observação</Label>
                            <Textarea
                              value={refeicao.observacao || ''}
                              onChange={(e) => updateRefeicao(rIdx, 'observacao', e.target.value)}
                              placeholder="Observações da refeição (ex: tomar 30 min antes do treino)"
                              className="min-h-[44px] text-sm"
                            />
                          </div>

                          <div className="space-y-2">
                            {refeicao.alimentos.map((alimento, aIdx) => (
                              <div key={aIdx} className="space-y-1">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center min-w-0">
                                  <FoodNameAutocomplete
                                    foods={catalogFoods}
                                    value={String(alimento.nome ?? '')}
                                    onValueChange={(nome) => updateAlimento(rIdx, aIdx, 'nome', nome)}
                                    onFoodSelect={(food) =>
                                      selectAlimentoFromCatalog(rIdx, aIdx, food)
                                    }
                                    disabled={catalogLoading}
                                    placeholder={
                                      catalogLoading
                                        ? 'A carregar catálogo…'
                                        : 'Nome do alimento'
                                    }
                                    className="flex-1"
                                  />
                                  <Input
                                    type="text"
                                    value={String(alimento.quantidade ?? '')}
                                    onChange={(e) => updateAlimento(rIdx, aIdx, 'quantidade', e.target.value)}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    placeholder="Qtd (ex: 100g)"
                                    className="w-32"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    title="Adicionar substituto"
                                    onClick={() => addAlternativa(rIdx, aIdx)}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeAlimento(rIdx, aIdx)}
                                    className="h-8 w-8 text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                                {alimento.alternativas && alimento.alternativas.length > 0 && (
                                  <div className="pl-4 border-l-2 border-muted-foreground/20 space-y-1">
                                    {alimento.alternativas.map((alt, altIdx) => (
                                      <div key={altIdx} className="flex gap-2 items-center">
                                        <Badge variant="outline" className="text-[10px] shrink-0">
                                          substituto
                                        </Badge>
                                        <FoodNameAutocomplete
                                          foods={catalogFoods}
                                          value={alt.nome}
                                          onValueChange={(nome) =>
                                            updateAlternativa(rIdx, aIdx, altIdx, 'nome', nome)
                                          }
                                          onFoodSelect={(food) =>
                                            selectAlternativaFromCatalog(rIdx, aIdx, altIdx, food)
                                          }
                                          grupoReferencia={resolveFoodForAlimento(alimento)}
                                          disabled={catalogLoading}
                                          placeholder="Substituto (mesmo grupo)"
                                          className="flex-1"
                                        />
                                        <Input
                                          value={alt.quantidade}
                                          onChange={(e) => updateAlternativa(rIdx, aIdx, altIdx, 'quantidade', e.target.value)}
                                          placeholder="Qtd"
                                          className="w-28 h-8"
                                        />
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => removeAlternativa(rIdx, aIdx, altIdx)}
                                          className="h-7 w-7 text-destructive"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={() => addAlimento(rIdx)} className="w-full">
                              <Plus className="h-4 w-4 mr-1" /> Adicionar Alimento
                            </Button>
                          </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}

                  {(!editableData.dieta || editableData.dieta.refeicoes.length === 0) && (
                    <div className="p-6 bg-muted/30 rounded-lg text-center space-y-3">
                      <Utensils className="h-8 w-8 text-muted-foreground mx-auto" />
                      <p className="text-sm text-muted-foreground">
                        Nenhuma refeição detectada na ficha. Clique em "Adicionar Refeição" para criar manualmente.
                      </p>
                    </div>
                  )}
                </div>

                </TabsContent>

                <TabsContent value="protocolo" className="mt-0 space-y-6 focus-visible:outline-none">
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
                      <ProtocolItemRow
                        key={idx}
                        nome={farmaco.nome}
                        dosagem={farmaco.dosagem}
                        horario={farmaco.horario || ''}
                        observacao={farmaco.observacao || ''}
                        onNome={(v) => updateFarmaco(idx, 'nome', v)}
                        onDosagem={(v) => updateFarmaco(idx, 'dosagem', v)}
                        onHorario={(v) => updateFarmaco(idx, 'horario', v)}
                        onObservacao={(v) => updateFarmaco(idx, 'observacao', v)}
                        onRemove={() => removeFarmaco(idx)}
                      />
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
                      <ProtocolItemRow
                        key={idx}
                        nome={sup.nome}
                        dosagem={sup.dosagem}
                        horario={sup.horario || ''}
                        observacao={sup.observacao || ''}
                        onNome={(v) => updateSuplemento(idx, 'nome', v)}
                        onDosagem={(v) => updateSuplemento(idx, 'dosagem', v)}
                        onHorario={(v) => updateSuplemento(idx, 'horario', v)}
                        onObservacao={(v) => updateSuplemento(idx, 'observacao', v)}
                        onRemove={() => removeSuplemento(idx)}
                      />
                    ))}
                    {(!editableData.suplementos || editableData.suplementos.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-2">Nenhum suplemento</p>
                    )}
                  </div>
                </div>

                {editableData.orientacoes && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-primary" />
                        <h4 className="font-medium">Orientações</h4>
                      </div>
                      <Textarea
                        value={editableData.orientacoes || ''}
                        onChange={(e) => setEditableData({ ...editableData, orientacoes: e.target.value })}
                        placeholder="Orientações gerais"
                        className="min-h-[80px]"
                      />
                    </div>
                  </>
                )}
                </TabsContent>
              </div>
            </Tabs>

            <div className="flex shrink-0 justify-between gap-2 mt-3 pt-3 border-t bg-background sticky bottom-0 z-10">
              <Button variant="outline" onClick={resetImporter}>
                Voltar
              </Button>
              <Button onClick={importStudent} disabled={isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 motion-safe:animate-spin" />
                    Importando...
                  </>
                ) : (
                  'Importar Aluno'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

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
                <Button onClick={onClose}>Fechar</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StudentImporter;
