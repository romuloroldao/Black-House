// DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Hook helper para garantir que componentes aguardem contexto

import { useEffect, useState } from 'react';
import { useDataContextGuard } from '@/contexts/DataContext';

/**
 * Hook que garante que uma função só seja executada quando o contexto de dados estiver pronto
 * 
 * @example
 * ```tsx
 * const { executeWhenReady } = useDataFetch();
 * 
 * useEffect(() => {
 *   executeWhenReady(async () => {
 *     const alunos = await apiClient.getAlunosByCoach();
 *     setAlunos(alunos);
 *   });
 * }, [executeWhenReady]);
 * ```
 */
export const useDataFetch = () => {
  const { canFetchData, assertDataContext, state } = useDataContextGuard();
  const [isExecuting, setIsExecuting] = useState(false);

  const executeWhenReady = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    if (!canFetchData) {
      console.warn(
        `[DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015] Tentativa de executar função sem contexto pronto. ` +
        `Estado atual: ${state}. Aguardando...`
      );
      return null;
    }

    try {
      assertDataContext();
      setIsExecuting(true);
      const result = await fn();
      return result;
    } catch (error: any) {
      if (error.code === 'DATA-CONTEXT-NOT-INITIALIZED' || error.code === 'DATA-CONTEXT-NO-IDENTITY') {
        console.warn(
          `[DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015] ${error.message}`
        );
        return null;
      }
      throw error;
    } finally {
      setIsExecuting(false);
    }
  };

  return {
    canFetchData,
    isExecuting,
    executeWhenReady,
    state
  };
};
