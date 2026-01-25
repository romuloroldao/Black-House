// DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Componentes de UI para estados de bootstrap
// REACT-SOFT-LOCK-FIX-003: Adicionar timeout para garantir que render sempre seja liberado

import { useState, useEffect } from 'react';
import { useDataContext } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext'; // REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009
import { useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

// DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: SplashScreen para estado INIT
export const SplashScreen = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
};

// DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Loader para estados IDENTITY_RESOLVED e CONTEXT_READY
// DESIGN-023-RENDER-THROW-ELIMINATION-002: Proteção contra erros de contexto
export const BootstrapLoader = () => {
  // DESIGN-023: Optional chaining e valores padrão para evitar crashes
  const context = useDataContext();
  const state = context?.state || 'INIT';
  const identity = context?.identity || null;
  
  const getMessage = () => {
    if (state === 'IDENTITY_RESOLVED') {
      return 'Identificando usuário...';
    }
    if (state === 'CONTEXT_READY') {
      return identity?.role === 'coach' 
        ? 'Preparando ambiente do coach...'
        : 'Preparando seu portal...';
    }
    return 'Carregando...';
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{getMessage()}</p>
      </div>
    </div>
  );
};

// DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: FatalError para estado FAILED
export const FatalError = ({ error }: { error: Error | null }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
      <div className="flex flex-col items-center gap-4 max-w-md text-center p-6">
        <div className="text-destructive text-4xl">⚠️</div>
        <h1 className="text-2xl font-bold">Erro ao inicializar</h1>
        <p className="text-sm text-muted-foreground">
          {error?.message || 'Não foi possível inicializar o contexto de dados.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Recarregar página
        </button>
      </div>
    </div>
  );
};

// DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Componente principal que renderiza UI baseado no estado
// DESIGN-023-RENDER-THROW-ELIMINATION-002: Proteção contra erros de contexto
// REACT-SOFT-LOCK-FIX-005: forceRender SEMPRE vence qualquer condição de estado
// REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009: Aguardar authInitialized antes de liberar
export const BootstrapGuard = ({ children }: { children: React.ReactNode }) => {
  // DESIGN-023: Optional chaining e valores padrão para evitar crashes
  const context = useDataContext();
  const state = context?.state || 'INIT';
  const error = context?.error || null;
  const isReady = context?.isReady || false;
  
  const location = useLocation();
  const isAuthRoute = location.pathname === '/auth' || location.pathname.startsWith('/auth');

  // REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009: Importar useAuth para verificar authInitialized
  const { authInitialized } = useAuth();

  // REACT-SOFT-LOCK-FIX-005: forceRender deve ser verificado PRIMEIRO, antes de qualquer condição
  // Se forceRender === true, NUNCA renderizar loading, sempre liberar render
  const [forceRender, setForceRender] = useState(false);
  
  useEffect(() => {
    // REACT-SOFT-LOCK-FIX-005: Timeout de 20 segundos para forçar render
    const forceRenderTimeout = setTimeout(() => {
      console.warn('[REACT-SOFT-LOCK-FIX-005] Timeout no BootstrapGuard (20s). Liberando render forçadamente.');
      setForceRender(true);
    }, 20000);
    
    return () => clearTimeout(forceRenderTimeout);
  }, []);

  // REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009: Log de diagnóstico
  console.log('[REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009] BootstrapGuard:', { 
    state, 
    isReady, 
    authInitialized, 
    forceRender, 
    isAuthRoute 
  });

  // DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Rotas públicas não precisam de contexto
  if (isAuthRoute) {
    return <>{children}</>;
  }

  // REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009: Aguardar authInitialized ANTES de qualquer decisão
  // Este é o novo invariante - garante que AuthContext terminou bootstrap
  if (!authInitialized && !forceRender) {
    console.log('[REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009] BootstrapGuard aguardando authInitialized');
    return <SplashScreen />;
  }

  // REACT-SOFT-LOCK-FIX-005: VERIFICAR forceRender ANTES de qualquer condição de estado
  // Se timeout expirou, liberar render mesmo sem dados completos
  // forceRender SEMPRE vence qualquer condição de estado
  if (forceRender) {
    console.warn('[REACT-SOFT-LOCK-FIX-005] Renderizando children forçadamente após timeout. Estado atual:', state, 'isReady:', isReady);
    return <>{children}</>;
  }

  // DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: UI Contract conforme especificação
  // REACT-SOFT-LOCK-FIX-005: Só renderizar loading se forceRender === false
  if (state === 'INIT') {
    return <SplashScreen />;
  }

  if (state === 'IDENTITY_RESOLVED' || state === 'CONTEXT_READY') {
    return <BootstrapLoader />;
  }

  if (state === 'FAILED') {
    return <FatalError error={error} />;
  }

  // DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Estado READY - renderizar app
  if (state === 'READY' && isReady) {
    return <>{children}</>;
  }

  // REACT-SOFT-LOCK-FIX-005: Se estado não é READY mas também não é INIT/IDENTITY_RESOLVED/CONTEXT_READY/FAILED
  // Isso não deveria acontecer, mas se acontecer, liberar render como fallback
  console.warn('[REACT-SOFT-LOCK-FIX-005] Estado inesperado no BootstrapGuard:', state, '. Liberando render como fallback.');
  return <>{children}</>;
};
