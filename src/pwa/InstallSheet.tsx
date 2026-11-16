import { useState } from "react";
import { useStudentOverlayLock } from "@/hooks/useStudentOverlayLock";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowDown, ArrowUp, Check, Copy, EllipsisVertical, Ellipsis, Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDeviceClass } from "@/lib/device";
import { isIPadDevice, type InstallSheet as InstallSheetKind } from "./install-store";

const APP_URL = typeof window !== "undefined" ? `${window.location.origin}/` : "/";

function Step({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">{icon}</span>
      <span className="pt-1.5 text-sm leading-snug">{children}</span>
    </li>
  );
}

function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(APP_URL);
    } catch {
      const input = document.createElement("input");
      input.value = APP_URL;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };
  return (
    <Button className="min-h-11 w-full" onClick={() => void copy()}>
      {copied ? <Check className="mr-2 h-4 w-4" aria-hidden /> : <Copy className="mr-2 h-4 w-4" aria-hidden />}
      {copied ? "Link copiado" : "Copiar link"}
    </Button>
  );
}

/** Folha com o passo a passo de instalação para cada navegador. */
export function InstallSheet({ kind, onClose }: { kind: InstallSheetKind; onClose: () => void }) {
  const ipad = kind === "ios-safari" && isIPadDevice();
  const iphone = kind === "ios-safari" && !ipad;
  const tablet = getDeviceClass() === "tablet";

  useStudentOverlayLock(true);

  let title = "Instalar app";
  let body: React.ReactNode = null;
  if (kind === "ios-safari") {
    title = ipad ? "Instalar no iPad" : "Instalar no iPhone";
    body = (
      <>
        <DialogPrimitive.Description className="text-sm leading-relaxed text-muted-foreground">
          Toque em Compartilhar (ícone do quadrado com seta), depois em Adicionar à Tela de Início.
        </DialogPrimitive.Description>
        <ol className="space-y-3">
          <Step icon={<Share className="h-4 w-4" aria-hidden />}>
            Toque em <strong>Compartilhar</strong>, {ipad ? "no topo da tela, à direita." : "na barra de baixo do Safari."}
          </Step>
          <Step icon={<SquarePlus className="h-4 w-4" aria-hidden />}>
            Role a lista e toque em <strong>Adicionar à Tela de Início</strong>.
          </Step>
          <Step icon={<Check className="h-4 w-4" aria-hidden />}>
            Toque em <strong>Adicionar</strong>. O ícone da Black House aparece na sua tela inicial.
          </Step>
        </ol>
        <p className="flex items-start gap-2 text-xs leading-snug text-muted-foreground">
          <Ellipsis className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>Não achou o Compartilhar? Nas versões mais novas do iOS, ele fica dentro do botão de mais opções.</span>
        </p>
        <Button variant="outline" className="min-h-11 w-full" onClick={onClose}>
          Entendi
        </Button>
      </>
    );
  } else if (kind === "open-in-safari" || kind === "open-in-chrome") {
    const browser = kind === "open-in-safari" ? "Safari" : "Chrome";
    title = `Abra no ${browser} para instalar`;
    body = (
      <>
        <DialogPrimitive.Description className="text-sm leading-relaxed text-muted-foreground">
          Para instalar, abra este endereço no {browser}.
        </DialogPrimitive.Description>
        <p className="select-all break-all rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-sm">{APP_URL}</p>
        <CopyLinkButton />
      </>
    );
  } else {
    title = "Instalar app";
    body = (
      <>
        <DialogPrimitive.Description className="text-sm leading-relaxed text-muted-foreground">
          Pelo menu do navegador:
        </DialogPrimitive.Description>
        <ol className="space-y-3">
          <Step icon={<EllipsisVertical className="h-4 w-4" aria-hidden />}>
            Toque no <strong>menu</strong> do navegador (três pontinhos).
          </Step>
          <Step icon={<SquarePlus className="h-4 w-4" aria-hidden />}>
            Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
          </Step>
        </ol>
        <Button variant="outline" className="min-h-11 w-full" onClick={onClose}>
          Entendi
        </Button>
      </>
    );
  }

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          data-install-sheet={kind}
          className={cn(
            "fixed z-50 flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl outline-none",
            ipad
              ? "right-3 top-[calc(env(safe-area-inset-top,0px)+3.5rem)] w-[min(380px,calc(100%-24px))]"
              : tablet
                ? "left-1/2 top-1/2 w-[min(420px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2"
                : iphone
                  ? "inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+4rem)]"
                  : "inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)]",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <DialogPrimitive.Title className="text-base font-semibold leading-tight">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Fechar"
              className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              <X className="h-5 w-5" aria-hidden />
            </DialogPrimitive.Close>
          </div>
          {body}
          {ipad && (
            <ArrowUp
              aria-hidden
              className="pointer-events-none absolute -top-12 right-10 h-9 w-9 text-primary motion-safe:animate-bounce"
            />
          )}
          {iphone && (
            <ArrowDown
              aria-hidden
              className="pointer-events-none absolute -bottom-12 left-1/2 h-9 w-9 -translate-x-1/2 text-primary motion-safe:animate-bounce"
            />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
