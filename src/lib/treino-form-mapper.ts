/** Mapeia row `treinos` da API para props do WorkoutForm. */
export function mapTreinoApiToWorkoutForm(treino: Record<string, unknown>) {
  const rawExercises = Array.isArray(treino.exercicios) ? treino.exercicios : [];
  const exercises = rawExercises.map((ex: Record<string, unknown>, index: number) => ({
    id: String(ex.id ?? index + 1),
    name: String(ex.nome ?? ex.name ?? ""),
    sets: Number(ex.series ?? ex.sets ?? 3),
    reps: String(ex.repeticoes ?? ex.reps ?? "12"),
    weight: String(ex.peso ?? ex.weight ?? ""),
    rest: String(ex.descanso ?? ex.rest ?? "60s"),
    notes: String(ex.observacoes ?? ex.notes ?? ""),
    videoUrl: ex.video_url != null ? String(ex.video_url) : ex.videoUrl != null ? String(ex.videoUrl) : undefined,
    order: Number(ex.ordem ?? ex.order ?? index + 1),
  }));

  return {
    id: treino.id,
    name: treino.nome,
    description: treino.descricao ?? "",
    category: treino.categoria,
    difficulty: treino.dificuldade,
    duration: treino.duracao ?? 60,
    isTemplate: treino.is_template === true,
    tags: Array.isArray(treino.tags) ? treino.tags : [],
    exercises,
    alunoId: treino.aluno_id ?? null,
    templateOrigemId: treino.template_origem_id ?? null,
  };
}
