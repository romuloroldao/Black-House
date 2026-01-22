// DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Sistema de lock de contexto de dados
// Garante que nenhuma chamada de dados ocorre antes da identidade estar resolvida

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Provider que gerencia o bootstrap
export const DataContextProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading, role } = useAuth();
  const [state, setState] = useState<BootstrapState>('INIT');
  const [identity, setIdentity] = useState<ResolvedIdentity | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Fase 1 - Resolver identidade
    if (authLoading) {
      setState('INIT');
      updateDataContextGuard('INIT', null);
      return;
    }

    if (!user || !role) {
      // Sem usuário autenticado - não há contexto de dados
      setState('INIT');
      setIdentity(null);
      updateDataContextGuard('INIT', null);
      return;
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
    setTimeout(() => {
      setState('READY');
      updateDataContextGuard('READY', {
        user_id: resolvedIdentity.user_id,
        role: resolvedIdentity.role,
        tenant_id: resolvedIdentity.tenant_id
      });
    }, 100);

  }, [user, role, authLoading]);

  const isReady = state === 'READY';
  const canFetchData = state === 'READY' || state === 'CONTEXT_READY';

  return (
    <DataContext.Provider value={{
      identity,
      state,
      error,
      isReady,
      canFetchData
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useDataContext = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useDataContext must be used within a DataContextProvider');
  }
  return context;
};

// DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Hook guard para prevenir chamadas sem contexto
export const useDataContextGuard = () => {
  const { canFetchData, identity, state } = useDataContext();

  const assertDataContext = () => {
    if (!canFetchData) {
      const error = new Error(
        `DATA-CONTEXT-NOT-INITIALIZED: Tentativa de buscar dados sem contexto inicializado. ` +
        `Estado atual: ${state}. Aguarde até que o contexto esteja READY.`
      );
      (error as any).code = 'DATA-CONTEXT-NOT-INITIALIZED';
      (error as any).state = state;
      throw error;
    }

    if (!identity) {
      const error = new Error(
        `DATA-CONTEXT-NO-IDENTITY: Tentativa de buscar dados sem identidade resolvida.`
      );
      (error as any).code = 'DATA-CONTEXT-NO-IDENTITY';
      throw error;
    }

    return identity;
  };

  return { assertDataContext, canFetchData, identity, state };
};
