import { useEffect } from "react";
import { toast } from "sonner";
import { isTouchAppDevice } from "@/lib/device";
import { applyUpdate, subscribeToUpdate } from "./sw-registration";

const TOAST_ID = "pwa-update";

/**
 * Aviso "Nova versão disponível" (celular e tablet). Nunca recarrega sozinho: só ao tocar em "Atualizar".
 * No computador não aparece; a versão nova assume quando todas as abas fecharem.
 */
export function PwaUpdatePrompt() {
  useEffect(() => {
    if (!isTouchAppDevice()) return;
    return subscribeToUpdate(() => {
      toast("Nova versão disponível", {
        id: TOAST_ID,
        duration: Infinity,
        action: { label: "Atualizar", onClick: () => applyUpdate() },
      });
    });
  }, []);
  return null;
}
