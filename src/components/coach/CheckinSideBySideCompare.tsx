import { useEffect, useMemo, useState } from "react";
import { Columns2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CHECKIN_SECTION_FIELD_KEYS, CHECKIN_SECTIONS } from "@/lib/checkin-sections";
import {
  buildCompareRows,
  formatCheckinWeekLabel,
} from "@/lib/checkin-compare";
import { formatCheckinFieldValue } from "@/lib/checkin-display";
import type { WeeklyCheckinRecord } from "@/types/weekly-checkin";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkins: WeeklyCheckinRecord[];
  studentName?: string;
  initialLeftId?: string;
  initialRightId?: string;
};

export function CheckinSideBySideCompare({
  open,
  onOpenChange,
  checkins,
  studentName,
  initialLeftId,
  initialRightId,
}: Props) {
  const sorted = useMemo(
    () => [...checkins].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [checkins],
  );

  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");

  useEffect(() => {
    if (!open || sorted.length === 0) return;
    const left = initialLeftId && sorted.some((c) => c.id === initialLeftId)
      ? initialLeftId
      : sorted[0]?.id ?? "";
    const rightDefault =
      initialRightId && sorted.some((c) => c.id === initialRightId)
        ? initialRightId
        : sorted.find((c) => c.id !== left)?.id ?? sorted[1]?.id ?? left;
    setLeftId(left);
    setRightId(rightDefault);
  }, [open, sorted, initialLeftId, initialRightId]);

  const left = sorted.find((c) => c.id === leftId);
  const right = sorted.find((c) => c.id === rightId);

  const rows = useMemo(() => {
    if (!left || !right) return [];
    return buildCompareRows(left, right);
  }, [left, right]);

  const rowByKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);

  if (sorted.length < 2) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Comparar semanas</DialogTitle>
            <DialogDescription>
              São necessários pelo menos dois check-ins para comparar lado a lado.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Columns2 className="h-5 w-5" />
            Comparar duas semanas
          </DialogTitle>
          <DialogDescription>
            {studentName ? `${studentName} · ` : ""}
            escolha dois registos para ver respostas em paralelo
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <WeekSelect
            label="Semana A (mais recente no eixo)"
            value={leftId}
            onValueChange={setLeftId}
            checkins={sorted}
            excludeId={rightId}
          />
          <WeekSelect
            label="Semana B"
            value={rightId}
            onValueChange={setRightId}
            checkins={sorted}
            excludeId={leftId}
          />
        </div>

        {left && right && (
          <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span className="truncate">{formatCheckinWeekLabel(left)}</span>
            <span className="truncate">{formatCheckinWeekLabel(right)}</span>
          </div>
        )}

        <ScrollArea className="min-h-0 flex-1 pr-3">
          <div className="space-y-6 pb-4">
            {CHECKIN_SECTIONS.map((section) => {
              const keys = CHECKIN_SECTION_FIELD_KEYS[section.id];
              const sectionRows = keys
                .map((k) => rowByKey.get(k))
                .filter((r): r is NonNullable<typeof r> => Boolean(r));
              if (sectionRows.length === 0) return null;

              return (
                <section key={section.id} className="space-y-2">
                  <h3 className="text-sm font-semibold">{section.title}</h3>
                  <div className="space-y-2">
                    {sectionRows.map((row) => (
                      <div
                        key={row.key}
                        className="rounded-lg border border-border/70 bg-card p-3"
                      >
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                          {row.label}
                        </p>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <p className="whitespace-pre-wrap break-words">{row.left}</p>
                          <p className="whitespace-pre-wrap break-words border-l pl-3">
                            {row.right}
                          </p>
                        </div>
                        {row.deltaText && (
                          <Badge variant="secondary" className="mt-2 text-xs font-normal">
                            Δ {row.deltaText}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}

            {left?.nao_cumpriu_porque || right?.nao_cumpriu_porque ? (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Relato do aluno</h3>
                <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm">
                  <p className="whitespace-pre-wrap italic text-muted-foreground">
                    {formatCheckinFieldValue("nao_cumpriu_porque", left?.nao_cumpriu_porque)}
                  </p>
                  <p className="whitespace-pre-wrap border-l pl-3 italic text-muted-foreground">
                    {formatCheckinFieldValue("nao_cumpriu_porque", right?.nao_cumpriu_porque)}
                  </p>
                </div>
              </section>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function WeekSelect({
  label,
  value,
  onValueChange,
  checkins,
  excludeId,
}: {
  label: string;
  value: string;
  onValueChange: (id: string) => void;
  checkins: WeeklyCheckinRecord[];
  excludeId?: string;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Escolher semana" />
        </SelectTrigger>
        <SelectContent>
          {checkins
            .filter((c) => c.id !== excludeId)
            .map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {formatCheckinWeekLabel(c)}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}
