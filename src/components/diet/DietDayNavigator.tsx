import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addDaysToKey, diffDateKeys, longDayLabel, relativeDayLabel } from "@/lib/calendar-date";
import type { DietPlano } from "@/lib/diet-plano";

/** Até quantos dias para trás/à frente o aluno pode navegar. */
export const DIET_DAY_NAV_PAST = 7;
export const DIET_DAY_NAV_FUTURE = 60;
const STRIP_DAYS = 7;

type Props = {
  todayKey: string;
  selectedKey: string;
  onSelect: (key: string) => void;
  /** Plano do ciclo em cada dia (null = sem rotação nesse dia). */
  planoForDay: (key: string) => DietPlano | null;
  /** Detalhe do dia seleccionado, ex.: "Plano A · dia 2 de 3". */
  selectedDetail?: string;
  className?: string;
};

function shortWeekday(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12))
    .toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "short" })
    .replace(".", "");
}

function dayOfMonth(key: string): string {
  return String(Number(key.slice(8, 10)));
}

/**
 * Navegação por dia do ciclo de cardápios: ‹ dia › + faixa de 7 dias com o plano de cada um.
 * O intervalo é limitado para não sugerir histórico que o sistema não guarda.
 */
export default function DietDayNavigator({
  todayKey,
  selectedKey,
  onSelect,
  planoForDay,
  selectedDetail,
  className,
}: Props) {
  const offset = diffDateKeys(todayKey, selectedKey);
  const canPrev = offset > -DIET_DAY_NAV_PAST;
  const canNext = offset < DIET_DAY_NAV_FUTURE;
  const isToday = offset === 0;

  const stripStart = useMemo(() => {
    if (offset >= 0 && offset < STRIP_DAYS) return todayKey;
    return addDaysToKey(selectedKey, -3);
  }, [offset, selectedKey, todayKey]);

  const strip = useMemo(
    () =>
      Array.from({ length: STRIP_DAYS }, (_, i) => {
        const key = addDaysToKey(stripStart, i);
        const rel = diffDateKeys(todayKey, key);
        return {
          key,
          plano: planoForDay(key),
          isToday: rel === 0,
          disabled: rel < -DIET_DAY_NAV_PAST || rel > DIET_DAY_NAV_FUTURE,
        };
      }),
    [stripStart, todayKey, planoForDay],
  );

  const relLabel = relativeDayLabel(selectedKey, todayKey);

  return (
    <nav
      aria-label="Dias do cardápio"
      className={cn("space-y-2 rounded-xl border border-border/60 bg-card p-3", className)}
    >
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={() => onSelect(addDaysToKey(selectedKey, -1))}
          disabled={!canPrev}
          aria-label="Dia anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1 text-center" aria-live="polite">
          <p className="truncate font-semibold leading-tight">
            {relLabel}
            {relLabel === "Hoje" || relLabel === "Amanhã" || relLabel === "Ontem" ? (
              <span className="font-normal text-muted-foreground"> · {longDayLabel(selectedKey)}</span>
            ) : null}
          </p>
          {selectedDetail ? <p className="text-xs text-muted-foreground">{selectedDetail}</p> : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={() => onSelect(addDaysToKey(selectedKey, 1))}
          disabled={!canNext}
          aria-label="Próximo dia"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1" role="list">
        {strip.map((day) => {
          const selected = day.key === selectedKey;
          return (
            <button
              key={day.key}
              type="button"
              role="listitem"
              disabled={day.disabled}
              onClick={() => onSelect(day.key)}
              aria-current={selected ? "date" : undefined}
              aria-label={`${relativeDayLabel(day.key, todayKey)}${day.plano ? `, Plano ${day.plano}` : ""}`}
              className={cn(
                "flex min-h-[52px] flex-col items-center justify-center rounded-lg border text-xs transition-colors motion-reduce:transition-none disabled:opacity-40",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-transparent hover:border-primary/40 hover:bg-muted/50",
              )}
            >
              <span className={cn("capitalize", !selected && "text-muted-foreground")}>
                {day.isToday ? "hoje" : shortWeekday(day.key)}
              </span>
              <span className="font-semibold">{dayOfMonth(day.key)}</span>
              {day.plano ? (
                <span className={cn("text-[10px] leading-none", selected ? "opacity-90" : "text-primary")}>
                  {day.plano}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {!isToday ? (
        <div className="flex justify-center">
          <Button type="button" variant="link" size="sm" className="h-auto py-0" onClick={() => onSelect(todayKey)}>
            Voltar para hoje
          </Button>
        </div>
      ) : null}
    </nav>
  );
}
