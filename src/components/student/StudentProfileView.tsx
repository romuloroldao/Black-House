import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useDataContext } from "@/contexts/DataContext";
import { User, Save, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const StudentProfileView = () => {
  const { user } = useAuth();
  const { isReady } = useDataContext();
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    data_nascimento: "",
    peso: "",
    objetivo: "",
  });

  // DESIGN-023-RUNTIME-CRASH-RESOLUTION-001: Guard defensivo - componente NÃO renderiza fora de READY
  // DESIGN-FRONTEND-HERMETIC-BOOTSTRAP-AND-ASSET-FIX-021: Componente só monta quando DataContext === READY
  if (!isReady) {
    return null;
  }

  // DESIGN-FRONTEND-HERMETIC-BOOTSTRAP-AND-ASSET-FIX-021: Removido useEffect que fazia fetch em mount
  // Dados devem ser carregados sob demanda ou via props/contexto
  // useEffect removido - loadProfileData() e loadAvatar() não são mais chamados automaticamente

  // DESIGN-FRONTEND-HERMETIC-BOOTSTRAP-AND-ASSET-FIX-021: loadProfileData() e loadAvatar() removidos
  // Dados devem ser carregados sob demanda ou via props/contexto, não em mount
  // Essas funções podem ser recriadas como handlers de eventos se necessário

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem válida");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to storage - DESIGN-VPS-ONLY-CANONICAL-DATA-AND-STORAGE-002
      // Rota canônica /api/avatar gerencia upload e retorna URL
      const uploadResult = await apiClient.uploadFile("avatars", filePath, file);
      const publicUrl = uploadResult.url || apiClient.getPublicUrl("avatars", filePath);

      // Atualizar avatar via rota semântica
      const profileResult = await apiClient.requestSafe('/api/profiles/me', {
        method: 'PATCH',
        body: JSON.stringify({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        }),
      });

      if (!profileResult.success) {
        throw new Error(profileResult.error || 'Erro ao atualizar avatar');
      }

      setAvatarUrl(publicUrl);
      toast.success("Avatar atualizado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao atualizar avatar:", error);
      toast.error("Erro ao atualizar avatar: " + error.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    // DESIGN-023-RENDER-THROW-ELIMINATION-002: Guard defensivo - não lançar exceção
    if (!user?.email) {
      toast.error('Usuário não autenticado');
      setLoading(false);
      return;
    }

    const alunoResult = await apiClient.getMeSafe();
    const aluno = alunoResult.success ? alunoResult.data : null;
    if (!aluno?.id) {
      toast.error('Aluno não encontrado');
      setLoading(false);
      return;
    }

    const updateResult = await apiClient.requestSafe(`/api/alunos/${aluno.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        nome: formData?.nome || null,
        telefone: formData?.telefone || null,
        data_nascimento: formData?.data_nascimento || null,
        peso: formData?.peso ? parseInt(formData.peso) : null,
        objetivo: formData?.objetivo || null,
      }),
    });

    if (!updateResult.success) {
      toast.error("Erro ao atualizar perfil");
      setLoading(false);
      return;
    }

    toast.success("Perfil atualizado com sucesso!");
    setLoading(false);
  };

  // DESIGN-023-RUNTIME-CRASH-RESOLUTION-001: Guard defensivo com optional chaining
  const getInitials = () => {
    try {
      const nome = formData?.nome;
      if (nome && typeof nome === 'string' && nome.trim().length > 0) {
        // DESIGN-023: Safe string operations com optional chaining
        const parts = nome.split(" ").filter(p => p && p.length > 0);
        if (parts.length > 0) {
          const initials = parts
            .map((n) => n?.[0] || '')
            .join("")
            .toUpperCase()
            .slice(0, 2);
          return initials || "??";
        }
      }
      // Fallback para email
      const email = user?.email;
      if (email && typeof email === 'string' && email.length > 0) {
        return email.charAt(0)?.toUpperCase() || "?";
      }
      return "?";
    } catch (error) {
      console.warn('[DESIGN-023] Erro ao gerar iniciais:', error);
      return "?";
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold mb-2">Meu Perfil</h1>
        <p className="text-muted-foreground">
          Gerencie suas informações pessoais
        </p>
      </div>

      {/* Avatar Section */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Foto de Perfil
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                {/* DESIGN-023: Optional chaining para acessos profundos */}
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              {uploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                <Camera className="h-4 w-4 mr-2" />
                {uploadingAvatar ? "Enviando..." : "Alterar Foto"}
              </Button>
              <p className="text-xs text-muted-foreground">
                JPG, PNG ou GIF. Máximo 5MB.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Informações Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo</Label>
              {/* DESIGN-023: Optional chaining para acessos profundos */}
              <Input
                id="nome"
                value={formData?.nome || ''}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData?.email || user?.email || ''}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData?.telefone || ''}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_nascimento">Data de Nascimento</Label>
              <Input
                id="data_nascimento"
                type="date"
                value={formData?.data_nascimento || ''}
                onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="peso">Peso Atual (kg)</Label>
              <Input
                id="peso"
                type="number"
                value={formData?.peso || ''}
                onChange={(e) => setFormData({ ...formData, peso: e.target.value })}
                placeholder="Ex: 75"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="objetivo">Objetivo</Label>
              <Input
                id="objetivo"
                value={formData?.objetivo || ''}
                onChange={(e) => setFormData({ ...formData, objetivo: e.target.value })}
                placeholder="Ex: Ganho de massa muscular"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              variant="premium"
              onClick={handleSave}
              disabled={loading}
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card border-primary/20">
        <CardHeader>
          <CardTitle>Informações da Conta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email da conta:</span>
              {/* DESIGN-023: Optional chaining para acessos profundos */}
              <span className="font-medium">{user?.email || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Conta criada em:</span>
              <span className="font-medium">
                {user?.created_at
                  ? (() => {
                      try {
                        return new Date(user.created_at).toLocaleDateString("pt-BR");
                      } catch (e) {
                        console.warn('[DESIGN-023] Erro ao parsear data:', e);
                        return 'N/A';
                      }
                    })()
                  : "-"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentProfileView;
