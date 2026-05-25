import { Skeleton } from "@/components/ui/skeleton";
import { deriveNameHintFromEmail } from "@/lib/aluno-display";

type TodayHeroCardProps = {
  loading?: boolean;
  aluno?: { nome?: string | null; email?: string | null; objetivo?: string | null } | null;
  pendenciasCount?: number;
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function getFirstName(aluno: TodayHeroCardProps["aluno"]): string {
  const nome = aluno?.nome != null ? String(aluno.nome).trim() : "";
  if (nome) return nome.split(/\s+/)[0] || "atleta";
  return deriveNameHintFromEmail(aluno?.email) || "atleta";
}

const TodayHeroCard = ({ loading, aluno, pendenciasCount = 0 }: TodayHeroCardProps) => {
  const dateLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (loading) {
    return (
      <div className="space-y-2 rounded-xl border border-border/60 bg-card/50 p-4 sm:p-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-5">
      <p className="text-sm text-muted-foreground capitalize">{dateLabel}</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
        {getGreeting()}, {getFirstName(aluno)}!
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {pendenciasCount > 0
          ? `Você tem ${pendenciasCount} pendência${pendenciasCount !== 1 ? "s" : ""} para hoje.`
          : aluno?.objetivo
            ? `Foco: ${aluno.objetivo}`
            : "Seu plano de hoje está pronto abaixo."}
      </p>
    </div>
  );
};

export default TodayHeroCard;
