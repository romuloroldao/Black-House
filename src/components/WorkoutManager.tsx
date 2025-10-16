import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Search, 
  Filter, 
  Copy, 
  Edit3, 
  Trash2, 
  Clock, 
  Target, 
  Users,
  Play,
  Star,
  Calendar,
  Dumbbell
} from "lucide-react";
import WorkoutForm from "./WorkoutForm";
import WorkoutTemplates from "./WorkoutTemplates";

const WorkoutManager = () => {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarTreinos();
  }, []);

  const carregarTreinos = async () => {
    try {
      const { data, error } = await supabase
        .from('treinos')
        .select('*')
        .eq('is_template', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const treinosFormatados = data?.map(treino => ({
        id: treino.id,
        name: treino.nome,
        description: treino.descricao || '',
        duration: treino.duracao,
        difficulty: treino.dificuldade,
        exercises: treino.num_exercicios,
        studentsAssigned: 0, // TODO: implementar quando houver relação com alunos
        category: treino.categoria,
        lastModified: new Date(treino.updated_at).toISOString().split('T')[0],
        isTemplate: treino.is_template,
        tags: treino.tags || []
      })) || [];

      setWorkouts(treinosFormatados);
    } catch (error) {
      console.error('Erro ao carregar treinos:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkouts = workouts.filter(workout =>
    workout.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    workout.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    workout.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Iniciante": return "bg-success/10 text-success border-success/20";
      case "Intermediário": return "bg-warning/10 text-warning border-warning/20";
      case "Avançado": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-muted/10 text-muted-foreground border-muted/20";
    }
  };

  const handleEditWorkout = (workout: any) => {
    setSelectedWorkout(workout);
    setActiveView("form");
  };

  const handleCreateNew = () => {
    setSelectedWorkout(null);
    setActiveView("form");
  };

  const handleDeleteWorkout = async (workoutId: string) => {
    if (!confirm("Tem certeza que deseja deletar este treino?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from('treinos')
        .delete()
        .eq('id', workoutId);

      if (error) throw error;

      toast({
        title: "Treino deletado!",
        description: "O treino foi removido com sucesso.",
      });

      carregarTreinos();
    } catch (error) {
      console.error('Erro ao deletar treino:', error);
      toast({
        title: "Erro ao deletar",
        description: "Não foi possível remover o treino.",
        variant: "destructive",
      });
    }
  };

  const renderWorkoutCard = (workout: any) => (
    <Card key={workout.id} className="group hover:shadow-elevated transition-smooth">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg">{workout.name}</CardTitle>
              {workout.isTemplate && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  <Star className="w-3 h-3 mr-1" />
                  Template
                </Badge>
              )}
            </div>
            <CardDescription className="text-sm line-clamp-2">
              {workout.description}
            </CardDescription>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-smooth">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleEditWorkout(workout)}
            >
              <Edit3 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Copy className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => handleDeleteWorkout(workout.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {workout.tags.map((tag: string) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{workout.duration} min</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Dumbbell className="w-4 h-4" />
              <span>{workout.exercises} exercícios</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{workout.studentsAssigned} alunos</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getDifficultyColor(workout.difficulty)} variant="outline">
                {workout.difficulty}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Atualizado em {new Date(workout.lastModified).toLocaleDateString('pt-BR')}
            </span>
            <Button variant="outline" size="sm" className="h-8">
              <Play className="w-3 h-3 mr-1" />
              Visualizar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (activeView === "form") {
    return (
      <WorkoutForm 
        workout={selectedWorkout}
        onBack={() => setActiveView("list")}
        onSave={() => {
          setActiveView("list");
          carregarTreinos();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Gerenciar Treinos
          </h1>
          <p className="text-muted-foreground">
            Crie, edite e organize seus treinos personalizados
          </p>
        </div>
        <Button onClick={handleCreateNew} className="shadow-glow">
          <Plus className="w-4 h-4 mr-2" />
          Novo Treino
        </Button>
      </div>

      <Tabs defaultValue="workouts" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="workouts">Meus Treinos</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="workouts" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Buscar treinos por nome, descrição ou tags..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" className="shrink-0">
                  <Filter className="w-4 h-4 mr-2" />
                  Filtros
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Dumbbell className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{workouts.length}</p>
                    <p className="text-xs text-muted-foreground">Total Treinos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Star className="w-5 h-5 text-warning" />
                  <div>
                    <p className="text-2xl font-bold">{workouts.filter(w => w.isTemplate).length}</p>
                    <p className="text-xs text-muted-foreground">Templates</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-success" />
                  <div>
                    <p className="text-2xl font-bold">{workouts.reduce((acc, w) => acc + w.studentsAssigned, 0)}</p>
                    <p className="text-xs text-muted-foreground">Atribuições</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-accent" />
                  <div>
                    <p className="text-2xl font-bold">
                      {workouts.length > 0 ? Math.round(workouts.reduce((acc, w) => acc + w.duration, 0) / workouts.length) : 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Duração Média</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Workouts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredWorkouts.map(renderWorkoutCard)}
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <WorkoutTemplates onUseTemplate={handleEditWorkout} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WorkoutManager;