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
  signOut: () => Promise<void>;
  role?: 'coach' | 'aluno';
  payment_status?: 'CURRENT' | 'OVERDUE' | 'PENDING_AFTER_DUE_DATE';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'coach' | 'aluno' | undefined>(undefined);
  const [payment_status, setPaymentStatus] = useState<'CURRENT' | 'OVERDUE' | 'PENDING_AFTER_DUE_DATE' | undefined>(undefined);

  useEffect(() => {
    // Verificar se há token salvo
    const token = apiClient.getToken();
    
    if (token) {
      // Buscar dados do usuário com role e payment_status
      apiClient.getUser()
        .then((response) => {
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
        })
        .catch(() => {
          // Token inválido, limpar
          apiClient.setToken(null);
          setUser(null);
          setSession(null);
          setRole(undefined);
          setPaymentStatus(undefined);
          setLoading(false);
        });
    } else {
      setLoading(false);
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
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-changed', handleAuthChange);
    };
  }, []);

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
    <AuthContext.Provider value={{ user, session, loading, signOut, role, payment_status }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
