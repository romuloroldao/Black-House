import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import type { RefeicaoRegistrada } from "@/lib/meal-photo-types";
import { AuthMealImage } from "@/components/student/meal-photo/AuthMealImage";

type Props = {
  refreshKey?: number;
  alunoId?: string;
  readonly?: boolean;
};

export default function RefeicoesRegistradasList({
  refreshKey = 0,
  alunoId,
  readonly,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RefeicaoRegistrada[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = alunoId
        ? await apiClient.listRefeicoesRegistradasByAlunoSafe(alunoId, { limit: 20 })
        : await apiClient.listRefeicoesRegistradasSafe({ limit: 20 });
      if (result.success && Array.isArray(result.data)) {
        setItems(result.data as RefeicaoRegistrada[]);
      } else {
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, [alunoId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        A carregar histórico…
      </div>
    );
  }

  if (!items.length) {
    return (
      <p className="py-2 text-sm text-muted-foreground">
        {readonly
          ? "Ainda não há refeições registadas por foto."
          : "Ainda não registou refeições por foto."}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((m) => {
        const when = m.registrado_em
          ? new Date(m.registrado_em).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
        return (
          <li key={m.id} className="overflow-hidden rounded-xl border">
            <div className="flex gap-3 p-3">
              {m.imagem_path ? (
                <AuthMealImage
                  path={m.imagem_path}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] text-muted-foreground">
                  Sem foto
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{m.nome_sugerido || "Refeição"}</p>
                  <Badge variant="secondary" className="text-[10px]">
                    {m.origem === "USER_ADJUSTED" ? "Ajustado" : "Estimativa IA"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{when}</p>
                <p className="mt-1 text-sm">
                  <span className="font-semibold">{Math.round(Number(m.kcal) || 0)}</span> kcal
                  <span className="text-muted-foreground">
                    {" "}
                    · P {Math.round(Number(m.ptn) || 0)} · C {Math.round(Number(m.cho) || 0)} · G{" "}
                    {Math.round(Number(m.lip) || 0)}
                  </span>
                </p>
                {Array.isArray(m.itens) && m.itens.length > 0 ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {m.itens.map((i) => i.nome).join(", ")}
                  </p>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
