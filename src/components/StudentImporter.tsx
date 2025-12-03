import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
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
  Edit,
  Plus
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ParsedStudentData {
  nome: string;
  peso: number | null;
  email: string;
  telefone: string;
  objetivo: string;
  aguaMinima: number | null;
  aguaMaxima: number | null;
  kcalTotal: number | null;
  protTotal: number | null;
  carbTotal: number | null;
  lipTotal: number | null;
}

interface ParsedMeal {
  refeicao: string;
  alimentos: Array<{
    nome: string;
    quantidade: number;
    kcal?: number;
    cho?: number;
    ptn?: number;
    lip?: number;
  }>;
  substitutos: Array<{
    nome: string;
    quantidade: number;
  }>;
  macros?: {
    kcal: number;
    cho: number;
    ptn: number;
    lip: number;
  };
}

interface ParsedSupplement {
  nome: string;
  dose: string;
  horario: string;
  tipo: 'suplemento' | 'fitoterapico' | 'farmaco' | 'protocolo';
}

interface ImportData {
  aluno: ParsedStudentData;
  refeicoes: ParsedMeal[];
  suplementos: ParsedSupplement[];
  orientacoes: string[];
}

const StudentImporter = () => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedData, setParsedData] = useState<ImportData | null>(null);
  const [currentStep, setCurrentStep] = useState<'upload' | 'review' | 'complete'>('upload');
  const [editableData, setEditableData] = useState<ImportData | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setLoading(true);

    try {
      const fileExtension = uploadedFile.name.split('.').pop()?.toLowerCase();
      
      if (fileExtension === 'xlsx' || fileExtension === 'xls' || fileExtension === 'csv') {
        await parseExcelFile(uploadedFile);
      } else {
        toast({
          title: "Formato não suportado",
          description: "Por favor, envie um arquivo Excel (.xlsx, .xls) ou CSV (.csv)",
          variant: "destructive"
        });
        setFile(null);
      }
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast({
        title: "Erro ao processar arquivo",
        description: "Não foi possível ler os dados do arquivo",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const parseExcelFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    
    const importData: ImportData = {
      aluno: {
        nome: '',
        peso: null,
        email: '',
        telefone: '',
        objetivo: '',
        aguaMinima: null,
        aguaMaxima: null,
        kcalTotal: null,
        protTotal: null,
        carbTotal: null,
        lipTotal: null
      },
      refeicoes: [],
      suplementos: [],
      orientacoes: []
    };

    // Try to find student data sheet
    const studentSheet = workbook.Sheets['Aluno'] || workbook.Sheets['Dados'] || workbook.Sheets[workbook.SheetNames[0]];
    if (studentSheet) {
      const studentData = XLSX.utils.sheet_to_json(studentSheet, { header: 1 }) as any[][];
      
      // Parse student info from first rows
      for (const row of studentData) {
        if (!row || row.length === 0) continue;
        
        const cellContent = String(row[0] || '').toLowerCase();
        const cellValue = row[1];
        
        if (cellContent.includes('nome')) {
          importData.aluno.nome = String(cellValue || '');
        } else if (cellContent.includes('peso')) {
          importData.aluno.peso = parseFloat(String(cellValue || '0')) || null;
        } else if (cellContent.includes('email')) {
          importData.aluno.email = String(cellValue || '');
        } else if (cellContent.includes('telefone')) {
          importData.aluno.telefone = String(cellValue || '');
        } else if (cellContent.includes('objetivo') || cellContent.includes('estratégia')) {
          importData.aluno.objetivo = String(cellValue || '');
        } else if (cellContent.includes('água') && cellContent.includes('mínima')) {
          importData.aluno.aguaMinima = parseFloat(String(cellValue || '0')) || null;
        } else if (cellContent.includes('água') && cellContent.includes('máxima')) {
          importData.aluno.aguaMaxima = parseFloat(String(cellValue || '0')) || null;
        } else if (cellContent.includes('kcal') && cellContent.includes('total')) {
          importData.aluno.kcalTotal = parseFloat(String(cellValue || '0')) || null;
        } else if (cellContent.includes('prot') && cellContent.includes('total')) {
          importData.aluno.protTotal = parseFloat(String(cellValue || '0')) || null;
        } else if (cellContent.includes('carb') && cellContent.includes('total')) {
          importData.aluno.carbTotal = parseFloat(String(cellValue || '0')) || null;
        } else if (cellContent.includes('lip') && cellContent.includes('total')) {
          importData.aluno.lipTotal = parseFloat(String(cellValue || '0')) || null;
        }
      }
    }

    // Try to find meals sheet
    const mealsSheet = workbook.Sheets['Refeições'] || workbook.Sheets['Dieta'] || workbook.Sheets['Plano'];
    if (mealsSheet) {
      const mealsData = XLSX.utils.sheet_to_json(mealsSheet, { header: 1 }) as any[][];
      let currentMeal: ParsedMeal | null = null;
      
      for (const row of mealsData) {
        if (!row || row.length === 0) continue;
        
        const firstCell = String(row[0] || '').toLowerCase();
        
        // Check if this is a meal header
        if (firstCell.includes('refeição') || firstCell.match(/^refeição\s*\d/i)) {
          if (currentMeal) {
            importData.refeicoes.push(currentMeal);
          }
          currentMeal = {
            refeicao: String(row[0] || ''),
            alimentos: [],
            substitutos: []
          };
        } else if (currentMeal && row[0] && row[1]) {
          // This is a food item row
          const quantidade = parseFloat(String(row[0] || '0')) || 0;
          const nome = String(row[1] || '');
          
          if (nome && quantidade > 0) {
            currentMeal.alimentos.push({
              nome,
              quantidade
            });
          }
        }
      }
      
      if (currentMeal) {
        importData.refeicoes.push(currentMeal);
      }
    }

    // Try to find supplements sheet
    const supplementsSheet = workbook.Sheets['Suplementos'] || workbook.Sheets['Complemento'] || workbook.Sheets['Fármacos'];
    if (supplementsSheet) {
      const supplementsData = XLSX.utils.sheet_to_json(supplementsSheet, { header: 1 }) as any[][];
      let currentType: 'suplemento' | 'fitoterapico' | 'farmaco' | 'protocolo' = 'suplemento';
      
      for (const row of supplementsData) {
        if (!row || row.length === 0) continue;
        
        const firstCell = String(row[0] || '').toLowerCase();
        
        if (firstCell.includes('suplementação') || firstCell.includes('suplemento')) {
          currentType = 'suplemento';
        } else if (firstCell.includes('fitoterápico') || firstCell.includes('fitoterapico')) {
          currentType = 'fitoterapico';
        } else if (firstCell.includes('fármaco') || firstCell.includes('farmaco')) {
          currentType = 'farmaco';
        } else if (firstCell.includes('protocolo')) {
          currentType = 'protocolo';
        } else if (row[0] && row[1]) {
          importData.suplementos.push({
            dose: String(row[0] || ''),
            nome: String(row[1] || ''),
            horario: String(row[2] || ''),
            tipo: currentType
          });
        }
      }
    }

    // If no structured data found, try to parse as simple table
    if (importData.refeicoes.length === 0) {
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const allData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
      
      let currentMeal: ParsedMeal | null = null;
      
      for (const row of allData) {
        if (!row || row.length === 0) continue;
        
        const firstCell = String(row[0] || '');
        
        // Parse student name and weight from header-like rows
        if (firstCell.toLowerCase().includes('nome:')) {
          importData.aluno.nome = firstCell.replace(/nome:/i, '').trim() || String(row[1] || '');
        }
        if (firstCell.toLowerCase().includes('peso')) {
          const pesoMatch = firstCell.match(/\d+/) || String(row[1] || '').match(/\d+/);
          if (pesoMatch) {
            importData.aluno.peso = parseInt(pesoMatch[0]);
          }
        }
        
        // Check for meal patterns
        if (firstCell.match(/refeição\s*\d/i) || firstCell.match(/^(café|almoço|jantar|lanche)/i)) {
          if (currentMeal) {
            importData.refeicoes.push(currentMeal);
          }
          currentMeal = {
            refeicao: firstCell,
            alimentos: [],
            substitutos: []
          };
        } else if (currentMeal) {
          // Try to extract food and quantity
          const qtdMatch = String(row[0] || '').match(/^\d+/);
          if (qtdMatch && row[1]) {
            currentMeal.alimentos.push({
              nome: String(row[1]),
              quantidade: parseInt(qtdMatch[0])
            });
          }
        }
      }
      
      if (currentMeal) {
        importData.refeicoes.push(currentMeal);
      }
    }

    setParsedData(importData);
    setEditableData(importData);
    setCurrentStep('review');
  };

  const handleImport = async () => {
    if (!editableData) return;
    
    setImporting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para importar dados",
          variant: "destructive"
        });
        return;
      }

      // 1. Create student
      const { data: alunoData, error: alunoError } = await supabase
        .from('alunos')
        .insert({
          nome: editableData.aluno.nome,
          email: editableData.aluno.email || `${editableData.aluno.nome.toLowerCase().replace(/\s+/g, '.')}@temp.com`,
          telefone: editableData.aluno.telefone || null,
          peso: editableData.aluno.peso,
          objetivo: editableData.aluno.objetivo || null,
          coach_id: user.id
        })
        .select()
        .single();

      if (alunoError) throw alunoError;

      // 2. Create diet if there are meals
      if (editableData.refeicoes.length > 0) {
        const { data: dietaData, error: dietaError } = await supabase
          .from('dietas')
          .insert({
            nome: `Plano Alimentar - ${editableData.aluno.nome}`,
            aluno_id: alunoData.id,
            objetivo: editableData.aluno.objetivo || 'Importado'
          })
          .select()
          .single();

        if (dietaError) throw dietaError;

        // 3. Get existing foods to match
        const { data: alimentosExistentes } = await supabase
          .from('alimentos')
          .select('id, nome');

        const alimentosMap = new Map(
          (alimentosExistentes || []).map(a => [a.nome.toLowerCase(), a.id])
        );

        // 4. Create diet items
        const refeicaoMap: Record<string, string> = {
          'refeição 1': 'Café da Manhã',
          'refeição 2': 'Lanche da Manhã',
          'refeição 3': 'Almoço',
          'refeição 4': 'Lanche da Tarde',
          'refeição 5': 'Jantar',
          'refeição 6': 'Ceia'
        };

        for (const refeicao of editableData.refeicoes) {
          const refeicaoNormalizada = refeicaoMap[refeicao.refeicao.toLowerCase()] || refeicao.refeicao;
          
          for (const alimento of refeicao.alimentos) {
            // Try to find matching food
            let alimentoId = alimentosMap.get(alimento.nome.toLowerCase());
            
            // If not found, try partial match
            if (!alimentoId) {
              for (const [nome, id] of alimentosMap) {
                if (nome.includes(alimento.nome.toLowerCase()) || alimento.nome.toLowerCase().includes(nome)) {
                  alimentoId = id;
                  break;
                }
              }
            }

            if (alimentoId) {
              await supabase
                .from('itens_dieta')
                .insert({
                  dieta_id: dietaData.id,
                  alimento_id: alimentoId,
                  quantidade: alimento.quantidade,
                  refeicao: refeicaoNormalizada
                });
            }
          }
        }

        // 5. Create supplements/medications
        if (editableData.suplementos.length > 0) {
          const farmacos = editableData.suplementos.map(s => ({
            dieta_id: dietaData.id,
            nome: s.nome,
            dosagem: s.dose,
            observacao: `${s.tipo} - ${s.horario}`
          }));

          await supabase
            .from('dieta_farmacos')
            .insert(farmacos);
        }
      }

      toast({
        title: "Importação concluída!",
        description: `Aluno ${editableData.aluno.nome} importado com sucesso`,
      });

      setCurrentStep('complete');
    } catch (error) {
      console.error('Erro na importação:', error);
      toast({
        title: "Erro na importação",
        description: "Não foi possível importar os dados",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  const resetImporter = () => {
    setFile(null);
    setParsedData(null);
    setEditableData(null);
    setCurrentStep('upload');
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Importar Aluno</h1>
        <p className="text-muted-foreground">
          Importe dados de alunos a partir de planilhas Excel
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 ${currentStep === 'upload' ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            1
          </div>
          <span className="font-medium">Upload</span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
        <div className={`flex items-center gap-2 ${currentStep === 'review' ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'review' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            2
          </div>
          <span className="font-medium">Revisar</span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
        <div className={`flex items-center gap-2 ${currentStep === 'complete' ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'complete' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            3
          </div>
          <span className="font-medium">Concluído</span>
        </div>
      </div>

      {/* Upload Step */}
      {currentStep === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload do Arquivo
            </CardTitle>
            <CardDescription>
              Faça upload de uma planilha Excel (.xlsx, .xls) ou CSV com os dados do aluno
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                disabled={loading}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                {loading ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="text-muted-foreground">Processando arquivo...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <FileText className="w-12 h-12 text-muted-foreground" />
                    <div>
                      <p className="text-lg font-medium">Clique para selecionar um arquivo</p>
                      <p className="text-sm text-muted-foreground">ou arraste e solte aqui</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Formatos aceitos: .xlsx, .xls, .csv
                    </p>
                  </div>
                )}
              </label>
            </div>

            {/* Template info */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Estrutura recomendada da planilha:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Aba "Aluno" ou "Dados": Nome, Peso, Email, Telefone, Objetivo</li>
                <li>• Aba "Refeições" ou "Dieta": Quantidade (g/ml), Alimento, por refeição</li>
                <li>• Aba "Suplementos": Dose, Nome, Horário</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Step */}
      {currentStep === 'review' && editableData && (
        <div className="space-y-6">
          <Tabs defaultValue="aluno">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="aluno" className="gap-2">
                <User className="w-4 h-4" />
                Dados do Aluno
              </TabsTrigger>
              <TabsTrigger value="dieta" className="gap-2">
                <Utensils className="w-4 h-4" />
                Dieta ({editableData.refeicoes.length} refeições)
              </TabsTrigger>
              <TabsTrigger value="suplementos" className="gap-2">
                <Pill className="w-4 h-4" />
                Suplementos ({editableData.suplementos.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="aluno" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Informações do Aluno</CardTitle>
                  <CardDescription>Revise e edite os dados antes de importar</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Nome *</Label>
                      <Input
                        value={editableData.aluno.nome}
                        onChange={(e) => setEditableData({
                          ...editableData,
                          aluno: { ...editableData.aluno, nome: e.target.value }
                        })}
                        placeholder="Nome completo"
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        value={editableData.aluno.email}
                        onChange={(e) => setEditableData({
                          ...editableData,
                          aluno: { ...editableData.aluno, email: e.target.value }
                        })}
                        placeholder="email@exemplo.com"
                        type="email"
                      />
                    </div>
                    <div>
                      <Label>Peso (kg)</Label>
                      <Input
                        value={editableData.aluno.peso || ''}
                        onChange={(e) => setEditableData({
                          ...editableData,
                          aluno: { ...editableData.aluno, peso: parseFloat(e.target.value) || null }
                        })}
                        placeholder="80"
                        type="number"
                      />
                    </div>
                    <div>
                      <Label>Telefone</Label>
                      <Input
                        value={editableData.aluno.telefone}
                        onChange={(e) => setEditableData({
                          ...editableData,
                          aluno: { ...editableData.aluno, telefone: e.target.value }
                        })}
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Objetivo</Label>
                      <Input
                        value={editableData.aluno.objetivo}
                        onChange={(e) => setEditableData({
                          ...editableData,
                          aluno: { ...editableData.aluno, objetivo: e.target.value }
                        })}
                        placeholder="Emagrecimento, Hipertrofia, etc."
                      />
                    </div>
                  </div>

                  {(editableData.aluno.kcalTotal || editableData.aluno.protTotal) && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-medium mb-3">Metas Nutricionais Detectadas</h4>
                        <div className="flex gap-4 flex-wrap">
                          {editableData.aluno.kcalTotal && (
                            <Badge variant="secondary" className="text-sm px-3 py-1">
                              {editableData.aluno.kcalTotal} kcal
                            </Badge>
                          )}
                          {editableData.aluno.protTotal && (
                            <Badge variant="secondary" className="text-sm px-3 py-1">
                              {editableData.aluno.protTotal}g PTN
                            </Badge>
                          )}
                          {editableData.aluno.carbTotal && (
                            <Badge variant="secondary" className="text-sm px-3 py-1">
                              {editableData.aluno.carbTotal}g CHO
                            </Badge>
                          )}
                          {editableData.aluno.lipTotal && (
                            <Badge variant="secondary" className="text-sm px-3 py-1">
                              {editableData.aluno.lipTotal}g LIP
                            </Badge>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dieta" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Plano Alimentar</CardTitle>
                  <CardDescription>
                    {editableData.refeicoes.length > 0 
                      ? `${editableData.refeicoes.length} refeições detectadas`
                      : 'Nenhuma refeição detectada no arquivo'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {editableData.refeicoes.length > 0 ? (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-6">
                        {editableData.refeicoes.map((refeicao, idx) => (
                          <div key={idx} className="p-4 border rounded-lg">
                            <h4 className="font-medium text-primary mb-3">{refeicao.refeicao}</h4>
                            <div className="space-y-2">
                              {refeicao.alimentos.map((alimento, aIdx) => (
                                <div key={aIdx} className="flex items-center justify-between text-sm">
                                  <span>{alimento.nome}</span>
                                  <Badge variant="outline">{alimento.quantidade}g</Badge>
                                </div>
                              ))}
                              {refeicao.alimentos.length === 0 && (
                                <p className="text-sm text-muted-foreground italic">
                                  Nenhum alimento detectado nesta refeição
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Utensils className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma refeição foi detectada no arquivo.</p>
                      <p className="text-sm">A dieta pode ser criada manualmente após a importação.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="suplementos" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Suplementos e Fármacos</CardTitle>
                  <CardDescription>
                    {editableData.suplementos.length > 0 
                      ? `${editableData.suplementos.length} itens detectados`
                      : 'Nenhum suplemento detectado no arquivo'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {editableData.suplementos.length > 0 ? (
                    <div className="space-y-3">
                      {editableData.suplementos.map((suplemento, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{suplemento.nome}</p>
                            <p className="text-sm text-muted-foreground">{suplemento.horario}</p>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className="mb-1">{suplemento.dose}</Badge>
                            <p className="text-xs text-muted-foreground capitalize">{suplemento.tipo}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Pill className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum suplemento foi detectado no arquivo.</p>
                      <p className="text-sm">Os suplementos podem ser adicionados manualmente.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Action buttons */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={resetImporter}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={importing || !editableData.aluno.nome}>
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirmar Importação
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Complete Step */}
      {currentStep === 'complete' && (
        <Card className="text-center py-12">
          <CardContent>
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Importação Concluída!</h2>
            <p className="text-muted-foreground mb-6">
              O aluno {editableData?.aluno.nome} foi importado com sucesso.
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={resetImporter}>
                <Plus className="w-4 h-4 mr-2" />
                Importar Outro
              </Button>
              <Button onClick={() => window.location.reload()}>
                Ver Alunos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StudentImporter;
