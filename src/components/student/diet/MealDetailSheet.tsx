import { Replace } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { macroScaleFactor, quantityUnitLabel } from "@/lib/foodService";
import type { DietItemWithFood, DietPlano } from "@/lib/diet-student-utils";

type MealDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealName: string;
  plano: DietPlano;
  items: DietItemWithFood[];
  onSubstituir: (item: DietItemWithFood) => void;
};

const MealDetailSheet = ({
  open,
  onOpenChange,
  mealName,
  plano,
  items,
  onSubstituir,
}: MealDetailSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[min(88dvh,920px)] flex-col gap-0 overflow-hidden rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom,0px)]"
      >
        <SheetHeader className="shrink-0 border-b border-border/60 px-6 pb-4 pr-14 pt-6 text-left">
          <SheetTitle>{mealName}</SheetTitle>
          <SheetDescription>
            Plano {plano} · {items.length} alimento{items.length !== 1 ? "s" : ""}
          </SheetDescription>
        </SheetHeader>
        <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain px-6 py-4 [-webkit-overflow-scrolling:touch]">
          {items.map((item) => {
            if (!item.alimentos) return null;
            const fator = macroScaleFactor(
              item.quantidade,
              item.unidade_quantidade,
              item.alimentos.portion,
            );
            const kcal = Math.round((item.alimentos.calories || 0) * fator);
            return (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{item.alimentos.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.quantidade}
                    {quantityUnitLabel(item.unidade_quantidade)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    P {Math.round((item.alimentos.protein || 0) * fator)}g · C{" "}
                    {Math.round((item.alimentos.carbs || 0) * fator)}g · G{" "}
                    {Math.round((item.alimentos.fat || 0) * fator)}g
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge variant="outline">{kcal} kcal</Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => onSubstituir(item)}
                  >
                    <Replace className="mr-1 h-3.5 w-3.5" />
                    Substitutos
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
};

export default MealDetailSheet;
