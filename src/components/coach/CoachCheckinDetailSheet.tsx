import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Columns2,
  FileDown,
  Loader2,
  MessageSquare,
  Save,
  Sparkles,
} from "lucide-react";
import { CheckinSideBySideCompare } from "@/components/coach/CheckinSideBySideCompare";
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
  isCheckinMarcadoSemTexto,
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

const COACH_CHECKIN_SECTIONS = CHECKIN_SECTIONS.filter((s) => s.id !== "corpo");

type CoachCheckinDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkin: WeeklyCheckinRecord | null;
  previousCheckin: WeeklyCheckinRecord | null;
  allCheckins?: WeeklyCheckinRecord[];
  studentId: string;
  studentName: string;
  onNavigate: (direction: "prev" | "next") => void;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
  onRespondido?: (checkinId: string, updated?: WeeklyCheckinRecord) => void;
};

export default function CoachCheckinDetailSheet({
  open,
  onOpenChange,
  checkin,
  previousCheckin,
  allCheckins = [],
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
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [markedRespondido, setMarkedRespondido] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [aiTrends, setAiTrends] = useState<string | null>(null);
  const [aiTrendsLoading, setAiTrendsLoading] = useState(false);
  const [aiDraftLoading, setAiDraftLoading] = useState(false);

  useEffect(() => {
    setMarkedRespondido(false);
  }, [checkin?.id]);

  useEffect(() => {
    if (!open || !checkin?.id) return;
    setSection("nutricao");
    setFeedback(checkin.coach_resposta?.trim() || "");
  }, [open, checkin?.id, checkin?.coach_resposta]);

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
      if (!checkin?.id) {
        throw new Error("Check-in não encontrado");
      }

      const save = await apiClient.saveWeeklyCheckinRespostaSafe(checkin.id, feedback.trim());
      if (!save.success || !save.data) {
        throw new Error(save.error || "Erro ao salvar");
      }

      setMarkedRespondido(true);
      onRespondido?.(checkin.id, save.data);

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

  const handleAiTrends = async () => {
    setAiTrendsLoading(true);
    setAiTrends(null);
    try {
      const result = await apiClient.weeklyCheckinAiTrendsSafe(studentId);
      if (!result.success) throw new Error(result.error || "IA indisponível");
      const bullets =
        result.data?.highlights?.length > 0
          ? `\n\n• ${result.data.highlights.join("\n• ")}`
          : "";
      setAiTrends(`${result.data?.summary || ""}${bullets}`.trim());
    } catch (err: unknown) {
      toast({
        title: "Resumo IA",
        description: err instanceof Error ? err.message : "Não foi possível gerar o resumo.",
        variant: "destructive",
      });
    } finally {
      setAiTrendsLoading(false);
    }
  };

  const handleAiDraft = async () => {
    if (!checkin?.id) return;
    setAiDraftLoading(true);
    try {
      const result = await apiClient.weeklyCheckinAiDraftSafe(checkin.id);
      if (!result.success) throw new Error(result.error || "IA indisponível");
      if (result.data?.draft) setFeedback(result.data.draft);
      toast({ title: "Rascunho gerado", description: "Revise e edite antes de salvar." });
    } catch (err: unknown) {
      toast({
        title: "Rascunho IA",
        description: err instanceof Error ? err.message : "Não foi possível gerar o rascunho.",
        variant: "destructive",
      });
    } finally {
      setAiDraftLoading(false);
    }
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
  const marcadoSemTexto = isCheckinMarcadoSemTexto(checkin) && !markedRespondido;
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
            ) : marcadoSemTexto ? (
              <Badge variant="outline" className="border-amber-500/50 text-xs text-amber-700 dark:text-amber-400">
                Sem texto no portal
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
            {allCheckins.length >= 2 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setCompareOpen(true)}
              >
                <Columns2 className="mr-2 h-4 w-4" />
                Comparar 2 semanas
              </Button>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={aiTrendsLoading}
                onClick={handleAiTrends}
              >
                {aiTrendsLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Tendências (4 sem.)
              </Button>
            </div>

            {aiTrends && (
              <div className="rounded-lg border border-border/70 bg-muted/40 p-4 text-sm whitespace-pre-wrap">
                <p className="mb-2 font-medium text-muted-foreground">Resumo IA</p>
                {aiTrends}
              </div>
            )}

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

            {marcadoSemTexto && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Resposta não visível para o aluno
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Este check-in foi marcado como respondido antes, mas o texto não foi salvo. O aluno
                  não vê nada no portal — use «Salvar resposta» abaixo.
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

            {checkin.peso_kg != null && Number.isFinite(Number(checkin.peso_kg)) && (
              <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-medium">{getFieldLabel("peso_kg")}</span>
                <span className="text-sm font-semibold">
                  {formatCheckinFieldValue("peso_kg", checkin.peso_kg)}
                </span>
              </div>
            )}

            <Tabs value={section} onValueChange={(v) => setSection(v as CheckinSectionId)}>
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-4">
                {COACH_CHECKIN_SECTIONS.map((s) => (
                  <TabsTrigger key={s.id} value={s.id} className="text-xs sm:text-sm">
                    {s.title}
                  </TabsTrigger>
                ))}
              </TabsList>

              {COACH_CHECKIN_SECTIONS.map((s) => (
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
              variant="secondary"
              className="flex-1 min-w-[140px]"
              onClick={handleAiDraft}
              disabled={aiDraftLoading}
            >
              {aiDraftLoading ? (
                <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Rascunho IA
            </Button>
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

      <CheckinSideBySideCompare
        open={compareOpen}
        onOpenChange={setCompareOpen}
        checkins={allCheckins}
        studentName={studentName}
        initialLeftId={checkin.id}
        initialRightId={previousCheckin?.id}
      />
    </Sheet>
  );
}
