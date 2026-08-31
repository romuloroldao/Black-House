import { useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { tEvolution } from "@/i18n/evolution-photos";
import { isAcceptableImageFile, prepareImageForUpload } from "@/lib/prepare-image-upload";
import {
  CHECKIN_PHOTO_POSES,
  type CheckinPhotoPose,
  MIN_CHECKIN_PHOTOS,
  type CheckinPhotoDraft,
} from "@/lib/checkin-weekly-rules";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

type Props = {
  pesoKg: string;
  onPesoKgChange: (value: string) => void;
  photos: CheckinPhotoDraft[];
  onPhotosChange: (photos: CheckinPhotoDraft[]) => void;
  disabled?: boolean;
};

function isKnownPose(value: string | undefined | null): value is CheckinPhotoPose {
  return CHECKIN_PHOTO_POSES.includes(value as CheckinPhotoPose);
}

/** Duplicatas de frente/costas (erro crítico para comparação). */
export function findCriticalPoseDuplicates(photos: CheckinPhotoDraft[]): CheckinPhotoPose[] {
  const counts = new Map<CheckinPhotoPose, number>();
  for (const p of photos) {
    if (!p.descricao || !isKnownPose(p.descricao)) continue;
    if (p.descricao !== "frente" && p.descricao !== "costas") continue;
    counts.set(p.descricao, (counts.get(p.descricao) || 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n > 1).map(([pose]) => pose);
}

export default function CheckinPhotosWeightStep({
  pesoKg,
  onPesoKgChange,
  photos,
  onPhotosChange,
  disabled = false,
}: Props) {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);

  const getPoseLabel = (pose?: CheckinPhotoPose) => {
    if (pose === "frente") return tEvolution("front");
    if (pose === "costas") return tEvolution("back");
    if (pose === "lado_esquerdo") return tEvolution("leftSide");
    if (pose === "lado_direito") return tEvolution("rightSide");
    return tEvolution("untaggedPhoto");
  };

  const criticalDuplicates = useMemo(() => findCriticalPoseDuplicates(photos), [photos]);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length || disabled) return;
    setPreparing(true);
    try {
      const next = [...photos];
      for (const file of Array.from(files)) {
        if (!isAcceptableImageFile(file)) {
          toast.error(`${file.name || "Arquivo"}: use apenas imagens.`);
          continue;
        }
        const prepared = await prepareImageForUpload(file);
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        let descricao: CheckinPhotoPose | undefined;

        // Classificar pela imagem (não pela ordem do upload)
        const classified = await apiClient.classifyProgressPhotoPoseSafe({ file: prepared });
        if (classified.success && isKnownPose(classified.data?.pose)) {
          descricao = classified.data.pose;
        } else if (classified.success && classified.data?.pose === "incerto") {
          toast.message("Não identificámos o ângulo desta foto — escolha Frente/Costas manualmente.");
        } else if (!classified.success) {
          toast.message("Não foi possível detectar o ângulo automaticamente — escolha manualmente.");
        }

        next.push({
          id,
          file: prepared,
          previewUrl: URL.createObjectURL(prepared),
          descricao,
        });
      }
      onPhotosChange(next);
      const dups = findCriticalPoseDuplicates(next);
      if (dups.length) {
        toast.warning(
          `Há mais de uma foto de ${dups.map(getPoseLabel).join(" e ")}. Ajuste os ângulos antes de enviar.`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível preparar a foto.");
    } finally {
      setPreparing(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const removePhoto = (id: string) => {
    const target = photos.find((p) => p.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    onPhotosChange(photos.filter((p) => p.id !== id));
  };

  const updatePhotoPose = (id: string, descricao: CheckinPhotoPose) => {
    const next = photos.map((photo) => (photo.id === id ? { ...photo, descricao } : photo));
    onPhotosChange(next);
    const dups = findCriticalPoseDuplicates(next);
    if (dups.length) {
      toast.warning(
        `Há mais de uma foto de ${dups.map(getPoseLabel).join(" e ")}. Ajuste antes de enviar.`,
      );
    }
  };

  const photosOk = photos.length >= MIN_CHECKIN_PHOTOS && criticalDuplicates.length === 0;
  const untagged = photos.filter((p) => !p.descricao).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Peso e fotos de evolução</CardTitle>
        <CardDescription>
          Envie pelo menos {MIN_CHECKIN_PHOTOS} fotos desta semana e informe seu peso atual. O
          sistema tenta identificar Frente/Costas pela imagem — confirme o ângulo em cada foto.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="checkin-peso">
            Peso atual (kg) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="checkin-peso"
            type="text"
            inputMode="decimal"
            placeholder="Ex: 82,5"
            value={pesoKg}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d,.]/g, "");
              onPesoKgChange(v);
            }}
            disabled={disabled}
            className="max-w-[200px]"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Use vírgula ou ponto (ex: 72,4). Valores entre 30 e 350 kg.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>
              Fotos desta semana <span className="text-destructive">*</span>
            </Label>
            <Badge variant={photosOk ? "secondary" : "outline"} className="student-badge-sm">
              {photos.length}/{MIN_CHECKIN_PHOTOS} mínimo
            </Badge>
          </div>

          {criticalDuplicates.length > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Ângulos duplicados: {criticalDuplicates.map(getPoseLabel).join(", ")}. Corrija para
              comparar corretamente depois.
            </p>
          )}
          {untagged > 0 && (
            <p className="text-sm text-muted-foreground">
              {untagged} foto(s) sem ângulo — escolha Frente/Costas/Lado em cada uma.
            </p>
          )}

          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={disabled || preparing}
            onChange={(e) => void addFiles(e.target.files)}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={disabled || preparing}
            onChange={(e) => void addFiles(e.target.files)}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={disabled || preparing}
              onClick={() => galleryInputRef.current?.click()}
            >
              {preparing ? (
                <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
              ) : (
                <ImagePlus className="mr-2 h-4 w-4" />
              )}
              Adicionar fotos
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={disabled || preparing}
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="mr-2 h-4 w-4" />
              Tirar foto
            </Button>
          </div>

          {photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((p, index) => (
                <div
                  key={p.id}
                  className="group relative overflow-hidden rounded-lg border bg-muted"
                >
                  <div className="relative aspect-[3/4]">
                    <img
                      src={p.previewUrl}
                      alt={`${getPoseLabel(p.descricao)} - Pré-visualização`}
                      className="h-full w-full object-cover"
                    />
                    <Badge className="absolute bottom-2 left-2 bg-background/85 text-foreground">
                      {getPoseLabel(p.descricao) || `${tEvolution("photoNumber")} ${index + 1}`}
                    </Badge>
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="absolute right-1 top-1 h-8 w-8 opacity-90"
                      disabled={disabled}
                      onClick={() => removePhoto(p.id)}
                      aria-label="Remover foto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="p-2">
                    <Label className="sr-only" htmlFor={`pose-${p.id}`}>
                      Posição da foto {index + 1}
                    </Label>
                    <Select
                      value={p.descricao || ""}
                      onValueChange={(value) => updatePhotoPose(p.id, value as CheckinPhotoPose)}
                      disabled={disabled}
                    >
                      <SelectTrigger id={`pose-${p.id}`} className="h-9">
                        <SelectValue placeholder="Posição" />
                      </SelectTrigger>
                      <SelectContent>
                        {CHECKIN_PHOTO_POSES.map((pose) => (
                          <SelectItem key={pose} value={pose}>
                            {getPoseLabel(pose)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              <Camera className="h-8 w-8 opacity-50" />
              <p>Adicione {MIN_CHECKIN_PHOTOS} ou mais fotos para continuar.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function revokeCheckinPhotoDrafts(photos: CheckinPhotoDraft[]) {
  for (const p of photos) {
    if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
  }
}
