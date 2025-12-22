import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Award, 
  Users, 
  Calendar,
  Trophy,
  Target,
  Star,
  MessageSquare,
  Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CoachProfile {
  id: string;
  user_id: string;
  nome_completo: string | null;
  bio: string | null;
  especialidades: string[];
  conquistas: Array<{ titulo: string; ano: number; descricao?: string }>;
  anos_experiencia: number;
  total_alunos_acompanhados: number;
  principais_resultados: string | null;
  avatar_url: string | null;
}

interface CoachProfileViewProps {
  onChatClick?: () => void;
}

const CoachProfileView = ({ onChatClick }: CoachProfileViewProps) => {
  const { user } = useAuth();
  const [coachProfile, setCoachProfile] = useState<CoachProfile | null>(null);
  const [coachEmail, setCoachEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCoachProfile();
  }, [user]);

  const loadCoachProfile = async () => {
    if (!user) return;

    try {
      // Get student's coach_id
      const { data: alunoData } = await supabase
        .from("alunos")
        .select("coach_id")
        .eq("email", user.email)
        .single();

      if (!alunoData?.coach_id) {
        setLoading(false);
        return;
      }

      // Get coach profile
      const { data: profileData } = await supabase
        .from("coach_profiles")
        .select("*")
        .eq("user_id", alunoData.coach_id)
        .single();

      if (profileData) {
        setCoachProfile({
          ...profileData,
          especialidades: profileData.especialidades || [],
          conquistas: (profileData.conquistas as any) || [],
        });
      }

      // Get coach email from profiles or user_roles
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("user_id", alunoData.coach_id)
        .single();

      if (roleData) {
        // Get from auth metadata if available in profiles
        const { data: profileInfo } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", alunoData.coach_id)
          .single();
        
        // We don't have direct access to auth.users email, 
        // so we'll display what we have
      }
    } catch (error) {
      console.error("Error loading coach profile:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-muted rounded-lg"></div>
          <div className="h-64 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!coachProfile) {
    return (
      <div className="p-6">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Coach não encontrado</h3>
            <p className="text-muted-foreground max-w-sm">
              Seu coach ainda não configurou o perfil. Entre em contato com ele para mais informações.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header with avatar and basic info */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent h-32" />
        <CardContent className="-mt-16 relative">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-6">
            <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
              <AvatarImage src={coachProfile.avatar_url || undefined} />
              <AvatarFallback className="text-4xl font-bold bg-primary text-primary-foreground">
                {coachProfile.nome_completo?.charAt(0) || "C"}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 space-y-2">
              <h1 className="text-3xl font-bold">
                {coachProfile.nome_completo || "Seu Coach"}
              </h1>
              <p className="text-muted-foreground">Coach de Alta Performance</p>
              
              {/* Especialidades */}
              {coachProfile.especialidades.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {coachProfile.especialidades.map((esp, i) => (
                    <Badge key={i} variant="secondary" className="text-sm">
                      <Star className="h-3 w-3 mr-1" />
                      {esp}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {onChatClick && (
                <Button onClick={onChatClick} className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Conversar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 bg-primary/10 rounded-full">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{coachProfile.anos_experiencia || 0}+</p>
              <p className="text-sm text-muted-foreground">Anos de experiência</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 bg-primary/10 rounded-full">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{coachProfile.total_alunos_acompanhados || 0}+</p>
              <p className="text-sm text-muted-foreground">Alunos acompanhados</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 bg-primary/10 rounded-full">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{coachProfile.conquistas?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Conquistas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bio */}
      {coachProfile.bio && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Sobre o Coach
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
              {coachProfile.bio}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Principais Resultados */}
      {coachProfile.principais_resultados && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Principais Resultados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
              {coachProfile.principais_resultados}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Conquistas Timeline */}
      {coachProfile.conquistas && coachProfile.conquistas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Conquistas e Marcos da Carreira
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative space-y-6">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
              
              {coachProfile.conquistas
                .sort((a, b) => (b.ano || 0) - (a.ano || 0))
                .map((conquista, index) => (
                <div key={index} className="relative pl-10">
                  {/* Timeline dot */}
                  <div className="absolute left-2.5 w-3 h-3 bg-primary rounded-full border-2 border-background" />
                  
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{conquista.ano}</Badge>
                      <h4 className="font-semibold">{conquista.titulo}</h4>
                    </div>
                    {conquista.descricao && (
                      <p className="text-sm text-muted-foreground">{conquista.descricao}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CoachProfileView;
