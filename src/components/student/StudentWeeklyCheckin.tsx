import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import escalaBristol from "@/assets/escala-bristol.jpg";
import { trackStudentEvent } from "@/lib/studentAnalytics";

const STORAGE_KEY = "bh_checkin_draft_v1";

const STEPS = [
  { id: "nutricao", title: "Nutrição", description: "Plano alimentar da semana" },
  { id: "treino", title: "Treino", description: "Sessões e cardio" },
  { id: "habitos", title: "Hábitos", description: "Suplementos, água e sol" },
  { id: "bemestar", title: "Bem-estar", description: "Sono, mental e digestão" },
  { id: "resumo", title: "Resumo", description: "Revise e envie" },
] as const;

type FormData = {
  beliscou_fora_plano: string;
  seguiu_plano_nota: number;
  apetite: string;
  treinou_todas_sessoes: string;
  desafiou_treinos: string;
  fez_cardio: string;
  seguiu_suplementacao: string;
  recursos_hormonais: string;
  ingeriu_agua_minima: string;
  exposicao_sol: string;
  pressao_arterial: string;
  glicemia: string;
  media_horas_sono: string;
  dificuldade_adormecer: string;
  acordou_noite: string;
  estresse_semana: string;
  lida_desafios: string;
  convivio_familiar: string;
  convivio_trabalho: string;
  postura_problemas: string;
  higiene_sono: string;
  autoestima: number;
  media_evacuacoes: string;
  formato_fezes: string;
  nao_cumpriu_porque: string;
};

const EMPTY_FORM: FormData = {
  beliscou_fora_plano: "",
  seguiu_plano_nota: 3,
  apetite: "",
  treinou_todas_sessoes: "",
  desafiou_treinos: "",
  fez_cardio: "",
  seguiu_suplementacao: "",
  recursos_hormonais: "",
  ingeriu_agua_minima: "",
  exposicao_sol: "",
  pressao_arterial: "",
  glicemia: "",
  media_horas_sono: "",
  dificuldade_adormecer: "",
  acordou_noite: "",
  estresse_semana: "",
  lida_desafios: "",
  convivio_familiar: "",
  convivio_trabalho: "",
  postura_problemas: "",
  higiene_sono: "",
  autoestima: 3,
  media_evacuacoes: "",
  formato_fezes: "",
  nao_cumpriu_porque: "",
};

function YesNo({
  value,
  onChange,
  name,
}: {
  value: string;
  onChange: (v: string) => void;
  name: string;
}) {
  return (
    <RadioGroup value={value} onValueChange={onChange}>
      <div className="flex items-center space-x-2 min-h-[44px]">
        <RadioGroupItem value="sim" id={`${name}-sim`} />
        <Label htmlFor={`${name}-sim`} className="font-normal cursor-pointer">
          Sim
        </Label>
      </div>
      <div className="flex items-center space-x-2 min-h-[44px]">
        <RadioGroupItem value="nao" id={`${name}-nao`} />
        <Label htmlFor={`${name}-nao`} className="font-normal cursor-pointer">
          Não
        </Label>
      </div>
    </RadioGroup>
  );
}

function loadDraft(): { formData: FormData; step: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.formData) return null;
    return {
      formData: { ...EMPTY_FORM, ...parsed.formData },
      step: typeof parsed.step === "number" ? parsed.step : 0,
    };
  } catch {
    return null;
  }
}

