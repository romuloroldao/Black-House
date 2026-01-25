import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('coach' | 'aluno')[];
  checkPayment?: boolean;
}

// RBAC-01: ProtectedRoute com verificação de role e payment_status
// DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001: ProtectedRoute deve sempre renderizar algo válido
// REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009: Bloquear decisões até authInitialized=true
const ProtectedRoute = ({ 
  children, 
  allowedRoles = ['coach', 'aluno'],
  checkPayment = false
}: ProtectedRouteProps) => {
  const { user, loading, authInitialized, role, payment_status } = useAuth();
  const location = useLocation();

  // REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009: NUNCA decidir antes de authInitialized=true
  // Este é o invariante crítico - garante que user está no estado final (null ou válido)
  if (!authInitialized) {
    console.log('[REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009] ProtectedRoute aguardando bootstrap (authInitialized=false)');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001: Loading state seguro
  // REACT-SOFT-LOCK-FIX-005: Timeout para garantir que loading não bloqueie indefinidamente
  const [forceRender, setForceRender] = useState(false);
  
  useEffect(() => {
    if (loading) {
      // REACT-SOFT-LOCK-FIX-005: Timeout de 12 segundos para forçar render
      const timeout = setTimeout(() => {
        console.warn('[REACT-SOFT-LOCK-FIX-005] Timeout no ProtectedRoute loading (12s). Liberando render.');
        setForceRender(true);
      }, 12000);
      
      return () => clearTimeout(timeout);
    } else {
      setForceRender(false);
    }
  }, [loading]);
  
  // REACT-SOFT-LOCK-FIX-005: Log de diagnóstico
  // REACT-AUTH-STATE-CONSISTENCY-FIX-007: Log detalhado de estado de autenticação
  // REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009: Adicionar authInitialized ao log
  console.log('[REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009] ProtectedRoute decisão:', { 
    authInitialized,
    loading, 
    forceRender, 
    hasUser: !!user,
    userEmail: user?.email,
    role: role || user?.role
  });
  
  // REACT-SOFT-LOCK-FIX-005: VERIFICAR forceRender ANTES de qualquer condição
  // Se timeout expirou, liberar render mesmo sem user (redirecionar depois)
  if (forceRender && !user) {
    console.warn('[REACT-SOFT-LOCK-FIX-005] forceRender=true mas !user. Redirecionando para /auth.');
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }
  
  // REACT-SOFT-LOCK-FIX-005: Se loading persistir por muito tempo E forceRender=false, mostrar loading
  // Se forceRender=true, pular loading e continuar
  if (loading && !forceRender) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001: Verificação defensiva de user
  // REACT-SOFT-LOCK-FIX-005: Só redirecionar se forceRender=false (se forceRender=true, já foi tratado acima)
  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  // DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001: Verificar role com valores padrão seguros
  const userRole = role || user?.role || 'aluno';
  if (!allowedRoles.includes(userRole)) {
    // Redirecionar baseado no role
    if (userRole === 'aluno') {
      return <Navigate to="/portal-aluno/dashboard" replace />;
    } else {
      return <Navigate to="/" replace />;
    }
  }

  // DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001: Verificar payment_status para alunos (bloquear acesso se inadimplente)
  const userPaymentStatus = payment_status || user?.payment_status || 'CURRENT';
  if (checkPayment && userRole === 'aluno') {
    const isOverdue = userPaymentStatus === 'OVERDUE' || userPaymentStatus === 'PENDING_AFTER_DUE_DATE';
    const isAllowedRoute = location.pathname === '/portal-aluno/blocked' || 
                          location.pathname === '/portal-aluno/financial' ||
                          location.pathname.startsWith('/auth');
    
    if (isOverdue && !isAllowedRoute) {
      // Redirecionar para tela de bloqueio
      return <Navigate to="/portal-aluno/blocked" replace />;
    }
  }

  // Redirecionar aluno para portal-aluno se tentar acessar rotas do coach
  if (userRole === 'aluno' && location.pathname === '/') {
    return <Navigate to="/portal-aluno/dashboard" replace />;
  }

  // Redirecionar coach para dashboard principal se tentar acessar portal-aluno
  if (userRole === 'coach' && location.pathname.startsWith('/portal-aluno')) {
    return <Navigate to="/" replace />;
  }

  // DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001: Sempre retornar children válido
  return <>{children}</>;
};

export default ProtectedRoute;
