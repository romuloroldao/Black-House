import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MealVariationOption = {
  id: string;
  indice: number;
  titulo: string;
  preparo: string;
};

type MealVariationsPanelProps = {
  loading: boolean;
  options: MealVariationOption[];
  selectedId: string | null;
  notice: string | null;
  onSelect: (id: string) => void;
};

export default function MealVariationsPanel({
  loading,
  options,
  selectedId,
  notice,
  onSelect,
}: MealVariationsPanelProps) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">A procurar preparos desta semana…</p>;
  }
  if (options.length < 2) return null;

  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Outros preparos desta semana</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Mesmos alimentos e as mesmas quantidades do plano. Escolher um preparo não marca a refeição como feita.
        </p>
      </div>
      <div className="space-y-2">
        {options.map((option) => {
          const selected = option.id === selectedId;
          return (
            <div
              key={option.id}
              className={cn(
                "rounded-lg border p-3",
                selected ? "border-primary/50 bg-primary/5" : "border-border/60",
              )}
            >
              <p className="text-sm font-medium">{option.titulo}</p>
              <p className="mt-1 text-sm text-muted-foreground">{option.preparo}</p>
              <Button
                type="button"
                size="sm"
                variant={selected ? "secondary" : "outline"}
                className="mt-2 h-8"
                disabled={selected}
                onClick={() => onSelect(option.id)}
              >
                {selected ? "Preparo escolhido hoje" : "Usar este preparo hoje"}
              </Button>
            </div>
          );
        })}
      </div>
      {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
    </section>
  );
}
