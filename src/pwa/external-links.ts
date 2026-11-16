import { isTouchAppDevice } from "@/lib/device";

/** Celular e tablet: link para outro site abre fora do app (target=_blank, rel=noopener), mesmo sem target no markup. */
export function initExternalLinks() {
  if (typeof document === "undefined" || !isTouchAppDevice()) return;
  document.addEventListener(
    "click",
    (event) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (!/^https?:$/.test(url.protocol) || url.origin === window.location.origin) return;
      anchor.target = "_blank";
      const rel = new Set(anchor.rel.split(/\s+/).filter(Boolean));
      rel.add("noopener");
      anchor.rel = Array.from(rel).join(" ");
    },
    true,
  );
}
