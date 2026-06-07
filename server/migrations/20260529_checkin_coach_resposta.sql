-- Resposta do coach vinculada a cada check-in semanal (não mais um feedback único por aluno)
ALTER TABLE public.weekly_checkins
  ADD COLUMN IF NOT EXISTS coach_resposta text;

COMMENT ON COLUMN public.weekly_checkins.coach_resposta IS 'Texto da resposta do coach a este check-in específico';

-- Backfill: copiar feedback legado apenas para o check-in respondido mais recente de cada aluno
UPDATE public.weekly_checkins w
SET coach_resposta = sub.feedback
FROM (
  SELECT DISTINCT ON (w2.aluno_id)
    w2.id AS checkin_id,
    fa.feedback
  FROM public.weekly_checkins w2
  INNER JOIN LATERAL (
    SELECT feedback
    FROM public.feedbacks_alunos fa
    WHERE fa.aluno_id = w2.aluno_id
      AND fa.feedback IS NOT NULL
      AND trim(fa.feedback) <> ''
    ORDER BY fa.updated_at DESC NULLS LAST, fa.created_at DESC
    LIMIT 1
  ) fa ON true
  WHERE w2.coach_respondido_em IS NOT NULL
    AND (w2.coach_resposta IS NULL OR trim(w2.coach_resposta) = '')
  ORDER BY w2.aluno_id, w2.coach_respondido_em DESC NULLS LAST, w2.created_at DESC
) sub
WHERE w.id = sub.checkin_id;
