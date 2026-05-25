import {
  ChevronRight,
  ClipboardCheck,
  Megaphone,
  MessageSquare,
  ListChecks,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PendingTask } from "@/lib/student-portal-utils";

type PendingTasksListProps = {
  loading?: boolean;
  tasks: PendingTask[];
  onNavigate: (tab: string) => void;
};

const iconById: Record<string, typeof ClipboardCheck> = {
  "checkin-weekly": ClipboardCheck,
  "chat-unread": MessageSquare,
  "announcements-unread": Megaphone,
};

const PendingTasksList = ({ loading, tasks, onNavigate }: PendingTasksListProps) => {
  if (loading) {
    return (
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-36" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-5 w-5 text-primary" />
          Pendências
          {tasks.length > 0 && (
            <span className="ml-1 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
              {tasks.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Tudo em dia por aqui. Continue firme na sua rotina.
          </p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((task) => {
              const Icon = iconById[task.id] ?? ListChecks;
              return (
                <li key={task.id}>
                  <Button
                    type="button"
                    variant="ghost"
                    className={
                      task.priority === "high"
                        ? "h-auto w-full justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 px-3 py-3 text-left hover:bg-primary/10"
                        : "h-auto w-full justify-between gap-3 rounded-lg border border-border/60 px-3 py-3 text-left hover:bg-muted/50"
                    }
                    onClick={() => onNavigate(task.tab)}
                  >
                    <span className="flex min-w-0 flex-1 items-start gap-3">
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="block font-medium leading-snug">{task.title}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
                          {task.description}
                        </span>
                      </span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default PendingTasksList;
