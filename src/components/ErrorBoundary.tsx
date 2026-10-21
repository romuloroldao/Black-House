// DESIGN-023-RUNTIME-CRASH-RESOLUTION-001: ErrorBoundary global para capturar crashes de renderização
// DESIGN-024-BOOTSTRAP-STABILITY-FINAL: ErrorBoundary não atua durante bootstrap (INIT/LOADING)
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDataContext } from '@/contexts/DataContext';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  // DESIGN-024: Prop para desabilitar ErrorBoundary durante bootstrap
  disabled?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  // DESIGN-023: getDerivedStateFromError para atualizar estado quando erro ocorre
  // DESIGN-024: Sempre marca como erro primeiro, mas componentDidCatch decide se mantém
  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  // DESIGN-023: componentDidCatch para logging detalhado
  // DESIGN-024: Só captura erros se ErrorBoundary não estiver desabilitado
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // DESIGN-024: Se ErrorBoundary estiver desabilitado (durante bootstrap), apenas logar warning
    // E resetar o estado para não exibir fallback
    if (this.props.disabled) {
      console.warn('[DESIGN-024] Erro durante bootstrap ignorado (ErrorBoundary desabilitado):', {
        error: error.message,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      });
      // DESIGN-024: Resetar estado para não exibir fallback durante bootstrap
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      });
      return;
    }

    // DESIGN-023: Log detalhado do erro com contexto React (apenas após READY)
    console.error('[DESIGN-023] ErrorBoundary capturou erro de renderização:', {
      error,
      errorInfo,
      componentStack: errorInfo.componentStack,
      errorMessage: error.message,
      errorStack: error.stack,
      timestamp: new Date().toISOString(),
    });

    // DESIGN-024: Manter estado de erro (já foi setado por getDerivedStateFromError)
    // Apenas adicionar errorInfo
    this.setState({
      errorInfo,
    });

    // Opcional: Enviar para serviço de monitoramento (ex: Sentry)
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
    // }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    // Recarregar a página para garantir estado limpo
    window.location.reload();
  };

  render() {
    // DESIGN-024: Se ErrorBoundary estiver desabilitado, sempre renderizar children
    // Mesmo que tenha erro, não exibir fallback durante bootstrap
    if (this.props.disabled) {
      return this.props.children;
    }

    // DESIGN-023: Fallback visual simples (sem UX elaborado)
    // DESIGN-024: Só exibir fallback se ErrorBoundary estiver ativo E houver erro
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle>Erro de Renderização</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ocorreu um erro ao renderizar a aplicação. Isso pode ser causado por:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Acesso a propriedades undefined</li>
                <li>Renderização fora do estado READY</li>
                <li>Erro em componente filho</li>
              </ul>
              
              {this.state.error && (
                <div className="mt-4 p-3 bg-destructive/10 rounded-md">
                  <p className="text-sm font-mono text-destructive break-all">
                    {this.state.error.message || 'Erro desconhecido'}
                  </p>
                  {process.env.NODE_ENV === 'development' && this.state.error.stack && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer">
                        Stack trace (desenvolvimento)
                      </summary>
                      <pre className="mt-2 text-xs overflow-auto max-h-40 text-muted-foreground">
                        {this.state.error.stack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <details className="mt-4">
                  <summary className="text-xs text-muted-foreground cursor-pointer">
                    Component Stack (desenvolvimento)
                  </summary>
                  <pre className="mt-2 text-xs overflow-auto max-h-40 text-muted-foreground font-mono">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <div className="flex gap-2 mt-4">
                <Button onClick={this.handleReset} variant="default">
                  Recarregar Aplicação
                </Button>
                <Button
                  onClick={() => {
                    console.error('[DESIGN-023] Erro completo:', {
                      error: this.state.error,
                      errorInfo: this.state.errorInfo,
                    });
                  }}
                  variant="outline"
                >
                  Copiar Detalhes (Console)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

// DESIGN-024-BOOTSTRAP-STABILITY-FINAL: ErrorBoundary que é ciente do estado de bootstrap
// Desabilita captura de erros durante INIT, IDENTITY_RESOLVED e CONTEXT_READY
// Só ativa após READY
export const BootstrapAwareErrorBoundary = ({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) => {
  // DESIGN-024: Usar DataContext para verificar estado de bootstrap
  // DESIGN-024: useDataContext retorna valores seguros mesmo fora do provider (conforme DESIGN-023)
  const dataContext = useDataContext();
  const state = dataContext?.state || 'INIT';
  const isReady = dataContext?.isReady || false;

  // DESIGN-024: Desabilitar ErrorBoundary durante bootstrap
  // Estados: INIT, IDENTITY_RESOLVED, CONTEXT_READY → disabled = true
  // Estado: READY → disabled = false (ErrorBoundary ativo)
  // Estado: FAILED → disabled = false (ErrorBoundary ativo para capturar erros de fallback)
  const isBootstrapState = state === 'INIT' || state === 'IDENTITY_RESOLVED' || state === 'CONTEXT_READY';
  const disabled = isBootstrapState || !isReady;

  // DESIGN-024: Log quando ErrorBoundary está desabilitado (apenas em dev)
  if (process.env.NODE_ENV === 'development' && disabled) {
    console.log('[DESIGN-024] ErrorBoundary desabilitado durante bootstrap. Estado:', state, 'isReady:', isReady);
  }

  return (
    <ErrorBoundary disabled={disabled} fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
};
