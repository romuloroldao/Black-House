import { useState } from "react";
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
  const [activeView, setActiveView] = useState("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWorkout, setSelectedWorkout] = useState(null);

  // Mock data - seria substituído por dados do Supabase
  const workouts = [
    {
      id: 1,
      name: "Treino A - Peito e Tríceps",
      description: "Foco em desenvolvimento do peitoral e fortalecimento dos tríceps",
      duration: 60,
      difficulty: "Intermediário",
      exercises: 8,
      studentsAssigned: 12,
      category: "Hipertrofia",
      lastModified: "2024-01-15",
      isTemplate: false,
      tags: ["Peito", "Tríceps", "Força"]
    },
    {
      id: 2,
      name: "HIIT Cardio Intenso",
      description: "Treino intervalado de alta intensidade para queima de gordura",
      duration: 30,
      difficulty: "Avançado",
      exercises: 6,
      studentsAssigned: 8,
      category: "Cardio",
      lastModified: "2024-01-14",
      isTemplate: true,
      tags: ["HIIT", "Cardio", "Queima"]
    },
    {
      id: 3,
      name: "Funcional Iniciante",
      description: "Treino funcional básico para iniciantes no mundo fitness",
      duration: 45,
      difficulty: "Iniciante",
      exercises: 10,
      studentsAssigned: 15,
      category: "Funcional",
      lastModified: "2024-01-13",
      isTemplate: false,
      tags: ["Funcional", "Básico", "Mobilidade"]
    }
  ];

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
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive">
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
        onSave={() => setActiveView("list")}
      />
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
                    <p className="text-2xl font-bold">{Math.round(workouts.reduce((acc, w) => acc + w.duration, 0) / workouts.length)}</p>
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