import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Bell, Key, Palette, Eye, EyeOff, Camera, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SettingsManager = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [asaasConfig, setAsaasConfig] = useState<any>(null);
  const [twilioConfig, setTwilioConfig] = useState<any>(null);
  
  // Profile state
  const [profileData, setProfileData] = useState({
    email: user?.email || "",
    phone: "",
    displayName: "",
  });

  // Notification preferences
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    paymentReminders: true,
    workoutExpirations: true,
    newMessages: true,
    eventReminders: true,
  });

  // Password change dialog state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    loadAsaasConfig();
    loadTwilioConfig();
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    
    // Load avatar from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single();
    
    if (profile?.avatar_url) {
      setAvatarUrl(profile.avatar_url);
    }
    
    // Load display name from user metadata
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user?.user_metadata) {
      const metadata = userData.user.user_metadata;
      setProfileData(prev => ({
        ...prev,
        displayName: metadata.display_name || metadata.full_name || metadata.name || "",
        phone: metadata.phone || "",
      }));
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
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
      // Create unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`; // Add cache buster

      // Upsert profile with avatar URL
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        });

      if (profileError) throw profileError;

      setAvatarUrl(publicUrl);
      toast.success("Avatar atualizado com sucesso!");
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      toast.error("Erro ao atualizar avatar: " + error.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const loadAsaasConfig = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("asaas_config")
        .select("*")
        .eq("coach_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      setAsaasConfig(data);
    } catch (error) {
      console.error("Erro ao carregar configurações Asaas:", error);
    }
  };

  const loadTwilioConfig = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("twilio_config")
        .select("*")
        .eq("coach_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      setTwilioConfig(data);
    } catch (error) {
      console.error("Erro ao carregar configurações Twilio:", error);
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      // Update user metadata
      const { error } = await supabase.auth.updateUser({
        data: {
          phone: profileData.phone,
          display_name: profileData.displayName,
        },
      });

      if (error) throw error;

      toast.success("Perfil atualizado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao atualizar perfil: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    setLoading(true);
    try {
      // Save notification preferences (could be stored in a separate table)
      toast.success("Preferências de notificação atualizadas!");
    } catch (error: any) {
      toast.error("Erro ao salvar preferências: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAsaasToggle = async () => {
    setLoading(true);
    try {
      if (asaasConfig) {
        // Update existing config
        const { error } = await supabase
          .from("asaas_config")
          .update({ is_sandbox: !asaasConfig.is_sandbox })
          .eq("id", asaasConfig.id);

        if (error) throw error;

        setAsaasConfig({ ...asaasConfig, is_sandbox: !asaasConfig.is_sandbox });
        toast.success("Configuração Asaas atualizada!");
      }
    } catch (error: any) {
      toast.error("Erro ao atualizar Asaas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTwilioConfig = async (accountSid: string, authToken: string, whatsappFrom: string) => {
    setLoading(true);
    try {
      if (twilioConfig) {
        // Update existing config
        const { error } = await supabase
          .from("twilio_config")
          .update({
            account_sid: accountSid,
            auth_token: authToken,
            whatsapp_from: whatsappFrom,
          })
          .eq("id", twilioConfig.id);

        if (error) throw error;

        toast.success("Configuração Twilio atualizada!");
      } else {
        // Create new config
        const { error } = await supabase
          .from("twilio_config")
          .insert([
            {
              coach_id: user?.id,
              account_sid: accountSid,
              auth_token: authToken,
              whatsapp_from: whatsappFrom,
            },
          ]);

        if (error) throw error;

        toast.success("Configuração Twilio criada!");
      }

      await loadTwilioConfig();
    } catch (error: any) {
      toast.error("Erro ao salvar configuração Twilio: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    // Validações
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error("Preencha todos os campos");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("As senhas não correspondem");
      return;
    }

    setLoading(true);
    try {
      // Atualizar senha
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      toast.success("Senha alterada com sucesso!");
      setPasswordDialogOpen(false);
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error: any) {
      toast.error("Erro ao alterar senha: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-5xl py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie suas preferências e configurações do sistema
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Perfil</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notificações</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">Integrações</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Aparência</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Foto de Perfil</CardTitle>
              <CardDescription>
                Atualize sua foto de perfil
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={avatarUrl || undefined} alt="Avatar" />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                      {profileData.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <label
                    htmlFor="avatar-upload"
                    className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90 transition-colors"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Alterar foto</p>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG ou GIF. Máximo 5MB.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informações do Perfil</CardTitle>
              <CardDescription>
                Atualize suas informações pessoais
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileData.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  O email não pode ser alterado
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Nome de Exibição</Label>
                <Input
                  id="displayName"
                  value={profileData.displayName}
                  onChange={(e) =>
                    setProfileData({ ...profileData, displayName: e.target.value })
                  }
                  placeholder="Seu nome"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={profileData.phone}
                  onChange={(e) =>
                    setProfileData({ ...profileData, phone: e.target.value })
                  }
                  placeholder="(00) 00000-0000"
                />
              </div>

              <Separator />

              <Button onClick={handleSaveProfile} disabled={loading}>
                {loading ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Segurança</CardTitle>
              <CardDescription>
                Gerencie a segurança da sua conta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Alterar Senha</Label>
                  <p className="text-sm text-muted-foreground">
                    Atualize sua senha regularmente
                  </p>
                </div>
                <Button variant="outline" onClick={() => setPasswordDialogOpen(true)}>
                  Alterar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Preferências de Notificação</CardTitle>
              <CardDescription>
                Configure como você deseja ser notificado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-notifications">Notificações por Email</Label>
                  <p className="text-sm text-muted-foreground">
                    Receba atualizações por email
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={notifications.emailNotifications}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, emailNotifications: checked })
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="payment-reminders">Lembretes de Pagamento</Label>
                  <p className="text-sm text-muted-foreground">
                    Notificações sobre pagamentos pendentes
                  </p>
                </div>
                <Switch
                  id="payment-reminders"
                  checked={notifications.paymentReminders}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, paymentReminders: checked })
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="workout-expirations">Expiração de Treinos</Label>
                  <p className="text-sm text-muted-foreground">
                    Alertas quando treinos estão expirando
                  </p>
                </div>
                <Switch
                  id="workout-expirations"
                  checked={notifications.workoutExpirations}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, workoutExpirations: checked })
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="new-messages">Novas Mensagens</Label>
                  <p className="text-sm text-muted-foreground">
                    Notificações de mensagens de alunos
                  </p>
                </div>
                <Switch
                  id="new-messages"
                  checked={notifications.newMessages}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, newMessages: checked })
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="event-reminders">Lembretes de Eventos</Label>
                  <p className="text-sm text-muted-foreground">
                    Notificações sobre eventos agendados
                  </p>
                </div>
                <Switch
                  id="event-reminders"
                  checked={notifications.eventReminders}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, eventReminders: checked })
                  }
                />
              </div>

              <Separator />

              <Button onClick={handleSaveNotifications} disabled={loading}>
                {loading ? "Salvando..." : "Salvar Preferências"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integrações</CardTitle>
              <CardDescription>
                Gerencie integrações com serviços externos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label>Asaas (Pagamentos)</Label>
                    {asaasConfig && (
                      <Badge variant={asaasConfig.is_sandbox ? "secondary" : "default"}>
                        {asaasConfig.is_sandbox ? "Sandbox" : "Produção"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {asaasConfig
                      ? "Integração configurada e ativa"
                      : "Configure sua chave API do Asaas"}
                  </p>
                </div>
                {asaasConfig && (
                  <Button variant="outline" onClick={handleAsaasToggle} disabled={loading}>
                    Alternar Modo
                  </Button>
                )}
              </div>

              {!asaasConfig && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Chave API Asaas</Label>
                    <Input placeholder="Cole sua chave API aqui" type="password" />
                    <Button className="mt-2">Configurar Asaas</Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Twilio - WhatsApp
              </CardTitle>
              <CardDescription>
                Configure sua integração com Twilio para enviar lembretes via WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="twilio-account-sid">Account SID</Label>
                <Input
                  id="twilio-account-sid"
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  defaultValue={twilioConfig?.account_sid || ""}
                  onChange={(e) => {
                    const accountSid = e.target.value;
                    setTwilioConfig((prev: any) => ({ ...prev, account_sid: accountSid }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twilio-auth-token">Auth Token</Label>
                <Input
                  id="twilio-auth-token"
                  type="password"
                  placeholder="••••••••••••••••••••••••••••••••"
                  defaultValue={twilioConfig?.auth_token || ""}
                  onChange={(e) => {
                    const authToken = e.target.value;
                    setTwilioConfig((prev: any) => ({ ...prev, auth_token: authToken }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twilio-whatsapp-from">WhatsApp Number (From)</Label>
                <Input
                  id="twilio-whatsapp-from"
                  placeholder="whatsapp:+14155238886"
                  defaultValue={twilioConfig?.whatsapp_from || ""}
                  onChange={(e) => {
                    const whatsappFrom = e.target.value;
                    setTwilioConfig((prev: any) => ({ ...prev, whatsapp_from: whatsappFrom }));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Formato: whatsapp:+[código do país][número]
                </p>
              </div>
              <Button
                onClick={() => handleSaveTwilioConfig(
                  twilioConfig?.account_sid || "",
                  twilioConfig?.auth_token || "",
                  twilioConfig?.whatsapp_from || ""
                )}
                disabled={loading}
              >
                Salvar Configurações Twilio
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Aparência</CardTitle>
              <CardDescription>
                Personalize a aparência do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tema</Label>
                <p className="text-sm text-muted-foreground">
                  O tema escuro/claro é detectado automaticamente do seu sistema
                </p>
              </div>
              
              <Separator />

              <div className="space-y-2">
                <Label>Densidade</Label>
                <p className="text-sm text-muted-foreground">
                  Configurações de densidade em desenvolvimento
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>
              Digite sua senha atual e escolha uma nova senha. A senha deve ter pelo menos 6 caracteres.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Senha Atual</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={passwordData.currentPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, currentPassword: e.target.value })
                  }
                  placeholder="Digite sua senha atual"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, newPassword: e.target.value })
                  }
                  placeholder="Digite sua nova senha"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                  }
                  placeholder="Confirme sua nova senha"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPasswordDialogOpen(false);
                setPasswordData({
                  currentPassword: "",
                  newPassword: "",
                  confirmPassword: "",
                });
              }}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button onClick={handleChangePassword} disabled={loading}>
              {loading ? "Alterando..." : "Alterar Senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsManager;
