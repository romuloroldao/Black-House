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
};

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
 * Normaliza fotos da galeria/câmera para JPEG ≤ maxBytes (padrão 5 MB), adequado ao envio no celular.
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

  if (isHeic(file)) {
    throw new Error(
      "Foto HEIC detectada. No iPhone: Ajustes → Câmera → Formatos → «Mais compatível», ou envie pela opção Galeria.",
    );
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
  } catch (err) {
    if (file.size <= maxBytes && (type === "image/png" || type === "image/webp")) {
      const ext = type.includes("png") ? ".png" : ".webp";
      return new File([file], defaultOutputName(file, ext), { type: file.type });
    }
    const msg = err instanceof Error ? err.message : "";
    throw new Error(
      msg ||
        "Não foi possível preparar a foto neste aparelho. Tente outra imagem ou use «Tirar foto».",
    );
  }
}
