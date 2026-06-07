import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, ErrorType } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import logoWhite from '@/assets/logo-white.svg';
import { Check, Eye, EyeOff, Mail, Lock, User, AlertCircle, Sparkles, Scale, Ruler, CreditCard } from 'lucide-react';
import { z } from 'zod';
import { maskCPF, validateCPF, onlyNumbers } from '@/utils/MaskFormat';

// Validation schemas
const signUpSchema = z.object({
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres").max(100, "Nome muito longo"),
  email: z.string().email("Email inválido").max(255, "Email muito longo"),
  cpf: z.string().min(1, "CPF é obrigatório").refine((val) => validateCPF(val), {
    message: "CPF inválido",
  }),
  peso: z.string().min(1, "Peso é obrigatório").refine((val) => {
    const n = Number(val);
    return Number.isFinite(n) && n > 0 && n <= 500;
  }, { message: "Informe um peso válido (1 a 500 kg)" }),
  altura: z.string().min(1, "Altura é obrigatória").refine((val) => {
    const n = Number(val);
    return Number.isFinite(n) && n >= 100 && n <= 250;
  }, { message: "Informe uma altura válida (100 a 250 cm)" }),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(72, "Senha muito longa"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

const signInSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

// Schema for forgot password
const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

// Schema for reset password
const resetPasswordSchema = z.object({
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(72, "Senha muito longa"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetPasswordMode, setResetPasswordMode] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState(false);
  const [passwordResetToken, setPasswordResetToken] = useState<string | null>(null);
  const [emailConfirmationInProgress, setEmailConfirmationInProgress] = useState(false);
  const [emailConfirmationMessage, setEmailConfirmationMessage] = useState<string | null>(null);
  const [emailConfirmationError, setEmailConfirmationError] = useState<string | null>(null);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);
  const [signupCoachId, setSignupCoachId] = useState<string | null>(null);
  
  // Form states
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [peso, setPeso] = useState('');
  const [altura, setAltura] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Password strength
  const [passwordStrength, setPasswordStrength] = useState(0);

  const { user, login } = useAuth();

  // REACT-AUTH-STATE-CONSISTENCY-FIX-007: Redirecionamento reativo baseado em estado
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const coachFromQuery = searchParams.get('coach') || searchParams.get('coach_id');
    if (coachFromQuery && /^[0-9a-f-]{36}$/i.test(coachFromQuery.trim())) {
      setSignupCoachId(coachFromQuery.trim());
      setActiveTab('signup');
    }

    const confirmFromQuery = searchParams.get('confirm_email');
    if (confirmFromQuery) {
      setEmailConfirmationInProgress(true);
      setEmailConfirmationError(null);
      setEmailConfirmationMessage(null);
      setForgotPasswordMode(false);
      setResetPasswordMode(false);
      setActiveTab('signin');

      (async () => {
        try {
          await apiClient.confirmEmail(confirmFromQuery);
          setEmailConfirmationMessage('E-mail confirmado com sucesso. Agora você já pode fazer login.');
          toast({
            title: 'E-mail confirmado!',
            description: 'Sua conta está ativa para login.',
          });
        } catch (error: any) {
          const message =
            error?.message ||
            'Não foi possível confirmar o e-mail. Peça um novo link de confirmação.';
          setEmailConfirmationError(message);
          toast({
            title: 'Falha ao confirmar email',
            description: message,
            variant: 'destructive',
          });
        } finally {
          setEmailConfirmationInProgress(false);
        }
      })();

      searchParams.delete('confirm_email');
      const qs = searchParams.toString();
      const clean = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
      window.history.replaceState(null, '', clean);
      return;
    }

    if (user) {
      console.log('[REACT-AUTH-STATE-CONSISTENCY-FIX-007] Usuário autenticado detectado, redirecionando...');
      navigate('/');
      return;
    }

    const resetFromQuery = searchParams.get('reset');
    if (resetFromQuery) {
      setPasswordResetToken(resetFromQuery);
      setResetPasswordMode(true);
      searchParams.delete('reset');
      const qs = searchParams.toString();
      const clean = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
      window.history.replaceState(null, '', clean);
      return;
    }

    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');
    if (type === 'recovery' && accessToken) {
      setPasswordResetToken(accessToken);
      setResetPasswordMode(true);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [navigate, toast, user]);

  useEffect(() => {
    // Calculate password strength
    let strength = 0;
    if (password.length >= 6) strength += 25;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) strength += 25;
    setPasswordStrength(strength);
  }, [password]);

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 25) return 'bg-destructive';
    if (passwordStrength <= 50) return 'bg-warning';
    if (passwordStrength <= 75) return 'bg-primary/70';
    return 'bg-success';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength <= 25) return 'Fraca';
    if (passwordStrength <= 50) return 'Média';
    if (passwordStrength <= 75) return 'Boa';
    return 'Forte';
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Validate
    const result = signUpSchema.safeParse({ nome, email, cpf, peso, altura, password, confirmPassword });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      setLoading(true);
      
      const data = await apiClient.signUp(email, password, {
        full_name: nome,
        cpf_cnpj: onlyNumbers(cpf),
        peso: Number(peso),
        altura: Number(altura),
        ...(signupCoachId ? { coach_id: signupCoachId } : {}),
      }) as {
        email_confirmation_sent?: boolean;
        dev_confirm_url?: string;
        aluno_provisioned?: boolean;
      };

      const confirmationRequested = !!data?.email_confirmation_sent;
      setSignupSuccess(true);
      toast({
        title: "Conta criada com sucesso!",
        description: data?.dev_confirm_url
          ? "Conta criada. Em desenvolvimento, copie o link de confirmação mostrado no console."
          : confirmationRequested
            ? "Conta criada. Confirme seu e-mail para liberar o acesso à plataforma."
            : "Conta criada. O envio de confirmação por e-mail ainda não está ativo; use \"Reenviar confirmação\" ou peça ao suporte.",
      });
      if (data?.dev_confirm_url) {
        console.info('[DEV] Link de confirmação de e-mail:', data.dev_confirm_url);
      }
      
    } catch (error: any) {
      const backendFields = error?.fields as string[] | undefined;
      if (Array.isArray(backendFields) && backendFields.length > 0) {
        const fieldErrors: Record<string, string> = {};
        const fieldLabels: Record<string, string> = {
          nome: 'Nome é obrigatório',
          email: 'Email é obrigatório',
          cpf_cnpj: 'CPF é obrigatório',
          peso: 'Peso é obrigatório',
          altura: 'Altura é obrigatória',
        };
        for (const f of backendFields) {
          const key = f === 'cpf_cnpj' ? 'cpf' : f;
          fieldErrors[key] = fieldLabels[f] || error?.message || 'Campo obrigatório';
        }
        setErrors(fieldErrors);
      }

      // DESIGN-API-CONNECTIVITY-GUARD-009: Tratamento diferenciado por tipo de erro
      const msg = String(error?.message ?? '').toLowerCase();
      const isDuplicateEmail =
        msg.includes('já cadastrado') ||
        msg.includes('email já') ||
        msg.includes('already registered') ||
        msg.includes('duplicate') ||
        msg.includes('23505');
      if (isDuplicateEmail) {
        setErrors({ email: 'Este email já está cadastrado. Use a aba Entrar ou outro email.' });
        toast({
          title: 'Email já em uso',
          description: 'Faça login nessa conta ou cadastre-se com outro email.',
          variant: 'destructive',
        });
        return;
      }
      
      // Verificar tipo de erro e exibir mensagem apropriada
      const errorType = error.errorType;
      let errorMessage = error.message || 'Erro desconhecido';
      let errorTitle = "Erro ao cadastrar";
      
      if (errorType === ErrorType.TLS) {
        errorTitle = "Erro de segurança";
        errorMessage = "Erro de segurança (SSL). Contate o suporte.";
      } else if (errorType === ErrorType.NETWORK) {
        errorTitle = "Erro de conexão";
        errorMessage = "Erro de conexão com a API. Verifique sua internet.";
      } else if (errorType === ErrorType.BACKEND) {
        errorTitle = "Erro ao cadastrar";
        // Manter mensagem original do backend
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setPendingConfirmationEmail(null);
    
    // Validate
    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      setLoading(true);
      
      // REACT-AUTH-STATE-CONSISTENCY-FIX-007: Usar método login() do AuthContext
      // Este método garante que user seja setado de forma consistente
      await login(email, password);

      toast({
        title: "Bem-vindo de volta!",
        description: "Login realizado com sucesso.",
      });
      
      // REACT-AUTH-STATE-CONSISTENCY-FIX-007: REMOVER navigate() imperativo
      // O redirecionamento acontece automaticamente via useEffect quando user !== null
      // navigate('/');
    } catch (error: any) {
      if (error.message?.includes('EMAIL_NOT_CONFIRMED')) {
        const targetEmail = email.trim().toLowerCase();
        setPendingConfirmationEmail(targetEmail);
        toast({
          title: "Confirmação pendente",
          description: "Confirme seu e-mail para entrar. Se precisar, reenvie o link abaixo.",
          variant: "destructive",
        });
        return;
      }

      // AUTH-HARDENING-001: Tratamento especial para 503 (Service Unavailable por schema inválido)
      if (error.status === 503 && error.reason === 'SCHEMA_INVALID') {
        toast({
          title: "Sistema em manutenção",
          description: error.message || 'O sistema está temporariamente indisponível devido a atualizações no banco de dados. Tente novamente em instantes.',
          variant: "destructive",
        });
        return;
      }
      
      if (error.message.includes('incorretos') || error.message.includes('Invalid login credentials') || error.message.includes('Credenciais inválidas')) {
        setErrors({ password: 'Email ou senha incorretos' });
        return;
      }
      
      // DESIGN-API-CONNECTIVITY-GUARD-009: Tratamento diferenciado por tipo de erro
      const errorType = error.errorType;
      let errorMessage = error.message || 'Erro desconhecido';
      let errorTitle = "Erro ao fazer login";
      
      if (errorType === ErrorType.TLS) {
        errorTitle = "Erro de segurança";
        errorMessage = "Erro de segurança (SSL). Contate o suporte.";
      } else if (errorType === ErrorType.NETWORK) {
        errorTitle = "Erro de conexão";
        errorMessage = "Erro de conexão com a API. Verifique sua internet.";
      } else if (errorType === ErrorType.BACKEND) {
        errorTitle = "Erro de autenticação";
        // Manter mensagem original do backend se disponível
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNome('');
    setEmail('');
    setCpf('');
    setPeso('');
    setAltura('');
    setPassword('');
    setConfirmPassword('');
    setErrors({});
    setSignupSuccess(false);
    setForgotPasswordSuccess(false);
    setResetPasswordSuccess(false);
    setPasswordResetToken(null);
    setEmailConfirmationInProgress(false);
    setEmailConfirmationMessage(null);
    setEmailConfirmationError(null);
    setPendingConfirmationEmail(null);
  };

  const handleResendConfirmation = async (targetEmail?: string) => {
    const emailToResend = (targetEmail || email || '').trim().toLowerCase();
    if (!emailToResend) return;
    try {
      setLoading(true);
      const data = await apiClient.resendEmailConfirmation(emailToResend) as { dev_confirm_url?: string };
      if (data?.dev_confirm_url) {
        console.info('[DEV] Novo link de confirmação:', data.dev_confirm_url);
      }
      toast({
        title: 'Reenvio solicitado',
        description: data?.dev_confirm_url
          ? 'Sem provedor de e-mail no backend (dev). Copie o link no console.'
          : 'Se o e-mail existir e não estiver confirmado, enviamos um novo link.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao reenviar confirmação',
        description: error.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Validate
    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      setLoading(true);
      const data = (await apiClient.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      })) as { ok?: boolean; message?: string; dev_reset_url?: string };

      if (data?.dev_reset_url) {
        console.info('[DEV] Link de redefinição de senha:', data.dev_reset_url);
      }

      setForgotPasswordSuccess(true);
      toast({
        title: data?.dev_reset_url ? 'Ambiente de desenvolvimento' : 'Pedido enviado',
        description: data?.dev_reset_url
          ? 'O e-mail não está configurado no servidor — copie o link no console (F12 → cadastro com [DEV]).'
          : (data?.message || 'Se este e-mail estiver cadastrado, verifique a caixa de entrada (e o spam).'),
      });
    } catch (error: any) {
      toast({
        title: "Não foi possível concluir o pedido",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Validate
    const result = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      setLoading(true);

      if (!passwordResetToken) {
        toast({
          title: "Link inválido ou expirado",
          description: "Peça um novo e-mail em \"Esqueci minha senha\" ou abra o link completo do e-mail.",
          variant: "destructive",
        });
        return;
      }

      await apiClient.completePasswordReset(passwordResetToken, password);
      setPasswordResetToken(null);

      setResetPasswordSuccess(true);
      toast({
        title: "Senha alterada com sucesso!",
        description: "Agora você pode fazer login com sua nova senha.",
      });
      
      // Clear the URL hash
      window.history.replaceState(null, '', window.location.pathname);
      
    } catch (error: any) {
      toast({
        title: "Erro ao alterar senha",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Success state after password reset
  if (resetPasswordSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <Card className="w-full max-w-md border-primary/20">
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Senha alterada!</h2>
              <p className="text-muted-foreground">
                Sua senha foi redefinida com sucesso.
              </p>
            </div>
            <Button 
              onClick={() => { 
                resetForm(); 
                setResetPasswordMode(false);
                setPasswordResetToken(null);
                setActiveTab('signin'); 
              }}
              className="w-full"
            >
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (emailConfirmationInProgress || emailConfirmationMessage || emailConfirmationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <Card className="w-full max-w-md border-primary/20">
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {emailConfirmationInProgress
                  ? 'Confirmando o e-mail...'
                  : emailConfirmationError
                    ? 'Não foi possível confirmar'
                    : 'E-mail confirmado!'}
              </h2>
              <p className="text-muted-foreground">
                {emailConfirmationInProgress
                  ? 'Estamos validando o link de confirmação.'
                  : (emailConfirmationError || emailConfirmationMessage)}
              </p>
            </div>
            {!emailConfirmationInProgress && (
              <Button
                onClick={() => {
                  setEmailConfirmationMessage(null);
                  setEmailConfirmationError(null);
                  setActiveTab('signin');
                }}
                className="w-full"
              >
                Ir para Login
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Reset password form
  if (resetPasswordMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Logo */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <img src={logoWhite} alt="Black House" className="h-20 w-auto" />
            </div>
          </div>

          <Card className="border-border/50 shadow-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Redefinir sua senha</CardTitle>
              <CardDescription>Digite sua nova senha abaixo</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    Nova senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password && (
                    <div className="space-y-1">
                      <Progress value={passwordStrength} className="h-1" />
                      <p className={`text-xs ${
                        passwordStrength <= 25 ? 'text-destructive' :
                        passwordStrength <= 50 ? 'text-warning' :
                        'text-primary'
                      }`}>
                        Força: {getPasswordStrengthText()}
                      </p>
                    </div>
                  )}
                  {errors.password && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.password}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password" className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    Confirmar nova senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirm-new-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Digite a senha novamente"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      className={errors.confirmPassword ? 'border-destructive pr-10' : 'pr-10'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && password === confirmPassword && (
                    <p className="text-xs text-primary flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Senhas coincidem
                    </p>
                  )}
                  {errors.confirmPassword && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>

                <Button 
                  type="submit" 
                  className="w-full shadow-glow" 
                  disabled={loading}
                  size="lg"
                >
                  {loading ? 'Salvando...' : 'Salvar nova senha'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Success state after forgot password request
  if (forgotPasswordSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <Card className="w-full max-w-md border-primary/20">
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Email enviado!</h2>
              <p className="text-muted-foreground">
                Enviamos um link de recuperação para <strong className="text-foreground">{email}</strong>
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
              <p>Verifique sua caixa de entrada e clique no link para redefinir sua senha.</p>
              <p className="mt-2">Não recebeu? Verifique a pasta de spam.</p>
            </div>
            <div className="space-y-2">
              <Button 
                onClick={() => { resetForm(); setForgotPasswordMode(false); setActiveTab('signin'); }}
                className="w-full"
              >
                Voltar ao Login
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setForgotPasswordSuccess(false)}
                className="w-full"
              >
                Tentar outro email
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Forgot password form
  if (forgotPasswordMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Logo */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <img src={logoWhite} alt="Black House" className="h-20 w-auto" />
            </div>
          </div>

          <Card className="border-border/50 shadow-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Esqueceu sua senha?</CardTitle>
              <CardDescription>Digite seu email para receber um link de recuperação</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    Email
                  </Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.email}
                    </p>
                  )}
                </div>

                <Button 
                  type="submit" 
                  className="w-full shadow-glow" 
                  disabled={loading}
                  size="lg"
                >
                  {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                </Button>

                <Button 
                  type="button"
                  variant="ghost" 
                  onClick={() => { resetForm(); setForgotPasswordMode(false); }}
                  className="w-full"
                >
                  Voltar ao login
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Success state after signup
  if (signupSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <Card className="w-full max-w-md border-primary/20">
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Conta criada com sucesso!</h2>
              <p className="text-muted-foreground">
                Enviamos um link de confirmação para <strong className="text-foreground">{email}</strong>
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
              <p>Verifique sua caixa de entrada e clique no link para ativar sua conta.</p>
              <p className="mt-2">Não recebeu? Verifique a pasta de spam.</p>
            </div>
            <div className="space-y-2">
              <Button 
                onClick={() => { resetForm(); setActiveTab('signin'); }}
                className="w-full"
              >
                Ir para Login
              </Button>
              <Button
                variant="ghost"
                onClick={handleResendConfirmation}
                disabled={loading || !email}
                className="w-full"
              >
                {loading ? 'Reenviando...' : 'Reenviar email de confirmação'}
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setSignupSuccess(false)}
                className="w-full"
              >
                Criar outra conta
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              <img 
                src={logoWhite} 
                alt="Black House" 
                className="h-20 w-auto"
              />
              <div className="absolute -right-2 -top-2">
                <Sparkles className="w-5 h-5 text-primary motion-safe:animate-pulse" />
              </div>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-dark via-primary to-primary-glow bg-clip-text text-transparent">
              Black House
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              saúde integrativa & performance
            </p>
          </div>
        </div>

        {/* Auth Card */}
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">
              {activeTab === 'signin' ? 'Acessar sua conta' : 'Criar nova conta'}
            </CardTitle>
            <CardDescription>
              {activeTab === 'signin'
                ? 'Entre com suas credenciais para continuar'
                : 'Informe nome, e-mail, CPF, peso e altura para criar sua conta de acesso ao sistema.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'signin' | 'signup'); resetForm(); }} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              </TabsList>
              
              {/* Sign In Form */}
              <TabsContent value="signin" className="mt-0">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      Email
                    </Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className={errors.email ? 'border-destructive' : ''}
                      autoComplete="username"
                    />
                    {errors.email && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.email}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-muted-foreground" />
                      Senha
                    </Label>
                    <div className="relative">
                      <Input
                        id="signin-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.password}
                      </p>
                    )}
                  </div>

                  {pendingConfirmationEmail && (
                    <Alert className="border-amber-500/40 bg-amber-500/10">
                      <AlertDescription className="space-y-3">
                        <p className="text-sm">
                          Este cadastro ainda não confirmou o e-mail:{" "}
                          <strong className="text-foreground">{pendingConfirmationEmail}</strong>
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          disabled={loading}
                          onClick={() => handleResendConfirmation(pendingConfirmationEmail)}
                        >
                          {loading ? "Reenviando..." : "Reenviar e-mail de confirmação"}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full shadow-glow" 
                    disabled={loading}
                    size="lg"
                  >
                    {loading ? 'Entrando...' : 'Entrar'}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => { resetForm(); setForgotPasswordMode(true); }}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      Esqueceu sua senha?
                    </button>
                  </div>
                </form>
              </TabsContent>
              
              {/* Sign Up Form */}
              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignUp} className="space-y-4">
                  {signupCoachId && (
                    <Alert className="border-primary/20 bg-primary/5">
                      <AlertDescription className="text-sm">
                        Cadastro vinculado ao seu coach. Após criar a conta, você aparecerá na lista de alunos dele.
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="signup-nome" className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      Nome completo *
                    </Label>
                    <Input
                      id="signup-nome"
                      type="text"
                      placeholder="Seu nome completo"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      disabled={loading}
                      required
                      className={errors.nome ? 'border-destructive' : ''}
                    />
                    {errors.nome && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.nome}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      Email *
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      required
                      className={errors.email ? 'border-destructive' : ''}
                    />
                    {errors.email && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-cpf" className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                      CPF *
                    </Label>
                    <Input
                      id="signup-cpf"
                      type="text"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={(e) => setCpf(maskCPF(e.target.value))}
                      disabled={loading}
                      required
                      className={errors.cpf ? 'border-destructive' : ''}
                    />
                    {errors.cpf && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.cpf}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="signup-peso" className="flex items-center gap-2">
                        <Scale className="w-4 h-4 text-muted-foreground" />
                        Peso (kg) *
                      </Label>
                      <Input
                        id="signup-peso"
                        type="number"
                        min={1}
                        max={500}
                        placeholder="Ex: 75"
                        value={peso}
                        onChange={(e) => setPeso(e.target.value)}
                        disabled={loading}
                        required
                        className={errors.peso ? 'border-destructive' : ''}
                      />
                      {errors.peso && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.peso}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-altura" className="flex items-center gap-2">
                        <Ruler className="w-4 h-4 text-muted-foreground" />
                        Altura (cm) *
                      </Label>
                      <Input
                        id="signup-altura"
                        type="number"
                        min={100}
                        max={250}
                        placeholder="Ex: 175"
                        value={altura}
                        onChange={(e) => setAltura(e.target.value)}
                        disabled={loading}
                        required
                        className={errors.altura ? 'border-destructive' : ''}
                      />
                      {errors.altura && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.altura}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-muted-foreground" />
                      Senha
                    </Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {password && (
                      <div className="space-y-1">
                        <Progress value={passwordStrength} className="h-1" />
                        <p className={`text-xs ${
                          passwordStrength <= 25 ? 'text-destructive' :
                          passwordStrength <= 50 ? 'text-warning' :
                          'text-primary'
                        }`}>
                          Força: {getPasswordStrengthText()}
                        </p>
                      </div>
                    )}
                    {errors.password && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.password}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password" className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-muted-foreground" />
                      Confirmar senha
                    </Label>
                    <div className="relative">
                      <Input
                        id="signup-confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Digite a senha novamente"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={loading}
                        className={errors.confirmPassword ? 'border-destructive pr-10' : 'pr-10'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPassword && password === confirmPassword && (
                      <p className="text-xs text-primary flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Senhas coincidem
                      </p>
                    )}
                    {errors.confirmPassword && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.confirmPassword}
                      </p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full shadow-glow" 
                    disabled={loading}
                    size="lg"
                  >
                    {loading ? 'Criando conta...' : 'Criar conta'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Ao continuar, você concorda com nossos termos de uso e política de privacidade.
        </p>
      </div>
    </div>
  );
};

export default Auth;
