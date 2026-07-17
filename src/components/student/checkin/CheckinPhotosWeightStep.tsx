import { useRef, useState } from "react";
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
import { toast } from "sonner";

type Props = {
  pesoKg: string;
  onPesoKgChange: (value: string) => void;
  photos: CheckinPhotoDraft[];
  onPhotosChange: (photos: CheckinPhotoDraft[]) => void;
  disabled?: boolean;
};

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

  const getDefaultPose = (index: number): CheckinPhotoPose | undefined =>
    CHECKIN_PHOTO_POSES[index] ?? undefined;

  const getPoseLabel = (pose?: CheckinPhotoPose) => {
    if (pose === "frente") return tEvolution("front");
    if (pose === "costas") return tEvolution("back");
    if (pose === "lado_esquerdo") return tEvolution("leftSide");
    if (pose === "lado_direito") return tEvolution("rightSide");
    return tEvolution("untaggedPhoto");
  };

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
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file: prepared,
          previewUrl: URL.createObjectURL(prepared),
          descricao: getDefaultPose(next.length),
        });
      }
      onPhotosChange(next);
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
    onPhotosChange(photos.map((photo) => (photo.id === id ? { ...photo, descricao } : photo)));
  };

  const photosOk = photos.length >= MIN_CHECKIN_PHOTOS;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Peso e fotos de evolução</CardTitle>
        <CardDescription>
          Envie pelo menos {MIN_CHECKIN_PHOTOS} fotos desta semana e informe seu peso atual. As
          fotos só podem ser enviadas aqui, no check-in semanal.
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
