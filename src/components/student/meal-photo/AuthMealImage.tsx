import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

/** Carrega imagem protegida por JWT (path relativo da API). */
export function AuthMealImage({
  path,
  alt,
  className,
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;

    async function load() {
      if (!path) {
        setSrc(null);
        return;
      }
      if (path.startsWith("blob:") || path.startsWith("data:")) {
        setSrc(path);
        return;
      }
      const url = apiClient.mealPhotoAuthenticatedUrl(path);
      if (!url) {
        setSrc(null);
        return;
      }
      try {
        const token = apiClient.getToken();
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("img");
        const blob = await res.blob();
        const obj = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(obj);
          return;
        }
        revoked = obj;
        setSrc(obj);
      } catch {
        if (!cancelled) setSrc(null);
      }
    }

    load();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [path]);

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-muted text-xs text-muted-foreground ${className || ""}`}
      >
        Sem imagem
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} />;
}
