import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, Utensils, Dumbbell, MessageCircle } from "lucide-react";

const STORAGE_KEY = "bh-student-onboarding-v1";

export function isStudentOnboardingDone(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markStudentOnboardingDone(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

const STEPS = [
  {
    title: "O seu dia num só lugar",
    description:
      "No ecrã Hoje vê treino, dieta, pendências e o countdown do retorno. É a página inicial ao entrar.",
    icon: Calendar,
  },
  {
    title: "Dieta e treino no telemóvel",
    description:
      "Marque refeições concluídas, alterne Plano A/B e inicie a sessão de treino com timer de descanso.",
    icon: Utensils,
  },
  {
    title: "Coach e check-in semanal",
    description:
      "Chat e avisos ficam em Coach. O check-in em 4 blocos mantém a sua sequência de semanas.",
    icon: MessageCircle,
  },
] as const;

type StudentOnboardingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const StudentOnboardingDialog = ({ open, onOpenChange }: StudentOnboardingDialogProps) => {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = step === 1 ? Dumbbell : step === 0 ? Calendar : MessageCircle;

  const finish = () => {
    markStudentOnboardingDone();
    onOpenChange(false);
    setStep(0);
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else finish();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border/80">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15">
              <Icon className="h-5 w-5 text-primary" aria-hidden />
            </span>
            {current.title}
          </DialogTitle>
          <DialogDescription className="text-left pt-1">{current.description}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1.5 py-2" aria-hidden>
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors motion-reduce:transition-none ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" className="min-h-11" onClick={finish}>
            Saltar
          </Button>
          <Button type="button" className="min-h-11" onClick={handleNext}>
            {step < STEPS.length - 1 ? "Seguinte" : "Começar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StudentOnboardingDialog;
