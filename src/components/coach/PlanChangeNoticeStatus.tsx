import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  summarizePlanChangeNotice,
  type NoticeTone,
  type PlanChangeDominio,
  type PlanChangeNotice,
} from "@/lib/plan-change-notices";
const POLL_MS = 10_000;

function formatDateTimeBR(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TONE_CLASS: Record<NoticeTone, string> = {
  neutral: "text-muted-foreground",
  ok: "text-success",
  warn: "text-warning",
  error: "text-destructive",
};

type Props = {
  alunoId: string;
  dominio: PlanChangeDominio;
  /** Mudar o valor força nova leitura (ex.: depois de salvar). */
  refreshKey?: number | string;
  className?: string;
};

/** Último aviso de dieta/treino enviado ao aluno, com o estado confirmado de cada canal. */
export default function PlanChangeNoticeStatus({ alunoId, dominio, refreshKey, className }: Props) {
  const [notice, setNotice] = useState<PlanChangeNotice | null>(null);
  const [retrying, setRetrying] = useState(false);
  const timerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    const res = await apiClient.getAvisosAlteracoesSafe(alunoId);
    if (!res.success) return;
    const items = Array.isArray(res.data?.items) ? res.data.items : [];
    setNotice(items.find((i) => i.dominio === dominio) ?? null);
  }, [alunoId, dominio]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const inFlight = notice?.status === "pending" || notice?.status === "processing";
  useEffect(() => {
    if (!inFlight) return;
    timerRef.current = window.setTimeout(() => void load(), POLL_MS);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [inFlight, notice, load]);

  if (!notice) return null;

  const summary = summarizePlanChangeNotice(notice);
  const when = notice.dispatched_at || notice.last_change_at;

  const retry = async () => {
    setRetrying(true);
    await apiClient.reprocessarAvisoAlteracaoSafe(notice.id);
    setRetrying(false);
    void load();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md text-xs hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            TONE_CLASS[summary.tone],
            className,
          )}
          aria-label={`${summary.label}. Ver detalhes`}
        >
          {inFlight ? (
            <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden />
          ) : (
            <BellRing className="h-3.5 w-3.5" aria-hidden />
          )}
          <span>{summary.label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2 text-sm" align="start">
        <p className="font-medium">{summary.label}</p>
        {when ? (
          <p className="text-xs text-muted-foreground">
            {notice.dispatched_at ? "Enviado em" : "Última alteração em"} {formatDateTimeBR(when)}
            {notice.change_count > 1 ? ` · ${notice.change_count} alterações agrupadas` : ""}
          </p>
        ) : null}
        {summary.detail.length > 0 ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {summary.detail.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        ) : null}
        {notice.status === "failed" ? (
          <Button size="sm" variant="outline" onClick={retry} disabled={retrying} className="w-full">
            {retrying ? (
              <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            Tentar reenviar
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
