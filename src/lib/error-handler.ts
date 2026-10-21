// DESIGN-API-CONNECTIVITY-GUARD-009: Helper para tratamento de erros da API
import { ErrorType } from './api-client';

export interface ApiError extends Error {
  errorType?: ErrorType;
  status?: number;
  endpoint?: string;
  originalError?: unknown;
}

/**
 * Obtém mensagem de erro customizada baseada no tipo de erro
 */
export function getErrorMessage(error: unknown): { title: string; message: string } {
  const apiError = error as ApiError;
  const errorType = apiError.errorType;
  
  // Erros TLS
  if (errorType === ErrorType.TLS) {
    return {
      title: 'Erro de segurança',
      message: 'Erro de segurança (SSL). Contate o suporte.'
    };
  }
  
  // Erros de rede
  if (errorType === ErrorType.NETWORK) {
    return {
      title: 'Erro de conexão',
      message: 'Erro de conexão com a API. Verifique sua internet.'
    };
  }
  
  // Erros de backend
  if (errorType === ErrorType.AUTH) {
    return {
      title: 'Erro de autenticação',
      message: apiError.message || 'Credenciais inválidas ou sessão expirada.'
    };
  }

  if (errorType === ErrorType.FATAL) {
    return {
      title: 'Erro ao carregar dados',
      message: apiError.message || 'Rota não encontrada.'
    };
  }

  if (errorType === ErrorType.BACKEND) {
    return {
      title: 'Erro na requisição',
      message: apiError.message || 'Erro ao processar a requisição.'
    };
  }
  
  // Erro desconhecido
  return {
    title: 'Erro desconhecido',
    message: apiError.message || 'Ocorreu um erro inesperado.'
  };
}

/**
 * Loga erro com informações detalhadas para debugging
 */
export function logError(error: unknown, context?: string): void {
  const apiError = error as ApiError;
  
  const logData = {
    designId: 'DESIGN-API-CONNECTIVITY-GUARD-009',
    context: context || 'unknown',
    errorType: apiError.errorType || 'UNKNOWN',
    message: apiError.message,
    status: apiError.status,
    endpoint: apiError.endpoint,
    timestamp: new Date().toISOString()
  };
  
  // Log estruturado para facilitar análise
  if (apiError.errorType === ErrorType.TLS) {
    console.error('[TLS_ERROR]', logData);
  } else if (apiError.errorType === ErrorType.NETWORK) {
    console.error('[NETWORK_ERROR]', logData);
  } else if (apiError.errorType === ErrorType.AUTH) {
    console.error('[AUTH_ERROR]', logData);
  } else if (apiError.errorType === ErrorType.FATAL) {
    console.error('[FATAL_ERROR]', logData);
  } else if (apiError.errorType === ErrorType.BACKEND) {
    console.error('[BACKEND_ERROR]', logData);
  } else {
    console.error('[UNKNOWN_ERROR]', logData);
  }
  
  // Log do erro original se disponível
  if (apiError.originalError) {
    console.error('[ORIGINAL_ERROR]', apiError.originalError);
  }
}
