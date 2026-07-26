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
import { Input } from "@/components/ui/input";

type WeightLogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (pesoKg: number) => void;
  busy?: boolean;
};

const WeightLogDialog = ({ open, onOpenChange, onSubmit, busy }: WeightLogDialogProps) => {
  const [value, setValue] = useState("");
  const parsed = Number(String(value).replace(",", "."));
  const valid = Number.isFinite(parsed) && parsed > 20 && parsed < 400;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registar peso</DialogTitle>
          <DialogDescription>Indica o peso atual em quilogramas.</DialogDescription>
        </DialogHeader>
        <Input
          inputMode="decimal"
          placeholder="Ex.: 78,5"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Peso em kg"
          disabled={busy}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!valid || busy}
            onClick={() => {
              if (!valid) return;
              onSubmit(parsed);
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WeightLogDialog;
