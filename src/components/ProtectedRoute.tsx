import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('coach' | 'aluno')[];
  checkPayment?: boolean;
}

// RBAC-01: ProtectedRoute com verificação de role e payment_status
const ProtectedRoute = ({ 
  children, 
  allowedRoles = ['coach', 'aluno'],
  checkPayment = false
}: ProtectedRouteProps) => {
  const { user, loading, role, payment_status } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  // Verificar role
  const userRole = role || user.role || 'aluno';
  if (!allowedRoles.includes(userRole)) {
    // Redirecionar baseado no role
    if (userRole === 'aluno') {
      return <Navigate to="/portal-aluno/dashboard" replace />;
    } else {
      return <Navigate to="/" replace />;
    }
  }

  // Verificar payment_status para alunos (bloquear acesso se inadimplente)
  const userPaymentStatus = payment_status || user.payment_status || 'CURRENT';
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

  return <>{children}</>;
};

export default ProtectedRoute;
