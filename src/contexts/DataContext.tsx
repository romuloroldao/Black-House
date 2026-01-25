// DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Sistema de lock de contexto de dados
// Garante que nenhuma chamada de dados ocorre antes da identidade estar resolvida

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { updateDataContextGuard } from '@/lib/data-context-guard';

// Estados da máquina de estados de bootstrap
export type BootstrapState = 
  | 'INIT'
  | 'IDENTITY_RESOLVED'
  | 'CONTEXT_READY'
  | 'READY'
  | 'FAILED';

// Interface de identidade resolvida
export interface ResolvedIdentity {
  user_id: string;
  role: 'coach' | 'aluno';
  tenant_id?: string;
  email: string;
  capabilities?: string[];
}

// Interface de contexto de dados
export interface DataContext {
  identity: ResolvedIdentity | null;
  state: BootstrapState;
  error: Error | null;
}

interface DataContextType extends DataContext {
  isReady: boolean;
  canFetchData: boolean;
  dataReady: boolean;
  hasFatalError: boolean;
  registerFatalError: (endpointKey: string) => void;
  clearFatalError: (endpointKey: string) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Provider que gerencia o bootstrap
export const DataContextProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading, role } = useAuth();
  const [state, setState] = useState<BootstrapState>('INIT');
  const [identity, setIdentity] = useState<ResolvedIdentity | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [fatalErrors, setFatalErrors] = useState<Set<string>>(new Set());
  // REACT-SOFT-LOCK-FIX-003: Ref para acessar state atual no timeout
  const stateRef = useRef<BootstrapState>(state);
  
  // REACT-SOFT-LOCK-FIX-003: Atualizar ref quando state mudar
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    // REACT-SOFT-LOCK-FIX-003: Timeout para garantir que estado sempre evolua
    const BOOTSTRAP_TIMEOUT = 15000; // 15 segundos
    let timeoutId: NodeJS.Timeout | null = null;
    
    // REACT-SOFT-LOCK-FIX-003: Timeout de segurança - se não evoluir em 15s, liberar render
    timeoutId = setTimeout(() => {
      console.warn('[REACT-SOFT-LOCK-FIX-003] Timeout no bootstrap. Liberando render mesmo sem dados completos.');
      // Verificar estado atual via ref
      const currentState = stateRef.current;
      if (currentState === 'INIT' || currentState === 'IDENTITY_RESOLVED' || currentState === 'CONTEXT_READY') {
        // Tentar criar identidade mínima se possível
        if (user && role) {
          const minimalIdentity: ResolvedIdentity = {
            user_id: user.id,
            role: role,
            email: user.email || '',
            tenant_id: user.id,
            capabilities: role === 'coach' 
              ? ['read:alunos', 'write:alunos', 'read:stats']
              : ['read:own_data', 'read:own_diet', 'read:own_workouts']
          };
          setIdentity(minimalIdentity);
          updateDataContextGuard('READY', {
            user_id: user.id,
            role: role,
            tenant_id: user.id
          });
        } else {
          updateDataContextGuard('READY', null);
        }
        setState('READY');
      }
    }, BOOTSTRAP_TIMEOUT);
    
    // DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Fase 1 - Resolver identidade
    if (authLoading) {
      setState('INIT');
      updateDataContextGuard('INIT', null);
      return () => {
        if (timeoutId) clearTimeout(timeoutId);
      };
    }

    if (!user || !role) {
      // Sem usuário autenticado - não há contexto de dados
      // REACT-SOFT-LOCK-FIX-003: Limpar timeout se não há usuário (estado final)
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      setState('INIT');
      setIdentity(null);
      updateDataContextGuard('INIT', null);
      return () => {
        if (timeoutId) clearTimeout(timeoutId);
      };
    }

    // DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Identidade resolvida via /api/me
    // O AuthContext já fez a chamada para /auth/user, mas precisamos garantir
    // que temos todos os dados necessários para criar o contexto
    const resolvedIdentity: ResolvedIdentity = {
      user_id: user.id,
      role: role,
      email: user.email,
      tenant_id: user.id, // Por enquanto, usar user_id como tenant_id
      capabilities: role === 'coach' 
        ? ['read:alunos', 'write:alunos', 'read:stats']
        : ['read:own_data', 'read:own_diet', 'read:own_workouts']
    };

    setIdentity(resolvedIdentity);
    setState('IDENTITY_RESOLVED');
    updateDataContextGuard('IDENTITY_RESOLVED', {
      user_id: resolvedIdentity.user_id,
      role: resolvedIdentity.role,
      tenant_id: resolvedIdentity.tenant_id
    });

    // DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Fase 2 - Criar contexto de dados
    // Contexto é criado imediatamente após identidade resolvida
    setState('CONTEXT_READY');
    updateDataContextGuard('CONTEXT_READY', {
      user_id: resolvedIdentity.user_id,
      role: resolvedIdentity.role,
      tenant_id: resolvedIdentity.tenant_id
    });

    // DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Fase 3 - Desbloquear domínio
    // Pequeno delay para garantir que todos os listeners estão prontos
    const readyTimeout = setTimeout(() => {
      // REACT-SOFT-LOCK-FIX-003: Limpar timeout principal quando chegar em READY
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      setState('READY');
      updateDataContextGuard('READY', {
        user_id: resolvedIdentity.user_id,
        role: resolvedIdentity.role,
        tenant_id: resolvedIdentity.tenant_id
      });
    }, 100);
    
    // REACT-SOFT-LOCK-FIX-003: Cleanup
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      clearTimeout(readyTimeout);
    };

  }, [user, role, authLoading]);

  const isReady = state === 'READY';
  const canFetchData = state === 'READY';
  const dataReady = state === 'READY';
  const hasFatalError = fatalErrors.size > 0;

  const registerFatalError = (endpointKey: string) => {
    setFatalErrors((prev) => {
      if (prev.has(endpointKey)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(endpointKey);
      return next;
    });
  };

  const clearFatalError = (endpointKey: string) => {
    setFatalErrors((prev) => {
      if (!prev.has(endpointKey)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(endpointKey);
      return next;
    });
  };

  return (
    <DataContext.Provider value={{
      identity,
      state,
      error,
      isReady,
      canFetchData,
      dataReady,
      hasFatalError,
      registerFatalError,
      clearFatalError
    }}>
      {children}
    </DataContext.Provider>
  );
};

// DESIGN-023-RENDER-THROW-ELIMINATION-002: Hook não lança exceção - retorna valores seguros
export const useDataContext = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    // DESIGN-023: Não lançar exceção - retornar valores seguros
    console.warn('[DESIGN-023] useDataContext usado fora de DataContextProvider. Retornando valores padrão.');
    return {
      identity: null,
      state: 'INIT' as BootstrapState,
      error: null,
      isReady: false,
      canFetchData: false,
      dataReady: false,
      hasFatalError: false,
      registerFatalError: () => {},
      clearFatalError: () => {},
    };
  }
  return context;
};

// DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Hook guard para prevenir chamadas sem contexto
// DESIGN-023-RENDER-THROW-ELIMINATION-002: Não lança exceção - retorna null se não estiver pronto
export const useDataContextGuard = () => {
  const { canFetchData, identity, state } = useDataContext();

  const assertDataContext = () => {
    if (!canFetchData) {
      // DESIGN-023: Não lançar exceção - retornar null e logar warning
      console.warn(
        `[DESIGN-023] DATA-CONTEXT-NOT-INITIALIZED: Tentativa de buscar dados sem contexto inicializado. ` +
        `Estado atual: ${state}. Aguarde até que o contexto esteja READY.`
      );
      return null;
    }

    if (!identity) {
      // DESIGN-023: Não lançar exceção - retornar null e logar warning
      console.warn(
        `[DESIGN-023] DATA-CONTEXT-NO-IDENTITY: Tentativa de buscar dados sem identidade resolvida.`
      );
      return null;
    }

    return identity;
  };

  return { assertDataContext, canFetchData, identity, state };
};
