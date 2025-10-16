import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Edit, Loader2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Student {
  id: string;
  nome: string;
  email: string;
  data_nascimento: string | null;
  peso: number | null;
  objetivo: string | null;
  created_at: string;
}

interface Feedback {
  id: string;
  feedback: string;
  updated_at: string;
}

interface Treino {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  dificuldade: string;
  duracao: number;
}

interface Dieta {
  id: string;
  nome: string;
  objetivo: string | null;
  data_criacao: string;
}

interface Foto {
  id: string;
  url: string;
  descricao: string | null;
  created_at: string;
}

export default function StudentDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [treino, setTreino] = useState<Treino | null>(null);
  const [dieta, setDieta] = useState<Dieta | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [selectedFoto, setSelectedFoto] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      carregarDadosAluno();
    }
  }, [id]);

  const carregarDadosAluno = async () => {
    try {
      setLoading(true);

      // Carregar dados do aluno
      const { data: alunoData, error: alunoError } = await supabase
        .from("alunos")
        .select("*")
        .eq("id", id)
        .single();

      if (alunoError) throw alunoError;
      setStudent(alunoData);

      // Carregar feedback
      const { data: feedbackData } = await supabase
        .from("feedbacks_alunos")
        .select("*")
        .eq("aluno_id", id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (feedbackData) {
        setFeedback(feedbackData.feedback);
        setFeedbackId(feedbackData.id);
      }

      // Carregar treino atual
      const { data: treinoData } = await supabase
        .from("alunos_treinos")
        .select(`
          treino_id,
          treinos (
            id,
            nome,
            descricao,
            categoria,
            dificuldade,
            duracao
          )
        `)
        .eq("aluno_id", id)
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (treinoData?.treinos) {
        setTreino(treinoData.treinos as unknown as Treino);
      }

      // Carregar dieta atual
      const { data: dietaData } = await supabase
        .from("dietas")
        .select("*")
        .eq("aluno_id", id)
        .order("data_criacao", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dietaData) {
        setDieta(dietaData);
      }

      // Carregar fotos
      const { data: fotosData } = await supabase
        .from("fotos_alunos")
        .select("*")
        .eq("aluno_id", id)
        .order("created_at", { ascending: false });

      if (fotosData) {
        setFotos(fotosData);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFeedback = async () => {
    if (!feedback.trim()) {
      toast({
        title: "Atenção",
        description: "Digite um feedback antes de salvar",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (feedbackId) {
        // Atualizar feedback existente
        const { error } = await supabase
          .from("feedbacks_alunos")
          .update({ feedback })
          .eq("id", feedbackId);

        if (error) throw error;
      } else {
        // Criar novo feedback
        const { data, error } = await supabase
          .from("feedbacks_alunos")
          .insert({
            aluno_id: id,
            coach_id: user.id,
            feedback,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) setFeedbackId(data.id);
      }

      toast({
        title: "Sucesso!",
        description: "Feedback salvo com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar feedback",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Aluno não encontrado</h2>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para lista de alunos
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{student.nome}</h1>
            <p className="text-muted-foreground">{student.email}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Dados Básicos */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="font-semibold">Data de Nascimento: </span>
              <span>{student.data_nascimento ? new Date(student.data_nascimento).toLocaleDateString('pt-BR') : "Não informado"}</span>
            </div>
            <div>
              <span className="font-semibold">Peso: </span>
              <span>{student.peso ? `${student.peso} kg` : "Não informado"}</span>
            </div>
            <div>
              <span className="font-semibold">Objetivo: </span>
              <span>{student.objetivo || "Não informado"}</span>
            </div>
          </CardContent>
        </Card>

        {/* Feedback */}
        <Card>
          <CardHeader>
            <CardTitle>Feedback do Professor</CardTitle>
            <CardDescription>Adicione observações e feedbacks personalizados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Digite seu feedback aqui..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <Button onClick={handleSaveFeedback} disabled={saving} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Feedback
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Treino Atual */}
        <Card>
          <CardHeader>
            <CardTitle>Treino Atual</CardTitle>
          </CardHeader>
          <CardContent>
            {treino ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{treino.nome}</h3>
                  <p className="text-sm text-muted-foreground">{treino.descricao}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline">{treino.categoria}</Badge>
                  <Badge variant="outline">{treino.dificuldade}</Badge>
                  <Badge variant="outline">{treino.duracao} min</Badge>
                </div>
                <Button className="w-full" variant="outline">
                  <Edit className="mr-2 h-4 w-4" />
                  Editar Treino
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">Nenhum treino atribuído</p>
                <Button variant="outline">Atribuir Treino</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dieta Atual */}
        <Card>
          <CardHeader>
            <CardTitle>Dieta Atual</CardTitle>
          </CardHeader>
          <CardContent>
            {dieta ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{dieta.nome}</h3>
                  <p className="text-sm text-muted-foreground">
                    Objetivo: {dieta.objetivo || "Não especificado"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Criada em: {new Date(dieta.data_criacao).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <Button className="w-full" variant="outline" onClick={() => navigate(`/dieta/${dieta.id}`)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar Dieta
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">Nenhuma dieta atribuída</p>
                <Button variant="outline">Criar Dieta</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fotos do Aluno */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Galeria de Fotos</CardTitle>
          <CardDescription>Progresso visual do aluno</CardDescription>
        </CardHeader>
        <CardContent>
          {fotos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {fotos.map((foto) => (
                <div
                  key={foto.id}
                  className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setSelectedFoto(foto.url)}
                >
                  <img
                    src={foto.url}
                    alt={foto.descricao || "Foto do aluno"}
                    className="w-full h-full object-cover"
                  />
                  {foto.descricao && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2">
                      {foto.descricao}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma foto disponível</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para ampliar foto */}
      <Dialog open={!!selectedFoto} onOpenChange={() => setSelectedFoto(null)}>
        <DialogContent className="max-w-4xl">
          {selectedFoto && (
            <img
              src={selectedFoto}
              alt="Foto ampliada"
              className="w-full h-auto"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
