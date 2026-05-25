import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DateInputBR } from "@/components/ui/date-input-br";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildRotationSequence, isRotationEnabled, type DietRotationConfig } from "@/lib/diet-rotation";

export type DietRotationFormState = {
  rotacao_ativa: boolean;
  rotacao_dias_plano_a: string;
  rotacao_dias_plano_b: string;
  rotacao_plano_inicial: "A" | "B";
  rotacao_data_inicio: string;
};

export function dietRotationFromRow(row: Record<string, unknown> | null | undefined): DietRotationFormState {
  return {
    rotacao_ativa: Boolean(row?.rotacao_ativa),
    rotacao_dias_plano_a: row?.rotacao_dias_plano_a != null ? String(row.rotacao_dias_plano_a) : "3",
    rotacao_dias_plano_b: row?.rotacao_dias_plano_b != null ? String(row.rotacao_dias_plano_b) : "1",
    rotacao_plano_inicial:
      String(row?.rotacao_plano_inicial || "A").toUpperCase() === "B" ? "B" : "A",
    rotacao_data_inicio: row?.rotacao_data_inicio
      ? String(row.rotacao_data_inicio).slice(0, 10)
      : "",
  };
}

export function dietRotationToPayload(form: DietRotationFormState): Record<string, unknown> {
  const ativa = form.rotacao_ativa;
  const diasA = parseInt(form.rotacao_dias_plano_a, 10);
  const diasB = parseInt(form.rotacao_dias_plano_b, 10);
  return {
    rotacao_ativa: ativa,
    rotacao_dias_plano_a: ativa && Number.isFinite(diasA) ? diasA : null,
    rotacao_dias_plano_b: ativa && Number.isFinite(diasB) ? diasB : null,
    rotacao_plano_inicial: form.rotacao_plano_inicial,
    rotacao_data_inicio: ativa && form.rotacao_data_inicio ? form.rotacao_data_inicio : null,
  };
}

type DietRotationFieldsProps = {
  value: DietRotationFormState;
  onChange: (next: DietRotationFormState) => void;
};

export function DietRotationFields({ value, onChange }: DietRotationFieldsProps) {
  const previewConfig: DietRotationConfig = {
    rotacao_ativa: value.rotacao_ativa,
    rotacao_dias_plano_a: parseInt(value.rotacao_dias_plano_a, 10) || 0,
    rotacao_dias_plano_b: parseInt(value.rotacao_dias_plano_b, 10) || 0,
    rotacao_plano_inicial: value.rotacao_plano_inicial,
    rotacao_data_inicio: value.rotacao_data_inicio || null,
  };

  const previewSeq = isRotationEnabled(previewConfig)
    ? buildRotationSequence(previewConfig).join(" → ")
    : null;

  return (
    <div className="space-y-4 rounded-md border border-border/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Ciclo rotativo Plano A / B</p>
          <p className="text-xs text-muted-foreground">
            O aluno vê automaticamente o plano do dia (ex.: 3 dias A, 1 dia B). Marque as refeições
            com sufixo Plano A ou B no nome.
          </p>
        </div>
        <Switch
          checked={value.rotacao_ativa}
          onCheckedChange={(checked) => onChange({ ...value, rotacao_ativa: checked })}
          aria-label="Activar ciclo rotativo"
        />
      </div>

      {value.rotacao_ativa && (
        <div className="space-y-3 border-t border-border/50 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rot-dias-a">Dias seguidos — Plano A</Label>
              <Input
                id="rot-dias-a"
                type="number"
                min={1}
                max={14}
                value={value.rotacao_dias_plano_a}
                onChange={(e) => onChange({ ...value, rotacao_dias_plano_a: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rot-dias-b">Dias seguidos — Plano B</Label>
              <Input
                id="rot-dias-b"
                type="number"
                min={1}
                max={14}
                value={value.rotacao_dias_plano_b}
                onChange={(e) => onChange({ ...value, rotacao_dias_plano_b: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Começa por</Label>
              <Select
                value={value.rotacao_plano_inicial}
                onValueChange={(v) =>
                  onChange({ ...value, rotacao_plano_inicial: v as "A" | "B" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Plano A</SelectItem>
                  <SelectItem value="B">Plano B</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rot-inicio">Início do ciclo (opcional)</Label>
              <DateInputBR
                id="rot-inicio"
                value={value.rotacao_data_inicio}
                onChange={(iso) => onChange({ ...value, rotacao_data_inicio: iso })}
              />
              <p className="text-[11px] text-muted-foreground">
                Vazio = data de criação da dieta
              </p>
            </div>
          </div>

          {previewSeq && (
            <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Sequência do ciclo: <span className="font-medium text-foreground">{previewSeq}</span>
              {" "}(repete)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
