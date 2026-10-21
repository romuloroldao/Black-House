import { useCallback, useEffect, useMemo, useState } from "react";
import { GripVertical, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  DIAS_SEMANA_LABELS,
  DIAS_SEMANA_ORDEM,
  type DiaSemanaIso,
  type TreinoAgendaSession,
} from "@/lib/treino-agenda-types";

export type AgendaWorkoutSource = {
  alunoTreinoId: string;
  id: string;
  nome: string;
  categoria?: string;
  dificuldade?: string;
};

type WeeklyWorkoutAgendaEditorProps = {
  alunoId: string;
  /** Treinos já atribuídos (biblioteca do aluno) — origem do drag */
  treinos: AgendaWorkoutSource[];
  /** Recarrega após guardar (opcional) */
  onSaved?: () => void;
};

type SlotMap = Partial<Record<DiaSemanaIso, TreinoAgendaSession>>;

/**
 * Programação semanal: drag cria sessões que referenciam alunos_treinos.
 * O treino permanece na lista de origem (reutilizável em N dias).
 */
export default function WeeklyWorkoutAgendaEditor({
  alunoId,
  treinos,
  onSaved,
}: WeeklyWorkoutAgendaEditorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slots, setSlots] = useState<SlotMap>({});
  const [dragOverDay, setDragOverDay] = useState<DiaSemanaIso | null>(null);

  const byAlunoTreinoId = useMemo(() => {
    const m = new Map<string, AgendaWorkoutSource>();
    for (const t of treinos) m.set(t.alunoTreinoId, t);
    return m;
  }, [treinos]);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiClient.getTreinoAgendaSafe(alunoId);
    const next: SlotMap = {};
    if (result.success && result.data?.sessions) {
      for (const s of result.data.sessions) {
        const dia = Number(s.dia_semana) as DiaSemanaIso;
        if (dia >= 1 && dia <= 7) next[dia] = s;
      }
    }
    setSlots(next);
    setLoading(false);
  }, [alunoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = async (next: SlotMap) => {
    setSaving(true);
    const sessions = DIAS_SEMANA_ORDEM.filter((d) => next[d]?.aluno_treino_id).map((d) => ({
      dia_semana: d,
      aluno_treino_id: next[d]!.aluno_treino_id,
      ordem: 0,
    }));
    const result = await apiClient.putTreinoAgendaSafe(alunoId, sessions);
    setSaving(false);
    if (result.success === false) {
      toast({
        title: "Não foi possível guardar a agenda",
        description: result.error || "Tente novamente",
        variant: "destructive",
      });
      await load();
      return;
    }
    const refreshed: SlotMap = {};
    for (const s of result.data.sessions || []) {
      const dia = Number(s.dia_semana) as DiaSemanaIso;
      if (dia >= 1 && dia <= 7) refreshed[dia] = s;
    }
    setSlots(refreshed);
    onSaved?.();
  };

  const sessoesCount = DIAS_SEMANA_ORDEM.filter((d) => slots[d]).length;

  const onDragStartLibrary = (e: React.DragEvent, alunoTreinoId: string) => {
    e.dataTransfer.setData("application/x-aluno-treino-id", alunoTreinoId);
    e.dataTransfer.effectAllowed = "copy";
  };

  const onDropDay = async (e: React.DragEvent, dia: DiaSemanaIso) => {
    e.preventDefault();
    setDragOverDay(null);
    const alunoTreinoId = e.dataTransfer.getData("application/x-aluno-treino-id");
    if (!alunoTreinoId) return;
    const src = byAlunoTreinoId.get(alunoTreinoId);
    if (!src) {
      toast({
        title: "Treino inválido",
        description: "Atribua o treino ao aluno antes de o colocar na agenda.",
        variant: "destructive",
      });
      return;
    }
    const next: SlotMap = {
      ...slots,
      [dia]: {
        dia_semana: dia,
        aluno_treino_id: alunoTreinoId,
        treino_id: src.id,
        treino_nome: src.nome,
        treino_categoria: src.categoria,
        treino_dificuldade: src.dificuldade,
        ordem: 0,
      },
    };
    setSlots(next);
    await persist(next);
  };

  const clearDay = async (dia: DiaSemanaIso) => {
    const next = { ...slots };
    delete next[dia];
    setSlots(next);
    await persist(next);
  };

  const labelForSlot = (slot: TreinoAgendaSession | undefined) => {
    if (!slot) return null;
    return (
      slot.treino_nome ||
      byAlunoTreinoId.get(slot.aluno_treino_id)?.nome ||
      "Treino"
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Programação semanal</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Arraste treinos para os dias. O mesmo treino pode repetir-se várias vezes na semana.
            </p>
          </div>
          <Badge variant="secondary">
            {sessoesCount} sessão{sessoesCount === 1 ? "" : "ões"} esta semana
            {saving ? " · a guardar…" : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            A carregar agenda…
          </div>
        ) : (
          <>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Treinos disponíveis
              </p>
              {treinos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Atribua pelo menos um treino acima para o poder programar na semana.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {treinos.map((t) => (
                    <li key={t.alunoTreinoId}>
                      <div
                        draggable
                        onDragStart={(e) => onDragStartLibrary(e, t.alunoTreinoId)}
                        className="flex cursor-grab items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm active:cursor-grabbing"
                      >
                        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="font-medium">{t.nome}</span>
                        {t.categoria ? (
                          <span className="text-xs text-muted-foreground">{t.categoria}</span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Sessões programadas
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
                {DIAS_SEMANA_ORDEM.map((dia) => {
                  const slot = slots[dia];
                  const nome = labelForSlot(slot);
                  return (
                    <div
                      key={dia}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                        setDragOverDay(dia);
                      }}
                      onDragLeave={() => setDragOverDay((d) => (d === dia ? null : d))}
                      onDrop={(e) => void onDropDay(e, dia)}
                      className={cn(
                        "flex min-h-[6.5rem] flex-col rounded-lg border p-2 transition-colors",
                        dragOverDay === dia
                          ? "border-primary bg-primary/10"
                          : "border-border/70 bg-muted/20",
                      )}
                    >
                      <p className="mb-1.5 text-xs font-semibold text-foreground">
                        {DIAS_SEMANA_LABELS[dia]}
                      </p>
                      {slot && nome ? (
                        <div className="flex flex-1 flex-col justify-between gap-1 rounded-md border border-border/80 bg-card p-2">
                          <p className="text-sm font-medium leading-snug">{nome}</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-full justify-start px-1 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => void clearDay(dia)}
                            disabled={saving}
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            Remover sessão
                          </Button>
                        </div>
                      ) : (
                        <p className="flex flex-1 items-center justify-center text-center text-xs text-muted-foreground">
                          Descanso
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
