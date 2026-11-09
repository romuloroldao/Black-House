import { useEffect } from "react";

/**
 * Marca <html data-safe-top-handled> enquanto um layout cuida sozinho da área do entalhe/barra de status.
 * Sem a marca, o app instalado empurra o conteúdo para baixo da barra de status (src/index.css).
 */
export function useSafeTopHandled(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    html.setAttribute("data-safe-top-handled", "");
    return () => html.removeAttribute("data-safe-top-handled");
  }, [active]);
}
