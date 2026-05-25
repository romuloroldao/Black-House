import { CalendarDays, Dumbbell, MessageSquare, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";

export const BOTTOM_NAV_TABS = ["hoje", "diet", "workouts", "coach"] as const;
export type BottomNavTab = (typeof BOTTOM_NAV_TABS)[number];

type StudentBottomNavProps = {
  activeTab: string;
  onTabChange: (tab: BottomNavTab, extra?: Record<string, string>) => void;
  coachBadge?: number;
};

const items: Array<{
  id: BottomNavTab;
  label: string;
  icon: typeof CalendarDays;
}> = [
  { id: "hoje", label: "Hoje", icon: CalendarDays },
  { id: "diet", label: "Dieta", icon: Utensils },
  { id: "workouts", label: "Treino", icon: Dumbbell },
  { id: "coach", label: "Coach", icon: MessageSquare },
];

function resolveActiveTab(tab: string): BottomNavTab | null {
  if (tab === "dashboard") return "hoje";
  if (BOTTOM_NAV_TABS.includes(tab as BottomNavTab)) return tab as BottomNavTab;
  if (tab === "chat" || tab === "messages") return "coach";
  return null;
}

const StudentBottomNav = ({ activeTab, onTabChange, coachBadge = 0 }: StudentBottomNavProps) => {
  const resolved = resolveActiveTab(activeTab);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[90] border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Navegação principal"
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = resolved === item.id;
          const showBadge = item.id === "coach" && coachBadge > 0;

          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition-colors motion-reduce:transition-none",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => {
                if (item.id === "coach") {
                  onTabChange("coach", { coachView: "chat" });
                } else {
                  onTabChange(item.id);
                }
              }}
            >
              <span className="relative">
                <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} aria-hidden />
                {showBadge && (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                    {coachBadge > 9 ? "9+" : coachBadge}
                  </span>
                )}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default StudentBottomNav;
