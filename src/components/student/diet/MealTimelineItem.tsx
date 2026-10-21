import { Check, ChevronRight, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { DietItemWithFood, DietPlano, MealGroup } from "@/lib/diet-student-utils";
import { calcularMacros, getItemsForPlano } from "@/lib/diet-student-utils";

type MealTimelineItemProps = {
  group: MealGroup;
  plano: DietPlano;
  dietHasMultiplosCardapios?: boolean;
  done: boolean;
  isLast?: boolean;
  isCurrent?: boolean;
  onToggleDone: () => void;
  onOpenDetail: () => void;
};

const MealTimelineItem = ({
  group,
  plano,
  dietHasMultiplosCardapios = false,
  done,
  isLast,
  isCurrent,
  onToggleDone,
  onOpenDetail,
}: MealTimelineItemProps) => {
  const items = getItemsForPlano(group, plano, { dietHasMultiplosCardapios });
  const macros = calcularMacros(items);
  const preview = items
    .filter((i) => i.alimentos?.name)
    .slice(0, 2)
    .map((i) => i.alimentos!.name)
    .join(", ");

  return (
    <div className="relative flex gap-3 pb-6">
      {!isLast && (
        <span
          className="absolute left-[17px] top-10 bottom-0 w-0.5 bg-border"
          aria-hidden
        />
      )}
      <button
        type="button"
        aria-label={done ? "Marcar refeição como pendente" : "Marcar refeição como concluída"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleDone();
        }}
        className={cn(
          "relative z-10 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors motion-reduce:transition-none",
          done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/40 bg-background hover:border-primary/60",
        )}
      >
        {done ? <Check className="h-4 w-4" strokeWidth={3} /> : <Circle className="h-4 w-4 text-muted-foreground/50" />}
      </button>

      <button
        type="button"
        className={cn(
          "min-w-0 flex-1 rounded-xl border p-3 text-left transition-colors motion-reduce:transition-none",
          isCurrent && !done
            ? "border-primary/50 bg-primary/5 shadow-sm"
            : "border-border/60 bg-card hover:bg-muted/30",
          done && "opacity-80",
        )}
        onClick={onOpenDetail}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cn("font-semibold leading-snug", done && "line-through text-muted-foreground")}>
              {group.displayName}
            </p>
            {preview && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{preview}</p>
            )}
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="outline" className="student-badge-sm">
            {Math.round(macros.totalCalorias)} kcal
          </Badge>
          <Badge variant="secondary" className="student-badge-sm">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </Badge>
          {group.hasMultiplosCardapios && (
            <Badge variant="premium" className="student-badge-sm">
              Plano {plano}
            </Badge>
          )}
        </div>
      </button>
    </div>
  );
};

export default MealTimelineItem;
