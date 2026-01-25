// REACT-DATA-LAYER-HARDENING-FIX-006: Utilitários para acesso seguro a dados
// Garante que dados nulos/undefined não quebrem renderização

/**
 * Retorna array seguro - sempre retorna array, nunca null/undefined
 */
export function safeArray<T>(data: T[] | null | undefined, fallback: T[] = []): T[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (data === null || data === undefined) {
    return fallback;
  }
  // Se data não é array mas existe, tentar converter
  console.warn('[REACT-DATA-LAYER-HARDENING-FIX-006] safeArray recebeu não-array:', typeof data);
  return fallback;
}

/**
 * Retorna objeto seguro - sempre retorna objeto, nunca null/undefined
 */
export function safeObject<T extends Record<string, any>>(
  data: T | null | undefined,
  fallback: T
): T {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data;
  }
  if (data === null || data === undefined) {
    return fallback;
  }
  console.warn('[REACT-DATA-LAYER-HARDENING-FIX-006] safeObject recebeu não-objeto:', typeof data);
  return fallback;
}

/**
 * Retorna valor seguro com fallback
 */
export function safeValue<T>(
  data: T | null | undefined,
  fallback: T
): T {
  if (data === null || data === undefined) {
    return fallback;
  }
  return data;
}

/**
 * Retorna primeiro item de array ou fallback
 */
export function safeFirst<T>(
  data: T[] | null | undefined,
  fallback: T | null = null
): T | null {
  const arr = safeArray(data);
  return arr.length > 0 ? arr[0] : fallback;
}

/**
 * Verifica se array tem itens de forma segura
 */
export function hasItems<T>(data: T[] | null | undefined): boolean {
  const arr = safeArray(data);
  return arr.length > 0;
}

/**
 * Mapeia array de forma segura
 */
export function safeMap<T, R>(
  data: T[] | null | undefined,
  mapper: (item: T, index: number) => R,
  fallback: R[] = []
): R[] {
  const arr = safeArray(data);
  try {
    return arr.map(mapper);
  } catch (error) {
    console.error('[REACT-DATA-LAYER-HARDENING-FIX-006] Erro ao mapear array:', error);
    return fallback;
  }
}

/**
 * Filtra array de forma segura
 */
export function safeFilter<T>(
  data: T[] | null | undefined,
  predicate: (item: T, index: number) => boolean,
  fallback: T[] = []
): T[] {
  const arr = safeArray(data);
  try {
    return arr.filter(predicate);
  } catch (error) {
    console.error('[REACT-DATA-LAYER-HARDENING-FIX-006] Erro ao filtrar array:', error);
    return fallback;
  }
}
