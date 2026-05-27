import { AlertCircle, UserCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getAlunoDisplayName, getAlunoFirstName } from '@/lib/aluno-display';
import {
  type DuplicateMatch,
  duplicateReasonLabel,
} from '@/lib/import-duplicate-detection';

type ImportDuplicateAlertProps = {
  matches: DuplicateMatch[];
  onUseExisting: (alunoId: string) => void;
  onContinueAnyway: () => void;
  dismissed: boolean;
};

export function ImportDuplicateAlert({
  matches,
  onUseExisting,
  onContinueAnyway,
  dismissed,
}: ImportDuplicateAlertProps) {
  if (!matches.length || dismissed) return null;

  const top = matches[0];

  return (
    <Alert variant="default" className="border-amber-500/40 bg-amber-500/10">
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-900 dark:text-amber-100">
        Possível aluno já cadastrado
      </AlertTitle>
      <AlertDescription className="space-y-3 text-sm">
        <p>
          Encontrámos <strong>{getAlunoDisplayName(top.aluno)}</strong> (
          {top.reasons.map(duplicateReasonLabel).join(', ')}).
          Importar como novo aluno pode criar duplicado e desvincular a dieta.
        </p>
        {matches.length > 1 ? (
          <p className="text-xs text-muted-foreground">
            +{matches.length - 1} outro(s) parecido(s) na sua lista.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => onUseExisting(top.aluno.id)}>
            <UserCheck className="mr-1.5 h-4 w-4" />
            Usar {getAlunoFirstName(top.aluno)}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onContinueAnyway}>
            Criar novo aluno mesmo assim
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
