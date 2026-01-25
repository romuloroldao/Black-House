import { assertDataContextReady, assertNoSupabaseDirectAccess } from './data-context-guard';
import { API_CONTRACT, isContractEndpoint, normalizeEndpoint } from '@/contracts/api-contract';
import { getAvailabilityKeyForEndpoint, isDataAvailable } from '@/lib/dataAvailability';

// FIX-012 — allowlist de endpoints reais da VPS
export const ALLOWED_ENDPOINTS = new Set<string>([
    '/api/alunos/by-coach',
    '/api/alunos',
    '/api/alunos/me',
    '/api/profiles/me',
    '/api/me',
    '/api/mensagens',
    '/api/notificacoes',
    '/api/payment-plans',
    '/api/alimentos'
]);

export function isEndpointAllowed(endpoint: string) {
    const normalized = normalizeEndpoint(endpoint);
    for (const allowed of ALLOWED_ENDPOINTS) {
        if (normalized.startsWith(allowed)) {
            return true;
        }
    }
    return false;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// DESIGN-API-CONNECTIVITY-GUARD-009: Tipos de erro para guard rails
export enum ErrorType {
    TLS = 'TLS',
    NETWORK = 'NETWORK',
    AUTH = 'AUTH',
    FATAL = 'FATAL',
    BACKEND = 'BACKEND',
    UNKNOWN = 'UNKNOWN'
}

// REACT-API-RESILIENCE-FIX-008: Resultado padronizado de API
export type ApiResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; errorType?: ErrorType; status?: number };

// REACT-API-RESILIENCE-FIX-008: Helper para criar resultado de sucesso
export function apiSuccess<T>(data: T): ApiResult<T> {
  return { success: true, data };
}

// REACT-API-RESILIENCE-FIX-008: Helper para criar resultado de erro
export function apiError<T>(error: string, errorType?: ErrorType, status?: number): ApiResult<T> {
  return { success: false, error, errorType, status };
}

// DESIGN-API-CONNECTIVITY-GUARD-009: Mensagens de erro customizadas
const ERROR_MESSAGES = {
    [ErrorType.TLS]: 'Erro de segurança (SSL). Contate o suporte.',
    [ErrorType.NETWORK]: 'Erro de conexão com a API.',
    [ErrorType.AUTH]: 'Erro de autenticação.',
    [ErrorType.FATAL]: 'Rota não encontrada.',
    [ErrorType.BACKEND]: 'Erro na requisição.',
    [ErrorType.UNKNOWN]: 'Erro desconhecido na requisição.'
};

// DESIGN-API-CONNECTIVITY-GUARD-009: Classificar tipo de erro
function classifyError(error: unknown, endpoint: string): { type: ErrorType; message: string; originalError: unknown } {
    // Erros de TLS/SSL
    if (error instanceof TypeError) {
        const errorMessage = error.message.toLowerCase();
        if (
            errorMessage.includes('failed to fetch') ||
            errorMessage.includes('networkerror') ||
            errorMessage.includes('network error') ||
            errorMessage.includes('ssl') ||
            errorMessage.includes('tls') ||
            errorMessage.includes('certificate') ||
            errorMessage.includes('cert') ||
            errorMessage.includes('secure') ||
            errorMessage.includes('security')
        ) {
            // Verificar se é especificamente TLS ou rede genérica
            if (
                errorMessage.includes('ssl') ||
                errorMessage.includes('tls') ||
                errorMessage.includes('certificate') ||
                errorMessage.includes('cert') ||
                errorMessage.includes('secure') ||
                errorMessage.includes('security')
            ) {
                console.error('[DESIGN-API-CONNECTIVITY-GUARD-009] Erro TLS detectado:', {
                    endpoint,
                    error: errorMessage,
                    type: 'TLS'
                });
                return {
                    type: ErrorType.TLS,
                    message: ERROR_MESSAGES[ErrorType.TLS],
                    originalError: error
                };
            }
            
            // Erro de rede genérico
            console.error('[DESIGN-API-CONNECTIVITY-GUARD-009] Erro de rede detectado:', {
                endpoint,
                error: errorMessage,
                type: 'NETWORK'
            });
            return {
                type: ErrorType.NETWORK,
                message: ERROR_MESSAGES[ErrorType.NETWORK],
                originalError: error
            };
        }
    }
    
    // Erros de conexão recusada, timeout, etc.
    if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (
            errorMessage.includes('connection refused') ||
            errorMessage.includes('connection reset') ||
            errorMessage.includes('connection timeout') ||
            errorMessage.includes('network') ||
            errorMessage.includes('fetch') ||
            errorMessage.includes('econnrefused') ||
            errorMessage.includes('etimedout') ||
            errorMessage.includes('enotfound')
        ) {
            console.error('[DESIGN-API-CONNECTIVITY-GUARD-009] Erro de rede detectado:', {
                endpoint,
                error: errorMessage,
                type: 'NETWORK'
            });
            return {
                type: ErrorType.NETWORK,
                message: ERROR_MESSAGES[ErrorType.NETWORK],
                originalError: error
            };
        }
    }
    
    // Erro desconhecido
    console.error('[DESIGN-API-CONNECTIVITY-GUARD-009] Erro desconhecido:', {
        endpoint,
        error: error instanceof Error ? error.message : String(error),
        type: 'UNKNOWN'
    });
    return {
        type: ErrorType.UNKNOWN,
        message: ERROR_MESSAGES[ErrorType.UNKNOWN],
        originalError: error
    };
}

class ApiClient {
    private token: string | null = null;
    private fatalBlockedEndpoints: Set<string> = new Set();

    constructor() {
        this.token = localStorage.getItem('auth_token');
    }

    setToken(token: string | null) {
        this.token = token;
        if (token) {
            localStorage.setItem('auth_token', token);
        } else {
            localStorage.removeItem('auth_token');
        }
    }

    getToken() {
        return this.token;
    }

    isEndpointBlocked(endpoint: string) {
        if (isEndpointAllowed(endpoint)) {
            return false;
        }
        return this.fatalBlockedEndpoints.has(normalizeEndpoint(endpoint));
    }

    blockEndpoint(endpoint: string) {
        if (isEndpointAllowed(endpoint)) {
            return;
        }
        this.fatalBlockedEndpoints.add(normalizeEndpoint(endpoint));
    }

    // REACT-API-RESILIENCE-FIX-008: Request seguro que nunca lança exceção
    // Retorna ApiResult<T> ao invés de lançar erros
    private async safeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResult<T>> {
        try {
            const method = (options.method || 'GET').toUpperCase();
            const availabilityKey = getAvailabilityKeyForEndpoint(normalizeEndpoint(endpoint));
            if (availabilityKey && !isDataAvailable(availabilityKey)) {
                if (method === 'GET') {
                    return apiSuccess([] as unknown as T);
                }
                return apiError('Base não disponível.', ErrorType.FATAL, 404);
            }
            if (!isContractEndpoint(endpoint)) {
                console.warn('[FIX-012] Endpoint fora do contrato. Bloqueando chamada:', {
                    endpoint: normalizeEndpoint(endpoint),
                    method
                });
                this.blockEndpoint(endpoint);
                if (method === 'GET') {
                    return apiSuccess([] as unknown as T);
                }
                return apiError('Rota não encontrada.', ErrorType.FATAL, 404);
            }
            if (this.isEndpointBlocked(endpoint)) {
                if (method === 'GET') {
                    return apiSuccess([] as unknown as T);
                }
                return apiError('Rota não encontrada.', ErrorType.FATAL, 404);
            }
            const data = await this.request(endpoint, options);
            return apiSuccess(data);
        } catch (error: any) {
            if (error?.errorType === ErrorType.FATAL && error?.endpoint) {
                this.blockEndpoint(error.endpoint);
                const method = (options.method || 'GET').toUpperCase();
                if (method === 'GET') {
                    return apiSuccess([] as unknown as T);
                }
                return apiError(error.message || ERROR_MESSAGES[ErrorType.FATAL], ErrorType.FATAL, error.status);
            }
            // Logar erro com tag FIX-008
            console.warn('[REACT-API-RESILIENCE-FIX-008] Request falhou:', {
                endpoint,
                status: error.status,
                errorType: error.errorType,
                message: error.message
            });

            return apiError(
                error.message || 'Erro na requisição',
                error.errorType,
                error.status
            );
        }
    }

