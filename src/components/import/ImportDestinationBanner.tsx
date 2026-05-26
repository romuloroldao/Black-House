import { User, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

type ImportDestinationBannerProps = {
  nome: string;
  email?: string | null;
  subtitle?: string;
  locked?: boolean;
  className?: string;
};

export function ImportDestinationBanner({
  nome,
  email,
  subtitle = 'A dieta e o protocolo serão vinculados a este aluno.',
  locked = true,
  className,
}: ImportDestinationBannerProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 sm:px-4 sm:py-3',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <User className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Destino da importação
          </p>
          <p className="truncate text-sm font-semibold text-foreground">{nome}</p>
          {email ? (
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {locked ? (
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label="Destino fixo" />
        ) : null}
      </div>
    </div>
  );
}
