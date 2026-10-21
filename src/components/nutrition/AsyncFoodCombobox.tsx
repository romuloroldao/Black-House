import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  getAllFoodsSafe,
  getFoodByIdSafe,
  normalizeFood,
  searchFoodsSafe,
  type Food,
} from '@/lib/foodService';
import { getFoodCatalogByIdSafe, listFoodCatalogSafe } from '@/modules/food-catalog/lib/food-catalog-api';

const MIN_SEARCH_CHARS = 2;
const PAGE_SIZE = 30;

type Props = {
  value?: string;
  onSelect: (foodId: string, food: Food | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Rótulo quando o alimento não está na lista de busca actual */
  selectedLabel?: string;
};

async function fetchFoodOptions(q: string): Promise<{ items: Food[]; error: string | null }> {
  const term = q.trim();

  const catalogRes = await listFoodCatalogSafe({
    q: term || undefined,
    page: 1,
    pageSize: PAGE_SIZE,
    sort: 'nome',
    order: 'asc',
  });

  if (catalogRes.success && catalogRes.data?.items?.length) {
    return {
      items: catalogRes.data.items.map((row) => normalizeFood(row)),
      error: null,
    };
  }

  const fallbackRes = term.length >= MIN_SEARCH_CHARS
    ? await searchFoodsSafe(term)
    : await getAllFoodsSafe();

  if (fallbackRes.success && Array.isArray(fallbackRes.data)) {
    const items = fallbackRes.data.slice(0, PAGE_SIZE);
    if (items.length > 0) {
      return { items, error: null };
    }
  }

  if (!catalogRes.success && !fallbackRes.success) {
    return {
      items: [],
      error: fallbackRes.error || catalogRes.error || 'Erro ao buscar alimentos',
    };
  }

  return { items: [], error: null };
}

export function AsyncFoodCombobox({
  value,
  onSelect,
  placeholder = 'Buscar alimento...',
  disabled = false,
  className,
  selectedLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [options, setOptions] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [resolvedLabel, setResolvedLabel] = useState(selectedLabel || '');
  const fetchSeqRef = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (selectedLabel) setResolvedLabel(selectedLabel);
  }, [selectedLabel]);

  useEffect(() => {
    if (!value) {
      setResolvedLabel('');
      return;
    }
    const inOptions = options.find((o) => o.id === value);
    if (inOptions) {
      setResolvedLabel(inOptions.name);
      return;
    }
    if (selectedLabel) return;

    let cancelled = false;
    (async () => {
      const catalogRes = await getFoodCatalogByIdSafe(value);
      if (cancelled) return;
      if (catalogRes.success && catalogRes.data) {
        setResolvedLabel(catalogRes.data.name);
        return;
      }
      const legacyRes = await getFoodByIdSafe(value);
      if (!cancelled && legacyRes.success && legacyRes.data) {
        setResolvedLabel(legacyRes.data.name);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value, options, selectedLabel]);

  const fetchOptions = useCallback(async (q: string) => {
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    setFetchError(null);

    const { items, error } = await fetchFoodOptions(q);

    if (seq !== fetchSeqRef.current) return;

    setOptions(items);
    setFetchError(error);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    void fetchOptions(debouncedSearch);
  }, [open, debouncedSearch, fetchOptions]);

  const displayLabel = value
    ? resolvedLabel || options.find((o) => o.id === value)?.name || 'Alimento seleccionado'
    : placeholder;

  const trimmedSearch = debouncedSearch.trim();
  const showMinCharsHint = !loading && !fetchError && trimmedSearch.length > 0 && trimmedSearch.length < MIN_SEARCH_CHARS;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Digite para buscar..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[280px]">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 motion-safe:animate-spin mr-2" />
                A buscar...
              </div>
            ) : fetchError ? (
              <div className="py-6 px-3 text-center text-sm text-destructive">
                {fetchError}
              </div>
            ) : showMinCharsHint ? (
              <div className="py-6 px-3 text-center text-sm text-muted-foreground">
                Digite pelo menos {MIN_SEARCH_CHARS} caracteres
              </div>
            ) : (
              <>
                <CommandEmpty>
                  {trimmedSearch.length >= MIN_SEARCH_CHARS
                    ? 'Nenhum alimento encontrado'
                    : 'Nenhum alimento no catálogo'}
                </CommandEmpty>
                <CommandGroup>
                  {options.map((food) => (
                    <CommandItem
                      key={food.id}
                      value={food.id}
                      onSelect={() => {
                        onSelect(food.id, food);
                        setResolvedLabel(food.name);
                        setOpen(false);
                        setSearch('');
                      }}
                    >
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="truncate">{food.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {food.calories} kcal / {food.portion}g
                        </span>
                      </div>
                      <Check
                        className={cn(
                          'ml-2 h-4 w-4 shrink-0',
                          value === food.id ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
