import { useEffect } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, toast, useSonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

function syncSonnerToastA11y() {
  if (typeof document === "undefined") return
  document.querySelectorAll("[data-sonner-toast]").forEach((node) => {
    const el = node as HTMLElement
    const isError = el.getAttribute("data-type") === "error"
    el.setAttribute("role", isError ? "alert" : "status")
    el.setAttribute("aria-live", isError ? "assertive" : "polite")
    el.setAttribute("aria-atomic", "true")
  })
}

/** Sincroniza role/aria-live nos toasts Sonner (erros → assertive + alert). */
function SonnerA11ySync() {
  const { toasts } = useSonner()

  useEffect(() => {
    syncSonnerToastA11y()
    const frame = requestAnimationFrame(syncSonnerToastA11y)
    return () => cancelAnimationFrame(frame)
  }, [toasts])

  return null
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <>
      <Sonner
        theme={theme as ToasterProps["theme"]}
        className="toaster group"
        containerAriaLabel="Notificações"
        toastOptions={{
          classNames: {
            toast:
              "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
            description: "group-[.toast]:text-muted-foreground",
            actionButton:
              "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
            cancelButton:
              "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          },
        }}
        {...props}
      />
      <SonnerA11ySync />
    </>
  )
}

export { Toaster, toast }
