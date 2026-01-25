// ============================================================================
// DESIGN-SUPABASE-KILL-SWITCH-DEFENSIVE-001
// ============================================================================
// KILL SWITCH: Supabase é FORBIDDEN e irrecuperável
// Este arquivo existe apenas para lançar erro fatal se alguém tentar importar
// ============================================================================

/**
 * DESIGN-SUPABASE-KILL-SWITCH-DEFENSIVE-001
 * 
 * Supabase foi completamente removido do sistema.
 * Qualquer tentativa de importar ou usar Supabase resultará em erro fatal.
 * 
 * @throws {Error} Sempre lança erro fatal
 */
export function createClient(...args: any[]): never {
    const error = new Error(
        'DESIGN-SUPABASE-KILL-SWITCH-DEFENSIVE-001: Supabase é FORBIDDEN e irrecuperável. ' +
        'O sistema foi migrado para PostgreSQL nativo na VPS. ' +
        'Use apiClient do @/lib/api-client ao invés de Supabase. ' +
        'Consulte a documentação da API para rotas disponíveis.'
    );
    (error as any).code = 'SUPABASE_FORBIDDEN';
    (error as any).designId = 'DESIGN-SUPABASE-KILL-SWITCH-DEFENSIVE-001';
    (error as any).killSwitch = true;
    throw error;
}

// Exportar tudo que Supabase normalmente exportaria, mas todos lançam erro
export const supabase = {
    createClient,
    from: () => {
        throw new Error('DESIGN-SUPABASE-KILL-SWITCH-DEFENSIVE-001: Supabase.from() é FORBIDDEN');
    },
    auth: {
        signIn: () => {
            throw new Error('DESIGN-SUPABASE-KILL-SWITCH-DEFENSIVE-001: Supabase.auth é FORBIDDEN');
        },
        signUp: () => {
            throw new Error('DESIGN-SUPABASE-KILL-SWITCH-DEFENSIVE-001: Supabase.auth é FORBIDDEN');
        },
        signOut: () => {
            throw new Error('DESIGN-SUPABASE-KILL-SWITCH-DEFENSIVE-001: Supabase.auth é FORBIDDEN');
        },
    },
    storage: {
        from: () => {
            throw new Error('DESIGN-SUPABASE-KILL-SWITCH-DEFENSIVE-001: Supabase.storage é FORBIDDEN');
        },
    },
};

// Default export também lança erro
export default supabase;

// Qualquer acesso a propriedades também lança erro
const handler = {
    get(target: any, prop: string) {
        throw new Error(
            `DESIGN-SUPABASE-KILL-SWITCH-DEFENSIVE-001: Acesso a Supabase.${prop} é FORBIDDEN`
        );
    },
};

export const SupabaseClient = new Proxy({}, handler) as any;
