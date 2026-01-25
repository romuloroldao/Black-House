import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Plus, Search, Edit, Trash2, Apple, AlertCircle, Calculator, Upload, Download, FileSpreadsheet, ClipboardCheck, Merge } from "lucide-react";
import FoodReviewManager from "./FoodReviewManager";
import * as XLSX from 'xlsx';
import { Food, getAllFoodsSafe, getMacroGroup } from "@/lib/foodService";

type Alimento = Food;

export default function FoodManager() {
  const { user } = useAuth();
  const [alimentos, setAlimentos] = useState<Alimento[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFood, setEditingFood] = useState<Alimento | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [loading, setLoading] = useState(true);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showReviewManager, setShowReviewManager] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    portion: "100",
    calories: "",
    carbs: "",
    protein: "",
    fat: "",
  });

  useEffect(() => {
    carregarDados();
  }, []);

  // Calcula calorias baseado nos macros (CHO: 4kcal/g, PTN: 4kcal/g, LIP: 9kcal/g)
  const calcularCaloriasDosMacros = () => {
    const cho = parseFloat(formData.carbs) || 0;
    const ptn = parseFloat(formData.protein) || 0;
    const lip = parseFloat(formData.fat) || 0;
    
    return (cho * 4) + (ptn * 4) + (lip * 9);
  };

  // Verifica se há inconsistência entre calorias informadas e calculadas
  const verificarInconsistencia = () => {
    const kcalInformada = parseFloat(formData.calories) || 0;
    const kcalCalculada = calcularCaloriasDosMacros();
    
    if (kcalInformada === 0 || kcalCalculada === 0) return null;
    
    const diferenca = Math.abs(kcalInformada - kcalCalculada);
    const percentualDiferenca = (diferenca / kcalCalculada) * 100;
    
    // Considera inconsistente se a diferença for maior que 10%
    if (percentualDiferenca > 10) {
      return {
        diferenca: diferenca.toFixed(1),
        percentual: percentualDiferenca.toFixed(1),
        kcalCalculada: kcalCalculada.toFixed(1)
      };
    }
    
    return null;
  };

  const ajustarCaloriasAutomaticamente = () => {
    const kcalCalculada = calcularCaloriasDosMacros();
    setFormData({ ...formData, calories: kcalCalculada.toFixed(1) });
    toast.success("Calorias ajustadas automaticamente!");
  };

  const downloadTemplate = () => {
    const csvContent = `name,portion,calories,carbs,protein,fat
Frango grelhado,100,165,0,31,3.6
Arroz branco cozido,100,130,28,2.7,0.3
Batata doce,100,86,20,1.6,0.1`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_alimentos.csv';
    link.click();
    toast.success("Template baixado com sucesso!");
  };

  // Determinar tipo automaticamente
  const determinarTipo = (nome: string, proteina: number, carboidrato: number, gordura: number): string => {
    const nomeLower = nome.toLowerCase();
    
    // Frutas
    const frutas = ['banana', 'maçã', 'laranja', 'limão', 'manga', 'mamão', 'melão', 'melancia', 'uva', 
                    'morango', 'abacaxi', 'pêra', 'pêssego', 'ameixa', 'acerola', 'kiwi', 'goiaba',
                    'maracujá', 'tangerina', 'mexerica', 'graviola', 'jabuticaba', 'jaca', 'caju'];
    if (frutas.some(f => nomeLower.includes(f))) {
      return 'Frutas';
    }
    
    // Vegetais e Legumes
    const vegetais = ['alface', 'brócolis', 'couve', 'espinafre', 'repolho', 'rúcula', 'agrião', 
                      'tomate', 'cenoura', 'beterraba', 'pepino', 'cebola', 'alho', 'pimentão',
                      'abobrinha', 'berinjela', 'quiabo', 'vagem', 'chuchu', 'jiló', 'palmito',
                      'abóbora', 'acelga', 'chicória', 'almeirão'];
    if (vegetais.some(v => nomeLower.includes(v))) {
      return 'Vegetais';
    }
    
    // Laticínios
    const laticinios = ['leite', 'queijo', 'iogurte', 'requeijão', 'manteiga', 'creme de leite',
                        'ricota', 'mussarela', 'cottage', 'petit suisse', 'doce de leite'];
    if (laticinios.some(l => nomeLower.includes(l))) {
      return 'Laticínios';
    }
    
    // Proteínas (carnes, peixes, ovos)
    const proteinas = ['carne', 'frango', 'peixe', 'atum', 'salmão', 'camarão', 'sardinha', 
                       'ovo', 'peru', 'lingüiça', 'linguiça', 'hambúrguer', 'bacon', 'presunto',
                       'salame', 'fígado', 'coração', 'moela', 'lombo', 'filé', 'peito',
                       'coxa', 'sobrecoxa', 'acém', 'patinho', 'alcatra', 'picanha', 'costela',
                       'lagarto', 'maminha', 'cupim', 'músculo', 'whey'];
    if (proteinas.some(p => nomeLower.includes(p)) || (proteina > 15 && carboidrato < 10)) {
      return 'Proteínas';
    }
    
    // Lipídios (gorduras, óleos, oleaginosas)
    const lipidios = ['óleo', 'azeite', 'margarina', 'castanha', 'amendoim', 'abacate',
                      'gergelim', 'linhaça', 'amêndoa', 'coco', 'pasta de amendoim'];
    if (lipidios.some(l => nomeLower.includes(l)) || gordura > 40) {
      return 'Lipídeos';
    }
    
    // Carboidratos (default - pães, arroz, massas, tubérculos)
    return 'Carboidratos';
  };

  // Determinar origem da proteína
  const determinarOrigemProteina = (nome: string): string => {
    const nomeLower = nome.toLowerCase();
    
    const animal = ['carne', 'frango', 'peixe', 'atum', 'salmão', 'camarão', 'ovo', 'leite', 'queijo', 'peru', 'bacon'];
    const vegetal = ['feijão', 'lentilha', 'soja', 'arroz', 'batata', 'aveia', 'granola'];
    
    for (const palavra of animal) {
      if (nomeLower.includes(palavra)) return 'Animal';
    }
    
    for (const palavra of vegetal) {
      if (nomeLower.includes(palavra)) return 'Vegetal';
    }
    
    return 'Mista';
  };

  const processarArquivo = async (file: File) => {
    try {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        // Processar Excel - TODAS as abas
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer);
        
        const processed: any[] = [];
        const nomesProcessados = new Set<string>();
        
        // Iterar por TODAS as abas do Excel
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          
          console.log(`Processando aba: ${sheetName} com ${jsonData.length} linhas`);
          
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || !row[0] || row[0].toString().trim() === '') continue;
            
            const nome = row[0]?.toString().trim();
            
            // Evitar duplicatas
            if (nomesProcessados.has(nome.toLowerCase())) continue;
            nomesProcessados.add(nome.toLowerCase());
            
            const proteina = parseFloat(row[3]) || 0;
            const carboidrato = parseFloat(row[4]) || 0;
            const gordura = parseFloat(row[5]) || 0;
            const calorias = parseFloat(row[2]) || 0;
            const fibra = parseFloat(row[6]) || null;
            
            // Aceitar alimentos mesmo com 0 calorias (água, chá, etc.)
            if (!nome) continue;
            
            processed.push({
              name: nome,
              portion: 100,
              calories: calorias,
              carbs: carboidrato,
              protein: proteina,
              fat: gordura,
              note: fibra ? `Fibra: ${fibra}g | Fonte: TACO` : 'Fonte: TACO'
            });
          }
        }
        
        console.log(`Total processado: ${processed.length} alimentos`);
        return processed;
      } else {
        // Processar CSV (mantém lógica existente)
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        const processed = [];
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          if (values.length < 6) continue;
          
          const [name, portion, calories, carbs, protein, fat] = values;
          processed.push({
            name,
            portion: parseFloat(portion) || 100,
            calories: parseFloat(calories) || 0,
            carbs: parseFloat(carbs) || 0,
            protein: parseFloat(protein) || 0,
            fat: parseFloat(fat) || 0
          });
        }
        
        return processed;
      }
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      throw error;
    }
  };

  const handleFileSelect = async (file: File | null) => {
    setImportFile(file);
    setShowPreview(false);
    setImportPreview([]);
    
    if (!file) return;
    
    try {
      const processed = await processarArquivo(file);
      setImportPreview(processed);
      setShowPreview(true);
      toast.success(`${processed.length} alimentos prontos para importar`);
    } catch (error) {
      toast.error("Erro ao processar arquivo");
      console.error(error);
    }
  };

  const handleImportFile = async () => {
    if (importPreview.length === 0) {
      toast.error("Nenhum alimento para importar");
      return;
    }

    setImporting(true);

    try {
      if (!user) {
        toast.error("Você precisa estar autenticado");
        setImporting(false);
        return;
      }

      // Buscar alimentos existentes para evitar duplicatas
      const existingResult = await getAllFoodsSafe();
      const existingFoods = existingResult.success && Array.isArray(existingResult.data) ? existingResult.data : [];
      const existingNames = new Set(existingFoods.map(f => f.name.toLowerCase()));

      // Filtrar apenas alimentos novos
      const novosAlimentos = importPreview.filter(item => 
        !existingNames.has(String(item.name || '').toLowerCase())
      );

      if (novosAlimentos.length === 0) {
        toast.info("Todos os alimentos já existem no banco de dados");
        setIsImportDialogOpen(false);
        setImporting(false);
        return;
      }

      const alimentosParaInserir = novosAlimentos.map(item => ({
        ...item,
        author: user.id
      }));

      console.log(`Inserindo ${alimentosParaInserir.length} novos alimentos`);

      // Inserir em lotes de 50
      const batchSize = 50;
      let importados = 0;
      let erros = 0;
      
      for (let i = 0; i < alimentosParaInserir.length; i += batchSize) {
        const batch = alimentosParaInserir.slice(i, i + batchSize);
        try {
          const result = await apiClient.requestSafe<any[]>('/api/alimentos', {
            method: 'POST',
            body: JSON.stringify(batch),
          });
          importados += result.success && Array.isArray(result.data) ? result.data.length : 0;
        } catch (error) {
          console.error('Erro no lote:', error);
          erros += batch.length;
        }
      }

      if (importados > 0) {
        toast.success(`${importados} alimentos importados com sucesso!`);
      }
      if (erros > 0) {
        toast.warning(`${erros} alimentos não puderam ser importados`);
      }
      
      setIsImportDialogOpen(false);
      setImportFile(null);
      setImportPreview([]);
      setShowPreview(false);
      carregarDados();
    } catch (error: any) {
      console.error("Erro ao importar:", error);
      toast.error(error.message || "Erro ao importar alimentos");
    } finally {
      setImporting(false);
    }
  };

  const carregarDados = async () => {
    setLoading(true);
    try {
      const alimentosRes = await getAllFoodsSafe();
      setAlimentos(alimentosRes.success && Array.isArray(alimentosRes.data) ? alimentosRes.data : []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar alimentos");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      portion: "100",
      calories: "",
      carbs: "",
      protein: "",
      fat: "",
    });
    setEditingFood(null);
  };

  const handleSave = async () => {
    try {
      // Validação básica
      if (!formData.name) {
        toast.error("Preencha os campos obrigatórios");
        return;
      }

      // Verificar inconsistência e avisar
      const inconsistencia = verificarInconsistencia();
      if (inconsistencia) {
        const confirmar = confirm(
          `Atenção: As calorias informadas (${formData.calories} kcal) diferem das calculadas (${inconsistencia.kcalCalculada} kcal) em ${inconsistencia.percentual}%.\n\nDeseja continuar mesmo assim?`
        );
        if (!confirmar) return;
      }

      if (!user) {
        toast.error("Você precisa estar autenticado");
        return;
      }

      const alimentoData = {
        name: formData.name.trim(),
        portion: parseFloat(formData.portion) || 100,
        calories: parseFloat(formData.calories) || 0,
        carbs: parseFloat(formData.carbs) || 0,
        protein: parseFloat(formData.protein) || 0,
        fat: parseFloat(formData.fat) || 0,
        author: user.id,
      };

      if (editingFood) {
        const result = await apiClient.requestSafe(`/api/alimentos/${editingFood.id}`, {
          method: 'PATCH',
          body: JSON.stringify(alimentoData),
        });
        if (!result.success) {
          throw new Error(result.error || 'Erro ao atualizar alimento');
        }
        toast.success("Alimento atualizado com sucesso!");
      } else {
        const result = await apiClient.requestSafe('/api/alimentos', {
          method: 'POST',
          body: JSON.stringify(alimentoData),
        });
        if (!result.success) {
          throw new Error(result.error || 'Erro ao cadastrar alimento');
        }
        toast.success("Alimento cadastrado com sucesso!");
      }

      setIsDialogOpen(false);
      resetForm();
      carregarDados();
    } catch (error: any) {
      console.error("Erro ao salvar alimento:", error);
      toast.error(error.message || "Erro ao salvar alimento");
    }
  };

  const handleEdit = (alimento: Alimento) => {
    setEditingFood(alimento);
    setFormData({
      name: alimento.name,
      portion: alimento.portion.toString(),
      calories: alimento.calories.toString(),
      carbs: alimento.carbs.toString(),
      protein: alimento.protein.toString(),
      fat: alimento.fat.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este alimento?")) return;

    try {
      // DESIGN-SUPABASE-PURGE-GLOBAL-003: Usar rota semântica ao invés de from()
      await apiClient.request(`/api/alimentos/${id}`, { method: 'DELETE' });

      toast.success("Alimento excluído com sucesso!");
      carregarDados();
    } catch (error: any) {
      console.error("Erro ao excluir alimento:", error);
      toast.error(error.message || "Erro ao excluir alimento");
    }
  };

  const filteredAlimentos = alimentos.filter((alimento) => {
    const matchesSearch = alimento.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || getMacroGroup(alimento) === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Paginação
  const totalPages = Math.ceil(filteredAlimentos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAlimentos = filteredAlimentos.slice(startIndex, startIndex + itemsPerPage);

  // Reset página quando filtro muda
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setCurrentPage(1);
  };

  const getTipoNome = (alimento: Alimento) => {
    const group = getMacroGroup(alimento);
    if (group === 'protein') return 'Proteínas';
    if (group === 'carb') return 'Carboidratos';
    if (group === 'fat') return 'Lipídios';
    return 'Misto';
  };

  // Se estiver mostrando o gerenciador de revisão, renderiza apenas ele
  if (showReviewManager) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <FoodReviewManager onBack={() => setShowReviewManager(false)} />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Apple className="w-8 h-8 text-primary" />
            Gerenciar Alimentos
          </h1>
          <p className="text-muted-foreground mt-1">
            Adicione e gerencie alimentos para criar dietas personalizadas
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => setShowReviewManager(true)}
          >
            <ClipboardCheck className="w-4 h-4" />
            Revisar / Mesclar
          </Button>
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                Importar CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  Importar Alimentos
                </DialogTitle>
                <DialogDescription>
                  Importe alimentos em massa de arquivos Excel (TACO) ou CSV
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Formatos suportados:</Label>
                    <div className="flex gap-2">
                      <Badge variant="outline">.xlsx</Badge>
                      <Badge variant="outline">.xls</Badge>
                      <Badge variant="outline">.csv</Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="file">Selecionar Arquivo</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                  />
                  {importFile && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      {importFile.name}
                    </p>
                  )}
                </div>

                {showPreview && importPreview.length > 0 && (
                  <div className="space-y-2">
                    <Label>Preview (primeiros 5 alimentos)</Label>
                    <div className="border rounded-lg max-h-60 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="text-left p-2 font-medium">Nome</th>
                            <th className="text-left p-2 font-medium">Tipo</th>
                            <th className="text-right p-2 font-medium">Kcal</th>
                            <th className="text-right p-2 font-medium">PTN</th>
                            <th className="text-right p-2 font-medium">CHO</th>
                            <th className="text-right p-2 font-medium">LIP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.slice(0, 5).map((item, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="p-2">{item.name}</td>
                              <td className="p-2">
                                <Badge variant="outline" className="text-xs">{getTipoNome(item)}</Badge>
                              </td>
                              <td className="p-2 text-right">{item.calories}</td>
                              <td className="p-2 text-right">{item.protein}g</td>
                              <td className="p-2 text-right">{item.carbs}g</td>
                              <td className="p-2 text-right">{item.fat}g</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Total: {importPreview.length} alimentos serão importados
                    </p>
                  </div>
                )}

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <strong>Processamento automático TACO:</strong> O sistema detectará automaticamente 
                    o tipo e origem da proteína de cada alimento. Arquivos Excel da TACO são processados automaticamente.
                  </AlertDescription>
                </Alert>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsImportDialogOpen(false);
                    setImportFile(null);
                    setImportPreview([]);
                    setShowPreview(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleImportFile}
                  disabled={!showPreview || importPreview.length === 0 || importing}
                >
                  {importing ? "Importando..." : `Importar ${importPreview.length} Alimentos`}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Novo Alimento
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingFood ? "Editar Alimento" : "Cadastrar Novo Alimento"}
              </DialogTitle>
              <DialogDescription>
                Preencha as informações nutricionais do alimento
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Alimento *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Frango grelhado"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="portion">Porção padrão (g)</Label>
                  <Input
                    id="portion"
                    type="number"
                    value={formData.portion}
                    onChange={(e) => setFormData({ ...formData, portion: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Padrão: 100g</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Informações Nutricionais</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={ajustarCaloriasAutomaticamente}
                    className="gap-2"
                  >
                    <Calculator className="w-4 h-4" />
                    Auto-calcular calorias
                  </Button>
                </div>
                
                {verificarInconsistencia() && (
                  <Alert className="mb-4 border-amber-500/50 bg-amber-500/10">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-sm text-amber-800">
                      <strong>Inconsistência detectada:</strong> As calorias informadas (
                      {formData.calories} kcal) diferem das calculadas pelos macros (
                      {verificarInconsistencia()?.kcalCalculada} kcal) em{" "}
                      {verificarInconsistencia()?.percentual}%. Clique em "Auto-calcular" para ajustar.
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="calories">Calorias (kcal)</Label>
                    <Input
                      id="calories"
                      type="number"
                      step="0.1"
                      value={formData.calories}
                      onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Baseado nos macros: {calcularCaloriasDosMacros().toFixed(1)} kcal
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="carbs">Carboidratos (g)</Label>
                    <Input
                      id="carbs"
                      type="number"
                      step="0.1"
                      value={formData.carbs}
                      onChange={(e) => setFormData({ ...formData, carbs: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="protein">Proteínas (g)</Label>
                    <Input
                      id="protein"
                      type="number"
                      step="0.1"
                      value={formData.protein}
                      onChange={(e) => setFormData({ ...formData, protein: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fat">Lipídios (g)</Label>
                    <Input
                      id="fat"
                      type="number"
                      step="0.1"
                      value={formData.fat}
                      onChange={(e) => setFormData({ ...formData, fat: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="info">Observações</Label>
                <Textarea
                  id="info"
                  value=""
                  onChange={() => {}}
                  placeholder="Observações opcionais (não persistidas)"
                  rows={3}
                  disabled
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingFood ? "Atualizar" : "Cadastrar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="sticky top-0 z-10 bg-background pb-4 pt-2 -mt-2 border-b mb-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar alimento..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              <SelectItem value="protein">Proteínas</SelectItem>
              <SelectItem value="carb">Carboidratos</SelectItem>
              <SelectItem value="fat">Lipídios</SelectItem>
              <SelectItem value="mixed">Misto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {filteredAlimentos.length} alimentos encontrados
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Carregando alimentos...</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {paginatedAlimentos.map((alimento) => {
            const isAutor = alimento.autor === user?.id;
            
            return (
              <Card key={alimento.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {alimento.name}
                        {isAutor && (
                          <Badge variant="secondary" className="text-xs">
                            Seu alimento
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        <Badge variant="outline">{getTipoNome(alimento)}</Badge>
                        <span className="mx-2">•</span>
                        <span className="text-xs">
                          Grupo: <span className="font-medium">{getTipoNome(alimento)}</span>
                        </span>
                      </CardDescription>
                    </div>
                    {isAutor && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(alimento)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(alimento.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Porção</p>
                      <p className="font-semibold">{alimento.portion}g</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Calorias</p>
                      <p className="font-semibold">{alimento.calories} kcal</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Carboidratos</p>
                      <p className="font-semibold">{alimento.carbs}g</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Proteínas</p>
                      <p className="font-semibold">{alimento.protein}g</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Lipídios</p>
                      <p className="font-semibold">{alimento.fat}g</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {paginatedAlimentos.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  {searchTerm || selectedCategory !== "all"
                    ? "Nenhum alimento encontrado com os filtros aplicados"
                    : "Nenhum alimento cadastrado"}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-9"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
