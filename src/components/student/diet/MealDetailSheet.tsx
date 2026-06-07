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
import {
  getItemsForPlano,
  partitionMealItems,
  type DietItemWithFood,
  type DietPlano,
  type MealGroup,
} from "@/lib/diet-student-utils";
import { cn } from "@/lib/utils";

type MealDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealName: string;
  group: MealGroup | null;
  plano: DietPlano;
  dietHasMultiplosCardapios: boolean;
  onSubstituir: (item: DietItemWithFood) => void;
};

function MealItemRow({
  item,
  onSubstituir,
}: {
  item: DietItemWithFood;
  onSubstituir: (item: DietItemWithFood) => void;
}) {
  if (!item.alimentos) return null;
  const fator = macroScaleFactor(
    item.quantidade,
    item.unidade_quantidade,
    item.alimentos.portion,
  );
  const kcal = Math.round((item.alimentos.calories || 0) * fator);

  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
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
}

function MealItemsSection({
  title,
  description,
  items,
  variant = "default",
  onSubstituir,
}: {
  title: string;
  description?: string;
  items: DietItemWithFood[];
  variant?: "default" | "substitutos";
  onSubstituir: (item: DietItemWithFood) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <ul
        className={cn(
          "space-y-2",
          variant === "substitutos" && "rounded-lg border border-dashed border-border/80 bg-muted/10 p-2",
        )}
      >
        {items.map((item) => (
          <MealItemRow key={item.id} item={item} onSubstituir={onSubstituir} />
        ))}
      </ul>
    </section>
  );
}

function CardapioBlock({
  cardapio,
  items,
  isActive,
  onSubstituir,
}: {
  cardapio: DietPlano;
  items: DietItemWithFood[];
  isActive: boolean;
  onSubstituir: (item: DietItemWithFood) => void;
}) {
  const { principais, substitutos } = partitionMealItems(items);
  if (principais.length === 0 && substitutos.length === 0) return null;

  return (
    <section
      className={cn(
        "space-y-4 rounded-xl border p-4",
        isActive ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Cardápio {cardapio}</h3>
        {isActive && (
          <Badge variant="premium" className="text-[10px]">
            Seleccionado hoje
          </Badge>
        )}
        <Badge variant="secondary" className="text-[10px]">
          {principais.length} alimento{principais.length !== 1 ? "s" : ""}
          {substitutos.length > 0
            ? ` · ${substitutos.length} substituto${substitutos.length !== 1 ? "s" : ""}`
            : ""}
        </Badge>
      </div>

      <MealItemsSection title="Alimentos" items={principais} onSubstituir={onSubstituir} />
      <MealItemsSection
        title="Substitutos"
        description="Opções equivalentes indicadas pelo coach — use uma no lugar do alimento principal."
        items={substitutos}
        variant="substitutos"
        onSubstituir={onSubstituir}
      />
    </section>
  );
}

const MealDetailSheet = ({
  open,
  onOpenChange,
  mealName,
  group,
  plano,
  dietHasMultiplosCardapios,
  onSubstituir,
}: MealDetailSheetProps) => {
  const planosNoGrupo = group?.planosPresentes ?? [];
  const showAllCardapios = Boolean(
    group?.hasMultiplosCardapios && dietHasMultiplosCardapios && planosNoGrupo.length >= 2,
  );

  const filterOpts = { dietHasMultiplosCardapios };

  const itemsSingle =
    group && !showAllCardapios ? getItemsForPlano(group, plano, filterOpts) : [];
  const { principais, substitutos } = partitionMealItems(itemsSingle);

  const totalMulti = showAllCardapios
    ? planosNoGrupo.reduce(
        (n, p) => n + getItemsForPlano(group!, p, filterOpts).length,
        0,
      )
    : 0;

  const description = showAllCardapios
    ? `Cardápios ${planosNoGrupo.join(", ")} · ${totalMulti} itens no total`
    : `Cardápio ${plano} · ${principais.length} alimento${principais.length !== 1 ? "s" : ""}${
        substitutos.length > 0
          ? ` · ${substitutos.length} substituto${substitutos.length !== 1 ? "s" : ""}`
          : ""
      }`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[min(88dvh,920px)] flex-col gap-0 overflow-hidden rounded-t-2xl p-0 student-bottom-nav-safe"
      >
        <SheetHeader className="shrink-0 border-b border-border/60 px-6 pb-4 pr-14 pt-6 text-left">
          <SheetTitle>{mealName}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-y-contain px-6 py-4 [-webkit-overflow-scrolling:touch]">
          {showAllCardapios && group ? (
            planosNoGrupo.map((cardapio) => (
              <CardapioBlock
                key={cardapio}
                cardapio={cardapio}
                items={getItemsForPlano(group, cardapio, filterOpts)}
                isActive={plano === cardapio}
                onSubstituir={onSubstituir}
              />
            ))
          ) : (
            <>
              <MealItemsSection
                title="Alimentos do cardápio"
                items={principais}
                onSubstituir={onSubstituir}
              />
              <MealItemsSection
                title="Substitutos"
                description="Opções equivalentes indicadas pelo coach."
                items={substitutos}
                variant="substitutos"
                onSubstituir={onSubstituir}
              />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MealDetailSheet;
