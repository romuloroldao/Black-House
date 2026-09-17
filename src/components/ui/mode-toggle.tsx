import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeValue = "light" | "dark" | "system";

const OPTIONS: { value: ThemeValue; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

/** Seletor completo Claro / Escuro / Sistema — Settings e Perfil. */
export function ModeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn("grid h-10 grid-cols-3 gap-1 rounded-lg border border-border bg-muted/40 p-1", className)}
        aria-hidden
      />
    );
  }

  const current = (theme as ThemeValue) || "dark";

  return (
    <div
      role="radiogroup"
      aria-label="Tema da interface"
      className={cn(
        "grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/40 p-1",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const selected = current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(value)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Atalho nas sidebars: alterna entre claro e escuro. */
export function ThemeToggleCompact({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("h-9 w-9", className)}
        aria-label="Alternar tema"
        disabled
      >
        <Sun className="h-4 w-4 opacity-40" aria-hidden />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-9 w-9", className)}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </Button>
  );
}
