import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, ImageIcon, Loader2, Upload } from "lucide-react";
import { CHECKIN_PHOTO_POSES, type CheckinPhotoPose } from "@/lib/checkin-weekly-rules";
import { tEvolution } from "@/i18n/evolution-photos";

type ProgressPhotoUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
  uploading: boolean;
  preparingImage: boolean;
  selectedFile: File | null;
  previewUrl: string | null;
  descricao: string;
  onDescricaoChange: (value: string) => void;
  /** Ângulo normalizado (frente/costas/lados) — preferido à descrição livre. */
  pose?: CheckinPhotoPose | "";
  onPoseChange?: (value: CheckinPhotoPose | "") => void;
  classifyingPose?: boolean;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onCancel: () => void;
};

function poseLabel(pose: CheckinPhotoPose) {
  if (pose === "frente") return tEvolution("front");
  if (pose === "costas") return tEvolution("back");
  if (pose === "lado_esquerdo") return tEvolution("leftSide");
  return tEvolution("rightSide");
}

/**
 * Diálogo de upload de foto de evolução.
 * Espera que o parent use `prepareAndClassifyProgressPhoto` no `onFileSelect`.
 */
const ProgressPhotoUploadDialog = ({
  open,
  onOpenChange,
  uploading,
  preparingImage,
  classifyingPose = false,
  selectedFile,
  previewUrl,
  descricao,
  onDescricaoChange,
  pose = "",
  onPoseChange,
  onFileSelect,
  onUpload,
  onCancel,
  trigger,
}: ProgressPhotoUploadDialogProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraBackInputRef = useRef<HTMLInputElement>(null);
  const cameraFrontInputRef = useRef<HTMLInputElement>(null);

  const busy = uploading || preparingImage || classifyingPose;

  const handleOpenChange = (next: boolean) => {
    if (busy) return;
    onOpenChange(next);
    if (!next) onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar foto de evolução</DialogTitle>
          <DialogDescription>
            No telemóvel, «Tirar foto» abre a câmera. A imagem é comprimida e o ângulo é
            identificado automaticamente (pode ajustar manualmente).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Foto</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onFileSelect}
              className="hidden"
            />
            <input
              ref={cameraBackInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFileSelect}
              className="hidden"
            />
            <input
              ref={cameraFrontInputRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={onFileSelect}
              className="hidden"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button
                type="button"
                variant="outline"
                className="w-full min-h-11"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="h-4 w-4 mr-2 shrink-0" />
                Galeria
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full min-h-11"
                disabled={busy}
                onClick={() => cameraBackInputRef.current?.click()}
              >
                <Camera className="h-4 w-4 mr-2 shrink-0" />
                Tirar foto
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full min-h-11"
                disabled={busy}
                onClick={() => cameraFrontInputRef.current?.click()}
              >
                <Camera className="h-4 w-4 mr-2 shrink-0" />
                Selfie
              </Button>
            </div>
            {(preparingImage || classifyingPose) && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 motion-safe:animate-spin" />
                {classifyingPose ? "A identificar ângulo…" : "A preparar imagem…"}
              </p>
            )}
            {previewUrl && !preparingImage && (
              <div className="overflow-hidden rounded-lg border bg-muted/30">
                <img
                  src={previewUrl}
                  alt="Pré-visualização da foto"
                  className="max-h-48 w-full object-contain"
                />
              </div>
            )}
          </div>

          {onPoseChange ? (
            <div className="space-y-2">
              <Label htmlFor="pose-foto">{tEvolution("pose")}</Label>
              <Select
                value={pose || undefined}
                onValueChange={(v) => onPoseChange(v as CheckinPhotoPose)}
                disabled={busy}
              >
                <SelectTrigger id="pose-foto" className="h-11">
                  <SelectValue placeholder={tEvolution("setPose")} />
                </SelectTrigger>
                <SelectContent>
                  {CHECKIN_PHOTO_POSES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {poseLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="descricao-foto">Nota (opcional)</Label>
            <Textarea
              id="descricao-foto"
              placeholder="Ex.: Semana 12 — após ajuste na dieta"
              value={descricao}
              onChange={(e) => onDescricaoChange(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!selectedFile || busy}
            onClick={onUpload}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 motion-safe:animate-spin" />
                A enviar…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Enviar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProgressPhotoUploadDialog;
