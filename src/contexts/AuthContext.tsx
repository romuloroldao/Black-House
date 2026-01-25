import { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

// RBAC-01: Interface de usuário com role e payment_status
export interface User {
  id: string;
  email: string;
  created_at?: string;
  role?: 'coach' | 'aluno';
  payment_status?: 'CURRENT' | 'OVERDUE' | 'PENDING_AFTER_DUE_DATE';
  // Campos adicionais que podem ser usados
  [key: string]: any;
}

export interface Session {
  token: string;
  user: User;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authInitialized: boolean; // REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009: Sinaliza conclusão do bootstrap
  login: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  role?: 'coach' | 'aluno';
  payment_status?: 'CURRENT' | 'OVERDUE' | 'PENDING_AFTER_DUE_DATE';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false); // REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009
  const [role, setRole] = useState<'coach' | 'aluno' | undefined>(undefined);
  const [payment_status, setPaymentStatus] = useState<'CURRENT' | 'OVERDUE' | 'PENDING_AFTER_DUE_DATE' | undefined>(undefined);

  useEffect(() => {
    // REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009: Bootstrap explícito de autenticação
    // REACT-SOFT-LOCK-FIX-003: Timeout para garantir que loading sempre termine
    const LOADING_TIMEOUT = 10000; // 10 segundos
    let timeoutId: NodeJS.Timeout | null = null;
    
    console.log('[REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009] Iniciando bootstrap de autenticação');
    
    // Verificar se há token salvo
    const token = apiClient.getToken();
    
    if (token) {
      // REACT-SOFT-LOCK-FIX-003: Timeout para garantir que loading sempre termine
      timeoutId = setTimeout(() => {
        console.warn('[REACT-SOFT-LOCK-FIX-003] Timeout ao carregar usuário. Liberando loading.');
        setLoading(false);
        setAuthInitialized(true); // REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009: Sempre sinalizar conclusão
        // Não limpar token - pode ser problema temporário de rede
      }, LOADING_TIMEOUT);
      
      // Buscar dados do usuário com role e payment_status
      apiClient.getUser()
        .then((response) => {
          // REACT-SOFT-LOCK-FIX-003: Limpar timeout se sucesso
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          
          // RBAC-01: Incluir role e payment_status do response
          const userWithRole = {
            ...response.user,
            role: response.role || response.user?.role || 'aluno',
            payment_status: response.payment_status || response.user?.payment_status || 'CURRENT'
          };
          
          setUser(userWithRole);
          setRole(userWithRole.role);
          setPaymentStatus(userWithRole.payment_status);
          setSession({ token, user: userWithRole });
          setLoading(false);
          setAuthInitialized(true); // REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009
          
          console.log('[REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009] Bootstrap concluído - usuário autenticado:', {
            email: userWithRole.email,
            role: userWithRole.role
          });
        })
        .catch(() => {
          // REACT-SOFT-LOCK-FIX-003: Limpar timeout se erro
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          
          // Token inválido, limpar
          apiClient.setToken(null);
          setUser(null);
          setSession(null);
          setRole(undefined);
          setPaymentStatus(undefined);
          setLoading(false);
          setAuthInitialized(true); // REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009: SEMPRE resolver
          
          console.log('[REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009] Bootstrap concluído - token inválido');
        });
    } else {
      setLoading(false);
      setAuthInitialized(true); // REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009: Sem token também resolve
      console.log('[REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009] Bootstrap concluído - sem token');
    }
    
    // Listener para mudanças no token (storage events para sincronizar entre abas)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token') {
        if (e.newValue) {
          apiClient.setToken(e.newValue);
          apiClient.getUser()
            .then((response) => {
              const userWithRole = {
                ...response.user,
                role: response.role || response.user?.role || 'aluno',
                payment_status: response.payment_status || response.user?.payment_status || 'CURRENT'
              };
              setUser(userWithRole);
              setRole(userWithRole.role);
              setPaymentStatus(userWithRole.payment_status);
              setSession({ token: e.newValue, user: userWithRole });
            })
            .catch(() => {
              setUser(null);
              setSession(null);
              setRole(undefined);
              setPaymentStatus(undefined);
            });
        } else {
          setUser(null);
          setSession(null);
          setRole(undefined);
          setPaymentStatus(undefined);
        }
      }
    };

    // Listener customizado para mudanças de autenticação na mesma aba
    const handleAuthChange = () => {
      const token = apiClient.getToken();
      if (token) {
        apiClient.getUser()
          .then((response) => {
            const userWithRole = {
              ...response.user,
              role: response.role || response.user?.role || 'aluno',
              payment_status: response.payment_status || response.user?.payment_status || 'CURRENT'
            };
            setUser(userWithRole);
            setRole(userWithRole.role);
            setPaymentStatus(userWithRole.payment_status);
            setSession({ token, user: userWithRole });
          })
          .catch(() => {
            setUser(null);
            setSession(null);
            setRole(undefined);
            setPaymentStatus(undefined);
          });
      } else {
        setUser(null);
        setSession(null);
        setRole(undefined);
        setPaymentStatus(undefined);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-changed', handleAuthChange);

    return () => {
      // REACT-SOFT-LOCK-FIX-003: Cleanup do timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-changed', handleAuthChange);
    };
  }, []);

  // REACT-AUTH-STATE-CONSISTENCY-FIX-007: Método login centralizado no AuthContext
  // Este método garante que user sempre seja setado após login bem-sucedido
  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      // 1. Executar login na API
      const response = await apiClient.signIn(email, password);
      
      // 2. Buscar dados completos do usuário
      const userData = await apiClient.getUser();
      
      // 3. Setar user no estado React com role e payment_status
      const userWithRole = {
        ...userData.user,
        role: userData.role || userData.user?.role || 'aluno',
        payment_status: userData.payment_status || userData.user?.payment_status || 'CURRENT'
      };
      
      // 4. Atualizar estado global de forma consistente
      setUser(userWithRole);
      setRole(userWithRole.role);
      setPaymentStatus(userWithRole.payment_status);
      setSession({ token: response.token, user: userWithRole });
      
      console.log('[REACT-AUTH-STATE-CONSISTENCY-FIX-007] Login concluído com sucesso:', {
        user: userWithRole.email,
        role: userWithRole.role,
        hasUser: true
      });
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await apiClient.signOut();
    setUser(null);
    setSession(null);
    setRole(undefined);
    setPaymentStatus(undefined);
    // Disparar evento para atualizar outras partes da aplicação
    window.dispatchEvent(new Event('auth-changed'));
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, authInitialized, login, signOut, role, payment_status }}>
      {children}
    </AuthContext.Provider>
  );
};

// DESIGN-023-RENDER-THROW-ELIMINATION-002: Hook não lança exceção - retorna valores seguros
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // DESIGN-023: Não lançar exceção - retornar valores seguros
    console.warn('[DESIGN-023] useAuth usado fora de AuthProvider. Retornando valores padrão.');
    return {
      user: null,
      session: null,
      loading: true,
      authInitialized: false, // REACT-AUTH-BOOTSTRAP-DEADLOCK-FIX-009
      login: async () => { throw new Error('AuthProvider não disponível'); },
      signOut: async () => {},
      role: undefined,
      payment_status: undefined,
    };
  }
  return context;
};
