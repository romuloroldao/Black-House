import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterChip {
  id: string;
  label: string;
  count?: number;
}

interface FinancialFiltersBarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  chips?: FilterChip[];
  activeChip?: string;
  onChipChange?: (id: string) => void;
  children?: React.ReactNode;
  className?: string;
}

export function FinancialFiltersBar({
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Buscar...",
  chips,
  activeChip,
  onChipChange,
  children,
  className,
}: FinancialFiltersBarProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {onSearchChange && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label={searchPlaceholder}
            />
          </div>
        )}
        {children}
      </div>
      {chips && chips.length > 0 && onChipChange && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtros de status">
          {chips.map((chip) => (
            <Button
              key={chip.id}
              variant={activeChip === chip.id ? "default" : "outline"}
              size="sm"
              onClick={() => onChipChange(chip.id)}
              aria-pressed={activeChip === chip.id}
            >
              {chip.label}
              {chip.count !== undefined && ` (${chip.count})`}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
