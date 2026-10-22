import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import escalaBristol from "@/assets/escala-bristol.jpg";
import StudentCoachCheckinFeedback from "@/components/student/StudentCoachCheckinFeedback";
import CheckinStepHeader from "@/components/student/checkin/CheckinStepHeader";
import {
  CHECKIN_SECTIONS,
  countCompletedSections,
  getCheckinSectionDescId,
  getCheckinSectionTitleId,
  getSectionMissingLabels,
  type CheckinSectionId,
} from "@/lib/checkin-sections";
import { CHECKIN_FIELD_LABELS, INITIAL_CHECKIN_FORM, type CheckinFormData } from "@/lib/checkin-types";
import { buildCheckinPayload, type CheckinSubmitExtras } from "@/lib/checkin-payload";
import {
  clearCheckinDraft,
  isCheckinDraftEmpty,
  loadCheckinDraft,
  saveCheckinDraft,
} from "@/lib/checkin-draft";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { startOfNextCalendarWeek, type CheckinStreakInfo } from "@/lib/checkin-streak";
import {
  MIN_CHECKIN_PHOTOS,
  parsePesoKgInput,
  type CheckinPhotoDraft,
} from "@/lib/checkin-weekly-rules";
import CheckinPhotosWeightStep, {
  revokeCheckinPhotoDrafts,
} from "@/components/student/checkin/CheckinPhotosWeightStep";
import { prepareImageForUpload } from "@/lib/prepare-image-upload";
import { Skeleton } from "@/components/ui/skeleton";
import ProfileCompletenessBanner from "@/components/student/ProfileCompletenessBanner";
import WorkoutEvolutionSection from "@/components/student/WorkoutEvolutionSection";
import type { ProfileCompletenessStatus } from "@/types/profile-completeness";
import FeatureOnboardingPanel, {
  FeatureOnboardingHelpButton,
} from "@/components/student/onboarding/FeatureOnboardingPanel";
import { useFeatureOnboarding } from "@/hooks/useFeatureOnboarding";

const SECTION_IDS: CheckinSectionId[] = CHECKIN_SECTIONS.map((s) => s.id);

type StudentWeeklyCheckinProps = {
  checkinStreak?: CheckinStreakInfo | null;
  checkinLoading?: boolean;
  onCheckinSubmitted?: () => void;
  profileStatus?: ProfileCompletenessStatus | null;
  onRequireProfile?: () => void;
};

