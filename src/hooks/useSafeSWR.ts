import { useEffect, useRef, useState } from 'react';
import { apiClient, ApiResult, ErrorType } from '@/lib/api-client';
import { safeArray } from '@/lib/data-safe-utils';
import { useDataContext } from '@/contexts/DataContext';
import { getAvailabilityKeyForEndpoint, isDataAvailable } from '@/lib/dataAvailability';

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const swrCache = new Map<string, CacheEntry<any>>();

interface UseSafeSWR<T> {
  data: T;
  loading: boolean;
  error: string | null;
  fromCache: boolean;
  refetch: () => void;
}

interface UseSafeSWROptions {
  enabled?: boolean;
  ttlMs?: number;
  fallback?: any;
}

const DEFAULT_TTL_MS = 30000;

export function useSafeSWR<T = any>(
  endpoint: string | undefined,
  options: UseSafeSWROptions = {}
): UseSafeSWR<T> {
  const { enabled = true, ttlMs = DEFAULT_TTL_MS, fallback } = options;
  const { dataReady } = useDataContext();
  const inFlightRef = useRef(false);
  const [data, setData] = useState<T>(fallback ?? (safeArray() as any));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const availabilityKey = endpoint ? getAvailabilityKeyForEndpoint(endpoint) : null;

  const readCache = () => {
    if (!endpoint) return null;
    const cached = swrCache.get(endpoint);
    if (!cached) return null;
    const isFresh = Date.now() - cached.timestamp <= ttlMs;
    return isFresh ? cached : null;
  };

  const fetchData = async () => {
    if (!endpoint || inFlightRef.current) return;
    if (!dataReady) return;
    if (!enabled) return;
    if (apiClient.isEndpointBlocked(endpoint)) return;
    if (availabilityKey && !isDataAvailable(availabilityKey)) {
      setLoading(false);
      return;
    }

    const cached = readCache();
    if (cached) {
      setData(cached.data);
      setFromCache(true);
      setLoading(false);
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    setError(null);
    setFromCache(false);

    const result: ApiResult<T> = await apiClient.requestSafe<T>(endpoint);
    if (result.success) {
      setData(result.data);
      swrCache.set(endpoint, { data: result.data, timestamp: Date.now() });
    } else {
      setError(result.error);
      if (result.errorType === ErrorType.FATAL || result.status === 404) {
        setLoading(false);
        inFlightRef.current = false;
        return;
      }
    }

    setLoading(false);
    inFlightRef.current = false;
  };

  useEffect(() => {
    if (!endpoint) return;
    if (!enabled) return;
    if (!dataReady) return;
    if (availabilityKey && !isDataAvailable(availabilityKey)) {
      setLoading(false);
      return;
    }
    if (apiClient.isEndpointBlocked(endpoint)) {
      setLoading(false);
      return;
    }
    void fetchData();
  }, [endpoint, enabled, dataReady, availabilityKey]);

  return {
    data,
    loading,
    error,
    fromCache,
    refetch: () => {
      if (!endpoint) return;
      swrCache.delete(endpoint);
      void fetchData();
    }
  };
}
