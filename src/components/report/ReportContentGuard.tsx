import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Protecção de conteúdo para documentos de relatório.
 *
 * LIMITAÇÕES — isto NÃO é DRM e NÃO impede captura:
 * - PrintScreen / recorte do SO / foto do ecrã / extensões continuam possíveis
 * - visibilitychange e blur disparam depois de muitos atalhos de captura
 * - o JSON da API e o DOM continuam acessíveis a quem já está autenticado
 * - bloquear Ctrl+C / menu de contexto no documento inteiro parte teclado,
 *   mobile e leitores de ecrã — por isso só o overlay e a impressão são
 *   restringidos, e a selecção é desaconselhada (select-none) sem esconder
 *   o texto dos leitores de ecrã
 *
 * Objectivo: reduzir partilha casual (copiar/imprimir/arrastar) sem fingir
 * segurança absoluta.
 */
type ReportContentGuardProps = {
  children: ReactNode;
  className?: string;
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("textarea, input, select, [contenteditable='true']"));
}

export default function ReportContentGuard({ children, className }: ReportContentGuardProps) {
  const [masked, setMasked] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const mask = useCallback(() => setMasked(true), []);
  const unmask = useCallback(() => setMasked(false), []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") mask();
      else unmask();
    };
    const onBlur = () => mask();
    const onFocus = () => {
      if (document.visibilityState === "visible") unmask();
    };
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (key === "p" || key === "s")) {
        e.preventDefault();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [mask, unmask]);

  return (
    <div
      ref={rootRef}
      className={cn("relative", className)}
      onCopy={(e) => {
        if (!isEditableTarget(e.target)) e.preventDefault();
      }}
      onCut={(e) => {
        if (!isEditableTarget(e.target)) e.preventDefault();
      }}
      onDragStart={(e) => e.preventDefault()}
      onContextMenu={(e) => {
        if (!isEditableTarget(e.target)) e.preventDefault();
      }}
    >
      <div className="select-none">{children}</div>
      {masked ? (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-background/95"
          role="status"
        >
          <p className="max-w-sm px-4 text-center text-sm text-muted-foreground">
            Conteúdo oculto enquanto a página está em segundo plano. Volte ao relatório para continuar.
          </p>
        </div>
      ) : null}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          body::after {
            content: "A impressão deste relatório não está disponível.";
            visibility: visible;
            display: block;
            padding: 2rem;
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  );
}
