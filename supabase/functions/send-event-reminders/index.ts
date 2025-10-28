import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Iniciando verificação de lembretes de eventos...');

    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in1Hour = new Date(now.getTime() + 60 * 60 * 1000);

    // Buscar eventos agendados nas próximas 24 horas
    const { data: eventosProximos, error: eventosError } = await supabase
      .from('eventos')
      .select(`
        *,
        turmas:turma_id(nome),
        eventos_participantes(
          aluno_id,
          alunos:aluno_id(id, nome, email)
        )
      `)
      .eq('status', 'agendado')
      .gte('data_inicio', now.toISOString())
      .lte('data_inicio', in24Hours.toISOString());

    if (eventosError) {
      console.error('Erro ao buscar eventos:', eventosError);
      throw eventosError;
    }

    console.log(`Encontrados ${eventosProximos?.length || 0} eventos nas próximas 24 horas`);

    const lembretes = [];

    for (const evento of eventosProximos || []) {
      const dataEvento = new Date(evento.data_inicio);
      const diff24h = Math.abs(dataEvento.getTime() - in24Hours.getTime());
      const diff1h = Math.abs(dataEvento.getTime() - in1Hour.getTime());

      // Determinar qual tipo de lembrete enviar
      let tipoLembrete = null;
      if (diff24h < 30 * 60 * 1000) { // Dentro de 30 minutos da janela de 24h
        tipoLembrete = '24h';
      } else if (diff1h < 30 * 60 * 1000) { // Dentro de 30 minutos da janela de 1h
        tipoLembrete = '1h';
      }

      if (!tipoLembrete) continue;

      // Processar participantes
      for (const participante of evento.eventos_participantes || []) {
        if (!participante.alunos) continue;

        const aluno = participante.alunos;

        // Verificar se já enviou este tipo de lembrete
        const { data: lembreteExistente } = await supabase
          .from('lembretes_eventos')
          .select('id')
          .eq('evento_id', evento.id)
          .eq('aluno_id', aluno.id)
          .eq('tipo_lembrete', tipoLembrete)
          .eq('enviado', true)
          .single();

        if (lembreteExistente) continue;

        // Criar lembrete se não existir
        const { data: lembreteData } = await supabase
          .from('lembretes_eventos')
          .select('id')
          .eq('evento_id', evento.id)
          .eq('aluno_id', aluno.id)
          .eq('tipo_lembrete', tipoLembrete)
          .single();

        if (!lembreteData) {
          await supabase
            .from('lembretes_eventos')
            .insert({
              evento_id: evento.id,
              aluno_id: aluno.id,
              tipo_lembrete: tipoLembrete,
            });
        }

        // Criar notificação para o aluno
        const mensagemTempo = tipoLembrete === '24h' ? '24 horas' : '1 hora';
        const turmaInfo = evento.turmas ? ` - ${evento.turmas.nome}` : '';
        
        await supabase
          .from('notificacoes')
          .insert({
            coach_id: evento.coach_id,
            aluno_id: aluno.id,
            tipo: 'lembrete_evento',
            titulo: `Lembrete: ${evento.titulo}`,
            mensagem: `O evento "${evento.titulo}"${turmaInfo} começará em ${mensagemTempo}`,
            link: `/student-portal?tab=calendar`,
          });

        // Marcar lembrete como enviado
        await supabase
          .from('lembretes_eventos')
          .update({ 
            enviado: true, 
            enviado_em: now.toISOString() 
          })
          .eq('evento_id', evento.id)
          .eq('aluno_id', aluno.id)
          .eq('tipo_lembrete', tipoLembrete);

        lembretes.push({
          evento: evento.titulo,
          aluno: aluno.nome,
          tipo: tipoLembrete,
        });
      }

      // Enviar notificação para o coach também
      const participantesCount = evento.eventos_participantes?.length || 0;
      const mensagemTempo = tipoLembrete === '24h' ? '24 horas' : '1 hora';
      
      await supabase
        .from('notificacoes')
        .insert({
          coach_id: evento.coach_id,
          tipo: 'lembrete_evento_coach',
          titulo: `Lembrete: ${evento.titulo}`,
          mensagem: `Seu evento "${evento.titulo}" começará em ${mensagemTempo} (${participantesCount} participantes)`,
          link: `/calendar`,
        });
    }

    console.log(`Lembretes enviados: ${lembretes.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        lembretes_enviados: lembretes.length,
        detalhes: lembretes,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Erro ao processar lembretes:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});