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
