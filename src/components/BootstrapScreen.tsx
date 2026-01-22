// DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Componentes de UI para estados de bootstrap

import { useDataContext } from '@/contexts/DataContext';
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
export const BootstrapLoader = () => {
  const { state, identity } = useDataContext();
  
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
export const BootstrapGuard = ({ children }: { children: React.ReactNode }) => {
  const { state, error, isReady } = useDataContext();
  const location = useLocation();
  const isAuthRoute = location.pathname === '/auth' || location.pathname.startsWith('/auth');

  // DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Rotas públicas não precisam de contexto
  if (isAuthRoute) {
    return <>{children}</>;
  }

  // DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: UI Contract conforme especificação
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

  // Fallback - não deveria acontecer
  return <SplashScreen />;
};
