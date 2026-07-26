import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isAgentDailyEnabled } from "@/lib/agent-daily-enabled";
import { trackAgentEvent } from "@/lib/agent-analytics";

type AgentReturnFabProps = {
  activeTab: string;
  onReturn: () => void;
  className?: string;
};

/** FAB para voltar ao Agent Home a partir da navegação tradicional. */
const AgentReturnFab = ({ activeTab, onReturn, className }: AgentReturnFabProps) => {
  if (!isAgentDailyEnabled()) return null;
  if (activeTab === "hoje" || activeTab === "dashboard") return null;

  return (
    <Button
      type="button"
      size="lg"
      className={cn(
        "fixed z-[90] gap-2 rounded-full shadow-lg",
        "bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] right-4 md:bottom-6 md:right-6",
        "min-h-12 px-4",
        className,
      )}
      onClick={() => {
        trackAgentEvent("agent_return", { from_tab: activeTab });
        onReturn();
      }}
      aria-label="Voltar ao agente"
    >
      <Sparkles className="h-4 w-4" aria-hidden />
      Agente
    </Button>
  );
};

export default AgentReturnFab;
