// REACT-API-RESILIENCE-FIX-008: Hook para usar APIs resilientes
// Garante que componentes nunca quebram por erro de API

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient, ApiResult, ErrorType } from '@/lib/api-client';
import { safeArray } from '@/lib/data-safe-utils';
import { useDataContext } from '@/contexts/DataContext';
import { DataAvailabilityKey, isDataAvailable } from '@/lib/dataAvailability';
import {
  apiSafeLogThrottle,
  apiSafeNegativeErrorCache,
  clearApiSafeSessionCaches,
} from '@/lib/api-safe-session-cache';

export { clearApiSafeSessionCaches };

interface UseApiSafeOptions {
  /** Se false, não faz fetch automático no mount */
  autoFetch?: boolean;
  /** Identificador do endpoint para cache de erro */
  endpointKey?: string;
  /** Chave de disponibilidade de dados */
  availabilityKey?: DataAvailabilityKey;
  /** Callback em caso de erro */
  onError?: (error: string) => void;
}

/**
 * Cache negativo só para erros determinísticos de rota (404).
 * 401/403 NÃO entram aqui: token expirado ou permissão mudam com login/retry;
 * cacheá-los deixava o computador preso na mensagem de token até um reload completo,
 * enquanto o celular (sessão nova) funcionava.
 */

/**
 * Hook para buscar dados de API de forma resiliente
 * NUNCA quebra render, sempre retorna estado seguro
 *
 * @example
 * const { data, loading, error, refetch } = useApiSafe(
 *   () => apiClient.getAlunosByCoachSafe(),
 *   { autoFetch: true }
 * );
 */
export function useApiSafe<T>(
  fetcher: () => Promise<ApiResult<T>>,
  options: UseApiSafeOptions = {}
) {
  const { autoFetch = true, onError, endpointKey, availabilityKey } = options;
  const { dataReady, state: dataContextState, registerFatalError, clearFatalError } = useDataContext();

  const fetcherRef = useRef(fetcher);
  const onErrorRef = useRef(onError);
  const inFlightRef = useRef(false);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const runFetch = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = opts?.force === true;

      if (inFlightRef.current) {
        return;
      }
      if (!dataReady) {
        console.warn('[DESIGN-023] Tentativa de chamada de dados antes do DataContext READY', {
          state: dataContextState,
        });
        setLoading(false);
        return;
      }
      if (availabilityKey && !isDataAvailable(availabilityKey)) {
        setLoading(false);
        return;
      }

      if (force && endpointKey) {
        apiSafeNegativeErrorCache.delete(endpointKey);
        clearFatalError(endpointKey);
        setFatalError(null);
      }

      if (!force && fatalError) {
        setLoading(false);
        return;
      }
      if (endpointKey && apiClient.isEndpointBlocked(endpointKey)) {
        setFatalError('Rota não encontrada.');
        registerFatalError(endpointKey);
        setLoading(false);
        return;
      }
      if (!force && endpointKey && apiSafeNegativeErrorCache.has(endpointKey)) {
        const cached = apiSafeNegativeErrorCache.get(endpointKey);
        if (cached) {
          setError(cached.error);
          setLoading(false);
          return;
        }
      }

      inFlightRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const result = await fetcherRef.current();

        if (result.success) {
          setData(result.data);
          setError(null);
          setFatalError(null);
          if (endpointKey) {
            apiSafeNegativeErrorCache.delete(endpointKey);
            clearFatalError(endpointKey);
          }
        } else {
          setData(null);
          setError(result.error);

          // Só 404 é "fatal permanente" (rota inexistente). Auth/forbidden devem poder tentar de novo.
          if (result.status === 404 || result.errorType === ErrorType.FATAL) {
            setFatalError(result.error);
            if (endpointKey) {
              apiSafeNegativeErrorCache.set(endpointKey, {
                status: result.status ?? 404,
                error: result.error,
                errorType: result.errorType,
              });
              registerFatalError(endpointKey);
            }
          } else if (result.status === 401) {
            // Sessão inválida: limpa o token para o próximo reload/login não reutilizar lixo.
            apiClient.setToken(null);
          }

          const logKey = `${endpointKey || 'unknown'}|${result.status || 'unknown'}|${result.errorType || 'UNKNOWN'}`;
          if (!apiSafeLogThrottle.has(logKey)) {
            apiSafeLogThrottle.add(logKey);
            console.warn('[REACT-API-RESILIENCE-FIX-008] API retornou erro:', {
              error: result.error,
              errorType: result.errorType,
              status: result.status,
            });
          }

          if (onErrorRef.current) {
            onErrorRef.current(result.error);
          }
        }
      } catch (err) {
        console.error('[REACT-API-RESILIENCE-FIX-008] Erro inesperado no hook:', err);
        setData(null);
        setError('Erro inesperado');
      } finally {
        inFlightRef.current = false;
        setLoading(false);
      }
    },
    [
      availabilityKey,
      dataReady,
      dataContextState,
      endpointKey,
      fatalError,
      registerFatalError,
      clearFatalError,
    ],
  );

  const refetch = useCallback(() => runFetch({ force: true }), [runFetch]);

  useEffect(() => {
    if (autoFetch && dataReady) {
      if (availabilityKey && !isDataAvailable(availabilityKey)) {
        setLoading(false);
        return;
      }
      if (fatalError) {
        setLoading(false);
        return;
      }
      if (endpointKey && apiClient.isEndpointBlocked(endpointKey)) {
        setFatalError('Rota não encontrada.');
        registerFatalError(endpointKey);
        setLoading(false);
        return;
      }
      if (endpointKey && apiSafeNegativeErrorCache.has(endpointKey)) {
        const cached = apiSafeNegativeErrorCache.get(endpointKey);
        if (cached) {
          setError(cached.error);
        }
        setLoading(false);
        return;
      }
      void runFetch();
    } else if (autoFetch && !dataReady) {
      setLoading(false);
    }
  }, [autoFetch, availabilityKey, dataReady, endpointKey, fatalError, runFetch, registerFatalError]);

  return {
    data,
    loading,
    error,
    refetch,
    fatalError,
    /** Helper: retorna array vazio se data for null/undefined */
    dataAsArray: safeArray(data as any),
    /** Helper: verifica se há dados */
    hasData: data !== null && data !== undefined,
    /** Helper: verifica se há erro */
    hasError: error !== null,
  };
}

/**
 * Hook especializado para listas (garante array)
 *
 * @example
 * const { data, loading, error } = useApiSafeList(
 *   () => apiClient.getAlunosByCoachSafe()
 * );
 * // data é sempre um array, nunca null
 */
export function useApiSafeList<T>(
  fetcher: () => Promise<ApiResult<T[]>>,
  options: UseApiSafeOptions = {}
) {
  const result = useApiSafe(fetcher, options);

  return {
    ...result,
    /** Sempre retorna array, nunca null */
    data: safeArray(result.data),
  };
}