export default function StudentWeeklyCheckin() {
  const draft = loadDraft();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(draft?.step ?? 0);
  const [formData, setFormData] = useState<FormData>(draft?.formData ?? EMPTY_FORM);
  const [pesoKg, setPesoKg] = useState<number | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    trackStudentEvent("checkin_started", { resumed: !!draft });
    return () => {
      if (!submittedRef.current) {
        trackStudentEvent("checkin_abandoned", { step });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) return;
      const { data: aluno } = await supabase
        .from("alunos")
        .select("peso")
        .eq("email", user.email)
        .maybeSingle();
      if (aluno?.peso) setPesoKg(Number(aluno.peso));
    })();
  }, []);

  const persistDraft = useCallback((nextForm: FormData, nextStep: number) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ formData: nextForm, step: nextStep, savedAt: Date.now() })
      );
      setDraftSavedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    } catch {
      /* quota / private mode */
    }
  }, []);

  useEffect(() => {
    persistDraft(formData, step);
  }, [formData, step, persistDraft]);

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const aguaLitros =
    pesoKg != null ? (pesoKg * 0.035).toFixed(1).replace(".", ",") : null;

  const validateStep = (index: number): string | null => {
    if (index === 0) {
      if (!formData.beliscou_fora_plano || !formData.apetite) {
        return "Preencha as perguntas de nutrição para continuar.";
      }
    }
    if (index === 1) {
      if (
        !formData.treinou_todas_sessoes ||
        !formData.desafiou_treinos ||
        !formData.fez_cardio
      ) {
        return "Preencha as perguntas de treino para continuar.";
      }
    }
    if (index === 2) {
      if (
        !formData.seguiu_suplementacao ||
        !formData.recursos_hormonais ||
        !formData.ingeriu_agua_minima ||
        !formData.exposicao_sol
      ) {
        return "Preencha as perguntas de hábitos para continuar.";
      }
    }
    if (index === 3) {
      if (
        !formData.media_horas_sono ||
        !formData.dificuldade_adormecer ||
        !formData.higiene_sono ||
        !formData.estresse_semana ||
        !formData.lida_desafios ||
        !formData.convivio_familiar ||
        !formData.convivio_trabalho ||
        !formData.postura_problemas ||
        !formData.media_evacuacoes ||
        !formData.formato_fezes
      ) {
        return "Preencha as perguntas obrigatórias de bem-estar para continuar.";
      }
    }
    return null;
  };

  const goNext = () => {
    const error = validateStep(step);
    if (error) {
      toast.error(error);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    const error = validateStep(3);
    if (error) {
      toast.error(error);
      setStep(3);
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: aluno } = await supabase
        .from("alunos")
        .select("id")
        .eq("email", user.email)
        .single();

      if (!aluno) throw new Error("Aluno não encontrado");

      const { error: insertError } = await supabase.from("weekly_checkins").insert({
        aluno_id: aluno.id,
        beliscou_fora_plano: formData.beliscou_fora_plano,
        seguiu_plano_nota: formData.seguiu_plano_nota,
        apetite: formData.apetite,
        treinou_todas_sessoes: formData.treinou_todas_sessoes === "sim",
        desafiou_treinos: formData.desafiou_treinos === "sim",
        fez_cardio: formData.fez_cardio === "sim",
        seguiu_suplementacao: formData.seguiu_suplementacao === "sim",
        recursos_hormonais: formData.recursos_hormonais,
        ingeriu_agua_minima: formData.ingeriu_agua_minima === "sim",
        exposicao_sol: formData.exposicao_sol === "sim",
        pressao_arterial: formData.pressao_arterial || null,
        glicemia: formData.glicemia || null,
        media_horas_sono: formData.media_horas_sono,
        dificuldade_adormecer: formData.dificuldade_adormecer === "sim",
        acordou_noite: formData.acordou_noite || null,
        estresse_semana: formData.estresse_semana === "sim",
        lida_desafios: formData.lida_desafios,
        convivio_familiar: formData.convivio_familiar,
        convivio_trabalho: formData.convivio_trabalho,
        postura_problemas: formData.postura_problemas,
        higiene_sono: formData.higiene_sono === "sim",
        autoestima: formData.autoestima,
        media_evacuacoes: formData.media_evacuacoes,
        formato_fezes: formData.formato_fezes,
        nao_cumpriu_porque: formData.nao_cumpriu_porque || null,
      });

      if (insertError) throw insertError;

      submittedRef.current = true;
      trackStudentEvent("checkin_submitted", { steps: STEPS.length });
      localStorage.removeItem(STORAGE_KEY);
      setFormData(EMPTY_FORM);
      setStep(0);
      toast.success(
        "Check-in enviado com sucesso! Seu coach já pode visualizar suas respostas."
      );
    } catch (err: any) {
      console.error("Erro ao enviar check-in:", err);
      let mensagemErro =
        "Não foi possível enviar o check-in. Por favor, tente novamente.";
      if (err.message?.includes("apetite") || err.code === "23514") {
        mensagemErro =
          "Por favor, preencha todos os campos obrigatórios antes de enviar.";
      } else if (err.message?.includes("Usuário não autenticado")) {
        mensagemErro = "Sua sessão expirou. Por favor, faça login novamente.";
      } else if (err.message?.includes("Aluno não encontrado")) {
        mensagemErro = "Perfil não encontrado. Entre em contato com seu coach.";
      }
      toast.error(mensagemErro);
    } finally {
      setLoading(false);
    }
  };

  const progressPct = ((step + 1) / STEPS.length) * 100;
  const current = STEPS[step];

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Check-in Semanal
        </h2>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Passo {step + 1} de {STEPS.length}: {current.title}
        </p>
        {draftSavedAt && (
          <p className="text-xs text-muted-foreground mt-1">
            Rascunho salvo às {draftSavedAt}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Progress value={progressPct} className="h-2" />
        <div className="flex justify-between gap-1 text-[10px] sm:text-xs text-muted-foreground">
          {STEPS.map((s, i) => (
            <span
              key={s.id}
              className={i === step ? "text-primary font-medium" : undefined}
            >
              {s.title}
            </span>
          ))}
        </div>
      </div>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Nutrição e Dieta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>1. Beliscou fora do plano?</Label>
              <RadioGroup
                value={formData.beliscou_fora_plano}
                onValueChange={(v) => setField("beliscou_fora_plano", v)}
              >
                <div className="flex items-center space-x-2 min-h-[44px]">
                  <RadioGroupItem value="prejudicando" id="beliscou-sim" />
                  <Label htmlFor="beliscou-sim" className="font-normal cursor-pointer">
                    Sim, isso está me prejudicando
                  </Label>
                </div>
                <div className="flex items-center space-x-2 min-h-[44px]">
                  <RadioGroupItem value="comprometido" id="beliscou-nao" />
                  <Label htmlFor="beliscou-nao" className="font-normal cursor-pointer">
                    Não, estou 100% comprometido
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>2. Seguiu o plano alimentar (1 a 5)?</Label>
              <RadioGroup
                value={formData.seguiu_plano_nota.toString()}
                onValueChange={(v) => setField("seguiu_plano_nota", parseInt(v))}
              >
                {[1, 2, 3, 4, 5].map((nota) => (
                  <div key={nota} className="flex items-center space-x-2 min-h-[44px]">
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
                onValueChange={(v) => setField("apetite", v)}
              >
                {(["alto", "normal", "ruim"] as const).map((opt) => (
                  <div key={opt} className="flex items-center space-x-2 min-h-[44px]">
                    <RadioGroupItem value={opt} id={`apetite-${opt}`} />
                    <Label
                      htmlFor={`apetite-${opt}`}
                      className="font-normal cursor-pointer capitalize"
                    >
                      {opt}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Treino e Exercícios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>4. Treinou todas as sessões da semana?</Label>
              <YesNo
                name="treinou"
                value={formData.treinou_todas_sessoes}
                onChange={(v) => setField("treinou_todas_sessoes", v)}
              />
            </div>
            <div className="space-y-3">
              <Label>5. Tem se desafiado nos treinos?</Label>
              <YesNo
                name="desafio"
                value={formData.desafiou_treinos}
                onChange={(v) => setField("desafiou_treinos", v)}
              />
            </div>
            <div className="space-y-3">
              <Label>6. Fez todo o cardio da semana?</Label>
              <YesNo
                name="cardio"
                value={formData.fez_cardio}
                onChange={(v) => setField("fez_cardio", v)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Hábitos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>7. Seguiu a suplementação e manipulados?</Label>
              <YesNo
                name="supl"
                value={formData.seguiu_suplementacao}
                onChange={(v) => setField("seguiu_suplementacao", v)}
              />
            </div>
            <div className="space-y-3">
              <Label>8. Recursos hormonais</Label>
              <RadioGroup
                value={formData.recursos_hormonais}
                onValueChange={(v) => setField("recursos_hormonais", v)}
              >
                <div className="flex items-center space-x-2 min-h-[44px]">
                  <RadioGroupItem value="sim" id="hormonal-sim" />
                  <Label htmlFor="hormonal-sim" className="font-normal cursor-pointer">
                    Sim
                  </Label>
                </div>
                <div className="flex items-center space-x-2 min-h-[44px]">
                  <RadioGroupItem value="nao" id="hormonal-nao" />
                  <Label htmlFor="hormonal-nao" className="font-normal cursor-pointer">
                    Não
                  </Label>
                </div>
                <div className="flex items-center space-x-2 min-h-[44px]">
                  <RadioGroupItem value="nao_uso" id="hormonal-nao-uso" />
                  <Label htmlFor="hormonal-nao-uso" className="font-normal cursor-pointer">
                    Não faço uso
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-3">
              <Label>
                9. Ingeriu a água mínima
                {aguaLitros
                  ? ` (meta ≈ ${aguaLitros} L — peso × 0,035)?`
                  : " (peso × 0,035)?"}
              </Label>
              <YesNo
                name="agua"
                value={formData.ingeriu_agua_minima}
                onChange={(v) => setField("ingeriu_agua_minima", v)}
              />
            </div>
            <div className="space-y-3">
              <Label>10. Exposição ao sol 15 min/dia?</Label>
              <YesNo
                name="sol"
                value={formData.exposicao_sol}
                onChange={(v) => setField("exposicao_sol", v)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Saúde física (opcional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pressao">11. Pressão arterial</Label>
                <Textarea
                  id="pressao"
                  value={formData.pressao_arterial}
                  onChange={(e) => setField("pressao_arterial", e.target.value)}
                  placeholder="Ex: 120/80"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="glicemia">12. Glicemia (jejum e pós-prandial)</Label>
                <Textarea
                  id="glicemia"
                  value={formData.glicemia}
                  onChange={(e) => setField("glicemia", e.target.value)}
                  placeholder="Ex: Jejum 85 mg/dL, Pós 110 mg/dL"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sono</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>13. Média de horas de sono (7 dias)</Label>
                <RadioGroup
                  value={formData.media_horas_sono}
                  onValueChange={(v) => setField("media_horas_sono", v)}
                >
                  {[
                    ["4-5", "4 a 5 horas"],
                    ["5-6", "5 a 6 horas"],
                    ["6-8", "6 a 8 horas"],
                  ].map(([val, label]) => (
                    <div key={val} className="flex items-center space-x-2 min-h-[44px]">
                      <RadioGroupItem value={val} id={`sono-${val}`} />
                      <Label htmlFor={`sono-${val}`} className="font-normal cursor-pointer">
                        {label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div className="space-y-3">
                <Label>14. Dificuldade para adormecer?</Label>
                <YesNo
                  name="dif"
                  value={formData.dificuldade_adormecer}
                  onChange={(v) => setField("dificuldade_adormecer", v)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acordou">15. Acordou à noite? Quantas vezes?</Label>
                <Textarea
                  id="acordou"
                  value={formData.acordou_noite}
                  onChange={(e) => setField("acordou_noite", e.target.value)}
                  placeholder="Ex: 2 vezes"
                  rows={2}
                />
              </div>
              <div className="space-y-3">
                <Label>16. Higiene do sono</Label>
                <YesNo
                  name="higiene"
                  value={formData.higiene_sono}
                  onChange={(v) => setField("higiene_sono", v)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mental e emocional</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>17. Teve estresse esta semana?</Label>
                <YesNo
                  name="estresse"
                  value={formData.estresse_semana}
                  onChange={(v) => setField("estresse_semana", v)}
                />
              </div>
              <div className="space-y-3">
                <Label>18. Lida com desafios e imprevistos</Label>
                <RadioGroup
                  value={formData.lida_desafios}
                  onValueChange={(v) => setField("lida_desafios", v)}
                >
                  <div className="flex items-center space-x-2 min-h-[44px]">
                    <RadioGroupItem value="nao_lida_bem" id="desafios-nao" />
                    <Label htmlFor="desafios-nao" className="font-normal cursor-pointer">
                      Não estou lidando bem
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 min-h-[44px]">
                    <RadioGroupItem value="as_vezes_abate" id="desafios-as-vezes" />
                    <Label htmlFor="desafios-as-vezes" className="font-normal cursor-pointer">
                      Às vezes me abate
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 min-h-[44px]">
                    <RadioGroupItem value="lida_bem" id="desafios-bem" />
                    <Label htmlFor="desafios-bem" className="font-normal cursor-pointer">
                      Lido bem e de forma positiva
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-3">
                <Label>19. Convívio familiar</Label>
                <RadioGroup
                  value={formData.convivio_familiar}
                  onValueChange={(v) => setField("convivio_familiar", v)}
                >
                  {(["ruim", "bom", "otimo"] as const).map((opt) => (
                    <div key={opt} className="flex items-center space-x-2 min-h-[44px]">
                      <RadioGroupItem value={opt} id={`familiar-${opt}`} />
                      <Label
                        htmlFor={`familiar-${opt}`}
                        className="font-normal cursor-pointer capitalize"
                      >
                        {opt === "otimo" ? "Ótimo" : opt}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div className="space-y-3">
                <Label>20. Convívio no trabalho</Label>
                <RadioGroup
                  value={formData.convivio_trabalho}
                  onValueChange={(v) => setField("convivio_trabalho", v)}
                >
                  {(["ruim", "bom", "otimo"] as const).map((opt) => (
                    <div key={opt} className="flex items-center space-x-2 min-h-[44px]">
                      <RadioGroupItem value={opt} id={`trabalho-${opt}`} />
                      <Label
                        htmlFor={`trabalho-${opt}`}
                        className="font-normal cursor-pointer capitalize"
                      >
                        {opt === "otimo" ? "Ótimo" : opt}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div className="space-y-3">
                <Label>21. Postura frente a problemas</Label>
                <RadioGroup
                  value={formData.postura_problemas}
                  onValueChange={(v) => setField("postura_problemas", v)}
                >
                  <div className="flex items-center space-x-2 min-h-[44px]">
                    <RadioGroupItem value="nao_sabe_resolver" id="postura-nao" />
                    <Label htmlFor="postura-nao" className="font-normal cursor-pointer">
                      Não estou sabendo resolver
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 min-h-[44px]">
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
                  onValueChange={(v) => setField("autoestima", v[0])}
                  min={1}
                  max={5}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 — Muito baixa</span>
                  <span>5 — Muito alta</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Saúde digestiva</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>23. Média de evacuações por dia</Label>
                <RadioGroup
                  value={formData.media_evacuacoes}
                  onValueChange={(v) => setField("media_evacuacoes", v)}
                >
                  {[
                    ["dias_sem", "Fico dias sem ir"],
                    ["1", "1 vez"],
                    ["2", "2 vezes"],
                    ["3", "3 vezes"],
                    ["mais_4", "+4 vezes"],
                  ].map(([val, label]) => (
                    <div key={val} className="flex items-center space-x-2 min-h-[44px]">
                      <RadioGroupItem value={val} id={`evac-${val}`} />
                      <Label htmlFor={`evac-${val}`} className="font-normal cursor-pointer">
                        {label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div className="space-y-3">
                <Label>24. Formato das fezes (Escala de Bristol)</Label>
                <div className="my-4 rounded-lg overflow-hidden border">
                  <img
                    src={escalaBristol}
                    alt="Escala de Bristol — tipos de fezes de 1 a 7"
                    className="w-full max-w-md mx-auto"
                  />
                </div>
                <RadioGroup
                  value={formData.formato_fezes}
                  onValueChange={(v) => setField("formato_fezes", v)}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((tipo) => (
                    <div key={tipo} className="flex items-center space-x-2 min-h-[44px]">
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
        </div>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Resumo e envio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li>
                Nutrição: nota {formData.seguiu_plano_nota}/5 · apetite{" "}
                {formData.apetite || "—"}
              </li>
              <li>
                Treino completo:{" "}
                {formData.treinou_todas_sessoes === "sim" ? "sim" : "não"} · cardio:{" "}
                {formData.fez_cardio === "sim" ? "sim" : "não"}
              </li>
              <li>
                Água mínima:{" "}
                {formData.ingeriu_agua_minima === "sim" ? "sim" : "não"}
                {aguaLitros ? ` (meta ${aguaLitros} L)` : ""}
              </li>
              <li>Sono: {formData.media_horas_sono || "—"} · autoestima {formData.autoestima}/5</li>
            </ul>
            <div className="space-y-2">
              <Label htmlFor="observacoes">25. O que não cumpriu? Por quê? (opcional)</Label>
              <Textarea
                id="observacoes"
                value={formData.nao_cumpriu_porque}
                onChange={(e) => setField("nao_cumpriu_porque", e.target.value)}
                placeholder="Descreva os desafios enfrentados durante a semana..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 sticky bottom-20 md:bottom-4 bg-background/95 py-3 border-t border-border -mx-1 px-1">
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] flex-1"
          onClick={goBack}
          disabled={step === 0 || loading}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            className="min-h-[44px] flex-1"
            onClick={goNext}
          >
            Continuar
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            type="button"
            className="min-h-[44px] flex-1"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar check-in"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
