import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Loader2, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { ImportHistoryRecord } from "@/types/import-history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ImportHistoryPanelProps = {
  alunoId: string;
  /** Incrementar após nova importação para recarregar. */
  refreshKey?: number;
  limit?: number;
  showStudentName?: boolean;
};

const modoLabel: Record<ImportHistoryRecord["modo"], string> = {
  create: "Novo aluno",
  enrich: "Vincular dieta",
};

const tipoLabel = (tipo: string | null) => {
  if (!tipo) return null;
  const map: Record<string, string> = {
    pdf: "PDF",
    csv: "CSV",
    xlsx: "Excel",
    outro: "Ficheiro",
  };
  return map[tipo] || tipo.toUpperCase();
};

export default function ImportHistoryPanel({
  alunoId,
  refreshKey = 0,
  limit = 15,
  showStudentName = false,
}: ImportHistoryPanelProps) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ImportHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await apiClient.importHistorySafe({ alunoId, limit });
    if (!result.success) {
      setError(result.error || "Não foi possível carregar o histórico.");
      setRows([]);
    } else {
      setRows(Array.isArray(result.data) ? result.data : []);
    }
    setLoading(false);
  }, [alunoId, limit]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">Histórico de importações</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Fichas PDF, CSV ou Excel confirmadas neste aluno.
          </CardDescription>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => void load()} aria-label="Actualizar histórico">
          <RefreshCw className={cnIcon(loading)} />
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
            A carregar…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Ainda não há importações registadas para este aluno.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm font-medium">
                      {format(new Date(row.created_at), "dd MMM yyyy · HH:mm", { locale: ptBR })}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {modoLabel[row.modo] || row.modo}
                    </Badge>
                    {row.arquivo_tipo ? (
                      <Badge variant="outline" className="text-[10px]">
                        {tipoLabel(row.arquivo_tipo)}
                      </Badge>
                    ) : null}
                    {row.replace_active_diet ? (
                      <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-700 dark:text-amber-400">
                        Substituiu activa
                      </Badge>
                    ) : null}
                  </div>
                  {showStudentName && row.aluno_nome ? (
                    <p className="text-xs text-muted-foreground">{row.aluno_nome}</p>
                  ) : null}
                  {row.arquivo_nome ? (
                    <p className="truncate text-xs text-muted-foreground" title={row.arquivo_nome}>
                      {row.arquivo_nome}
                    </p>
                  ) : null}
                  {row.resumo ? (
                    <p className="text-xs leading-relaxed text-foreground/90">{row.resumo}</p>
                  ) : null}
                </div>
                {row.dieta_id ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => navigate(`/dieta/${row.dieta_id}`)}
                  >
                    Ver dieta
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function cnIcon(loading: boolean) {
  return loading ? "h-4 w-4 motion-safe:animate-spin" : "h-4 w-4";
}
