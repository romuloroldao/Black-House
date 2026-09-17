import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Trash2, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isAcceptableImageFile, prepareImageForUpload } from "@/lib/prepare-image-upload";
import {
  CHECKIN_PHOTO_SLOTS,
  MIN_CHECKIN_PHOTOS,
  countFilledCheckinSlots,
  fillCheckinPhotoSlots,
  type CheckinPhotoDraft,
  type CheckinPhotoPose,
} from "@/lib/checkin-weekly-rules";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  pesoKg: string;
  onPesoKgChange: (value: string) => void;
  photos: CheckinPhotoDraft[];
  onPhotosChange: (photos: CheckinPhotoDraft[]) => void;
  disabled?: boolean;
};

function photoForPose(photos: CheckinPhotoDraft[], pose: CheckinPhotoPose): CheckinPhotoDraft | undefined {
  return photos.find((p) => p.descricao === pose);
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
  const slotTargetRef = useRef<CheckinPhotoPose | "auto">("auto");
  const [preparing, setPreparing] = useState(false);

  const filledCount = countFilledCheckinSlots(photos);
  const photosOk = filledCount >= MIN_CHECKIN_PHOTOS;

  const openPicker = (pose: CheckinPhotoPose | "auto", mode: "gallery" | "camera") => {
    if (disabled || preparing) return;
    slotTargetRef.current = pose;
    if (mode === "gallery") galleryInputRef.current?.click();
    else cameraInputRef.current?.click();
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length || disabled) return;
    setPreparing(true);
    const target = slotTargetRef.current;
    try {
      const preparedDrafts: CheckinPhotoDraft[] = [];
      for (const file of Array.from(files)) {
        if (!isAcceptableImageFile(file)) {
          toast.error(`${file.name || "Arquivo"}: use apenas imagens.`);
          continue;
        }
        const prepared = await prepareImageForUpload(file);
        preparedDrafts.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file: prepared,
          previewUrl: URL.createObjectURL(prepared),
        });
      }
      if (!preparedDrafts.length) return;

      if (target !== "auto") {
        const [first, ...rest] = preparedDrafts;
        const previous = photoForPose(photos, target);
        if (previous?.previewUrl) URL.revokeObjectURL(previous.previewUrl);
        for (const extra of rest) {
          if (extra.previewUrl) URL.revokeObjectURL(extra.previewUrl);
        }
        const withoutTarget = photos.filter((p) => p.descricao !== target);
        const nextDraft: CheckinPhotoDraft = { ...first, descricao: target };
        const byPose = new Map(
          withoutTarget
            .filter((p) => p.descricao)
            .map((p) => [p.descricao as CheckinPhotoPose, p]),
        );
        byPose.set(target, nextDraft);
        onPhotosChange(
          CHECKIN_PHOTO_SLOTS.map((s) => byPose.get(s.pose)).filter(
            (d): d is CheckinPhotoDraft => Boolean(d),
          ),
        );
        return;
      }

      onPhotosChange(fillCheckinPhotoSlots(photos, preparedDrafts));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível preparar a foto.");
    } finally {
      setPreparing(false);
      slotTargetRef.current = "auto";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const removePhoto = (pose: CheckinPhotoPose) => {
    const target = photoForPose(photos, pose);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    onPhotosChange(photos.filter((p) => p.descricao !== pose));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Peso e fotos de evolução</CardTitle>
        <CardDescription>
          Tire as fotos nesta ordem. Depois do envio, a plataforma confirma o ângulo
          automaticamente. Mínimo: {MIN_CHECKIN_PHOTOS} fotos (frente e costas).
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
              {filledCount}/{MIN_CHECKIN_PHOTOS} mínimo
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

          <div className="grid grid-cols-2 gap-3">
            {CHECKIN_PHOTO_SLOTS.map((slot) => {
              const draft = photoForPose(photos, slot.pose);
              const filled = Boolean(draft);

              return (
                <div
                  key={slot.pose}
                  className={cn(
                    "relative overflow-hidden rounded-xl border bg-muted/40",
                    filled ? "border-border" : "border-dashed",
                  )}
                >
                  <div className="relative aspect-[3/4]">
                    {filled && draft ? (
                      <>
                        <img
                          src={draft.previewUrl}
                          alt={`${slot.label} — pré-visualização`}
                          className="h-full w-full object-cover"
                        />
                        <Badge className="absolute bottom-2 left-2 bg-background/90 text-foreground">
                          {slot.index + 1} · {slot.label}
                        </Badge>
                        {!slot.required ? (
                          <Badge
                            variant="outline"
                            className="absolute bottom-2 right-10 bg-background/80 text-[10px]"
                          >
                            Opcional
                          </Badge>
                        ) : null}
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          className="absolute right-1 top-1 h-8 w-8 opacity-90"
                          disabled={disabled}
                          onClick={() => removePhoto(slot.pose)}
                          aria-label={`Remover foto ${slot.label}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                          <User className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {slot.index + 1} · {slot.label}
                          {slot.required ? (
                            <span className="text-destructive"> *</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">{slot.hint}</p>
                        <div className="mt-1 flex w-full flex-col gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 w-full text-xs"
                            disabled={disabled || preparing}
                            onClick={() => openPicker(slot.pose, "camera")}
                          >
                            {preparing ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 motion-safe:animate-spin" />
                            ) : (
                              <Camera className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Tirar foto
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-full text-xs"
                            disabled={disabled || preparing}
                            onClick={() => openPicker(slot.pose, "gallery")}
                          >
                            <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
                            Galeria
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={disabled || preparing || filledCount >= CHECKIN_PHOTO_SLOTS.length}
              onClick={() => openPicker("auto", "gallery")}
            >
              {preparing ? (
                <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
              ) : (
                <ImagePlus className="mr-2 h-4 w-4" />
              )}
              Adicionar várias (preenche slots vazios)
            </Button>
          </div>

          {!photosOk ? (
            <p className="text-xs text-muted-foreground">
              Preencha pelo menos Frente e Costas para continuar. Laterais melhoram o
              comparativo, mas são opcionais.
            </p>
          ) : null}
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
