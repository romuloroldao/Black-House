import { cn } from "@/lib/utils";

interface MoneyDisplayProps {
  value: number;
  className?: string;
  showSign?: boolean;
}

const formatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatMoney(value: number): string {
  return formatter.format(value);
}

export function MoneyDisplay({ value, className, showSign = false }: MoneyDisplayProps) {
  const formatted = formatMoney(Math.abs(value));
  const display = showSign && value !== 0 ? `${value > 0 ? "+" : "-"}${formatted}` : formatted;

  return (
    <span
      className={cn(
        "tabular-nums",
        showSign && value > 0 && "text-green-600",
        showSign && value < 0 && "text-destructive",
        className,
      )}
    >
      {display}
    </span>
  );
}
