const MAX_BYTES_DEFAULT = 5 * 1024 * 1024;
const MAX_SIDE_DEFAULT = 2048;

const EXT_PATTERN = /\.(jpe?g|png|webp|heic|heif)$/i;

/** Tipos e extensões comuns em galeria e câmera do celular. */
export function isAcceptableImageFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("image/")) return true;
  return EXT_PATTERN.test(file.name || "");
}

function isHeic(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return (
    type.includes("heic") ||
    type.includes("heif") ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

function defaultOutputName(file: File, ext = ".jpg"): string {
  const base = (file.name || "foto").replace(/\.[^.]+$/, "").trim() || "foto";
  return `${base.slice(0, 48)}-${Date.now()}${ext}`;
}

async function loadImageSource(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup?: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      /* fallback abaixo */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

async function encodeJpeg(
  file: File,
  maxSide: number,
  maxBytes: number,
  qualityStart: number,
): Promise<File> {
  const { source, width, height, cleanup } = await loadImageSource(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(width, height, 1));
    const cw = Math.max(1, Math.round(width * scale));
    const ch = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(source, 0, 0, cw, ch);

    let quality = qualityStart;
    let blob: Blob | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (!blob) throw new Error("encode");
      if (blob.size <= maxBytes) {
        return new File([blob], defaultOutputName(file), { type: "image/jpeg" });
      }
      quality = Math.max(0.45, quality - 0.1);
    }

    const mb = Math.round(((blob?.size || file.size) / (1024 * 1024)) * 10) / 10;
    throw new Error(
      `A foto ainda está grande (${mb} MB). Tente uma imagem mais próxima ou com menos zoom.`,
    );
  } finally {
    cleanup?.();
  }
}

/**
 * Prepara fotos para envio: comprime no browser quando possível.
 * HEIC e formatos que o telemóvel não decodifica são enviados como estão;
 * o servidor converte automaticamente para JPEG (ver normalize-upload-image).
 */
export async function prepareImageForUpload(
  file: File,
  options?: { maxBytes?: number; maxSide?: number; quality?: number },
): Promise<File> {
  const maxBytes = options?.maxBytes ?? MAX_BYTES_DEFAULT;
  const maxSide = options?.maxSide ?? MAX_SIDE_DEFAULT;
  const quality = options?.quality ?? 0.82;

  if (!isAcceptableImageFile(file)) {
    throw new Error(
      "Formato não suportado. Escolha uma imagem da galeria ou tire uma foto com os botões abaixo.",
    );
  }

  // HEIC/HEIF: o browser quase nunca decodifica — o servidor converte com sharp.
  if (isHeic(file)) {
    return new File([file], defaultOutputName(file, pathExtForHeic(file)), {
      type: file.type || "image/heic",
    });
  }

  const type = (file.type || "").toLowerCase();
  if (
    file.size <= maxBytes &&
    (type === "image/jpeg" || type === "image/jpg") &&
    file.name &&
    /\.jpe?g$/i.test(file.name)
  ) {
    return file;
  }

  try {
    return await encodeJpeg(file, maxSide, maxBytes, quality);
  } catch {
    if (file.size <= maxBytes && (type === "image/png" || type === "image/webp")) {
      const ext = type.includes("png") ? ".png" : ".webp";
      return new File([file], defaultOutputName(file, ext), { type: file.type });
    }
    // Falha no canvas (comum no Android): envia original; API normaliza no servidor.
    if (file.size <= 12 * 1024 * 1024) {
      const ext = extFromNameOrType(file);
      return new File([file], defaultOutputName(file, ext), {
        type: file.type || "application/octet-stream",
      });
    }
    throw new Error(
      "A foto é grande demais para enviar. Tente uma imagem mais próxima ou com menos zoom.",
    );
  }
}

function pathExtForHeic(file: File): string {
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".heif")) return ".heif";
  return ".heic";
}

function extFromNameOrType(file: File): string {
  const name = file.name || "";
  const m = name.match(/\.(jpe?g|png|webp)$/i);
  if (m) return `.${m[1].toLowerCase().replace("jpeg", "jpg")}`;
  const type = (file.type || "").toLowerCase();
  if (type.includes("png")) return ".png";
  if (type.includes("webp")) return ".webp";
  return ".jpg";
}
