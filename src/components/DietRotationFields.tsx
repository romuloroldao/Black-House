import { Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { DateInputBR } from "@/components/ui/date-input-br";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildRotationSequence,
  isRotationEnabled,
  normalizeRotationBlocks,
  rotationBlocksToPayload,
  type DietRotationConfig,
  type RotationBlock,
} from "@/lib/diet-rotation";
import { normalizePlanoLetter } from "@/lib/diet-plano";

const PLANOS_DISPONIVEIS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export type DietRotationFormState = {
  rotacao_ativa: boolean;
  blocos: Array<{ plano: string; dias: string }>;
  rotacao_data_inicio: string;
};

function blocksFromRow(row: Record<string, unknown> | null | undefined): RotationBlock[] {
  const config: DietRotationConfig = {
    rotacao_ativa: Boolean(row?.rotacao_ativa),
    rotacao_sequencia: row?.rotacao_sequencia as RotationBlock[] | null,
    rotacao_dias_plano_a: row?.rotacao_dias_plano_a as number | null,
    rotacao_dias_plano_b: row?.rotacao_dias_plano_b as number | null,
    rotacao_plano_inicial: row?.rotacao_plano_inicial as string | null,
  };
  return normalizeRotationBlocks(config);
}

export function dietRotationFromRow(row: Record<string, unknown> | null | undefined): DietRotationFormState {
  const blocos = blocksFromRow(row);
  return {
    rotacao_ativa: Boolean(row?.rotacao_ativa),
    blocos:
      blocos.length > 0
        ? blocos.map((b) => ({ plano: b.plano, dias: String(b.dias) }))
        : [
            { plano: "A", dias: "3" },
            { plano: "B", dias: "1" },
          ],
    rotacao_data_inicio: row?.rotacao_data_inicio
      ? String(row.rotacao_data_inicio).slice(0, 10)
      : "",
  };
}

export function dietRotationToPayload(form: DietRotationFormState): Record<string, unknown> {
  const blocks: RotationBlock[] = form.blocos
    .map((b) => ({
      plano: normalizePlanoLetter(b.plano) || "A",
      dias: parseInt(b.dias, 10) || 0,
    }))
    .filter((b) => b.dias >= 1);

  return rotationBlocksToPayload(
    form.rotacao_ativa,
    blocks,
    form.rotacao_data_inicio || null,
  );
}

type DietRotationFieldsProps = {
  value: DietRotationFormState;
  onChange: (next: DietRotationFormState) => void;
};

export function DietRotationFields({ value, onChange }: DietRotationFieldsProps) {
  const previewConfig: DietRotationConfig = {
    rotacao_ativa: value.rotacao_ativa,
    rotacao_sequencia: value.blocos.map((b) => ({
      plano: normalizePlanoLetter(b.plano) || "A",
      dias: parseInt(b.dias, 10) || 0,
    })),
    rotacao_data_inicio: value.rotacao_data_inicio || null,
  };

  const previewSeq = isRotationEnabled(previewConfig)
    ? buildRotationSequence(previewConfig).join(" → ")
    : null;

  const updateBlock = (index: number, patch: Partial<{ plano: string; dias: string }>) => {
    const blocos = value.blocos.map((b, i) => (i === index ? { ...b, ...patch } : b));
    onChange({ ...value, blocos });
  };

  const addBlock = () => {
    const used = new Set(value.blocos.map((b) => normalizePlanoLetter(b.plano)).filter(Boolean));
    const nextLetter = PLANOS_DISPONIVEIS.find((l) => !used.has(l)) || "A";
    onChange({
      ...value,
      blocos: [...value.blocos, { plano: nextLetter, dias: "1" }],
    });
  };

  const removeBlock = (index: number) => {
    if (value.blocos.length <= 1) return;
    onChange({ ...value, blocos: value.blocos.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4 rounded-md border border-border/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Ciclo rotativo de cardápios</p>
          <p className="text-xs text-muted-foreground">
            Defina a sequência (ex.: 3 dias A, 1 dia B, 2 dias C). O aluno vê automaticamente o
            cardápio do dia. Marque cada refeição com Plano A, B, C… no import ou no editor.
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Blocos do ciclo</Label>
              <Button type="button" variant="outline" size="sm" onClick={addBlock}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Cardápio
              </Button>
            </div>
            {value.blocos.map((bloco, index) => (
              <div
                key={`${index}-${bloco.plano}`}
                className="flex flex-wrap items-end gap-2 rounded-md border border-border/50 bg-muted/20 p-2"
              >
                <div className="space-y-1 min-w-[100px]">
                  <Label className="text-[11px]">Cardápio</Label>
                  <Select
                    value={normalizePlanoLetter(bloco.plano) || "A"}
                    onValueChange={(v) => updateBlock(index, { plano: v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLANOS_DISPONIVEIS.map((l) => (
                        <SelectItem key={l} value={l}>
                          Plano {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 flex-1 min-w-[80px]">
                  <Label className="text-[11px]">Dias seguidos</Label>
                  <Input
                    type="number"
                    min={1}
                    max={14}
                    value={bloco.dias}
                    onChange={(e) => updateBlock(index, { dias: e.target.value })}
                    className="h-9"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-destructive"
                  disabled={value.blocos.length <= 1}
                  onClick={() => removeBlock(index)}
                  aria-label="Remover bloco"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
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
