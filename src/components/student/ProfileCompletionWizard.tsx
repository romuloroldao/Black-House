import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DateInputBR } from "@/components/ui/date-input-br";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, UserRound } from "lucide-react";
import { useStudentOverlayLock } from "@/hooks/useStudentOverlayLock";
import type { ProfileCompletenessStatus, ProfileFieldKey } from "@/types/profile-completeness";
import { PROFILE_FIELD_LABELS } from "@/types/profile-completeness";

type FormState = {
  nome: string;
  telefone: string;
  data_nascimento: string;
  sexo: "" | "M" | "F";
  peso_kg: string;
  altura_cm: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: ProfileCompletenessStatus | null;
  initialData?: Partial<FormState & { email?: string }>;
  onCompleted?: () => void;
  forceStep?: number;
};

const STEPS = [
  { title: "Identidade", description: "Como devemos te chamar?" },
  { title: "Contacto", description: "WhatsApp para lembretes importantes" },
  { title: "Dados corporais", description: "Base para o acompanhamento do coach" },
];

function needsStep(field: ProfileFieldKey, missing: ProfileFieldKey[]) {
  return missing.includes(field);
}

export default function ProfileCompletionWizard({
  open,
  onOpenChange,
  status,
  initialData,
  onCompleted,
  forceStep,
}: Props) {
  useStudentOverlayLock(open);
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    nome: "",
    telefone: "",
    data_nascimento: "",
    sexo: "",
    peso_kg: "",
    altura_cm: "",
  });

  const missing = status?.missing_fields ?? [];

  useEffect(() => {
    if (!open) return;
    setForm({
      nome: initialData?.nome ?? "",
      telefone: initialData?.telefone ?? "",
      data_nascimento: initialData?.data_nascimento ?? "",
      sexo: (initialData?.sexo as "" | "M" | "F") ?? "",
      peso_kg: initialData?.peso_kg ?? "",
      altura_cm: initialData?.altura_cm ?? "",
    });
    if (forceStep != null) {
      setStep(forceStep);
    } else if (needsStep("nome", missing)) {
      setStep(0);
    } else if (needsStep("telefone", missing)) {
      setStep(1);
    } else {
      setStep(2);
    }
  }, [open, initialData, missing, forceStep]);

  const pct = status?.completion_pct ?? 0;
  const current = STEPS[step];

  const validateStep = (): boolean => {
    if (step === 0 && !form.nome.trim()) {
      toast.error("Informe seu nome");
      return false;
    }
    if (step === 1) {
      const digits = form.telefone.replace(/\D/g, "");
      if (digits.length < 10) {
        toast.error("Informe um WhatsApp válido");
        return false;
      }
    }
    if (step === 2) {
      if (!form.data_nascimento) {
        toast.error("Informe sua data de nascimento");
        return false;
      }
      if (!form.sexo) {
        toast.error("Selecione o sexo");
        return false;
      }
      const peso = Number(form.peso_kg.replace(",", "."));
      if (!Number.isFinite(peso) || peso < 30 || peso > 350) {
        toast.error("Peso inválido (30–350 kg)");
        return false;
      }
      const altura = Number(form.altura_cm.replace(",", "."));
      if (!Number.isFinite(altura) || altura < 100 || altura > 250) {
        toast.error("Altura inválida (100–250 cm)");
        return false;
      }
    }
    return true;
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        nome: form.nome.trim(),
        telefone: form.telefone.trim(),
        data_nascimento: form.data_nascimento || null,
        sexo: form.sexo || null,
        peso_kg: form.peso_kg.replace(",", "."),
        altura_cm: form.altura_cm.replace(",", "."),
      };
      if (user?.email) payload.email = user.email;

      const result = await apiClient.requestSafe("/api/alunos/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (!result.success) {
        throw new Error(result.error || "Não foi possível salvar");
      }
      toast.success("Perfil atualizado!");
      onCompleted?.();
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (!validateStep()) return;
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      return;
    }
    await saveAll();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
        <div className="bg-primary/5 px-6 pt-6 pb-4">
          <DialogHeader className="text-left space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
              <UserRound className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>{current.title}</DialogTitle>
            <DialogDescription>{current.description}</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Passo {step + 1} de {STEPS.length}</span>
              <span>{pct}% completo</span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          {step === 0 && (
            <div className="space-y-2">
              <Label htmlFor="wizard-nome">Nome completo</Label>
              <Input
                id="wizard-nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                autoFocus
              />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-2">
              <Label htmlFor="wizard-telefone">WhatsApp</Label>
              <Input
                id="wizard-telefone"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
                autoFocus
              />
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Data de nascimento</Label>
                <DateInputBR
                  value={form.data_nascimento}
                  onChange={(v) => setForm({ ...form, data_nascimento: v })}
                />
              </div>
              <div className="space-y-2">
                <Label>Sexo</Label>
                <RadioGroup
                  value={form.sexo}
                  onValueChange={(v) => setForm({ ...form, sexo: v as "M" | "F" })}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="M" id="sexo-m" />
                    <Label htmlFor="sexo-m" className="font-normal">Masculino</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="F" id="sexo-f" />
                    <Label htmlFor="sexo-f" className="font-normal">Feminino</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="wizard-peso">Peso (kg)</Label>
                  <Input
                    id="wizard-peso"
                    inputMode="decimal"
                    value={form.peso_kg}
                    onChange={(e) =>
                      setForm({ ...form, peso_kg: e.target.value.replace(/[^\d,.]/g, "") })
                    }
                    placeholder="82,5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wizard-altura">Altura (cm)</Label>
                  <Input
                    id="wizard-altura"
                    inputMode="numeric"
                    value={form.altura_cm}
                    onChange={(e) =>
                      setForm({ ...form, altura_cm: e.target.value.replace(/[^\d]/g, "") })
                    }
                    placeholder="178"
                  />
                </div>
              </div>
            </div>
          )}

          {missing.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Pendente:{" "}
              {missing.map((f) => PROFILE_FIELD_LABELS[f as ProfileFieldKey] || f).join(", ")}
            </p>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0 || saving}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Voltar
          </Button>
          <Button type="button" onClick={() => void handleNext()} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
                Salvando…
              </>
            ) : step < STEPS.length - 1 ? (
              "Continuar"
            ) : (
              "Concluir perfil"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
