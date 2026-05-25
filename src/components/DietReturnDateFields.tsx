import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DateInputBR } from '@/components/ui/date-input-br';
import { Button } from '@/components/ui/button';

export function isoDateFromDaysAhead(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface DietReturnDateFieldsProps {
  dataRetorno: string;
  diasValidade: string;
  onDataRetornoChange: (iso: string) => void;
  onDiasValidadeChange: (dias: string) => void;
}

export function DietReturnDateFields({
  dataRetorno,
  diasValidade,
  onDataRetornoChange,
  onDiasValidadeChange,
}: DietReturnDateFieldsProps) {
  const handleDias = (raw: string) => {
    onDiasValidadeChange(raw);
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) {
      onDataRetornoChange(isoDateFromDaysAhead(n));
    }
  };

  const handleDate = (iso: string) => {
    onDataRetornoChange(iso);
    if (iso) onDiasValidadeChange('');
  };

  const clear = () => {
    onDataRetornoChange('');
    onDiasValidadeChange('');
  };

  return (
    <div className="space-y-3 rounded-md border border-border/60 p-3">
      <div>
        <p className="text-sm font-medium">Data de retorno / vencimento</p>
        <p className="text-xs text-muted-foreground">
          Lembretes ao aluno e evento na Agenda. Deixe vazio se não houver data fixa.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="diet-data-retorno">Data</Label>
          <DateInputBR id="diet-data-retorno" value={dataRetorno} onChange={handleDate} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="diet-dias-validade">Ou validade (dias)</Label>
          <Input
            id="diet-dias-validade"
            type="number"
            min={1}
            placeholder="Ex: 45"
            value={diasValidade}
            onChange={(e) => handleDias(e.target.value)}
          />
        </div>
      </div>
      {dataRetorno ? (
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={clear}>
          Remover data de retorno
        </Button>
      ) : null}
    </div>
  );
}
