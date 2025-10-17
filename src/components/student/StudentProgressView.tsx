import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Camera, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const StudentProgressView = () => {
  const { user } = useAuth();
  const [fotos, setFotos] = useState<any[]>([]);
  const [alunoId, setAlunoId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadProgressData();
    }
  }, [user]);

  const loadProgressData = async () => {
    const { data: aluno } = await supabase
      .from("alunos")
      .select("id")
      .eq("email", user?.email)
      .single();

    if (aluno) {
      setAlunoId(aluno.id);

      const { data: fotosData } = await supabase
        .from("fotos_alunos")
        .select("*")
        .eq("aluno_id", aluno.id)
        .order("created_at", { ascending: false });

      setFotos(fotosData || []);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Meu Progresso</h1>
          <p className="text-muted-foreground">
            Acompanhe sua evolução com fotos e relatórios
          </p>
        </div>
        <Button variant="premium">
          <Camera className="h-4 w-4 mr-2" />
          Upload de Foto
        </Button>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Evolução
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Funcionalidade de upload e visualização de progresso em desenvolvimento.
              Em breve você poderá fazer upload de suas fotos de progresso diretamente por aqui.
            </p>
          </div>
        </CardContent>
      </Card>

      {fotos.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {fotos.map((foto) => (
            <Card key={foto.id} className="shadow-card overflow-hidden">
              <div className="aspect-square bg-muted">
                <img
                  src={foto.url}
                  alt={foto.descricao || "Foto de progresso"}
                  className="w-full h-full object-cover"
                />
              </div>
              {foto.descricao && (
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{foto.descricao}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(foto.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentProgressView;
