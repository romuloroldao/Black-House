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
import { Camera, ImageIcon, Loader2, Upload } from "lucide-react";

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
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onCancel: () => void;
};

const ProgressPhotoUploadDialog = ({
  open,
  onOpenChange,
  uploading,
  preparingImage,
  selectedFile,
  previewUrl,
  descricao,
  onDescricaoChange,
  onFileSelect,
  onUpload,
  onCancel,
  trigger,
}: ProgressPhotoUploadDialogProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraBackInputRef = useRef<HTMLInputElement>(null);
  const cameraFrontInputRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = (next: boolean) => {
    if (uploading || preparingImage) return;
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
            No telemóvel, «Tirar foto» abre a câmera. A imagem é comprimida automaticamente antes do
            envio. O seu coach vê na sua ficha.
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
                disabled={preparingImage || uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="h-4 w-4 mr-2 shrink-0" />
                Galeria
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full min-h-11"
                disabled={preparingImage || uploading}
                onClick={() => cameraBackInputRef.current?.click()}
              >
                <Camera className="h-4 w-4 mr-2 shrink-0" />
                Tirar foto
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full min-h-11"
                disabled={preparingImage || uploading}
                onClick={() => cameraFrontInputRef.current?.click()}
              >
                <Camera className="h-4 w-4 mr-2 shrink-0" />
                Selfie
              </Button>
            </div>
            {preparingImage && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 motion-safe:animate-spin" />
                A preparar imagem…
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
          <div className="space-y-2">
            <Label htmlFor="descricao-foto">Descrição (opcional)</Label>
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
            disabled={uploading || preparingImage}
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!selectedFile || uploading || preparingImage}
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
