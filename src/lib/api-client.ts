import { assertDataContextReady, assertNoSupabaseDirectAccess } from './data-context-guard';
import { API_CONTRACT, isContractEndpoint, normalizeEndpoint } from '@/contracts/api-contract';
import { getAvailabilityKeyForEndpoint, isDataAvailable } from '@/lib/dataAvailability';

// FIX-012 — prefixos de rotas semânticas na VPS (PostgreSQL; ver src/contracts/api-contract.ts)
export const ALLOWED_ENDPOINTS = new Set<string>([
    '/api/alunos/by-coach',
    '/api/alunos/me',
    '/api/alunos/link-user',
    '/api/alunos/unlinked-registrations',
    '/api/alunos/adopt-registration',
    '/api/alunos/dismiss-registration',
    '/api/alunos',
    '/api/alunos/',
    '/api/recurring-charges-config',
    '/api/recurring-charges-config/',
    '/api/alunos-treinos',
    '/api/alunos-treinos/',
    '/api/alimentos',
    '/api/alimentos/nutrition-audit',
    '/api/dietas',
    '/api/dietas/',
    '/api/feedbacks-alunos',
    '/api/feedbacks-alunos/',
    '/api/fotos-alunos',
    '/api/fotos-alunos/',
    '/api/itens-dieta',
    '/api/itens-dieta/',
    '/api/dieta-farmacos',
    '/api/dieta-farmacos/',
    '/api/mensagens',
    '/api/conversas',
    '/api/conversas/',
    '/api/notificacoes',
    '/api/notificacoes/',
    '/api/agenda-eventos',
    '/api/agenda-eventos/',
    '/api/eventos',
    '/api/eventos/',
    '/api/eventos-participantes',
    '/api/eventos-participantes/',
    '/api/relatorios',
    '/api/relatorios/',
    '/api/relatorio-feedbacks',
    '/api/relatorio-feedbacks/',
    '/api/relatorio-midias',
    '/api/relatorio-midias/',
    '/api/payment-plans',
    '/api/treinos',
    '/api/profiles/me',
    '/api/me',
    '/api/checkins',
    '/api/weekly-checkins',
    '/api/weekly-checkins/',
    '/api/uploads/progress-photo',
    '/api/uploads/storage/progress-photos',
    '/api/uploads/storage/progress-photos/',
    '/api/videos',
    '/api/lives',
    '/api/uploads/avatar',
    '/api/import/parse-pdf',
    '/api/import/confirm',
    '/api/payments/create-asaas',
    '/api/asaas-payments',
    '/api/asaas-config',
    '/api/asaas-config/',
    '/api/asaas-config/verify-connection',
    '/api/twilio-config',
    '/api/twilio-config/',
    '/api/financial-exceptions',
    '/api/financial-exceptions/',
    '/api/expenses',
    '/api/expenses/',
    '/api/user-roles',
    '/api/profiles',
    '/api/avisos',
    '/api/avisos/',
    '/api/turmas',
    '/api/turmas/',
    '/api/turmas-alunos',
    '/api/turmas-alunos/',
    '/api/avisos-destinatarios',
    '/api/avisos-destinatarios/',
    '/auth/confirm-email',
    '/auth/resend-confirmation',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/change-password',
]);

type LegacyMapResult = { endpoint: string; unwrapFirstRow: boolean };

/** DELETE /rest/v1 usa `?id=` (Express); o mapeamento legado usa `id.eq` como no GET. */
function rewriteRestV1UrlForDelete(restPath: string): string {
    if (!restPath.startsWith('/rest/v1/')) return restPath;
    const qIndex = restPath.indexOf('?');
    if (qIndex === -1) return restPath;
    const path = restPath.slice(0, qIndex);
    const params = new URLSearchParams(restPath.slice(qIndex + 1));
    const idEq = params.get('id.eq');
    if (idEq != null && idEq !== '') {
        params.delete('id.eq');
        if (!params.has('id')) {
            params.set('id', idEq);
        }
    }
    const q = params.toString();
    return q ? `${path}?${q}` : path;
}

/** Extrai UUID do filtro PostgREST `id.eq=` na URL /rest/v1/... (usado pelo PATCH legado). */
function extractIdEqFromRestPath(restPath: string): string | null {
    const qIndex = restPath.indexOf('?');
    if (qIndex === -1) return null;
    const params = new URLSearchParams(restPath.slice(qIndex + 1));
    const raw = params.get('id.eq');
    return raw ? decodeURIComponent(raw) : null;
}

function normalizeLegacyQueryToRest(query: string): string {
    if (!query) return '';
    const src = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
    const out = new URLSearchParams();

    for (const [key, value] of src.entries()) {
        if (['select', 'order', 'limit', 'offset'].includes(key)) {
            out.append(key, value);
            continue;
        }
        // Se já veio no formato PostgREST (campo.operador), manter.
        if (key.includes('.')) {
            out.append(key, value);
            continue;
        }
        // Legado /api usa query simples (?aluno_id=...), converter para eq.
        out.append(`${key}.eq`, value);
    }

    const serialized = out.toString();
    return serialized ? `?${serialized}` : '';
}

function mapLegacyApiToRestV1(endpoint: string): LegacyMapResult {
    const normalized = normalizeEndpoint(endpoint);
    const hasQuery = endpoint.includes('?');
    const rawQuery = hasQuery ? endpoint.slice(endpoint.indexOf('?')) : '';
    const query = normalizeLegacyQueryToRest(rawQuery);

    const byIdToQuery = (table: string, id: string) => ({
        endpoint: `/rest/v1/${table}?id.eq=${encodeURIComponent(id)}`,
        unwrapFirstRow: true,
    });

    let match = normalized.match(/^\/api\/alunos\/([^/]+)$/);
    if (match && !['me', 'by-coach', 'link-user', 'unlinked-registrations', 'adopt-registration', 'dismiss-registration'].includes(match[1])) {
        return byIdToQuery('alunos', match[1]);
    }

    match = normalized.match(/^\/api\/treinos\/([^/]+)$/);
    if (match) return byIdToQuery('treinos', match[1]);

    match = normalized.match(/^\/api\/dietas\/([^/]+)$/);
    if (match) return byIdToQuery('dietas', match[1]);

    match = normalized.match(/^\/api\/alunos-treinos\/([^/]+)$/);
    if (match) return byIdToQuery('alunos_treinos', match[1]);

    match = normalized.match(/^\/api\/feedbacks-alunos\/([^/]+)$/);
    if (match) return byIdToQuery('feedbacks_alunos', match[1]);

    match = normalized.match(/^\/api\/recurring-charges-config\/([^/]+)$/);
    if (match) return byIdToQuery('recurring_charges_config', match[1]);

    match = normalized.match(/^\/api\/itens-dieta\/([^/]+)$/);
    if (match) return byIdToQuery('itens_dieta', match[1]);

    match = normalized.match(/^\/api\/dieta-farmacos\/([^/]+)$/);
    if (match) return byIdToQuery('dieta_farmacos', match[1]);

    match = normalized.match(/^\/api\/avisos\/([^/]+)$/);
    if (match) return byIdToQuery('avisos', match[1]);

    match = normalized.match(/^\/api\/turmas\/([^/]+)$/);
    if (match) return byIdToQuery('turmas', match[1]);

    match = normalized.match(/^\/api\/turmas-alunos\/([^/]+)$/);
    if (match) return byIdToQuery('turmas_alunos', match[1]);

    match = normalized.match(/^\/api\/avisos-destinatarios\/([^/]+)$/);
    if (match) return byIdToQuery('avisos_destinatarios', match[1]);

    const tableMap: Record<string, string> = {
        '/api/treinos': 'treinos',
        '/api/dietas': 'dietas',
        '/api/alunos-treinos': 'alunos_treinos',
        '/api/feedbacks-alunos': 'feedbacks_alunos',
        '/api/recurring-charges-config': 'recurring_charges_config',
        '/api/itens-dieta': 'itens_dieta',
        '/api/dieta-farmacos': 'dieta_farmacos',
        '/api/avisos': 'avisos',
        '/api/turmas': 'turmas',
        '/api/turmas-alunos': 'turmas_alunos',
        '/api/avisos-destinatarios': 'avisos_destinatarios',
    };

    if (tableMap[normalized]) {
        return {
            endpoint: `/rest/v1/${tableMap[normalized]}${query}`,
            unwrapFirstRow: false,
        };
    }

    return { endpoint, unwrapFirstRow: false };
}

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
        const raw = localStorage.getItem('auth_token');
        this.token =
            raw == null ? null : String(raw).trim().replace(/^Bearer\s+/i, '').trim() || null;
    }

    setToken(token: string | null) {
        if (token) {
            const cleaned = String(token).trim().replace(/^Bearer\s+/i, '').trim();
            this.token = cleaned || null;
            if (this.token) {
                localStorage.setItem('auth_token', this.token);
            } else {
                localStorage.removeItem('auth_token');
            }
        } else {
            this.token = null;
            localStorage.removeItem('auth_token');
        }
    }

    /** JWT cru (sem prefixo Bearer, sem espaços) — útil para multipart e WebSocket. */
    getToken() {
        const storedToken = localStorage.getItem('auth_token');
        if (storedToken == null) {
            this.token = null;
            return null;
        }
        const cleaned = String(storedToken).trim().replace(/^Bearer\s+/i, '').trim() || null;
        this.token = cleaned;
        if (cleaned !== storedToken && typeof localStorage !== 'undefined') {
            try {
                if (cleaned) localStorage.setItem('auth_token', cleaned);
                else localStorage.removeItem('auth_token');
            } catch {
                /* quota / modo privado */
            }
        }
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

        const activeToken = this.getToken();
        if (activeToken) {
            headers['Authorization'] = `Bearer ${activeToken}`;
        }

        try {
            const mapped = mapLegacyApiToRestV1(endpoint);
            let effectiveEndpoint = mapped.endpoint;
            const method = (options.method || 'GET').toUpperCase();
            if (method === 'DELETE') {
                effectiveEndpoint = rewriteRestV1UrlForDelete(effectiveEndpoint);
            }
            const url = effectiveEndpoint.startsWith('http') ? effectiveEndpoint : `${API_URL}${effectiveEndpoint}`;
            let body = options.body;
            // PATCH /rest/v1/:table exige `id` no body (SECURITY-01 no servidor); o mapeamento legado só põe id.eq na query.
            if (method === 'PATCH' && effectiveEndpoint.startsWith('/rest/v1/')) {
                const restId = extractIdEqFromRestPath(effectiveEndpoint);
                if (restId && typeof body === 'string' && body.trim()) {
                    try {
                        const parsed = JSON.parse(body) as Record<string, unknown>;
                        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.id == null) {
                            body = JSON.stringify({ id: restId, ...parsed });
                        }
                    } catch {
                        /* body não-JSON: não alterar */
                    }
                }
            }
            const response = await fetch(url, {
                ...options,
                headers,
                body,
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
                const errObj = error as Record<string, unknown>;
                const primary = typeof errObj.error === 'string' ? errObj.error : '';
                const secondary = typeof errObj.message === 'string' ? errObj.message : '';
                let text = primary || secondary || 'Erro na requisição';
                if (primary && secondary && secondary !== primary) {
                    text = `${primary} — ${secondary}`;
                }
                const code = typeof errObj.error_code === 'string' ? errObj.error_code : '';
                if (code) {
                    text = `${text} [${code}]`;
                }
                const backendError = new Error(text);
                (backendError as any).status = response.status;
                if (Array.isArray(errObj.fields)) {
                    (backendError as any).fields = errObj.fields;
                }
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

            const payload = await response.json();
            if (mapped.unwrapFirstRow && Array.isArray(payload)) {
                return payload[0] ?? null;
            }
            return payload;
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
    async signUp(
        email: string,
        password: string,
        metadata?: {
            full_name?: string;
            coach_id?: string;
            cpf_cnpj?: string;
            peso?: number;
            altura?: number;
        },
    ) {
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
        const q = `user_id=${encodeURIComponent(userId)}`;
        return this.request(`/auth/user-by-id?${q}`);
    }

    /** Esqueci minha senha — envia email com link (Resend ou SMTP no servidor). */
    async requestPasswordReset(email: string) {
        return this.request(API_CONTRACT.auth.forgotPassword(), {
            method: 'POST',
            body: JSON.stringify({ email }),
        });
    }

    /** Confirmar email via token enviado no link do signup/reenvio. */
    async confirmEmail(token: string) {
        return this.request(API_CONTRACT.auth.confirmEmail(), {
            method: 'POST',
            body: JSON.stringify({ token }),
        });
    }

    /** Reenviar e-mail de confirmação para conta ainda não confirmada. */
    async resendEmailConfirmation(email: string) {
        return this.request(API_CONTRACT.auth.resendConfirmation(), {
            method: 'POST',
            body: JSON.stringify({ email }),
        });
    }

    /** Alias usado pela UI legada; ignora redirectTo (o link aponta para FRONTEND_URL no servidor). */
    async resetPasswordForEmail(email: string, _options?: { redirectTo?: string }) {
        return this.requestPasswordReset(email);
    }

    /** Redefinir senha com token JWT recebido no link do email. */
    async completePasswordReset(token: string, password: string) {
        return this.request(API_CONTRACT.auth.resetPassword(), {
            method: 'POST',
            body: JSON.stringify({ token, password }),
        });
    }

    /** Alterar senha com usuário autenticado (senha atual + nova). */
    async changePassword(currentPassword: string, newPassword: string) {
        return this.request('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword }),
        });
    }

    // Update user (outros campos — ainda não exposto na API)
    async updateUser(updates: { password?: string }) {
        if (updates?.password) {
            throw new Error('Para nova senha com link de recuperação, use completePasswordReset.');
        }
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

            if (bucket === 'progress-photos') {
                const formData = new FormData();
                formData.append('file', file);
                const response = await fetch(API_CONTRACT.uploads.progressPhoto(), {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                    },
                    body: formData,
                });
                if (!response.ok) {
                    const error = await response.json().catch(() => ({ error: 'Erro no upload' }));
                    const uploadError = new Error(error.error || 'Erro no upload da foto de progresso');
                    (uploadError as any).errorType = ErrorType.BACKEND;
                    (uploadError as any).status = response.status;
                    throw uploadError;
                }
                const result = await response.json();
                return { url: result.url as string, path: (result.path as string) || path };
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
        if (bucket === 'progress-photos') {
            const base = API_URL.replace(/\/$/, '');
            return `${base}/api/uploads/storage/progress-photos/${path}`;
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
        if (identity.role !== 'coach' && identity.role !== 'admin') {
            console.warn('[DESIGN-023] getAlunosByCoach() requer role coach/admin, role atual:', identity.role);
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
        if (identity.role !== 'coach' && identity.role !== 'admin') {
            console.warn('[REACT-API-RESILIENCE-FIX-008] getAlunosByCoachSafe() requer role coach/admin');
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
