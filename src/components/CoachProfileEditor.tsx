import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { 
  Save, 
  Plus, 
  X, 
  Upload,
  User,
  Award,
  Calendar,
  Users,
  Target,
  Trophy,
  Sparkles
} from "lucide-react";

interface Conquista {
  titulo: string;
  ano: number;
  descricao?: string;
}

interface CoachProfileData {
  id?: string;
  user_id: string;
  nome_completo: string;
  bio: string;
  especialidades: string[];
  conquistas: Conquista[];
  anos_experiencia: number;
  total_alunos_acompanhados: number;
  principais_resultados: string;
  avatar_url: string | null;
}

const CoachProfileEditor = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newEspecialidade, setNewEspecialidade] = useState("");
  const [newConquista, setNewConquista] = useState<Conquista>({ titulo: "", ano: new Date().getFullYear() });
  
  const [profile, setProfile] = useState<CoachProfileData>({
    user_id: "",
    nome_completo: "",
    bio: "",
    especialidades: [],
    conquistas: [],
    anos_experiencia: 0,
    total_alunos_acompanhados: 0,
    principais_resultados: "",
    avatar_url: null,
  });

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("coach_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setProfile({
          ...data,
          nome_completo: data.nome_completo || "",
          bio: data.bio || "",
          especialidades: data.especialidades || [],
          conquistas: (data.conquistas as unknown as Conquista[]) || [],
          anos_experiencia: data.anos_experiencia || 0,
          total_alunos_acompanhados: data.total_alunos_acompanhados || 0,
          principais_resultados: data.principais_resultados || "",
          avatar_url: data.avatar_url,
        });
      } else {
        // Initialize new profile
        setProfile(prev => ({ ...prev, user_id: user.id }));
      }
    } catch (error) {
      // Profile doesn't exist yet, that's ok
      setProfile(prev => ({ ...prev, user_id: user.id }));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const profileData = {
        user_id: user.id,
        nome_completo: profile.nome_completo,
        bio: profile.bio,
        especialidades: profile.especialidades,
        conquistas: profile.conquistas as unknown as any,
        anos_experiencia: profile.anos_experiencia,
        total_alunos_acompanhados: profile.total_alunos_acompanhados,
        principais_resultados: profile.principais_resultados,
        avatar_url: profile.avatar_url,
      };

      if (profile.id) {
        const { error } = await supabase
          .from("coach_profiles")
          .update(profileData)
          .eq("id", profile.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("coach_profiles")
          .insert(profileData)
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setProfile(prev => ({ ...prev, id: data.id }));
        }
      }

      toast({
        title: "Perfil salvo!",
        description: "Seu perfil foi atualizado com sucesso.",
      });
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o perfil.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addEspecialidade = () => {
    if (newEspecialidade.trim() && !profile.especialidades.includes(newEspecialidade.trim())) {
      setProfile(prev => ({
        ...prev,
        especialidades: [...prev.especialidades, newEspecialidade.trim()],
      }));
      setNewEspecialidade("");
    }
  };

  const removeEspecialidade = (esp: string) => {
    setProfile(prev => ({
      ...prev,
      especialidades: prev.especialidades.filter(e => e !== esp),
    }));
  };

  const addConquista = () => {
    if (newConquista.titulo.trim()) {
      setProfile(prev => ({
        ...prev,
        conquistas: [...prev.conquistas, { ...newConquista }],
      }));
      setNewConquista({ titulo: "", ano: new Date().getFullYear() });
    }
  };

  const removeConquista = (index: number) => {
    setProfile(prev => ({
      ...prev,
      conquistas: prev.conquistas.filter((_, i) => i !== index),
    }));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `coach-${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));

      toast({
        title: "Foto atualizada!",
        description: "Sua foto de perfil foi atualizada.",
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "Erro ao enviar foto",
        description: "Não foi possível enviar a foto.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Perfil do Coach</h1>
          <p className="text-muted-foreground">
            Configure seu perfil para que seus alunos possam conhecer você melhor
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      {/* Avatar and Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Informações Básicas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {profile.nome_completo?.charAt(0) || "C"}
                </AvatarFallback>
              </Avatar>
              <label className="absolute -bottom-2 -right-2 p-2 bg-primary rounded-full cursor-pointer hover:bg-primary/90 transition-colors">
                <Upload className="h-4 w-4 text-primary-foreground" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </label>
            </div>
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo</Label>
                <Input
                  id="nome"
                  value={profile.nome_completo}
                  onChange={(e) => setProfile(prev => ({ ...prev, nome_completo: e.target.value }))}
                  placeholder="Seu nome completo"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Resumo Profissional</Label>
            <Textarea
              id="bio"
              value={profile.bio}
              onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
              placeholder="Conte um pouco sobre você, sua formação e filosofia de trabalho..."
              className="min-h-[120px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Especialidades */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Especialidades
          </CardTitle>
          <CardDescription>
            Adicione suas áreas de especialização
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {profile.especialidades.map((esp, i) => (
              <Badge key={i} variant="secondary" className="text-sm py-1 px-3">
                {esp}
                <button
                  onClick={() => removeEspecialidade(esp)}
                  className="ml-2 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newEspecialidade}
              onChange={(e) => setNewEspecialidade(e.target.value)}
              placeholder="Ex: Alta Performance, Emagrecimento, Hipertrofia..."
              onKeyPress={(e) => e.key === "Enter" && addEspecialidade()}
            />
            <Button onClick={addEspecialidade} variant="outline" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Indicadores
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="anos">Anos de Experiência</Label>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                id="anos"
                type="number"
                min="0"
                value={profile.anos_experiencia}
                onChange={(e) => setProfile(prev => ({ ...prev, anos_experiencia: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="alunos">Alunos Acompanhados</Label>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Input
                id="alunos"
                type="number"
                min="0"
                value={profile.total_alunos_acompanhados}
                onChange={(e) => setProfile(prev => ({ ...prev, total_alunos_acompanhados: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="resultados">Principais Resultados Alcançados</Label>
            <Textarea
              id="resultados"
              value={profile.principais_resultados}
              onChange={(e) => setProfile(prev => ({ ...prev, principais_resultados: e.target.value }))}
              placeholder="Descreva os principais resultados que você ajudou seus alunos a alcançar..."
              className="min-h-[100px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Conquistas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Conquistas e Marcos da Carreira
          </CardTitle>
          <CardDescription>
            Adicione suas conquistas, certificações e marcos importantes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile.conquistas.length > 0 && (
            <div className="space-y-3">
              {profile.conquistas
                .sort((a, b) => b.ano - a.ano)
                .map((conquista, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Award className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{conquista.ano}</Badge>
                      <span className="font-medium">{conquista.titulo}</span>
                    </div>
                    {conquista.descricao && (
                      <p className="text-sm text-muted-foreground mt-1">{conquista.descricao}</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeConquista(index)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3 p-4 border border-dashed rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Título da Conquista</Label>
                <Input
                  value={newConquista.titulo}
                  onChange={(e) => setNewConquista(prev => ({ ...prev, titulo: e.target.value }))}
                  placeholder="Ex: Certificação CREF, Campeonato..."
                />
              </div>
              <div className="space-y-2">
                <Label>Ano</Label>
                <Input
                  type="number"
                  value={newConquista.ano}
                  onChange={(e) => setNewConquista(prev => ({ ...prev, ano: parseInt(e.target.value) || new Date().getFullYear() }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input
                value={newConquista.descricao || ""}
                onChange={(e) => setNewConquista(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Breve descrição da conquista..."
              />
            </div>
            <Button onClick={addConquista} variant="outline" className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Conquista
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CoachProfileEditor;
