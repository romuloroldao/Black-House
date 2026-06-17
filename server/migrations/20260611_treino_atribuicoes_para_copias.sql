-- Migra atribuições antigas (alunos_treinos -> template partilhado) para cópias por aluno.
--
-- Contexto: a feature "treino editável por aluno" passou a clonar o treino no momento
-- da atribuição (server: /alunos-treinos/assign). As atribuições criadas ANTES disso
-- continuam a apontar para o template global, por isso editar "o treino do aluno"
-- alterava o template para todos. Esta migração cria, para cada vínculo que ainda
-- aponta para um treino de biblioteca (aluno_id IS NULL), uma cópia exclusiva do aluno
-- e re-aponta o vínculo para essa cópia.
--
-- Idempotente: depois de migrado, o vínculo passa a apontar para uma cópia (aluno_id
-- preenchido), pelo que a próxima execução não encontra nada para migrar.

DO $$
DECLARE
  rec RECORD;
  nova_copia_id uuid;
  migrados int := 0;
BEGIN
  FOR rec IN
    SELECT
      atr.id          AS link_id,
      atr.aluno_id    AS aluno_id,
      t.id            AS template_id,
      t.nome          AS nome,
      t.descricao     AS descricao,
      t.duracao       AS duracao,
      t.dificuldade   AS dificuldade,
      t.categoria     AS categoria,
      t.num_exercicios AS num_exercicios,
      t.tags          AS tags,
      t.exercicios    AS exercicios,
      t.coach_id      AS coach_id
    FROM public.alunos_treinos atr
    JOIN public.treinos t ON t.id = atr.treino_id
    WHERE t.aluno_id IS NULL
  LOOP
    INSERT INTO public.treinos (
      nome, descricao, duracao, dificuldade, categoria, num_exercicios,
      is_template, tags, exercicios, coach_id, aluno_id, template_origem_id, updated_at
    ) VALUES (
      rec.nome,
      rec.descricao,
      COALESCE(rec.duracao, 60),
      rec.dificuldade,
      rec.categoria,
      COALESCE(rec.num_exercicios, 0),
      false,
      COALESCE(rec.tags, '{}'),
      COALESCE(rec.exercicios, '[]'::jsonb),
      rec.coach_id,
      rec.aluno_id,
      rec.template_id,
      now()
    )
    RETURNING id INTO nova_copia_id;

    UPDATE public.alunos_treinos
    SET treino_id = nova_copia_id
    WHERE id = rec.link_id;

    migrados := migrados + 1;
  END LOOP;

  RAISE NOTICE 'Atribuições migradas para cópias por aluno: %', migrados;
END $$;
