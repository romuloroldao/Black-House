import { useMemo, useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { Food } from '@/lib/foodService';
import { canSubstitute, sameEquivalenceGroup } from '@/lib/foodEquivalence';

function normalizeText(text: string | null | undefined) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

function flexibleSearch(searchTerm: string, food: Food) {
  const normalizedSearch = normalizeText(searchTerm);
  if (!normalizedSearch) return true;
  const label = normalizeText(food.name);
  const grupo = normalizeText(food.tipo_nome);
  const words = normalizedSearch.split(/\s+/).filter(Boolean);
  return words.every((w) => label.includes(w) || grupo.includes(w));
}

function foodDescription(food: Food) {
  const grupo = food.tipo_nome?.trim() || 'Sem grupo';
  const kcal = Number(food.calories) || 0;
  const porcao = Number(food.portion) > 0 ? Number(food.portion) : 100;
  const livre = food.equiv_livre ? ' · livre' : '';
  return `${grupo} · ${kcal} kcal/${porcao}g${livre}`;
}

export function findBestFoodMatch(nome: string, foods: Food[]): Food | null {
  const q = normalizeText(nome);
  if (!q || foods.length === 0) return null;
  const exact = foods.find((f) => normalizeText(f.name) === q);
  if (exact) return exact;
  const partial = foods.filter((f) => flexibleSearch(nome, f));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    const starts = partial.find((f) => normalizeText(f.name).startsWith(q));
    if (starts) return starts;
    return partial[0];
  }
  return null;
}

type FoodNameAutocompleteProps = {
  foods: Food[];
  value: string;
  onValueChange: (nome: string) => void;
  onFoodSelect: (food: Food) => void;
  /** Se definido, prioriza o mesmo grupo de equivalência (substitutos). */
  grupoReferencia?: Food | null;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function FoodNameAutocomplete({
  foods,
  value,
  onValueChange,
  onFoodSelect,
  grupoReferencia = null,
  placeholder = 'Nome do alimento',
  className,
  disabled = false,
}: FoodNameAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let list = foods.filter((f) => flexibleSearch(value, f));
    if (grupoReferencia?.tipo_id) {
      const sameGroup = list.filter(
        (f) => String(f.tipo_id) === String(grupoReferencia.tipo_id),
      );
      const other = list.filter(
        (f) => String(f.tipo_id) !== String(grupoReferencia.tipo_id),
      );
      list = [...sameGroup, ...other];
    }
    return list.slice(0, 12);
  }, [foods, value, grupoReferencia]);

  const selectedFood = useMemo(
    () => foods.find((f) => normalizeText(f.name) === normalizeText(value)),
    [foods, value],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [value, filtered.length]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pickFood = (food: Food) => {
    onFoodSelect(food);
    onValueChange(food.name);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={cn('relative flex-1 min-w-0', className)}>
      <Input
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onPointerDown={(e) => e.stopPropagation()}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!open || filtered.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter' && filtered[activeIndex]) {
            e.preventDefault();
            pickFood(filtered[activeIndex]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className={cn(
          selectedFood?.id
            ? 'border-primary/40 pr-24'
            : value.trim()
              ? 'border-amber-500/50'
              : undefined,
        )}
      />
      {selectedFood?.tipo_nome && (
        <Badge
          variant="outline"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] max-w-[45%] truncate pointer-events-none"
          title={selectedFood.tipo_nome}
        >
          {selectedFood.tipo_nome}
        </Badge>
      )}
      {open && value.trim().length >= 1 && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 max-w-full rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          <Command shouldFilter={false} className="rounded-md">
            <CommandList className="max-h-[220px]">
              <CommandEmpty className="py-3 text-xs text-muted-foreground px-3">
                Nenhum alimento no catálogo. O texto será cadastrado na importação.
              </CommandEmpty>
              <CommandGroup heading={grupoReferencia?.tipo_nome ? `Sugestões · ${grupoReferencia.tipo_nome}` : 'Catálogo Black House'}>
                {filtered.map((food, idx) => {
                  const mesmoGrupo =
                    grupoReferencia?.tipo_id &&
                    String(food.tipo_id) === String(grupoReferencia.tipo_id);
                  const substOk =
                    !grupoReferencia ||
                    (canSubstitute(grupoReferencia) &&
                      canSubstitute(food) &&
                      sameEquivalenceGroup(grupoReferencia, food));
                  return (
                    <CommandItem
                      key={food.id}
                      value={food.id}
                      onSelect={() => pickFood(food)}
                      className={cn(
                        'flex flex-col items-start gap-0.5 cursor-pointer',
                        idx === activeIndex && 'bg-accent',
                        grupoReferencia && !substOk && 'opacity-50',
                      )}
                    >
                      <span className="font-medium text-sm">{food.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {foodDescription(food)}
                        {mesmoGrupo ? ' · mesmo grupo' : ''}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}
