import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import logoWhite from "@/assets/logo-white.svg";
import logoDark from "@/assets/logo-black-house.png";

type BrandLogoProps = {
  className?: string;
  alt?: string;
};

/**
 * Logo adaptável: versão clara em dark mode, versão escura em light mode.
 * Antes do mount usa logo branca (defaultTheme=dark) para evitar flash.
 */
export function BrandLogo({ className, alt = "Black House" }: BrandLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLight = mounted && resolvedTheme === "light";
  const src = isLight ? logoDark : logoWhite;

  return (
    <img
      src={src}
      alt={alt}
      className={cn("w-auto object-contain", className)}
      decoding="async"
    />
  );
}

export default BrandLogo;
