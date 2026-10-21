import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  apiLogout,
  apiMe,
  getApiToken,
  setApiToken,
  useVpsApi,
  type ApiUser,
} from "@/lib/apiClient";

/** Shape mínima compatível com o que o portal usa (id + email). */
type AuthUser = User | (ApiUser & { user_metadata?: Record<string, unknown> });

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  /** true quando VITE_USE_VPS_API=true */
  usingVpsApi: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toAuthUser(apiUser: ApiUser): AuthUser {
  return {
    ...apiUser,
    user_metadata: apiUser.role ? { role: apiUser.role } : {},
  };
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (useVpsApi) {
      const token = getApiToken();
      if (!token) {
        setUser(null);
        setSession(null);
        setLoading(false);
        return;
      }

      apiMe()
        .then(({ user: apiUser }) => {
          setUser(toAuthUser(apiUser));
          setSession({
            access_token: token,
            token_type: "bearer",
            user: {
              id: apiUser.id,
              email: apiUser.email,
              app_metadata: {},
              user_metadata: {},
              aud: "authenticated",
              created_at: apiUser.created_at || new Date().toISOString(),
            } as User,
          } as Session);
        })
        .catch(() => {
          setApiToken(null);
          setUser(null);
          setSession(null);
        })
        .finally(() => setLoading(false));

      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (useVpsApi) {
      await apiLogout();
      setUser(null);
      setSession(null);
      return;
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signOut, usingVpsApi: useVpsApi }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
