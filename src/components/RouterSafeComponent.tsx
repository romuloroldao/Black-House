// REACT-RENDER-CRASH-FIX-002: RouterSafeComponent garante que componentes só renderizem dentro do contexto do Router
// Previne crashes quando hooks do React Router são usados fora do contexto

import { useInRouterContext } from 'react-router-dom';

interface RouterSafeComponentProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * RouterSafeComponent verifica se está dentro do contexto do Router antes de renderizar filhos.
 * Componentes que usam hooks do React Router (useSearchParams, useNavigate, useLocation, etc.)
 * só são renderizados quando o Router está disponível.
 * 
 * Uso obrigatório em layouts críticos que usam hooks do Router.
 */
export const RouterSafeComponent = ({ children, fallback }: RouterSafeComponentProps) => {
  // REACT-RENDER-CRASH-FIX-002: useInRouterContext verifica se estamos dentro de um Router
  const isInRouterContext = useInRouterContext();

  // REACT-RENDER-CRASH-FIX-002: Se não estiver no contexto do Router, renderizar fallback
  if (!isInRouterContext) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // REACT-RENDER-CRASH-FIX-002: Router está disponível, renderizar filhos
  return <>{children}</>;
};
