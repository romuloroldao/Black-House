// DESIGN-CHECKPOINT-GLOBAL-RUNTIME-SHIELD-001: Blindagem global de erros de runtime
// Captura erros que escapam do React (ErrorBoundary) e do código assíncrono (try/catch)
// Garante que nenhum erro externo interrompa a execução da SPA em produção

/**
 * Runtime Shield - Blindagem Global de Erros
 * 
 * Este módulo implementa handlers globais para capturar erros que ocorrem:
 * - Fora do ciclo React (browser APIs, libs externas, scheduler)
 * - Em Promises rejeitadas não tratadas
 * - Em eventos assíncronos não relacionados ao React
 * 
 * Regras:
 * - Nunca relançar exceção
 * - Nunca interromper execução do JS
 * - Logar erro como warning estruturado
 * - Aplicação deve continuar funcionando
 */

interface ErrorInfo {
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  error?: Error;
  stack?: string;
  timestamp: string;
  userAgent: string;
  url: string;
}

interface RejectionInfo {
  reason: unknown;
  promise: Promise<unknown>;
  timestamp: string;
  userAgent: string;
  url: string;
}

// DESIGN-CHECKPOINT-GLOBAL-RUNTIME-SHIELD-001: Função para logar erro estruturado
function logRuntimeError(info: ErrorInfo | RejectionInfo, type: 'error' | 'rejection') {
  const isDevelopment = import.meta.env.DEV;
  const isProduction = import.meta.env.PROD;

  // DESIGN-CHECKPOINT-GLOBAL-RUNTIME-SHIELD-001: Em produção, usar console.warn
  // Em desenvolvimento, usar console.error para facilitar debug
  const logMethod = isProduction ? console.warn : console.error;
  
  const prefix = '[DESIGN-CHECKPOINT-GLOBAL-RUNTIME-SHIELD-001]';
  const errorType = type === 'error' ? 'Runtime Error' : 'Unhandled Promise Rejection';

  logMethod(`${prefix} ${errorType} capturado:`, {
    type: errorType,
    ...info,
    environment: isProduction ? 'production' : 'development',
    // DESIGN-CHECKPOINT-GLOBAL-RUNTIME-SHIELD-001: Informações adicionais para debug
    ...(type === 'error' && 'error' in info && info.error ? {
      errorName: info.error.name,
      errorMessage: info.error.message,
      errorStack: info.error.stack,
    } : {}),
    ...(type === 'rejection' && 'reason' in info ? {
      rejectionReason: info.reason instanceof Error 
        ? { name: info.reason.name, message: info.reason.message, stack: info.reason.stack }
        : String(info.reason),
    } : {}),
  });

  // DESIGN-CHECKPOINT-GLOBAL-RUNTIME-SHIELD-001: Opcional: Enviar para serviço de monitoramento
  // Descomentar e configurar se necessário
  // if (window.Sentry && isProduction) {
  //   if (type === 'error' && 'error' in info && info.error) {
  //     window.Sentry.captureException(info.error, {
  //       tags: { source: 'runtime-shield', type: 'window.onerror' },
  //       extra: info,
  //     });
  //   } else if (type === 'rejection' && 'reason' in info) {
  //     window.Sentry.captureException(info.reason instanceof Error ? info.reason : new Error(String(info.reason)), {
  //       tags: { source: 'runtime-shield', type: 'unhandledrejection' },
  //       extra: info,
  //     });
  //   }
  // }
}

// DESIGN-CHECKPOINT-GLOBAL-RUNTIME-SHIELD-001: Handler para window.onerror
function handleGlobalError(
  message: string | Event,
  source?: string,
  lineno?: number,
  colno?: number,
  error?: Error
): boolean {
  // DESIGN-CHECKPOINT-GLOBAL-RUNTIME-SHIELD-001: Nunca relançar exceção
  // Retornar true indica que o erro foi tratado e não deve ser propagado
  
  const errorInfo: ErrorInfo = {
    message: typeof message === 'string' ? message : message.type || 'Unknown error',
    source: source || 'unknown',
    lineno: lineno,
    colno: colno,
    error: error,
    stack: error?.stack,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
  };

  logRuntimeError(errorInfo, 'error');

  // DESIGN-CHECKPOINT-GLOBAL-RUNTIME-SHIELD-001: Retornar true para prevenir comportamento padrão
  // Isso evita que o erro apareça no console como "Uncaught Error"
  return true;
}

// DESIGN-CHECKPOINT-GLOBAL-RUNTIME-SHIELD-001: Handler para window.onunhandledrejection
function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  // DESIGN-CHECKPOINT-GLOBAL-RUNTIME-SHIELD-001: Prevenir comportamento padrão
  // Isso evita que a Promise rejeitada apareça no console como "Uncaught Promise Rejection"
  event.preventDefault();

  const rejectionInfo: RejectionInfo = {
    reason: event.reason,
    promise: event.promise,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
  };

  logRuntimeError(rejectionInfo, 'rejection');
}

// DESIGN-CHECKPOINT-GLOBAL-RUNTIME-SHIELD-001: Inicializar Runtime Shield
export function initializeRuntimeShield(): void {
  // DESIGN-CHECKPOINT-GLOBAL-RUNTIME-SHIELD-001: Verificar se já foi inicializado
  if ((window as any).__RUNTIME_SHIELD_INITIALIZED__) {
    console.warn('[DESIGN-CHECKPOINT-GLOBAL-RUNTIME-SHIELD-001] Runtime Shield já foi inicializado. Ignorando segunda inicialização.');
    return;
  }

  // DESIGN-CHECKPOINT-GLOBAL-RUNTIME-SHIELD-001: Registrar handlers globais
  window.onerror = handleGlobalError;
  window.onunhandledrejection = handleUnhandledRejection;

  // DESIGN-CHECKPOINT-GLOBAL-RUNTIME-SHIELD-001: Marcar como inicializado
  (window as any).__RUNTIME_SHIELD_INITIALIZED__ = true;

  if (import.meta.env.DEV) {
    console.log('[DESIGN-CHECKPOINT-GLOBAL-RUNTIME-SHIELD-001] Runtime Shield inicializado com sucesso.');
  }
}

// DESIGN-CHECKPOINT-GLOBAL-RUNTIME-SHIELD-001: Desabilitar Runtime Shield (útil para testes)
export function disableRuntimeShield(): void {
  window.onerror = null;
  window.onunhandledrejection = null;
  (window as any).__RUNTIME_SHIELD_INITIALIZED__ = false;
  
  if (import.meta.env.DEV) {
    console.log('[DESIGN-CHECKPOINT-GLOBAL-RUNTIME-SHIELD-001] Runtime Shield desabilitado.');
  }
}
