import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type StudentIntentBarProps = {
  onOpen: () => void;
  className?: string;
};

const StudentIntentBar = ({ onOpen, className }: StudentIntentBarProps) => {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-left",
        "shadow-sm transition hover:bg-muted/70 active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      aria-label="Abrir assistente do dia"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">O que queres fazer agora?</span>
        <span className="block truncate text-xs text-muted-foreground">
          Próxima refeição, treino, concluir ou restaurante
        </span>
      </span>
    </button>
  );
};

export default StudentIntentBar;
