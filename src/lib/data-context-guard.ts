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
    canFetchData: state === 'READY',
    identity
  };
};

// DESIGN-023-RENDER-THROW-ELIMINATION-002: Função para verificar se pode fazer chamadas
// NÃO lança exceções - retorna null se não estiver pronto
export const assertDataContextReady = (methodName: string) => {
  if (!guardState.canFetchData) {
    // DESIGN-023: Não lançar exceção - retornar null e logar warning
    console.warn(
      `[DESIGN-023] DATA-CONTEXT-NOT-INITIALIZED: Tentativa de chamar ${methodName} sem contexto de dados inicializado. ` +
      `Estado atual: ${guardState.state}. ` +
      `Aguarde até que o contexto esteja READY antes de fazer chamadas de dados.`
    );
    return null;
  }

  if (!guardState.identity) {
    // DESIGN-023: Não lançar exceção - retornar null e logar warning
    console.warn(
      `[DESIGN-023] DATA-CONTEXT-NO-IDENTITY: Tentativa de chamar ${methodName} sem identidade resolvida.`
    );
    return null;
  }

  return guardState.identity;
};

// DESIGN-023-RENDER-THROW-ELIMINATION-002: Verificar se é Supabase direto (forbidden)
// NÃO lança exceções - retorna false se for forbidden
export const assertNoSupabaseDirectAccess = (methodName: string): boolean => {
  if (methodName === 'from' || methodName.includes('from(')) {
    // DESIGN-023: Não lançar exceção - logar warning e retornar false
    console.warn(
      `[DESIGN-023] DESIGN-SUPABASE-PURGE-GLOBAL-003: ` +
      `apiClient.from() é FORBIDDEN. Sintaxe PostgREST foi completamente removida. ` +
      `Use rotas semânticas específicas como getAlunosByCoach(), getMe(), etc.`
    );
    return false;
  }
  return true;
};

// DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Obter estado atual (para debug)
export const getDataContextState = () => ({ ...guardState });
