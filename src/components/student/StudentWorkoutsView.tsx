import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dumbbell, Clock, Target } from "lucide-react";

const StudentWorkoutsView = () => {
  const { user } = useAuth();
  const [treino, setTreino] = useState<any>(null);

  useEffect(() => {
    if (user) {
      loadWorkoutData();
    }
  }, [user]);

  const loadWorkoutData = async () => {
    const { data: aluno } = await supabase
      .from("alunos")
      .select("id")
      .eq("email", user?.email)
      .single();

    if (aluno) {
      const { data: alunoTreino } = await supabase
        .from("alunos_treinos")
        .select("*, treinos(*)")
        .eq("aluno_id", aluno.id)
        .eq("ativo", true)
        .single();

      if (alunoTreino) {
        setTreino(alunoTreino.treinos);
      }
    }
  };

  if (!treino) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Dumbbell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum treino atribuído</h3>
          <p className="text-muted-foreground">
            Entre em contato com seu coach para receber seu treino personalizado
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Meus Treinos</h1>
        <p className="text-muted-foreground">Seu plano de treino personalizado</p>
      </div>

      <Card className="shadow-card border-primary/20">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{treino.nome}</CardTitle>
              <p className="text-muted-foreground mt-2">{treino.descricao}</p>
            </div>
            <Badge variant="premium" className="ml-4">Ativo</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <Target className="h-8 w-8 text-primary" />
              <div>
                <div className="text-sm text-muted-foreground">Categoria</div>
                <div className="font-semibold">{treino.categoria}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <Dumbbell className="h-8 w-8 text-primary" />
              <div>
                <div className="text-sm text-muted-foreground">Dificuldade</div>
                <div className="font-semibold">{treino.dificuldade}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <Clock className="h-8 w-8 text-primary" />
              <div>
                <div className="text-sm text-muted-foreground">Duração</div>
                <div className="font-semibold">{treino.duracao} min</div>
              </div>
            </div>
          </div>

          {treino.tags && treino.tags.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {treino.tags.map((tag: string, index: number) => (
                  <Badge key={index} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 rounded-lg bg-gradient-premium border border-primary/30">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Instruções
            </h3>
            <p className="text-sm text-muted-foreground">
              Siga este treino conforme orientado pelo seu coach. Mantenha a consistência e foco nos exercícios.
              Em caso de dúvidas, entre em contato através do chat.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentWorkoutsView;
