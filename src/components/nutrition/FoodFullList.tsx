import { useMemo, useState } from "react";
import { Check, FolderCog, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SubstituicaoIsocalorica } from "@/lib/foodEquivalence";
import {
  UNCATEGORIZED_ID,
  groupByCategory,
  matchesFoodSearch,
  type FoodCategory,
} from "@/lib/food-categories";

const INITIAL_ROWS = 150;
const ALL = "__todas__";

interface FoodFullListProps {
  items: SubstituicaoIsocalorica[];
  categories: FoodCategory[];
  status: "loading" | "error" | "ready";
  unLabel: string;
  selectedId: string;
  onSelect: (alimentoId: string) => void;
  onRetry: () => void;
  grupoLabel: string;
  onManageCategories?: () => void;
}

/** Lista completa do grupo, densa como uma tabela impressa: categoria → alimento · quantidade · kcal. */
export default function FoodFullList({
  items,
  categories,
  status,
  unLabel,
  selectedId,
  onSelect,
  onRetry,
  grupoLabel,
  onManageCategories,
}: FoodFullListProps) {
  const [filtro, setFiltro] = useState("");
  const [categoria, setCategoria] = useState(ALL);
  const [limite, setLimite] = useState(INITIAL_ROWS);

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.alimento.name.localeCompare(b.alimento.name, "pt-BR")),
    [items],
  );
  const allSections = useMemo(
    () => groupByCategory(sorted, (s) => s.alimento.id, categories),
    [sorted, categories],
  );
  const filtered = useMemo(
    () => sorted.filter((s) => matchesFoodSearch(s.alimento.name, filtro)),
    [sorted, filtro],
  );
  const sections = useMemo(() => {
    const grouped = groupByCategory(filtered, (s) => s.alimento.id, categories);
    return categoria === ALL ? grouped : grouped.filter((s) => s.id === categoria);
  }, [filtered, categories, categoria]);

  const totalVisivel = sections.reduce((n, s) => n + s.items.length, 0);
  const hasCategories = allSections.some((s) => s.id !== UNCATEGORIZED_ID);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
        Carregando a lista completa...
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-3 py-6 text-center">
        <p className="text-sm text-destructive">Não foi possível carregar a lista completa.</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum outro alimento no grupo {grupoLabel}.
      </p>
    );
  }

  let restantes = limite;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filtrar pelo nome..."
            value={filtro}
            onChange={(e) => {
              setFiltro(e.target.value);
              setLimite(INITIAL_ROWS);
            }}
            className="h-9 pl-9"
            autoComplete="off"
            aria-label="Filtrar a lista completa pelo nome"
          />
        </div>
        {onManageCategories ? (
          <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={onManageCategories}>
            <FolderCog className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">Organizar categorias</span>
            <span className="sm:hidden">Categorias</span>
          </Button>
        ) : null}
      </div>

      {hasCategories ? (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Categorias">
          {[{ id: ALL, nome: "Todas", items: sorted }, ...allSections].map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={categoria === s.id}
              onClick={() => {
                setCategoria(s.id);
                setLimite(INITIAL_ROWS);
              }}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
                categoria === s.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {s.nome} <span className="opacity-70">{s.items.length}</span>
            </button>
          ))}
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {totalVisivel} {totalVisivel === 1 ? "alimento" : "alimentos"} · quantidade equivalente à porção atual
      </p>

      {totalVisivel === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nenhum alimento corresponde ao filtro.</p>
      ) : (
        <div
          role="radiogroup"
          aria-label="Alimentos substitutos"
          className="max-h-[min(46dvh,420px)] overflow-y-auto overflow-x-hidden rounded-lg border md:max-h-[44vh]"
        >
          {sections.map((section) => {
            if (restantes <= 0) return null;
            const rows = section.items.slice(0, restantes);
            restantes -= rows.length;
            return (
              <section key={section.id} aria-label={section.nome}>
                {hasCategories ? (
                  <h4 className="sticky top-0 z-10 border-b bg-muted/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                    {section.nome}
                  </h4>
                ) : null}
                <ul className="divide-y">
                  {rows.map((sub) => {
                    const selected = selectedId === sub.alimento.id;
                    return (
                      <li key={sub.alimento.id}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => onSelect(sub.alimento.id)}
                          className={cn(
                            "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                            selected ? "bg-primary/10" : "hover:bg-muted/50",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                              selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                            )}
                            aria-hidden
                          >
                            {selected ? <Check className="h-3 w-3" /> : null}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{sub.alimento.name}</span>
                          <span className="shrink-0 tabular-nums font-medium">
                            {Math.round(sub.quantidadeEquivalente * 10) / 10}
                            {unLabel}
                          </span>
                          <span className="w-16 shrink-0 text-right tabular-nums text-xs text-muted-foreground">
                            {sub.kcalEquivalente.toFixed(0)} kcal
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {totalVisivel > limite ? (
            <div className="border-t p-2 text-center">
              <Button type="button" variant="ghost" size="sm" onClick={() => setLimite((n) => n + INITIAL_ROWS)}>
                Mostrar mais ({totalVisivel - limite})
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
