import { Skeleton } from "@/components/ui/skeleton";
import { deriveNameHintFromEmail } from "@/lib/aluno-display";
import { cn } from "@/lib/utils";

type TodayHeroCardProps = {
  loading?: boolean;
  aluno?: { nome?: string | null; email?: string | null; objetivo?: string | null } | null;
  pendenciasCount?: number;
  /** Saudação de uma linha para Agent Home (sem card-herói competindo) */
  compact?: boolean;
  className?: string;
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

const TodayHeroCard = ({
  loading,
  aluno,
  pendenciasCount = 0,
  compact = false,
  className,
}: TodayHeroCardProps) => {
  const dateLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const firstName = getFirstName(aluno);

  if (loading) {
    return (
      <div
        className={cn(
          compact ? "space-y-1 py-1" : "space-y-2 rounded-xl border border-border/60 bg-card/50 p-4 sm:p-5",
          className,
        )}
      >
        <Skeleton className={cn(compact ? "h-6 w-40" : "h-8 w-48")} />
        {!compact && <Skeleton className="h-4 w-64 max-w-full" />}
      </div>
    );
  }

  if (compact) {
    const meta =
      pendenciasCount > 0
        ? `${pendenciasCount} pendência${pendenciasCount !== 1 ? "s" : ""}`
        : aluno?.objetivo
          ? aluno.objetivo
          : "Seu plano de hoje está ligado";

    return (
      <header className={cn("min-w-0 py-0.5", className)} aria-label="Saudação">
        <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {getGreeting()}, {firstName}
        </h1>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          <span className="capitalize">{dateLabel}</span>
          <span aria-hidden> · </span>
          {meta}
        </p>
      </header>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-5",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground capitalize">{dateLabel}</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
        {getGreeting()}, {firstName}!
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
