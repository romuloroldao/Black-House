import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  Clock, 
  Target, 
  Video,
  GripVertical,
  Copy
} from "lucide-react";

interface WorkoutFormProps {
  workout?: any;
  onBack: () => void;
  onSave: () => void;
}

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  weight: string;
  rest: string;
  notes: string;
  videoUrl?: string;
  order: number;
}

const WorkoutForm = ({ workout, onBack, onSave }: WorkoutFormProps) => {
  const [formData, setFormData] = useState({
    name: workout?.name || "",
    description: workout?.description || "",
    category: workout?.category || "",
    difficulty: workout?.difficulty || "",
    duration: workout?.duration || 60,
    isTemplate: workout?.isTemplate || false,
    tags: workout?.tags || [],
    objectives: workout?.objectives || [],
    notes: workout?.notes || ""
  });

  const [exercises, setExercises] = useState<Exercise[]>(
    workout?.exercises || [
      {
        id: "1",
        name: "",
        sets: 3,
        reps: "12",
        weight: "",
        rest: "60s",
        notes: "",
        order: 1
      }
    ]
  );

  const [newTag, setNewTag] = useState("");

  const categories = [
    "Hipertrofia",
    "Força",
    "Resistência",
    "Cardio",
    "Funcional",
    "Mobilidade",
    "Reabilitação"
  ];

  const difficulties = ["Iniciante", "Intermediário", "Avançado"];

  const addExercise = () => {
    const newExercise: Exercise = {
      id: Date.now().toString(),
      name: "",
      sets: 3,
      reps: "12",
      weight: "",
      rest: "60s",
      notes: "",
      order: exercises.length + 1
    };
    setExercises([...exercises, newExercise]);
  };

  const removeExercise = (id: string) => {
    setExercises(exercises.filter(ex => ex.id !== id));
  };

  const updateExercise = (id: string, field: string, value: any) => {
    setExercises(exercises.map(ex => 
      ex.id === id ? { ...ex, [field]: value } : ex
    ));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim()]
      });
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleSave = () => {
    // Aqui faria a validação e salvaria no Supabase
    console.log("Salvando treino:", { formData, exercises });
    onSave();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            {workout ? "Editar Treino" : "Novo Treino"}
          </h1>
          <p className="text-muted-foreground">
            {workout ? "Modifique os detalhes do treino" : "Crie um novo treino personalizado"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="shadow-glow">
            <Save className="w-4 h-4 mr-2" />
            Salvar Treino
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informações Básicas */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>
                Dados gerais do treino
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Treino</Label>
                <Input
                  id="name"
                  placeholder="Ex: Treino A - Peito e Tríceps"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  placeholder="Descreva o objetivo e foco deste treino..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Dificuldade</Label>
                  <Select value={formData.difficulty} onValueChange={(value) => setFormData({...formData, difficulty: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {difficulties.map(diff => (
                        <SelectItem key={diff} value={diff}>{diff}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duração (minutos)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({...formData, duration: parseInt(e.target.value)})}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="template"
                  checked={formData.isTemplate}
                  onCheckedChange={(checked) => setFormData({...formData, isTemplate: checked})}
                />
                <Label htmlFor="template">Salvar como template</Label>
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
              <CardDescription>
                Adicione tags para facilitar a busca
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Nova tag"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTag()}
                />
                <Button onClick={addTag} size="icon" variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {formData.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                    {tag} ×
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Exercícios */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Exercícios</CardTitle>
                  <CardDescription>
                    Configure os exercícios deste treino
                  </CardDescription>
                </div>
                <Button onClick={addExercise} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Exercício
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {exercises.map((exercise, index) => (
                <div key={exercise.id} className="space-y-4 p-4 border border-border rounded-lg bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                      <span className="font-medium text-sm">Exercício {index + 1}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeExercise(exercise.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome do Exercício</Label>
                      <Input
                        placeholder="Ex: Supino Reto"
                        value={exercise.name}
                        onChange={(e) => updateExercise(exercise.id, 'name', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>URL do Vídeo (opcional)</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="https://..."
                          value={exercise.videoUrl || ""}
                          onChange={(e) => updateExercise(exercise.id, 'videoUrl', e.target.value)}
                        />
                        <Button variant="outline" size="icon">
                          <Video className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Séries</Label>
                      <Input
                        type="number"
                        value={exercise.sets}
                        onChange={(e) => updateExercise(exercise.id, 'sets', parseInt(e.target.value))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Repetições</Label>
                      <Input
                        placeholder="Ex: 12 ou 8-12"
                        value={exercise.reps}
                        onChange={(e) => updateExercise(exercise.id, 'reps', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Carga</Label>
                      <Input
                        placeholder="Ex: 60kg"
                        value={exercise.weight}
                        onChange={(e) => updateExercise(exercise.id, 'weight', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Descanso</Label>
                      <Input
                        placeholder="Ex: 60s"
                        value={exercise.rest}
                        onChange={(e) => updateExercise(exercise.id, 'rest', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      placeholder="Dicas de execução, observações importantes..."
                      value={exercise.notes}
                      onChange={(e) => updateExercise(exercise.id, 'notes', e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WorkoutForm;