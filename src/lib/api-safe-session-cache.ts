/**
 * Cache negativo em memória do useApiSafe (erros 404 determinísticos).
 * Separado do hook para o logout limpar sem importar React hooks.
 */

export interface ApiSafeNegativeCacheEntry {
  status: number;
  error: string;
  errorType?: string;
}

export const apiSafeNegativeErrorCache = new Map<string, ApiSafeNegativeCacheEntry>();
export const apiSafeLogThrottle = new Set<string>();

export function clearApiSafeSessionCaches(): void {
  apiSafeNegativeErrorCache.clear();
  apiSafeLogThrottle.clear();
}
