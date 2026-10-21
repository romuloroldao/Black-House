import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Check, Sparkles, ShieldCheck, AlertCircle, Trash2 } from 'lucide-react';

const STEPS = [
  { id: 'upload', label: 'Upload' },
  { id: 'review', label: 'Revisar' },
  { id: 'complete', label: 'Concluído' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

export function ImportStepper({ currentStep }: { currentStep: StepId }) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <nav aria-label="Progresso da importação" className="w-full shrink-0">
      <ol className="flex items-center">
        {STEPS.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={step.id} className="flex flex-1 items-center last:flex-none">
              <div
                className={cn(
                  'flex items-center gap-2 min-w-0',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium border-2 transition-colors',
                    done && 'border-green-500 bg-green-500 text-white',
                    active && !done && 'border-primary bg-primary text-primary-foreground',
                    !done && !active && 'border-muted-foreground/30 bg-muted',
                  )}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span className={cn('hidden text-sm font-medium sm:inline', active && 'font-semibold')}>
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-2 h-0.5 flex-1 min-w-[12px] rounded-full',
                    index < currentIndex ? 'bg-green-500' : 'bg-muted-foreground/20',
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

type ExtractionSummaryProps = {
  confidence?: {
    overall: number;
    sections: { aluno: number; dieta: number; protocolo: number | null };
  } | null;
  extractionLabel: string;
  numPages?: number;
  confColor: string;
  warnings: string[];
};

export function ImportExtractionSummary({
  confidence,
  extractionLabel,
  numPages,
  confColor,
  warnings,
}: ExtractionSummaryProps) {
  return (
    <div className="shrink-0 space-y-2">
      <div className={cn('rounded-lg border p-3', confColor)} role="status">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            {confidence ? `${confidence.overall}% confiança` : 'Confiança —'}
          </span>
          {confidence && (
            <span className="text-xs opacity-90">
              Aluno {confidence.sections.aluno}% · Dieta {confidence.sections.dieta}%
              {confidence.sections.protocolo !== null &&
                ` · Protocolo ${confidence.sections.protocolo}%`}
            </span>
          )}
          <Badge variant="secondary" className="gap-1 text-xs font-normal">
            <Sparkles className="h-3 w-3" />
            {extractionLabel}
          </Badge>
          {numPages ? (
            <span className="text-xs text-muted-foreground">{numPages} página(s)</span>
          ) : null}
        </div>
      </div>
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          <p className="mb-1 flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Revise com atenção
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-xs">
            {warnings.slice(0, 5).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
            {warnings.length > 5 && (
              <li className="list-none pl-0 text-muted-foreground">+{warnings.length - 5} avisos</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ProtocolItemRow({
  nome,
  dosagem,
  horario,
  observacao,
  onNome,
  onDosagem,
  onHorario,
  onObservacao,
  onRemove,
}: {
  nome: string;
  dosagem: string;
  horario: string;
  observacao: string;
  onNome: (v: string) => void;
  onDosagem: (v: string) => void;
  onHorario: (v: string) => void;
  onObservacao: (v: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid min-w-0 gap-2 rounded-lg border bg-card p-3 sm:grid-cols-[minmax(0,1.4fr)_88px_100px_minmax(0,1fr)_36px] sm:items-end">
      <div className="space-y-1 min-w-0">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Nome</Label>
        <Input value={nome} onChange={(e) => onNome(e.target.value)} placeholder="Ex: Magnésio" className="h-9" />
      </div>
      <div className="space-y-1 min-w-0">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Dose</Label>
        <Input value={dosagem} onChange={(e) => onDosagem(e.target.value)} placeholder="400mg" className="h-9" />
      </div>
      <div className="space-y-1 min-w-0">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Horário</Label>
        <Input value={horario} onChange={(e) => onHorario(e.target.value)} placeholder="Manhã" className="h-9" />
      </div>
      <div className="space-y-1 min-w-0">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Obs.</Label>
        <Input
          value={observacao}
          onChange={(e) => onObservacao(e.target.value)}
          placeholder="Opcional"
          className="h-9"
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 text-destructive sm:self-end"
        onClick={onRemove}
        aria-label="Remover item"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
