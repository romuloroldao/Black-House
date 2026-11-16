import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { isStandalone, isTouchAppDevice } from "@/lib/device";

/**
 * Voltar discreto para telas internas sem voltar próprio. Só aparece no app instalado (celular e tablet),
 * onde não existe o botão de voltar do navegador.
 */
export function StandaloneBackButton({ fallback = "/" }: { fallback?: string }) {
  const navigate = useNavigate();
  if (!isTouchAppDevice() || !isStandalone()) return null;
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  };
  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Voltar"
      className="standalone-back fixed right-3 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-md backdrop-blur"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
    >
      <ArrowLeft className="h-5 w-5" aria-hidden />
    </button>
  );
}
