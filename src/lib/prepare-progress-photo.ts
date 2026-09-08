/**
 * Pipeline partilhada: preparar imagem (HEIC/compress) + classificar ângulo (Vision).
 * Usada no check-in e no diálogo de upload de evolução.
 */
import { apiClient } from '@/lib/api-client';
import {
  isAcceptableImageFile,
  prepareImageForUpload,
} from '@/lib/prepare-image-upload';
import {
  CHECKIN_PHOTO_POSES,
  type CheckinPhotoPose,
} from '@/lib/checkin-weekly-rules';

export function isKnownProgressPose(value: unknown): value is CheckinPhotoPose {
  return (
    typeof value === 'string' &&
    (CHECKIN_PHOTO_POSES as readonly string[]).includes(value)
  );
}

export type PreparedProgressPhoto = {
  file: File;
  pose?: CheckinPhotoPose;
  poseConfidence?: number;
  poseIncerto: boolean;
  classifyError?: string;
};

/**
 * Comprime/normaliza no cliente e tenta classificar o ângulo.
 * Se a Vision falhar, devolve o ficheiro preparado sem pose (o UI deve permitir escolha manual).
 */
export async function prepareAndClassifyProgressPhoto(
  raw: File,
): Promise<PreparedProgressPhoto> {
  if (!isAcceptableImageFile(raw)) {
    throw new Error('Ficheiro de imagem inválido');
  }

  const prepared = await prepareImageForUpload(raw);
  const classified = await apiClient.classifyProgressPhotoPoseSafe({ file: prepared });

  if (!classified.success) {
    const message =
      'error' in classified && typeof classified.error === 'string'
        ? classified.error
        : 'classificação indisponível';
    return {
      file: prepared,
      poseIncerto: false,
      classifyError: message,
    };
  }

  if (isKnownProgressPose(classified.data?.pose)) {
    return {
      file: prepared,
      pose: classified.data.pose,
      poseConfidence: classified.data?.confidence,
      poseIncerto: false,
    };
  }

  if (classified.data?.pose === 'incerto') {
    return {
      file: prepared,
      poseIncerto: true,
    };
  }

  return {
    file: prepared,
    poseIncerto: false,
  };
}
