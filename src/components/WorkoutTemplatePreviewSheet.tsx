import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { mapTreinoApiToWorkoutForm } from "@/lib/treino-form-mapper";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Dumbbell, Edit3, RefreshCw } from "lucide-react";

export interface WorkoutTemplatePreview {
  id: string;
  name: string;
}

interface WorkoutTemplatePreviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: WorkoutTemplatePreview | null;
  onEdit?: (template: WorkoutTemplatePreview) => void;
}

const WorkoutTemplatePreviewSheet = ({
  open,
  onOpenChange,
  template,
  onEdit,
}: WorkoutTemplatePreviewSheetProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workout, setWorkout] = useState<ReturnType<typeof mapTreinoApiToWorkoutForm> | null>(null);

  useEffect(() => {
    if (!open || !template?.id) {
      setWorkout(null);
      setError(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      const result = await apiClient.requestSafe<Record<string, unknown>>(`/api/treinos/${template.id}`);
      if (cancelled) return;

      if (result.success && result.data) {
        setWorkout(mapTreinoApiToWorkoutForm(result.data));
      } else {
        setWorkout(null);
        setError(result.error || "Não foi possível carregar o template.");
      }
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, template?.id]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-1 pb-4">
          <SheetTitle className="pr-8">{template?.name ?? "Template"}</SheetTitle>
          <SheetDescription className="text-left">
            Pré-visualização do template (somente leitura)
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                if (template?.id) {
                  setLoading(true);
                  setError(null);
                  apiClient.requestSafe<Record<string, unknown>>(`/api/treinos/${template.id}`).then((result) => {
                    if (result.success && result.data) {
                      setWorkout(mapTreinoApiToWorkoutForm(result.data));
                      setError(null);
                    } else {
                      setError(result.error || "Não foi possível carregar o template.");
                    }
                    setLoading(false);
                  });
                }
              }}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Tentar novamente
            </Button>
          </div>
        )}

        {!loading && !error && workout && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{workout.category}</Badge>
              <Badge variant="outline">{workout.difficulty}</Badge>
              <Badge variant="secondary" className="gap-1">
                <Clock className="w-3 h-3" />
                {workout.duration} min
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Dumbbell className="w-3 h-3" />
                {workout.exercises.length} exercício{workout.exercises.length === 1 ? "" : "s"}
              </Badge>
            </div>

            {workout.description ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{workout.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Sem descrição.</p>
            )}

            {workout.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {workout.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Exercícios</h3>
              {workout.exercises.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Este template não possui exercícios.</p>
              ) : (
                workout.exercises.map((ex, index) => (
                  <div key={ex.id} className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                    <p className="font-medium">
                      {index + 1}. {ex.name || "Sem nome"}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>Séries: {ex.sets}</span>
                      <span>Reps: {ex.reps}</span>
                      {ex.weight ? <span>Carga: {ex.weight}</span> : null}
                      <span>Descanso: {ex.rest}</span>
                    </div>
                    {ex.notes ? (
                      <p className="text-xs text-muted-foreground">{ex.notes}</p>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            {onEdit && template && (
              <Button
                className="w-full"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(template);
                }}
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Usar template
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default WorkoutTemplatePreviewSheet;
