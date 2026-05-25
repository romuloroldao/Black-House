import { Camera, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AlunoHojeFotosEvolucao } from "@/types/aluno-hoje";
import { formatPhotoAgeLabel } from "@/lib/photo-evolution-utils";

type TodayPhotoCardProps = {
  loading?: boolean;
  fotos: AlunoHojeFotosEvolucao | null | undefined;
  onTirarFoto: () => void;
  onVerGaleria: () => void;
};

const TodayPhotoCard = ({ loading, fotos, onTirarFoto, onVerGaleria }: TodayPhotoCardProps) => {
  if (loading) {
    return <Skeleton className="h-28 w-full rounded-xl" />;
  }

  const enviouEstaSemana = fotos?.enviou_esta_semana ?? false;
  const ultimaUrl = fotos?.ultima_url ?? null;
  const statusLabel = enviouEstaSemana
    ? formatPhotoAgeLabel(fotos?.ultima_em ?? null)
    : "Falta a foto desta semana";

  return (
    <Card
      className={cn(
        "overflow-hidden border shadow-card",
        enviouEstaSemana
          ? "border-emerald-500/25 bg-gradient-to-br from-emerald-500/5 to-transparent"
          : "border-primary/30 bg-gradient-to-br from-primary/8 to-transparent",
      )}
    >
      <CardContent className="flex gap-4 p-4">
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border",
            enviouEstaSemana
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-primary/25 bg-primary/10",
          )}
        >
          {ultimaUrl && enviouEstaSemana ? (
            <img
              src={ultimaUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : enviouEstaSemana ? (
            <Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" aria-hidden />
          ) : (
            <Camera className="h-7 w-7 text-primary" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-semibold leading-snug">Foto desta semana</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {enviouEstaSemana
                ? `${statusLabel}. O seu coach vê na sua ficha.`
                : "Uma foto por semana ajuda o coach a ajustar dieta e treino."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!enviouEstaSemana && (
              <Button type="button" size="sm" className="min-h-10" onClick={onTirarFoto}>
                <Camera className="mr-2 h-4 w-4" />
                Tirar foto
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant={enviouEstaSemana ? "default" : "outline"}
              className="min-h-10"
              onClick={enviouEstaSemana ? onTirarFoto : onVerGaleria}
            >
              {enviouEstaSemana ? "Nova foto" : "Ver fotos"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TodayPhotoCard;
