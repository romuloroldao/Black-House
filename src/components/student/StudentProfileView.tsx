import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useDataContext } from "@/contexts/DataContext";
import { User, Save, Camera, Loader2, Upload, Bell } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DateInputBR } from "@/components/ui/date-input-br";
import { prepareImageForUpload } from "@/lib/prepare-image-upload";

const StudentProfileView = () => {
  const { user } = useAuth();
  const { isReady } = useDataContext();
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    data_nascimento: "",
    peso: "",
    altura_cm: "",
    sexo: "" as "" | "M" | "F",
    objetivo: "",
  });
  const [notificationChannel, setNotificationChannel] = useState<
    "in_app_only" | "in_app_and_email"
  >("in_app_and_email");
  const [savingNotifications, setSavingNotifications] = useState(false);

  useEffect(() => {
    if (!isReady || !user) return;

    let isMounted = true;

    const loadProfileData = async () => {
      const [alunoResult, profileResult, prefsResult] = await Promise.all([
        apiClient.getMeSafe(),
        apiClient.getProfileSafe(),
        apiClient.requestSafe<{
          notification_channel: "in_app_only" | "in_app_and_email";
        }>("/api/alunos/me/notification-preferences"),
      ]);

      const aluno = alunoResult.success ? alunoResult.data : null;
      const profile = profileResult.success ? profileResult.data : null;

      if (!isMounted) return;

      setFormData({
        nome: aluno?.nome || "",
        email: user.email || "",
        telefone: aluno?.telefone || "",
        data_nascimento: (aluno?.data_nascimento || "").split("T")[0] || "",
        peso: aluno?.peso_kg != null ? String(aluno.peso_kg) : aluno?.peso ? String(aluno.peso) : "",
        altura_cm:
          aluno?.altura_cm != null
            ? String(aluno.altura_cm)
            : aluno?.altura != null
              ? String(aluno.altura)
              : "",
        sexo: aluno?.sexo === "M" || aluno?.sexo === "F" ? aluno.sexo : "",
        objetivo: aluno?.objetivo || "",
      });

      setAvatarUrl(profile?.avatar_url || null);

      if (prefsResult.success && prefsResult.data?.notification_channel) {
        setNotificationChannel(prefsResult.data.notification_channel);
      }
    };

    loadProfileData();

    return () => {
      isMounted = false;
    };
  }, [isReady, user?.id, user?.email]);

  // DESIGN-023-RUNTIME-CRASH-RESOLUTION-001: Guard defensivo - componente NÃO renderiza fora de READY
  // DESIGN-FRONTEND-HERMETIC-BOOTSTRAP-AND-ASSET-FIX-021: Componente só monta quando DataContext === READY
  if (!isReady) {
    return null;
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) {
      event.target.value = "";
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 12 MB");
      event.target.value = "";
      return;
    }

    setUploadingAvatar(true);
    try {
      const prepared = await prepareImageForUpload(file);
      const fileName = `${user.id}-${Date.now()}.jpg`;
      const filePath = `${user.id}/${fileName}`;

      const uploadResult = await apiClient.uploadFile("avatars", filePath, prepared);
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
      event.target.value = "";
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

    const updateResult = await apiClient.requestSafe(`/api/alunos/me`, {
      method: 'PATCH',
      body: JSON.stringify({
        nome: formData?.nome || null,
        telefone: formData?.telefone || null,
        data_nascimento: formData?.data_nascimento || null,
        peso_kg: formData?.peso ? String(formData.peso).replace(",", ".") : null,
        altura_cm: formData?.altura_cm ? String(formData.altura_cm).replace(",", ".") : null,
        sexo: formData?.sexo || null,
        objetivo: formData?.objetivo || null,
      }),
    });

    if (!updateResult.success) {
      toast.error("Erro ao atualizar perfil");
      setLoading(false);
      return;
    }

    toast.success("Perfil atualizado com sucesso!");
    const profileResult = await apiClient.getProfileSafe();
    if (profileResult.success) {
      setAvatarUrl(profileResult.data?.avatar_url || null);
    }
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
    <div className="min-w-0 space-y-6 max-w-2xl">
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
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
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
                  <Loader2 className="h-6 w-6 motion-safe:animate-spin text-primary" />
                </div>
              )}
            </div>
            <div className="w-full space-y-2 sm:w-auto">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="user"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingAvatar ? "Enviando..." : "Escolher da galeria"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {uploadingAvatar ? "Enviando..." : "Tirar foto"}
                </Button>
              </div>
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
              <Label htmlFor="telefone">WhatsApp</Label>
              <Input
                id="telefone"
                value={formData?.telefone || ''}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_nascimento">Data de Nascimento</Label>
              <DateInputBR
                id="data_nascimento"
                value={formData?.data_nascimento || ''}
                onChange={(value) => setFormData({ ...formData, data_nascimento: value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="peso">Peso Atual (kg)</Label>
              <Input
                id="peso"
                type="text"
                inputMode="decimal"
                value={formData?.peso || ''}
                onChange={(e) =>
                  setFormData({ ...formData, peso: e.target.value.replace(/[^\d,.]/g, "") })
                }
                placeholder="Ex: 75,5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="altura_cm">Altura (cm)</Label>
              <Input
                id="altura_cm"
                type="text"
                inputMode="numeric"
                value={formData?.altura_cm || ''}
                onChange={(e) =>
                  setFormData({ ...formData, altura_cm: e.target.value.replace(/[^\d]/g, "") })
                }
                placeholder="Ex: 178"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Sexo</Label>
              <RadioGroup
                value={formData.sexo}
                onValueChange={(v) => setFormData({ ...formData, sexo: v as "M" | "F" })}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="M" id="profile-sexo-m" />
                  <Label htmlFor="profile-sexo-m" className="font-normal">Masculino</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="F" id="profile-sexo-f" />
                  <Label htmlFor="profile-sexo-f" className="font-normal">Feminino</Label>
                </div>
              </RadioGroup>
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

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notificações de retorno
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Lembretes de retorno de dieta e treino (2 dias antes, véspera e no dia) aparecem sempre no
            sininho do portal. Escolha se também deseja receber por e-mail.
          </p>
          <RadioGroup
            value={notificationChannel}
            onValueChange={(v) =>
              setNotificationChannel(v as "in_app_only" | "in_app_and_email")
            }
            className="space-y-3"
          >
            <div className="flex items-start gap-3 rounded-lg border border-border p-3">
              <RadioGroupItem value="in_app_and_email" id="notif-email" />
              <Label htmlFor="notif-email" className="cursor-pointer font-normal leading-snug">
                <span className="font-medium text-foreground">Aplicativo e e-mail</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Sininho na plataforma + e-mails com a identidade Black House.
                </span>
              </Label>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border p-3">
              <RadioGroupItem value="in_app_only" id="notif-inapp" />
              <Label htmlFor="notif-inapp" className="cursor-pointer font-normal leading-snug">
                <span className="font-medium text-foreground">Apenas no aplicativo</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Somente notificações internas (sem e-mails automáticos de retorno).
                </span>
              </Label>
            </div>
          </RadioGroup>
          <div className="flex justify-end">
            <Button
              variant="outline"
              disabled={savingNotifications}
              onClick={async () => {
                setSavingNotifications(true);
                try {
                  const result = await apiClient.requestSafe(
                    "/api/alunos/me/notification-preferences",
                    {
                      method: "PATCH",
                      body: JSON.stringify({ notification_channel: notificationChannel }),
                    },
                  );
                  if (!result.success) {
                    throw new Error(result.error || "Erro ao salvar");
                  }
                  toast.success("Preferência de notificação salva");
                } catch (e: unknown) {
                  const msg = e instanceof Error ? e.message : "Erro ao salvar";
                  toast.error(msg);
                } finally {
                  setSavingNotifications(false);
                }
              }}
            >
              {savingNotifications ? "Salvando..." : "Salvar preferência"}
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
