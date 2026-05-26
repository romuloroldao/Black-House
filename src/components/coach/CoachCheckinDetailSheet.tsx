import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, FileDown, Loader2, MessageSquare, Save } from "lucide-react";
import { exportCheckinToPdf } from "@/utils/checkinPdfExport";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  CHECKIN_SECTIONS,
  CHECKIN_SECTION_FIELD_KEYS,
  type CheckinSectionId,
} from "@/lib/checkin-sections";
import {
  compareCheckinField,
  deltaLabel,
  formatCheckinFieldValue,
  getFieldLabel,
  hasRelato,
  isCheckinRespondido,
} from "@/lib/checkin-display";
import { getCheckinPrioridadeSummary, isCheckinPrioridade } from "@/lib/checkin-highlights";
import type { WeeklyCheckinRecord } from "@/types/weekly-checkin";
import CheckinPriorityBadge from "@/components/coach/CheckinPriorityBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type CoachCheckinDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkin: WeeklyCheckinRecord | null;
  previousCheckin: WeeklyCheckinRecord | null;
  studentId: string;
  studentName: string;
  onNavigate: (direction: "prev" | "next") => void;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
  onRespondido?: (checkinId: string) => void;
};

export default function CoachCheckinDetailSheet({
  open,
  onOpenChange,
  checkin,
  previousCheckin,
  studentId,
  studentName,
  onNavigate,
  canNavigatePrev,
  canNavigateNext,
  onRespondido,
}: CoachCheckinDetailSheetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [section, setSection] = useState<CheckinSectionId>("nutricao");
  const [feedback, setFeedback] = useState("");
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [markedRespondido, setMarkedRespondido] = useState(false);

  useEffect(() => {
    setMarkedRespondido(false);
  }, [checkin?.id]);

  useEffect(() => {
    if (!open || !studentId) return;
    setSection("nutricao");

    apiClient
      .requestSafe<Array<{ id?: string; aluno_id?: string; feedback?: string; updated_at?: string }>>(
        `/api/feedbacks-alunos?aluno_id=${studentId}`,
      )
      .then((result) => {
        if (!result.success || !Array.isArray(result.data)) return;
        const forStudent = result.data.filter((row) => row.aluno_id === studentId);
        const latest = [...forStudent].sort(
          (a, b) =>
            new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime(),
        )[0];
        if (latest?.feedback) {
          setFeedback(latest.feedback);
          setFeedbackId(latest.id ?? null);
        } else {
          setFeedback("");
          setFeedbackId(null);
        }
      });
  }, [open, studentId, checkin?.id]);

  const handleSaveFeedback = async () => {
    if (!feedback.trim()) {
      toast({
        title: "Digite uma resposta",
        description: "Escreva o feedback antes de salvar.",
        variant: "destructive",
      });
      return;
    }
    if (!user?.id) {
      toast({ title: "Sessão expirada", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (feedbackId) {
        const update = await apiClient.requestSafe(`/api/feedbacks-alunos/${feedbackId}`, {
          method: "PATCH",
          body: JSON.stringify({ feedback: feedback.trim() }),
        });
        if (!update.success) throw new Error(update.error || "Erro ao atualizar");
      } else {
        const create = await apiClient.requestSafe<{ id: string }>("/api/feedbacks-alunos", {
          method: "POST",
          body: JSON.stringify({
            aluno_id: studentId,
            coach_id: user.id,
            feedback: feedback.trim(),
          }),
        });
        if (!create.success) throw new Error(create.error || "Erro ao salvar");
        if (create.data?.id) setFeedbackId(create.data.id);
      }

      if (checkin?.id) {
        const mark = await apiClient.requestSafe<WeeklyCheckinRecord>(
          `/api/weekly-checkins/${checkin.id}/respondido`,
          { method: "PATCH", body: JSON.stringify({}) },
        );
        if (mark.success) {
          setMarkedRespondido(true);
          onRespondido?.(checkin.id);
        }
      }

      toast({ title: "Resposta salva", description: "O aluno verá na aba Check-in e em Progresso." });
    } catch (err: unknown) {
      toast({
        title: "Erro ao salvar",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChat = () => {
    onOpenChange(false);
    navigate(`/?tab=messages&aluno_id=${encodeURIComponent(studentId)}`);
  };

  const handleExportPdf = async () => {
    if (!checkin) return;
    setExportingPdf(true);
    try {
      await exportCheckinToPdf({
        checkin,
        previousCheckin,
        studentName,
        coachFeedback: feedback,
      });
      toast({ title: "PDF exportado", description: "O ficheiro foi transferido para o seu dispositivo." });
    } catch (err: unknown) {
      toast({
        title: "Erro ao exportar PDF",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setExportingPdf(false);
    }
  };

  if (!checkin) return null;

  const checkinDate = format(new Date(checkin.created_at), "dd 'de' MMMM 'de' yyyy", {
    locale: ptBR,
  });
  const responded = isCheckinRespondido(checkin) || markedRespondido;
  const prioridade = isCheckinPrioridade(checkin);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl md:max-w-2xl"
      >
        <SheetHeader className="space-y-3 border-b px-6 py-4 pr-12 text-left">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={!canNavigatePrev}
              onClick={() => onNavigate("prev")}
              aria-label="Check-in anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={!canNavigateNext}
              onClick={() => onNavigate("next")}
              aria-label="Check-in seguinte"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <SheetTitle className="text-left">{studentName}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2 text-left">
            <span>Check-in de {checkinDate}</span>
            {prioridade && <CheckinPriorityBadge checkin={checkin} showTooltip={false} />}
            {responded ? (
              <Badge variant="secondary" className="text-xs">
                Respondido
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/50 text-xs text-amber-700 dark:text-amber-400">
                Pendente
              </Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 py-4">
            {prioridade && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
                <p className="text-sm font-semibold text-destructive">Triagem prioritária</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Este check-in reúne estresse, adesão baixa (≤2/5) e relato detalhado (
                  {getCheckinPrioridadeSummary(checkin)}). Recomendamos resposta personalizada em
                  breve.
                </p>
              </div>
            )}

            {hasRelato(checkin) && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="mb-2 text-sm font-medium text-primary">Relato do aluno</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {checkin.nao_cumpriu_porque}
                </p>
              </div>
            )}

            <Tabs value={section} onValueChange={(v) => setSection(v as CheckinSectionId)}>
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-4">
                {CHECKIN_SECTIONS.map((s) => (
                  <TabsTrigger key={s.id} value={s.id} className="text-xs sm:text-sm">
                    {s.title}
                  </TabsTrigger>
                ))}
              </TabsList>

              {CHECKIN_SECTIONS.map((s) => (
                <TabsContent key={s.id} value={s.id} className="mt-4 space-y-3">
                  <p className="text-sm text-muted-foreground">{s.description}</p>
                  {CHECKIN_SECTION_FIELD_KEYS[s.id]
                    .filter((key) => key !== "nao_cumpriu_porque")
                    .map((key) => {
                      const value = checkin[key as keyof WeeklyCheckinRecord];
                      const prevValue = previousCheckin?.[key as keyof WeeklyCheckinRecord];
                      const delta = previousCheckin
                        ? compareCheckinField(key, value, prevValue)
                        : "unknown";
                      const deltaText = deltaLabel(delta);

                      return (
                        <div
                          key={key}
                          className="flex flex-col gap-1 rounded-md border border-border/60 px-3 py-2 sm:flex-row sm:items-start sm:justify-between"
                        >
                          <span className="text-sm font-medium">{getFieldLabel(key)}</span>
                          <div className="text-left sm:text-right">
                            <span className="text-sm">{formatCheckinFieldValue(key, value)}</span>
                            {deltaText && (
                              <p
                                className={cn(
                                  "text-xs",
                                  delta === "down" && "text-amber-600 dark:text-amber-400",
                                  delta === "up" && "text-emerald-600 dark:text-emerald-400",
                                  delta === "same" && "text-muted-foreground",
                                )}
                              >
                                {deltaText}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </ScrollArea>

        <div className="space-y-3 border-t bg-background px-6 py-4">
          <p className="text-sm font-medium">Sua resposta ao aluno</p>
          <Textarea
            placeholder="Referencie o que o aluno relatou neste check-in..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              className="flex-1 min-w-[140px]"
              onClick={handleSaveFeedback}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar resposta
            </Button>
            <Button type="button" variant="outline" className="flex-1 min-w-[140px]" onClick={handleOpenChat}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Abrir chat
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 min-w-[140px]"
              onClick={handleExportPdf}
              disabled={exportingPdf}
            >
              {exportingPdf ? (
                <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" />
              )}
              Exportar PDF
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
