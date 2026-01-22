// DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Guard global para prevenir chamadas sem contexto

// Sistema de guard global que pode ser verificado antes de qualquer chamada de dados
// Este módulo permite que o apiClient verifique se o contexto está pronto
// sem criar dependência circular com React Context

type DataContextState = 'INIT' | 'IDENTITY_RESOLVED' | 'CONTEXT_READY' | 'READY' | 'FAILED';

interface DataContextGuard {
  state: DataContextState;
  canFetchData: boolean;
  identity: {
    user_id: string;
    role: 'coach' | 'aluno';
    tenant_id?: string;
  } | null;
}

// DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Estado global do guard
let guardState: DataContextGuard = {
  state: 'INIT',
  canFetchData: false,
  identity: null
};

// DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Função para atualizar o guard (chamada pelo DataContext)
export const updateDataContextGuard = (state: DataContextState, identity: DataContextGuard['identity']) => {
  guardState = {
    state,
    canFetchData: state === 'READY' || state === 'CONTEXT_READY',
    identity
  };
};

// DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Função para verificar se pode fazer chamadas
export const assertDataContextReady = (methodName: string) => {
  if (!guardState.canFetchData) {
    const error = new Error(
      `DATA-CONTEXT-NOT-INITIALIZED: Tentativa de chamar ${methodName} sem contexto de dados inicializado. ` +
      `Estado atual: ${guardState.state}. ` +
      `Aguarde até que o contexto esteja READY antes de fazer chamadas de dados.`
    );
    (error as any).code = 'DATA-CONTEXT-NOT-INITIALIZED';
    (error as any).state = guardState.state;
    (error as any).designId = 'DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015';
    throw error;
  }

  if (!guardState.identity) {
    const error = new Error(
      `DATA-CONTEXT-NO-IDENTITY: Tentativa de chamar ${methodName} sem identidade resolvida.`
    );
    (error as any).code = 'DATA-CONTEXT-NO-IDENTITY';
    (error as any).designId = 'DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015';
    throw error;
  }

  return guardState.identity;
};

// DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Verificar se é Supabase direto (forbidden)
export const assertNoSupabaseDirectAccess = (methodName: string) => {
  if (methodName === 'from' || methodName.includes('from(')) {
    const error = new Error(
      `DESIGN-SUPABASE-PURGE-GLOBAL-003 + DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: ` +
      `apiClient.from() é FORBIDDEN. Sintaxe PostgREST foi completamente removida. ` +
      `Use rotas semânticas específicas como getAlunosByCoach(), getMe(), etc.`
    );
    (error as any).code = 'POSTGREST_FORBIDDEN';
    (error as any).designId = 'DESIGN-SUPABASE-PURGE-GLOBAL-003';
    throw error;
  }
};

// DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Obter estado atual (para debug)
export const getDataContextState = () => ({ ...guardState });
