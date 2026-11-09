import { LayoutDashboard, ListChecks, Menu, MessageSquare, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { id: "dashboard", label: "Início", icon: LayoutDashboard },
  { id: "students", label: "Alunos", icon: Users },
  { id: "messages", label: "Mensagens", icon: MessageSquare },
  { id: "check-ins", label: "Check-ins", icon: ListChecks },
] as const;

export const OPEN_COACH_MENU_EVENT = "bh:open-coach-menu";

type CoachBottomNavProps = {
  activeTab: string;
  onTabChange: (tab: string) => void;
};

/** Barra inferior do coach no celular (só é montada quando o aparelho é celular). */
export function CoachBottomNav({ activeTab, onTabChange }: CoachBottomNavProps) {
  const inMainItems = items.some((i) => i.id === activeTab);
  return (
    <nav
      data-app-bottom-nav
      aria-label="Navegação principal"
      className="app-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90"
    >
      <div className="mx-auto grid min-h-14 max-w-lg grid-cols-5 py-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "flex min-h-[48px] flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition-colors motion-reduce:transition-none",
                isActive ? "text-primary" : "text-foreground/75 hover:text-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} aria-hidden />
              <span className="max-w-full truncate">{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_COACH_MENU_EVENT))}
          aria-current={!inMainItems ? "page" : undefined}
          className={cn(
            "flex min-h-[48px] flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition-colors motion-reduce:transition-none",
            !inMainItems ? "text-primary" : "text-foreground/75 hover:text-foreground",
          )}
        >
          <Menu className={cn("h-5 w-5", !inMainItems && "stroke-[2.5]")} aria-hidden />
          <span>Menu</span>
        </button>
      </div>
    </nav>
  );
}