    // REACT-SUPABASE-LEGACY-PURGE-FIX-010: Expor request seguro para componentes
    async requestSafe<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResult<T>> {
        return this.safeRequest<T>(endpoint, options);
    }

    // DESIGN-API-CONNECTIVITY-GUARD-009: Request com detecção de tipo de erro
    private async request(endpoint: string, options: RequestInit = {}) {
        if (!isContractEndpoint(endpoint)) {
            const contractError = new Error(ERROR_MESSAGES[ErrorType.FATAL]);
            (contractError as any).status = 404;
            (contractError as any).errorType = ErrorType.FATAL;
            (contractError as any).endpoint = normalizeEndpoint(endpoint);
            throw contractError;
        }
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...options.headers as Record<string, string>,
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
            const response = await fetch(url, {
                ...options,
                headers,
            });

            if (!response.ok) {
                // DESIGN-API-CONNECTIVITY-GUARD-009: Erro HTTP do backend
                const error = await response.json().catch(() => ({ error: 'Erro na requisição' }));
                
                // AUTH-HARDENING-001: Tratamento especial para 503 (Service Unavailable)
                // Quando schema inválido, o backend retorna 503 com detalhes
                if (response.status === 503 && error.reason === 'SCHEMA_INVALID') {
                    const schemaError = new Error(error.message || 'Sistema em manutenção');
                    (schemaError as any).status = 503;
                    (schemaError as any).reason = error.reason;
                    (schemaError as any).error_code = error.error_code;
                    (schemaError as any).action_required = error.action_required;
                    (schemaError as any).errorType = ErrorType.BACKEND;
                    throw schemaError;
                }
                
                // DESIGN-API-CONNECTIVITY-GUARD-009: Erro de backend (HTTP 4xx, 5xx)
                const backendError = new Error(error.error || 'Erro na requisição');
                (backendError as any).status = response.status;
                let errorType = ErrorType.BACKEND;
                if (response.status === 401 || response.status === 403) {
                    errorType = ErrorType.AUTH;
                } else if (response.status === 404) {
                    errorType = ErrorType.FATAL;
                }
                (backendError as any).errorType = errorType;
                (backendError as any).endpoint = endpoint;
                
                console.error('[DESIGN-API-CONNECTIVITY-GUARD-009] Erro de backend detectado:', {
                    endpoint,
                    status: response.status,
                    error: error.error || 'Erro na requisição',
                    type: errorType
                });
                
                throw backendError;
            }

            return response.json();
        } catch (error) {
            // DESIGN-API-CONNECTIVITY-GUARD-009: Capturar erros de rede/TLS
            // Se já é um erro de backend (tem status), re-lançar
            if (error instanceof Error && (error as any).errorType) {
                throw error;
            }
            
            // Classificar erro (TLS, rede, etc.)
            const classified = classifyError(error, endpoint);
            const apiError = new Error(classified.message);
            (apiError as any).errorType = classified.type;
            (apiError as any).originalError = classified.originalError;
            (apiError as any).endpoint = endpoint;
            throw apiError;
        }
    }

    // Auth
    async signUp(email: string, password: string, metadata?: { full_name?: string }) {
        const data = await this.request('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ email, password, ...metadata }),
        });
        this.setToken(data.token);
        // Disparar evento para atualizar AuthContext
        window.dispatchEvent(new Event('auth-changed'));
        return data;
    }

    async signIn(email: string, password: string) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        this.setToken(data.token);
        // Disparar evento para atualizar AuthContext
        window.dispatchEvent(new Event('auth-changed'));
        return data;
    }

    async signOut() {
        this.setToken(null);
        // Disparar evento para atualizar AuthContext
        window.dispatchEvent(new Event('auth-changed'));
    }

    async getUser() {
        return this.request('/auth/user');
    }

    async getUserById(userId: string) {
        return this.request(`/auth/user-by-id?user_id=${userId}`);
    }

    // Reset password (requer implementação na API)
    async resetPasswordForEmail(email: string, options?: { redirectTo?: string }) {
        // TODO: Implementar endpoint na API
        throw new Error('Reset password ainda não implementado na API');
    }

    // Update user (requer implementação na API)
    async updateUser(updates: { password?: string }) {
        // TODO: Implementar endpoint na API
        throw new Error('Update user ainda não implementado na API');
    }


    // Storage - DESIGN-VPS-ONLY-CANONICAL-DATA-AND-STORAGE-002
    // Upload gerenciado pelo backend (sem Supabase Storage)
    async uploadFile(bucket: string, path: string, file: File) {
        try {
            // Para avatares, usar rota canônica /api/avatar
            if (bucket === 'avatars') {
                const formData = new FormData();
                formData.append('avatar', file);

                const response = await fetch(API_CONTRACT.uploads.avatar(), {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                    },
                    body: formData,
                });

                if (!response.ok) {
                    const error = await response.json().catch(() => ({ error: 'Erro no upload' }));
                    const uploadError = new Error(error.error || 'Erro no upload do avatar');
                    (uploadError as any).errorType = ErrorType.BACKEND;
                    (uploadError as any).status = response.status;
                    throw uploadError;
                }

                const result = await response.json();
                return { url: result.url, path: result.path };
            }
            
            // Para outros buckets, manter compatibilidade temporária
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_URL}/storage/v1/object/${bucket}/${path}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Erro no upload' }));
                const uploadError = new Error(error.error || 'Erro no upload');
                (uploadError as any).errorType = ErrorType.BACKEND;
                (uploadError as any).status = response.status;
                throw uploadError;
            }

            return response.json();
        } catch (error) {
            // DESIGN-API-CONNECTIVITY-GUARD-009: Classificar erros de upload
            if (error instanceof Error && (error as any).errorType) {
                throw error;
            }
            
            const classified = classifyError(error, `/api/uploads/${bucket}`);
            const apiError = new Error(classified.message);
            (apiError as any).errorType = classified.type;
            (apiError as any).originalError = classified.originalError;
            throw apiError;
        }
    }

    getPublicUrl(bucket: string, path: string) {
        // Para avatares, URL já vem completa do backend
        if (bucket === 'avatars') {
            return path.startsWith('http') ? path : `${API_URL}${path}`;
        }
        
        // Para outros buckets, manter compatibilidade
        return `${API_URL}/storage/v1/object/public/${bucket}/${path}`;
    }
    
    // Buscar identidade do usuário/aluno atual
    // DESIGN-ROLE-MESSAGING-ISOLATION-001: Usar rota semântica /api/alunos/me
    // DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Guard para prevenir chamadas sem contexto
    // DESIGN-023-RENDER-THROW-ELIMINATION-002: Não lançar exceção - retornar null se não estiver pronto
    async getMe() {
        const identity = assertDataContextReady('getMe()');
        if (!identity) {
            // DESIGN-023: Retornar null ao invés de throw
            return null;
        }
        return this.request('/api/alunos/me');
    }
    
    // ============================================================================
    // MÉTODOS REST CANÔNICOS - BLACKHOUSE-BACKEND-SOVEREIGN-ARCH-004
    // ============================================================================
    // Endpoints REST clássicos (sem padrões PostgREST)
    // Nunca usar select=, eq=, order= nas URLs
    // ============================================================================
    
    // GET /api/alunos/by-coach - Lista alunos do coach autenticado
    // DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Guard para prevenir chamadas sem contexto
    // DESIGN-023-RENDER-THROW-ELIMINATION-002: Não lançar exceção - retornar array vazio se não estiver pronto
    // REACT-API-RESILIENCE-FIX-008: DEPRECATED - Use getAlunosByCoachSafe() para resiliência total
    async getAlunosByCoach() {
        const identity = assertDataContextReady('getAlunosByCoach()');
        if (!identity) {
            // DESIGN-023: Retornar array vazio ao invés de throw
            return [];
        }
        // DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Verificar role antes de permitir
        if (identity.role !== 'coach') {
            // DESIGN-023: Não lançar exceção - logar warning e retornar array vazio
            console.warn('[DESIGN-023] getAlunosByCoach() requer role "coach", mas role atual é:', identity.role);
            return [];
        }
        return this.request(API_CONTRACT.alunos.byCoach());
    }

    // REACT-API-RESILIENCE-FIX-008: Versão resiliente que NUNCA lança exceção
    async getAlunosByCoachSafe(): Promise<ApiResult<any[]>> {
        const identity = assertDataContextReady('getAlunosByCoachSafe()');
        if (!identity) {
            return apiSuccess([]);
        }
        if (identity.role !== 'coach') {
            console.warn('[REACT-API-RESILIENCE-FIX-008] getAlunosByCoachSafe() requer role "coach"');
            return apiSuccess([]);
        }
        return this.safeRequest<any[]>(API_CONTRACT.alunos.byCoach());
    }
    
    // GET /api/notificacoes - Notificações do usuário autenticado
    // DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Guard para prevenir chamadas sem contexto
    // DESIGN-023-RENDER-THROW-ELIMINATION-002: Não lançar exceção - retornar array vazio se não estiver pronto
    // REACT-API-RESILIENCE-FIX-008: DEPRECATED - Use getNotificationsSafe() para resiliência total
    async getNotifications(options?: { lida?: boolean; tipo?: string; limit?: number }) {
        const identity = assertDataContextReady('getNotifications()');
        if (!identity) {
            // DESIGN-023: Retornar array vazio ao invés de throw
            return [];
        }
        const params = new URLSearchParams();
        if (options?.lida !== undefined) params.append('lida', String(options.lida));
        if (options?.tipo) params.append('tipo', options.tipo);
        if (options?.limit) params.append('limit', String(options.limit));
        
        const query = params.toString();
        return this.request(`/api/notificacoes${query ? `?${query}` : ''}`);
    }

    // REACT-API-RESILIENCE-FIX-008: Versão resiliente que NUNCA lança exceção
    async getNotificationsSafe(options?: { lida?: boolean; tipo?: string; limit?: number }): Promise<ApiResult<any[]>> {
        const identity = assertDataContextReady('getNotificationsSafe()');
        if (!identity) {
            return apiSuccess([]);
        }
        const params = new URLSearchParams();
        if (options?.lida !== undefined) params.append('lida', String(options.lida));
        if (options?.tipo) params.append('tipo', options.tipo);
        if (options?.limit) params.append('limit', String(options.limit));
        
        const query = params.toString();
        return this.safeRequest<any[]>(`/api/notificacoes${query ? `?${query}` : ''}`);
    }
    
    // GET /api/profiles/me - Perfil do usuário logado
    // DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: Guard para prevenir chamadas sem contexto
    // DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: getProfile() é deprecated - usar getMe() para avatar
    // DESIGN-023-RENDER-THROW-ELIMINATION-002: Não lançar exceção - retornar null se não estiver pronto
    // REACT-API-RESILIENCE-FIX-008: DEPRECATED - Use getMeSafe() ou getProfileSafe()
    async getProfile() {
        const identity = assertDataContextReady('getProfile()');
        if (!identity) {
            // DESIGN-023: Retornar null ao invés de throw
            return null;
        }
        console.warn('DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015: getProfile() é deprecated. Use getMe() para obter dados do usuário.');
        return this.request('/api/profiles/me');
    }

    // REACT-API-RESILIENCE-FIX-008: Versão resiliente de getMe
    async getMeSafe(): Promise<ApiResult<any>> {
        const identity = assertDataContextReady('getMeSafe()');
        if (!identity) {
            return apiSuccess(null);
        }
        return this.safeRequest<any>('/api/alunos/me');
    }

    // REACT-API-RESILIENCE-FIX-008: Versão resiliente de getProfile
    async getProfileSafe(): Promise<ApiResult<any>> {
        const identity = assertDataContextReady('getProfileSafe()');
        if (!identity) {
            return apiSuccess(null);
        }
        return this.safeRequest<any>('/api/profiles/me');
    }
    
    // PATCH /api/notificacoes/:id - Atualizar notificação
    async updateNotification(id: string, updates: { lida?: boolean }) {
        return this.request(`/api/notificacoes/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
    }
    
    // DELETE /api/notificacoes/:id - Deletar notificação
    async deleteNotification(id: string) {
        return this.request(`/api/notificacoes/${id}`, {
            method: 'DELETE',
        });
    }
    
    // ============================================================================
    // MÉTODO from() - DEPRECATED - Mantido para compatibilidade temporária
    // ============================================================================
    // ATENÇÃO: Este método usa padrões PostgREST (select=, eq=, order=)
    // Prefira usar métodos REST canônicos acima (getAlunosByCoach, getNotifications, etc)
    // TODO: Remover gradualmente conforme componentes migram
    // ============================================================================
}

export const apiClient = new ApiClient();