export default function StudentWeeklyCheckin({
  checkinStreak = null,
  checkinLoading = false,
  onCheckinSubmitted,
  profileStatus = null,
  onRequireProfile,
}: StudentWeeklyCheckinProps) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [step, setStep] = useState(() => {
    const raw = Number(searchParams.get("checkin_step"));
    return raw >= 0 && raw < CHECKIN_SECTIONS.length ? raw : 0;
  });
  const [formData, setFormData] = useState<CheckinFormData>(INITIAL_CHECKIN_FORM);
  const [pesoKg, setPesoKg] = useState("");
  const [photoDrafts, setPhotoDrafts] = useState<CheckinPhotoDraft[]>([]);
  const [draftRestored, setDraftRestored] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const draftHydratedFor = useRef<string | null>(null);

  // A aba remonta ao trocar de tab no portal; sem isto o aluno perde as respostas.
  useEffect(() => {
    const userId = user?.id;
    if (!userId || draftHydratedFor.current === userId) return;
    draftHydratedFor.current = userId;
    const draft = loadCheckinDraft(userId);
    if (!draft) return;
    setFormData(draft.formData);
    setPesoKg(draft.pesoKg);
    setDraftRestored(true);
    setHasDraft(true);
    toast.info("Recuperamos as respostas que você já tinha preenchido. As fotos precisam ser enviadas de novo.");
  }, [user?.id]);

  useEffect(() => {
    const userId = user?.id;
    if (!userId || draftHydratedFor.current !== userId) return;
    saveCheckinDraft(userId, formData, pesoKg);
    setHasDraft(!isCheckinDraftEmpty(formData, pesoKg));
  }, [user?.id, formData, pesoKg]);

  const corpoExtras = {
    pesoKg,
    photoCount: photoDrafts.length,
    minPhotos: MIN_CHECKIN_PHOTOS,
  };

  const completedSections = countCompletedSections(formData, CHECKIN_FIELD_LABELS, corpoExtras);
  const currentSectionId = SECTION_IDS[step];

  const syncStepToUrl = (next: number) => {
    setStep(next);
    const params = new URLSearchParams(searchParams);
    params.set("tab", "checkin");
    if (next > 0) params.set("checkin_step", String(next));
    else params.delete("checkin_step");
    setSearchParams(params, { replace: true });
  };

  const goNext = () => {
    const missing = getSectionMissingLabels(
      formData,
      currentSectionId,
      CHECKIN_FIELD_LABELS,
      corpoExtras,
    );
    if (missing.length > 0) {
      const preview = missing.slice(0, 3).join(", ");
      const extra = missing.length > 3 ? ` e mais ${missing.length - 3}` : "";
      toast.error(`Complete este bloco: ${preview}${extra}.`);
      return;
    }
    if (step < CHECKIN_SECTIONS.length - 1) syncStepToUrl(step + 1);
  };

  const goPrev = () => {
    if (step > 0) syncStepToUrl(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (step < CHECKIN_SECTIONS.length - 1) {
      goNext();
      return;
    }

    const missingLabels = getSectionMissingLabels(formData, "bem_estar", CHECKIN_FIELD_LABELS);
    const allMissing = SECTION_IDS.flatMap((id) =>
      getSectionMissingLabels(formData, id, CHECKIN_FIELD_LABELS, corpoExtras),
    );
    if (allMissing.length > 0) {
      const preview = allMissing.slice(0, 4).join(", ");
      const extra = allMissing.length > 4 ? ` e mais ${allMissing.length - 4}` : "";
      toast.error(`Preencha todas as perguntas obrigatórias antes de enviar: ${preview}${extra}.`);
      const firstIncomplete = SECTION_IDS.findIndex(
        (id) => getSectionMissingLabels(formData, id, CHECKIN_FIELD_LABELS, corpoExtras).length > 0,
      );
      if (firstIncomplete >= 0) syncStepToUrl(firstIncomplete);
      return;
    }
    if (missingLabels.length > 0) {
      syncStepToUrl(SECTION_IDS.indexOf("bem_estar"));
      return;
    }

    const pesoParsed = parsePesoKgInput(pesoKg);
    if (pesoParsed == null) {
      toast.error("Informe um peso válido (30 a 350 kg).");
      syncStepToUrl(0);
      return;
    }
    if (photoDrafts.length < MIN_CHECKIN_PHOTOS) {
      toast.error(
        `Envie pelo menos ${MIN_CHECKIN_PHOTOS} fotos (frente e costas) antes de concluir.`,
      );
      syncStepToUrl(0);
      return;
    }

    if (profileStatus?.hard_gate_active && !profileStatus.is_complete) {
      toast.error("Complete seu perfil antes de enviar o check-in.");
      onRequireProfile?.();
      return;
    }

    setLoading(true);
    setSubmitStatus("A preparar envio…");

    try {
      if (!user?.id) {
        toast.error("Usuário não autenticado. Por favor, faça login novamente.");
        return;
      }

      const me = await apiClient.getMeSafe();
      const alunoId = me.data?.id;
      if (!alunoId) {
        toast.error("Perfil de aluno não encontrado.");
        return;
      }

      const fotosPayload: CheckinSubmitExtras["fotos"] = [];
      // Ordem canónica dos slots; descricao = orientação sugerida (pose_aluno no servidor).
      // pose_client é opcional — nunca deve bloquear o upload (Android/MediaPipe).
      const orderedDrafts = [...photoDrafts].sort((a, b) => {
        const order = ["frente", "costas", "lado_esquerdo", "lado_direito"] as const;
        return order.indexOf(a.descricao as (typeof order)[number]) -
          order.indexOf(b.descricao as (typeof order)[number]);
      });
      for (let i = 0; i < orderedDrafts.length; i++) {
        const draft = orderedDrafts[i];
        setSubmitStatus(`A preparar foto ${i + 1} de ${orderedDrafts.length}…`);
        const prepared = await prepareImageForUpload(draft.file);
        setSubmitStatus(`A enviar foto ${i + 1} de ${orderedDrafts.length}…`);
        const fileName = `${Date.now()}-${i}-${prepared.name}`;
        const uploadResult = await apiClient.uploadFile(
          "progress-photos",
          `${alunoId}/${fileName}`,
          prepared,
        );
        const publicUrl =
          uploadResult?.url ||
          apiClient.getPublicUrl("progress-photos", `${alunoId}/${fileName}`);

        let detected: { pose: string; confidence: number } | null = null;
        try {
          const poseMod = await Promise.race([
            import("@/lib/pose-detect"),
            new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1500)),
          ]);
          if (poseMod) {
            detected = await poseMod.getPoseDetection(draft.file, 2000);
          }
        } catch {
          detected = null;
        }

        fotosPayload.push({
          url: publicUrl,
          // Orientação do slot do guia visual → pose_aluno (auditoria apenas)
          descricao: draft.descricao || null,
          ...(detected
            ? { pose_client: detected.pose, pose_client_confidence: detected.confidence }
            : {}),
        });
      }

      setSubmitStatus("A guardar check-in…");
      const response = await apiClient.requestSafe<{ success?: boolean }>("/api/checkins", {
        method: "POST",
        body: JSON.stringify(
          buildCheckinPayload(formData, { pesoKg: pesoParsed, fotos: fotosPayload }),
        ),
      });

      if (!response.success) {
        const errText = response.error || "";
        if (errText.includes("CHECKIN_ALREADY_THIS_WEEK")) {
          toast.info("Você já enviou o check-in desta semana.");
          clearCheckinDraft(user.id);
          onCheckinSubmitted?.();
        } else if (
          errText.includes("CHECKIN_PHOTOS_REQUIRED") ||
          errText.includes("CHECKIN_PESO_INVALID")
        ) {
          toast.error(
            errText.includes("CHECKIN_PHOTOS")
              ? `Envie pelo menos ${MIN_CHECKIN_PHOTOS} fotos no check-in.`
              : "Informe um peso válido (30 a 350 kg).",
          );
          syncStepToUrl(0);
        } else if (
          errText.includes("CHECKIN_VALIDATION") ||
          errText.includes("violates check constraint")
        ) {
          toast.error(
            "Alguns valores do check-in são inválidos. Volte às perguntas anteriores e confira as respostas.",
          );
        } else if (errText.includes("PROFILE_INCOMPLETE")) {
          toast.error("Complete seu perfil antes de enviar o check-in.");
          onRequireProfile?.();
        } else if (errText.includes("CHECKIN_CREATE_ERROR")) {
          toast.error("Erro ao guardar o check-in. Tente novamente ou contacte seu coach.");
        } else {
          toast.error(errText || "Erro ao enviar check-in. Tente novamente.");
        }
        return;
      }

      toast.success("Check-in enviado com sucesso! Seu coach já pode visualizar suas respostas.");
      clearCheckinDraft(user.id);
      onCheckinSubmitted?.();
      revokeCheckinPhotoDrafts(photoDrafts);
      setPhotoDrafts([]);
      setPesoKg("");
      setFormData(INITIAL_CHECKIN_FORM);
      syncStepToUrl(0);
    } catch (error: unknown) {
      console.error("Erro ao enviar check-in:", error);

      let mensagemErro = "Não foi possível enviar o check-in. Por favor, tente novamente.";

      const err = error as {
        message?: string;
        missing_fields?: string[];
        code?: string;
        status?: number;
      };

      if (err.message && err.message.trim() && !err.message.includes("Failed to fetch")) {
        mensagemErro = err.message.trim();
      } else if (err.status === 401 || err.message?.includes("401") || err.message?.includes("Token")) {
        mensagemErro = "Sua sessão expirou. Por favor, faça login novamente.";
      } else if (err.message?.includes("Failed to fetch") || err.message?.includes("conexão") || err.message?.includes("Erro de conexão")) {
        mensagemErro =
          "Erro de conexão ao enviar fotos ou check-in. Verifique a internet e tente de novo (Wi‑Fi recomendado).";
      }

      const apiMissing = Array.isArray(err.missing_fields) ? err.missing_fields : [];
      if (apiMissing.length > 0) {
        const labels = apiMissing.map((k) => CHECKIN_FIELD_LABELS[k] || k);
        const preview = labels.slice(0, 4).join(", ");
        const extra = labels.length > 4 ? ` e mais ${labels.length - 4}` : "";
        mensagemErro = `Preencha as perguntas em falta: ${preview}${extra}.`;
      } else if (
        err.message?.includes("CHECKIN_MISSING_FIELDS") ||
        err.message?.includes("apetite") ||
        err.code === "23514"
      ) {
        mensagemErro =
          "Por favor, preencha todas as perguntas obrigatórias (opções Sim/Não e listas) antes de enviar.";
      } else if (err.message?.includes("Usuário não autenticado")) {
        mensagemErro = "Sua sessão expirou. Por favor, faça login novamente.";
      } else if (
        err.message?.includes("Aluno não encontrado") ||
        err.message?.includes("ALUNO_NOT_LINKED")
      ) {
        mensagemErro = "Perfil não encontrado. Entre em contato com seu coach.";
      } else if (
        err.message?.includes("foto") ||
        err.message?.includes("imagem") ||
        err.message?.includes("upload") ||
        err.message?.includes("IMAGE_TOO_LARGE")
      ) {
        mensagemErro = err.message.trim();
      } else if (
        err.message?.includes("Erro desconhecido") ||
        !err.message?.trim()
      ) {
        mensagemErro =
          "Falha ao enviar fotos ou check-in. Verifique a internet, feche e abra o app de novo, ou faça login outra vez.";
      }

      toast.error(mensagemErro);
    } finally {
      setLoading(false);
      setSubmitStatus(null);
    }
  };

  const jaEnviouEstaSemana = checkinStreak?.fez_esta_semana === true;
  const proximoEnvio = format(startOfNextCalendarWeek(), "EEEE, d 'de' MMMM", { locale: ptBR });

  const checkinOnboarding = useFeatureOnboarding({
    onboardingId: "checkin-weekly",
    enabled:
      !checkinLoading &&
      !jaEnviouEstaSemana &&
      !loading &&
      !(profileStatus?.hard_gate_active && !profileStatus?.is_complete),
    delayMs: 700,
  });

  if (checkinLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const coachFeedback = (
    <StudentCoachCheckinFeedback compact limit={1} showHistoryAction />
  );

  return (
    <div className="form-checkin space-y-4 md:space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-lg font-bold tracking-tight sm:text-xl">Check-in Semanal</h2>
          <p className="text-sm text-muted-foreground">
            Um envio por semana — peso, fotos (mín. {MIN_CHECKIN_PHOTOS}) e questionário nos blocos
            seguintes
          </p>
        </div>
        {!jaEnviouEstaSemana ? (
          <FeatureOnboardingHelpButton onClick={checkinOnboarding.reopen} />
        ) : null}
      </header>

      {draftRestored && !jaEnviouEstaSemana ? (
        <Alert className="border-primary/40 bg-primary/10 py-3">
          <AlertTitle>Rascunho recuperado</AlertTitle>
          <AlertDescription>
            Continuamos de onde você parou neste aparelho. As fotos precisam ser anexadas de novo
            neste envio.
          </AlertDescription>
        </Alert>
      ) : null}

      {profileStatus && !profileStatus.is_complete && onRequireProfile && (
        <ProfileCompletenessBanner
          status={profileStatus}
          onComplete={onRequireProfile}
          compact={profileStatus.hard_gate_active}
        />
      )}

      {jaEnviouEstaSemana ? (
        <div className="space-y-4">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start">
              <CheckCircle2 className="h-10 w-10 shrink-0 text-primary" aria-hidden />
              <div className="space-y-1">
                <p className="text-lg font-semibold">Check-in desta semana já enviado</p>
                <p className="text-sm text-muted-foreground">
                  Só é possível um check-in por semana. O próximo ficará disponível na{" "}
                  <span className="font-medium text-foreground">{proximoEnvio}</span>.
                </p>
                {checkinStreak && checkinStreak.semanas_consecutivas > 0 && (
                  <p className="pt-1 text-sm text-muted-foreground">
                    Sequência atual: {checkinStreak.semanas_consecutivas}{" "}
                    {checkinStreak.semanas_consecutivas === 1 ? "semana seguida" : "semanas seguidas"}.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          {coachFeedback}
        </div>
      ) : (
      /*
       * Desktop: formulário (tarefa) à esquerda; feedback do coach compacto à direita.
       * Mobile: feedback curto acima, depois os blocos — sem card gigante a empurrar o formulário.
       */
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(16rem,19rem)] md:gap-6">
        <aside className="order-1 min-w-0 md:order-2 md:sticky md:top-3 md:self-start">
          {coachFeedback}
        </aside>
        <div className="order-2 min-w-0 md:order-1">
      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
        <div data-onboarding="checkin-steps">
          <CheckinStepHeader
            step={step}
            completedSections={completedSections}
            hasDraft={hasDraft}
            onSelectStep={(index) => {
              if (index >= 0 && index <= step) syncStepToUrl(index);
            }}
          />
        </div>

        <div
          role="region"
          aria-labelledby={getCheckinSectionTitleId(currentSectionId)}
          aria-describedby={getCheckinSectionDescId(currentSectionId)}
        >
        {currentSectionId === "corpo" && (
          <div data-onboarding="checkin-photos">
            <CheckinPhotosWeightStep
              pesoKg={pesoKg}
              onPesoKgChange={setPesoKg}
              photos={photoDrafts}
              onPhotosChange={setPhotoDrafts}
              disabled={loading}
            />
          </div>
        )}

        {currentSectionId === "nutricao" && (
        <>
        {/* Nutrição e Dieta */}
        <Card>
          <CardHeader>
            <CardTitle>Nutrição e Dieta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>1. Beliscou fora do plano?</Label>
              <RadioGroup
                value={formData.beliscou_fora_plano}
                onValueChange={(value) => setFormData({ ...formData, beliscou_fora_plano: value })}
                required
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="prejudicando" id="beliscou-sim" />
                  <Label htmlFor="beliscou-sim" className="font-normal cursor-pointer">
                    Sim, isso está me prejudicando
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="comprometido" id="beliscou-nao" />
                  <Label htmlFor="beliscou-nao" className="font-normal cursor-pointer">
                    Não, estou 100% comprometido
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>2. Seguiu o plano alimentar (0 a 5)?</Label>
              <RadioGroup
                value={formData.seguiu_plano_nota.toString()}
                onValueChange={(value) => setFormData({ ...formData, seguiu_plano_nota: parseInt(value) })}
                required
              >
                {[1, 2, 3, 4, 5].map((nota) => (
                  <div key={nota} className="flex items-center space-x-2">
                    <RadioGroupItem value={nota.toString()} id={`nota-${nota}`} />
                    <Label htmlFor={`nota-${nota}`} className="font-normal cursor-pointer">
                      Nota {nota}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>3. Apetite</Label>
              <RadioGroup
                value={formData.apetite}
                onValueChange={(value) => setFormData({ ...formData, apetite: value })}
                required
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="alto" id="apetite-alto" />
                  <Label htmlFor="apetite-alto" className="font-normal cursor-pointer">Alto</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="normal" id="apetite-normal" />
                  <Label htmlFor="apetite-normal" className="font-normal cursor-pointer">Normal</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ruim" id="apetite-ruim" />
                  <Label htmlFor="apetite-ruim" className="font-normal cursor-pointer">Ruim</Label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>
        {/* Suplementação — mesmo bloco Nutrição */}
        <Card>
          <CardHeader>
            <CardTitle>Suplementação e Recursos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>7. Seguiu a suplementação e manipulados?</Label>
              <RadioGroup
                value={formData.seguiu_suplementacao}
                onValueChange={(value) => setFormData({ ...formData, seguiu_suplementacao: value })}
                required
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim" id="supl-sim" />
                  <Label htmlFor="supl-sim" className="font-normal cursor-pointer">Sim</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id="supl-nao" />
                  <Label htmlFor="supl-nao" className="font-normal cursor-pointer">Não</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>8. Recursos hormonais</Label>
              <RadioGroup
                value={formData.recursos_hormonais}
                onValueChange={(value) => setFormData({ ...formData, recursos_hormonais: value })}
                required
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim" id="horm-sim" />
                  <Label htmlFor="horm-sim" className="font-normal cursor-pointer">Sim</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id="horm-nao" />
                  <Label htmlFor="horm-nao" className="font-normal cursor-pointer">Não</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao_uso" id="horm-nao-uso" />
                  <Label htmlFor="horm-nao-uso" className="font-normal cursor-pointer">Não uso</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>9. Ingeriu a quantidade mínima de água?</Label>
              <RadioGroup
                value={formData.ingeriu_agua_minima}
                onValueChange={(value) => setFormData({ ...formData, ingeriu_agua_minima: value })}
                required
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim" id="agua-sim" />
                  <Label htmlFor="agua-sim" className="font-normal cursor-pointer">Sim</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id="agua-nao" />
                  <Label htmlFor="agua-nao" className="font-normal cursor-pointer">Não</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>10. Exposição ao sol?</Label>
              <RadioGroup
                value={formData.exposicao_sol}
                onValueChange={(value) => setFormData({ ...formData, exposicao_sol: value })}
                required
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim" id="sol-sim" />
                  <Label htmlFor="sol-sim" className="font-normal cursor-pointer">Sim</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id="sol-nao" />
                  <Label htmlFor="sol-nao" className="font-normal cursor-pointer">Não</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pressao">11. Pressão arterial (opcional)</Label>
              <Textarea
                id="pressao"
                value={formData.pressao_arterial}
                onChange={(e) => setFormData({ ...formData, pressao_arterial: e.target.value })}
                placeholder="Ex: 12/8 em repouso"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="glicemia">12. Glicemia (opcional)</Label>
              <Textarea
                id="glicemia"
                value={formData.glicemia}
                onChange={(e) => setFormData({ ...formData, glicemia: e.target.value })}
                placeholder="Ex: Jejum 85 mg/dL, Pós 110 mg/dL"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
        </>
        )}

        {currentSectionId === "treino" && (
        <>
        <WorkoutEvolutionSection compact />
        <Card>
          <CardHeader>
            <CardTitle>Treino e Exercícios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>4. Treinou todas as sessões da semana?</Label>
              <RadioGroup
                value={formData.treinou_todas_sessoes}
                onValueChange={(value) => setFormData({ ...formData, treinou_todas_sessoes: value })}
                required
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim" id="treinou-sim" />
                  <Label htmlFor="treinou-sim" className="font-normal cursor-pointer">Sim</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id="treinou-nao" />
                  <Label htmlFor="treinou-nao" className="font-normal cursor-pointer">Não</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>5. Tem se desafiado nos treinos?</Label>
              <RadioGroup
                value={formData.desafiou_treinos}
                onValueChange={(value) => setFormData({ ...formData, desafiou_treinos: value })}
                required
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim" id="desafio-sim" />
                  <Label htmlFor="desafio-sim" className="font-normal cursor-pointer">Sim</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id="desafio-nao" />
                  <Label htmlFor="desafio-nao" className="font-normal cursor-pointer">Não</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>6. Fez todo o cardio da semana?</Label>
              <RadioGroup
                value={formData.fez_cardio}
                onValueChange={(value) => setFormData({ ...formData, fez_cardio: value })}
                required
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim" id="cardio-sim" />
                  <Label htmlFor="cardio-sim" className="font-normal cursor-pointer">Sim</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id="cardio-nao" />
                  <Label htmlFor="cardio-nao" className="font-normal cursor-pointer">Não</Label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>
        </>
        )}

        {currentSectionId === "sono" && (
        <Card>
          <CardHeader>
            <CardTitle>Qualidade do Sono</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>13. Média de horas de sono (7 dias)</Label>
              <RadioGroup
                value={formData.media_horas_sono}
                onValueChange={(value) => setFormData({ ...formData, media_horas_sono: value })}
                required
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="4-5" id="sono-4-5" />
                  <Label htmlFor="sono-4-5" className="font-normal cursor-pointer">4 a 5 horas</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="5-6" id="sono-5-6" />
                  <Label htmlFor="sono-5-6" className="font-normal cursor-pointer">5 a 6 horas</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="6-8" id="sono-6-8" />
                  <Label htmlFor="sono-6-8" className="font-normal cursor-pointer">6 a 8 horas</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>14. Dificuldade para adormecer?</Label>
              <RadioGroup
                value={formData.dificuldade_adormecer}
                onValueChange={(value) => setFormData({ ...formData, dificuldade_adormecer: value })}
                required
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim" id="dif-sim" />
                  <Label htmlFor="dif-sim" className="font-normal cursor-pointer">Sim</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id="dif-nao" />
                  <Label htmlFor="dif-nao" className="font-normal cursor-pointer">Não</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="acordou">15. Acordou à noite? Quantas vezes? (opcional)</Label>
              <Textarea
                id="acordou"
                value={formData.acordou_noite}
                onChange={(e) => setFormData({ ...formData, acordou_noite: e.target.value })}
                placeholder="Ex: 2 vezes"
                rows={2}
              />
            </div>

            <div className="space-y-3">
              <Label>21. Higiene do sono</Label>
              <RadioGroup
                value={formData.higiene_sono}
                onValueChange={(value) => setFormData({ ...formData, higiene_sono: value })}
                required
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim" id="higiene-sim" />
                  <Label htmlFor="higiene-sim" className="font-normal cursor-pointer">Sim</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id="higiene-nao" />
                  <Label htmlFor="higiene-nao" className="font-normal cursor-pointer">Não</Label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>
        )}

        {currentSectionId === "bem_estar" && (
        <>
        {/* Mental e Emocional */}
        <Card>
          <CardHeader>
            <CardTitle>Saúde Mental e Emocional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>16. Estresse da semana</Label>
              <RadioGroup
                value={formData.estresse_semana}
                onValueChange={(value) => setFormData({ ...formData, estresse_semana: value })}
                required
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim" id="estresse-sim" />
                  <Label htmlFor="estresse-sim" className="font-normal cursor-pointer">Sim</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id="estresse-nao" />
                  <Label htmlFor="estresse-nao" className="font-normal cursor-pointer">Não</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>17. Lida com desafios e imprevistos</Label>
              <RadioGroup
                value={formData.lida_desafios}
                onValueChange={(value) => setFormData({ ...formData, lida_desafios: value })}
                required
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao_lida_bem" id="desafios-nao" />
                  <Label htmlFor="desafios-nao" className="font-normal cursor-pointer">
                    Não estou lidando bem
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="as_vezes_abate" id="desafios-as-vezes" />
                  <Label htmlFor="desafios-as-vezes" className="font-normal cursor-pointer">
                    Às vezes me abate
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="lida_bem" id="desafios-bem" />
                  <Label htmlFor="desafios-bem" className="font-normal cursor-pointer">
                    Lido bem e de forma positiva
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>18. Convívio familiar</Label>
              <RadioGroup
                value={formData.convivio_familiar}
                onValueChange={(value) => setFormData({ ...formData, convivio_familiar: value })}
                required
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ruim" id="familiar-ruim" />
                  <Label htmlFor="familiar-ruim" className="font-normal cursor-pointer">Ruim</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bom" id="familiar-bom" />
                  <Label htmlFor="familiar-bom" className="font-normal cursor-pointer">Bom</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="otimo" id="familiar-otimo" />
                  <Label htmlFor="familiar-otimo" className="font-normal cursor-pointer">Ótimo</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>19. Convívio no trabalho</Label>
              <RadioGroup
                value={formData.convivio_trabalho}
                onValueChange={(value) => setFormData({ ...formData, convivio_trabalho: value })}
                required
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ruim" id="trabalho-ruim" />
                  <Label htmlFor="trabalho-ruim" className="font-normal cursor-pointer">Ruim</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bom" id="trabalho-bom" />
                  <Label htmlFor="trabalho-bom" className="font-normal cursor-pointer">Bom</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="otimo" id="trabalho-otimo" />
                  <Label htmlFor="trabalho-otimo" className="font-normal cursor-pointer">Ótimo</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>20. Postura frente a problemas</Label>
              <RadioGroup
                value={formData.postura_problemas}
                onValueChange={(value) => setFormData({ ...formData, postura_problemas: value })}
                required
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao_sabe_resolver" id="postura-nao" />
                  <Label htmlFor="postura-nao" className="font-normal cursor-pointer">
                    Não estou sabendo resolver
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="resiliente" id="postura-sim" />
                  <Label htmlFor="postura-sim" className="font-normal cursor-pointer">
                    Resiliente e resolutivo
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>22. Autoestima da semana: {formData.autoestima}</Label>
              <Slider
                value={[formData.autoestima]}
                onValueChange={(value) => setFormData({ ...formData, autoestima: value[0] })}
                min={1}
                max={5}
                step={1}
                className="w-full"
                aria-label="Autoestima da semana, nota de 1 a 5"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 - Muito baixa</span>
                <span>5 - Muito alta</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Saúde Digestiva */}
        <Card>
          <CardHeader>
            <CardTitle>Saúde Digestiva</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>23. Média de evacuações por dia</Label>
              <RadioGroup
                value={formData.media_evacuacoes}
                onValueChange={(value) => setFormData({ ...formData, media_evacuacoes: value })}
                required
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dias_sem" id="evac-dias" />
                  <Label htmlFor="evac-dias" className="font-normal cursor-pointer">
                    Fico dias sem ir
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="1" id="evac-1" />
                  <Label htmlFor="evac-1" className="font-normal cursor-pointer">1 vez</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="2" id="evac-2" />
                  <Label htmlFor="evac-2" className="font-normal cursor-pointer">2 vezes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="3" id="evac-3" />
                  <Label htmlFor="evac-3" className="font-normal cursor-pointer">3 vezes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="mais_4" id="evac-mais" />
                  <Label htmlFor="evac-mais" className="font-normal cursor-pointer">+4 vezes</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>24. Formato das fezes (Escala de Bristol)</Label>
              <div className="my-4 rounded-lg overflow-hidden border">
                <img 
                  src={escalaBristol} 
                  alt="Escala de Bristol - Tipos de fezes de 1 a 7" 
                  className="mx-auto h-auto w-full max-w-md object-contain"
                />
              </div>
              <RadioGroup
                value={formData.formato_fezes}
                onValueChange={(value) => setFormData({ ...formData, formato_fezes: value })}
                required
              >
                {[1, 2, 3, 4, 5, 6, 7].map((tipo) => (
                  <div key={tipo} className="flex items-center space-x-2">
                    <RadioGroupItem value={`tipo${tipo}`} id={`fezes-${tipo}`} />
                    <Label htmlFor={`fezes-${tipo}`} className="font-normal cursor-pointer">
                      Tipo {tipo}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        {/* Observações — opcional */}
        <Card>
          <CardHeader>
            <CardTitle>Observações Finais</CardTitle>
            <CardDescription>Campo opcional. Use só se quiser comentar algo à parte do check-in.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="observacoes">25. O que não cumpriu? Por quê? (opcional)</Label>
              <Textarea
                id="observacoes"
                value={formData.nao_cumpriu_porque}
                onChange={(e) => setFormData({ ...formData, nao_cumpriu_porque: e.target.value })}
                placeholder="Opcional — descreva desafios ou pendências da semana, se desejar"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>
        </>
        )}

        </div>

        {/* Ações no fluxo do documento — NÃO fixed: fixed cobria a resposta do coach (DE gate). */}
        <div
          data-onboarding="checkin-submit"
          className="flex flex-col-reverse gap-2 border-t border-border/50 pt-4 sm:flex-row sm:justify-between"
        >
          {step > 0 ? (
            <Button
              type="button"
              variant="outline"
              className="h-12 min-h-[var(--student-touch-min)]"
              onClick={goPrev}
              disabled={loading}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Anterior
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          {step < CHECKIN_SECTIONS.length - 1 ? (
            <Button
              type="button"
              className="h-12 min-h-[var(--student-touch-min)] sm:ml-auto"
              onClick={goNext}
            >
              Próximo bloco
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <div className="flex w-full flex-col gap-1.5 sm:ml-auto sm:w-auto">
              <Button
                type="submit"
                size="lg"
                className="h-12 min-h-[var(--student-touch-min)] w-full font-semibold"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
                    {submitStatus ?? "Enviando…"}
                  </>
                ) : (
                  "Enviar check-in"
                )}
              </Button>
              {loading && submitStatus ? (
                <p className="text-center text-xs text-muted-foreground sm:text-right" aria-live="polite">
                  {submitStatus}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </form>
        </div>
      </div>
      )}

      <FeatureOnboardingPanel
        open={checkinOnboarding.open}
        title={checkinOnboarding.definition?.title || "Check-in"}
        step={checkinOnboarding.step}
        stepIndex={checkinOnboarding.stepIndex}
        stepCount={checkinOnboarding.definition?.steps.length || 0}
        onNext={checkinOnboarding.next}
        onSkip={checkinOnboarding.skip}
        onDismissPermanently={checkinOnboarding.dismissPermanently}
        onClose={checkinOnboarding.skip}
      />
    </div>
  );
}
