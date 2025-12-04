import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  Loader2
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
      setCurrentStep('upload');
    }
  };

  const processFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    try {
      // Convert file to base64
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
      setCurrentStep('review');
      toast.success('PDF processado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao processar PDF:', error);
      toast.error(error.message || 'Erro ao processar PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  const importStudent = async () => {
    if (!parsedData) return;

    setIsImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // 1. Create student
      const { data: aluno, error: alunoError } = await supabase
        .from('alunos')
        .insert({
          nome: parsedData.aluno.nome,
          peso: parsedData.aluno.peso || null,
          objetivo: parsedData.aluno.objetivo || null,
          coach_id: user.id,
          email: `${parsedData.aluno.nome.toLowerCase().replace(/\s+/g, '.')}@importado.temp`
        })
        .select()
        .single();

      if (alunoError) throw alunoError;

      // 2. Create diet if exists
      if (parsedData.dieta && parsedData.dieta.refeicoes?.length > 0) {
        const { data: dieta, error: dietaError } = await supabase
          .from('dietas')
          .insert({
            nome: parsedData.dieta.nome || 'Plano Alimentar Importado',
            objetivo: parsedData.dieta.objetivo || null,
            aluno_id: aluno.id
          })
          .select()
          .single();

        if (dietaError) throw dietaError;

        // 3. Add pharma/supplements to diet
        if (parsedData.farmacos && parsedData.farmacos.length > 0) {
          const farmacosInsert = parsedData.farmacos.map(f => ({
            dieta_id: dieta.id,
            nome: f.nome,
            dosagem: f.dosagem,
            observacao: f.observacao || null
          }));

          await supabase.from('dieta_farmacos').insert(farmacosInsert);
        }

        if (parsedData.suplementos && parsedData.suplementos.length > 0) {
          const suplementosInsert = parsedData.suplementos.map(s => ({
            dieta_id: dieta.id,
            nome: s.nome,
            dosagem: s.dosagem,
            observacao: s.observacao || 'Suplemento'
          }));

          await supabase.from('dieta_farmacos').insert(suplementosInsert);
        }
      }

      setCurrentStep('complete');
      toast.success(`Aluno "${parsedData.aluno.nome}" importado com sucesso!`);
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
      {currentStep === 'review' && parsedData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Dados Extraídos
            </CardTitle>
            <CardDescription>
              Revise os dados extraídos antes de importar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {/* Student Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    <h4 className="font-medium">Dados do Aluno</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-3 bg-muted rounded-lg text-sm">
                    <div><span className="text-muted-foreground">Nome:</span> {parsedData.aluno.nome}</div>
                    {parsedData.aluno.peso && (
                      <div><span className="text-muted-foreground">Peso:</span> {parsedData.aluno.peso}kg</div>
                    )}
                    {parsedData.aluno.altura && (
                      <div><span className="text-muted-foreground">Altura:</span> {parsedData.aluno.altura}cm</div>
                    )}
                    {parsedData.aluno.idade && (
                      <div><span className="text-muted-foreground">Idade:</span> {parsedData.aluno.idade} anos</div>
                    )}
                    {parsedData.aluno.objetivo && (
                      <div className="col-span-2"><span className="text-muted-foreground">Objetivo:</span> {parsedData.aluno.objetivo}</div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Diet Info */}
                {parsedData.dieta && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Utensils className="h-4 w-4 text-primary" />
                      <h4 className="font-medium">Dieta: {parsedData.dieta.nome}</h4>
                    </div>
                    
                    {parsedData.dieta.macros && (
                      <div className="flex gap-2 flex-wrap">
                        {parsedData.dieta.macros.calorias && (
                          <Badge variant="outline">{parsedData.dieta.macros.calorias} kcal</Badge>
                        )}
                        {parsedData.dieta.macros.proteina && (
                          <Badge variant="outline">P: {parsedData.dieta.macros.proteina}g</Badge>
                        )}
                        {parsedData.dieta.macros.carboidrato && (
                          <Badge variant="outline">C: {parsedData.dieta.macros.carboidrato}g</Badge>
                        )}
                        {parsedData.dieta.macros.gordura && (
                          <Badge variant="outline">G: {parsedData.dieta.macros.gordura}g</Badge>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      {parsedData.dieta.refeicoes.map((refeicao, idx) => (
                        <div key={idx} className="p-3 bg-muted rounded-lg">
                          <h5 className="font-medium text-sm mb-2">{refeicao.nome}</h5>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {refeicao.alimentos.map((alimento, aIdx) => (
                              <li key={aIdx}>• {alimento.nome} - {alimento.quantidade}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Supplements/Pharma */}
                {((parsedData.suplementos && parsedData.suplementos.length > 0) || 
                  (parsedData.farmacos && parsedData.farmacos.length > 0)) && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Pill className="h-4 w-4 text-primary" />
                        <h4 className="font-medium">Suplementos e Fármacos</h4>
                      </div>
                      <div className="space-y-2">
                        {parsedData.farmacos?.map((farmaco, idx) => (
                          <div key={idx} className="p-2 bg-muted rounded text-sm">
                            <span className="font-medium">{farmaco.nome}</span> - {farmaco.dosagem}
                            {farmaco.observacao && <span className="text-muted-foreground"> ({farmaco.observacao})</span>}
                          </div>
                        ))}
                        {parsedData.suplementos?.map((sup, idx) => (
                          <div key={idx} className="p-2 bg-muted rounded text-sm">
                            <span className="font-medium">{sup.nome}</span> - {sup.dosagem}
                            {sup.observacao && <span className="text-muted-foreground"> ({sup.observacao})</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
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
                  O aluno "{parsedData?.aluno.nome}" foi importado com sucesso.
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
