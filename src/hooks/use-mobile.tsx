import * as React from "react"
import { PHONE_LAYOUT_MEDIA_QUERY } from "@/lib/device"

/** Layout compacto: janela abaixo de 768px ou celular (inclusive deitado). */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(PHONE_LAYOUT_MEDIA_QUERY)
    const onChange = () => {
      setIsMobile(mql.matches)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
