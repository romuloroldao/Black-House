import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Iniciando envio de lembretes de check-in...');

    // Buscar todos os alunos ativos
    const { data: alunos, error: alunosError } = await supabase
      .from('alunos')
      .select('id, nome, email, coach_id')
      .not('email', 'is', null);

    if (alunosError) {
      console.error('Erro ao buscar alunos:', alunosError);
      throw alunosError;
    }

    console.log(`Encontrados ${alunos?.length || 0} alunos`);

    let notificationsSent = 0;

    // Para cada aluno, verificar se precisa enviar lembrete
    for (const aluno of alunos || []) {
      // Verificar último check-in
      const { data: lastCheckin } = await supabase
        .from('weekly_checkins')
        .select('created_at')
        .eq('aluno_id', aluno.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Calcular dias desde último check-in
      const hoje = new Date();
      const diasDesdeUltimoCheckin = lastCheckin 
        ? Math.floor((hoje.getTime() - new Date(lastCheckin.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 999; // Se nunca preencheu, considerar muitos dias

      // Enviar lembrete se passaram 7 dias ou mais
      if (diasDesdeUltimoCheckin >= 7) {
        // Criar notificação
        const { error: notificationError } = await supabase
          .from('notificacoes')
          .insert({
            coach_id: aluno.coach_id,
            aluno_id: aluno.id,
            tipo: 'checkin_semanal',
            titulo: 'Check-in Semanal Disponível',
            mensagem: 'Seu check-in semanal está disponível! Preencha para otimizar seu progresso.',
            link: '/student-portal?tab=checkin'
          });

        if (notificationError) {
          console.error(`Erro ao criar notificação para ${aluno.email}:`, notificationError);
        } else {
          console.log(`Notificação enviada para ${aluno.email}`);
          notificationsSent++;
        }

        // Atualizar ou criar lembrete
        const { error: reminderError } = await supabase
          .from('checkin_reminders')
          .upsert({
            aluno_id: aluno.id,
            ultima_notificacao: hoje.toISOString(),
            proximo_lembrete: new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            ativo: true
          }, {
            onConflict: 'aluno_id'
          });

        if (reminderError) {
          console.error(`Erro ao atualizar lembrete para ${aluno.email}:`, reminderError);
        }
      }
    }

    console.log(`Total de notificações enviadas: ${notificationsSent}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${notificationsSent} lembretes enviados com sucesso`,
        totalAlunos: alunos?.length || 0,
        notificationsSent 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Erro ao processar lembretes:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
