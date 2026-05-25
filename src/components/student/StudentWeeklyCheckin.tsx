import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import escalaBristol from "@/assets/escala-bristol.jpg";

type CheckinFormData = {
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

/** Campos obrigatórios alinhados a POST /api/checkins (server/routes/api.js). */
const CHECKIN_REQUIRED: { key: keyof CheckinFormData; label: string; kind: "choice" | "sim_nao" }[] = [
  { key: "beliscou_fora_plano", label: "Beliscou fora do plano?", kind: "choice" },
  { key: "apetite", label: "Apetite", kind: "choice" },
  { key: "treinou_todas_sessoes", label: "Treinou todas as sessões?", kind: "sim_nao" },
  { key: "desafiou_treinos", label: "Desafiou-se nos treinos?", kind: "sim_nao" },
  { key: "fez_cardio", label: "Fez todo o cardio?", kind: "sim_nao" },
  { key: "seguiu_suplementacao", label: "Seguiu suplementação?", kind: "sim_nao" },
  { key: "recursos_hormonais", label: "Recursos hormonais", kind: "choice" },
  { key: "ingeriu_agua_minima", label: "Ingeriu água mínima?", kind: "sim_nao" },
  { key: "exposicao_sol", label: "Exposição ao sol?", kind: "sim_nao" },
  { key: "media_horas_sono", label: "Média de horas de sono", kind: "choice" },
  { key: "dificuldade_adormecer", label: "Dificuldade para adormecer?", kind: "sim_nao" },
  { key: "estresse_semana", label: "Estresse da semana", kind: "sim_nao" },
  { key: "lida_desafios", label: "Lida com desafios", kind: "choice" },
  { key: "convivio_familiar", label: "Convívio familiar", kind: "choice" },
  { key: "convivio_trabalho", label: "Convívio no trabalho", kind: "choice" },
  { key: "postura_problemas", label: "Postura frente a problemas", kind: "choice" },
  { key: "higiene_sono", label: "Higiene do sono", kind: "sim_nao" },
  { key: "media_evacuacoes", label: "Média de evacuações", kind: "choice" },
  { key: "formato_fezes", label: "Formato das fezes (Bristol)", kind: "choice" },
];

/** Não entram em REQUIRED_CHECKIN no backend — podem ficar em branco. */
const CHECKIN_OPTIONAL_KEYS: (keyof CheckinFormData)[] = [
  "pressao_arterial",
  "glicemia",
  "acordou_noite",
  "nao_cumpriu_porque",
];

const CHECKIN_FIELD_LABELS: Record<string, string> = Object.fromEntries(
  CHECKIN_REQUIRED.map((f) => [f.key, f.label]),
);

function getMissingCheckinFields(data: CheckinFormData): string[] {
  const missing: string[] = [];
  for (const field of CHECKIN_REQUIRED) {
    const value = data[field.key];
    if (field.kind === "sim_nao") {
      if (value !== "sim" && value !== "nao") {
        missing.push(field.label);
      }
    } else if (value === "" || value === null || value === undefined) {
      missing.push(field.label);
    }
  }
  return missing;
}

function optionalCheckinText(value: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildCheckinPayload(data: CheckinFormData) {
  const payload: Record<string, unknown> = {
    beliscou_fora_plano: data.beliscou_fora_plano,
    seguiu_plano_nota: data.seguiu_plano_nota,
    apetite: data.apetite,
    treinou_todas_sessoes: data.treinou_todas_sessoes === "sim",
    desafiou_treinos: data.desafiou_treinos === "sim",
    fez_cardio: data.fez_cardio === "sim",
    seguiu_suplementacao: data.seguiu_suplementacao === "sim",
    recursos_hormonais: data.recursos_hormonais,
    ingeriu_agua_minima: data.ingeriu_agua_minima === "sim",
    exposicao_sol: data.exposicao_sol === "sim",
    media_horas_sono: data.media_horas_sono,
    dificuldade_adormecer: data.dificuldade_adormecer === "sim",
    estresse_semana: data.estresse_semana === "sim",
    lida_desafios: data.lida_desafios,
    convivio_familiar: data.convivio_familiar,
    convivio_trabalho: data.convivio_trabalho,
    postura_problemas: data.postura_problemas,
    higiene_sono: data.higiene_sono === "sim",
    autoestima: data.autoestima,
    media_evacuacoes: data.media_evacuacoes,
    formato_fezes: data.formato_fezes,
  };

  for (const key of CHECKIN_OPTIONAL_KEYS) {
    payload[key] = optionalCheckinText(data[key] as string);
  }

  return payload;
}

export default function StudentWeeklyCheckin() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
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
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const missingLabels = getMissingCheckinFields(formData);
    if (missingLabels.length > 0) {
      const preview = missingLabels.slice(0, 4).join(", ");
      const extra = missingLabels.length > 4 ? ` e mais ${missingLabels.length - 4}` : "";
      toast.error(`Preencha todas as perguntas obrigatórias antes de enviar: ${preview}${extra}.`);
      return;
    }

    setLoading(true);

    try {
      // DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001: Substituir throw por toast + return
      if (!user?.id) {
        toast.error("Usuário não autenticado. Por favor, faça login novamente.");
        setLoading(false);
        return;
      }

      // Usar novo endpoint /api/checkins que valida aluno_id automaticamente
      // DESIGN-VPS-ONLY-CANONICAL-DATA-AND-STORAGE-002
      const response = await apiClient.request('/api/checkins', {
        method: 'POST',
        body: JSON.stringify(buildCheckinPayload(formData)),
      });

      if (response.success) {
        toast.success("Check-in enviado com sucesso! Seu coach já pode visualizar suas respostas.");
      } else {
        // DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001: Substituir throw por toast + return
        toast.error(response.error || "Erro ao enviar check-in. Tente novamente.");
        setLoading(false);
        return;
      }
      
      // Reset form
      setFormData({
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
      });
    } catch (error: any) {
      console.error("Erro ao enviar check-in:", error);

      let mensagemErro = "Não foi possível enviar o check-in. Por favor, tente novamente.";

      const apiMissing = Array.isArray(error?.missing_fields) ? error.missing_fields as string[] : [];
      if (apiMissing.length > 0) {
        const labels = apiMissing.map((k) => CHECKIN_FIELD_LABELS[k] || k);
        const preview = labels.slice(0, 4).join(", ");
        const extra = labels.length > 4 ? ` e mais ${labels.length - 4}` : "";
        mensagemErro = `Preencha as perguntas em falta: ${preview}${extra}.`;
      } else if (
        error.message?.includes("CHECKIN_MISSING_FIELDS") ||
        error.message?.includes("apetite") ||
        error.code === "23514"
      ) {
        mensagemErro = "Por favor, preencha todas as perguntas obrigatórias (opções Sim/Não e listas) antes de enviar.";
      } else if (error.message?.includes("Usuário não autenticado")) {
        mensagemErro = "Sua sessão expirou. Por favor, faça login novamente.";
      } else if (error.message?.includes("Aluno não encontrado") || error.message?.includes("ALUNO_NOT_LINKED")) {
        mensagemErro = "Perfil não encontrado. Entre em contato com seu coach.";
      }

      toast.error(mensagemErro);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Check-in Semanal</h2>
        <p className="text-muted-foreground mt-2">
          Preencha seu check-in semanal para acompanhar seu progresso
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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

        {/* Treino */}
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

        {/* Suplementação */}
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
                  <RadioGroupItem value="sim" id="hormonal-sim" />
                  <Label htmlFor="hormonal-sim" className="font-normal cursor-pointer">Sim</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id="hormonal-nao" />
                  <Label htmlFor="hormonal-nao" className="font-normal cursor-pointer">Não</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao_uso" id="hormonal-nao-uso" />
                  <Label htmlFor="hormonal-nao-uso" className="font-normal cursor-pointer">
                    Não faço uso
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        {/* Hidratação e Sol */}
        <Card>
          <CardHeader>
            <CardTitle>Hidratação e Exposição Solar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>9. Ingeriu água mínima (peso x 0,035)?</Label>
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
              <Label>10. Exposição ao sol 15min/dia?</Label>
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
          </CardContent>
        </Card>

        {/* Saúde Física — campos de texto livre, todos opcionais */}
        <Card>
          <CardHeader>
            <CardTitle>Saúde Física</CardTitle>
            <CardDescription>Preencha apenas se quiser registrar pressão ou glicemia esta semana.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="pressao">11. Pressão arterial (opcional)</Label>
              <Textarea
                id="pressao"
                value={formData.pressao_arterial}
                onChange={(e) => setFormData({ ...formData, pressao_arterial: e.target.value })}
                placeholder="Ex: 120/80"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="glicemia">12. Glicemia em jejum e pós-prandial (opcional)</Label>
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

        {/* Sono */}
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

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
              Enviando...
            </>
          ) : (
            "Enviar Check-in Semanal"
          )}
        </Button>
      </form>
    </div>
  );
}
