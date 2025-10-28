import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

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

    console.log('Iniciando verificação de expirações de treinos...');

    // Buscar treinos ativos com data de expiração definida
    const { data: treinosAtivos, error: treinosError } = await supabase
      .from('alunos_treinos')
      .select(`
        id,
        aluno_id,
        treino_id,
        data_expiracao,
        dias_antecedencia_notificacao,
        notificacao_expiracao_enviada,
        alunos (
          id,
          nome,
          email,
          coach_id
        ),
        treinos (
          id,
          nome,
          coach_id
        )
      `)
      .eq('ativo', true)
      .not('data_expiracao', 'is', null);

    if (treinosError) {
      console.error('Erro ao buscar treinos:', treinosError);
      throw treinosError;
    }

    console.log(`Encontrados ${treinosAtivos?.length || 0} treinos com data de expiração`);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const notificacoesCriadas = [];

    for (const treinoAtivo of treinosAtivos || []) {
      const dataExpiracao = new Date(treinoAtivo.data_expiracao);
      dataExpiracao.setHours(0, 0, 0, 0);

      const diasAntecedencia = treinoAtivo.dias_antecedencia_notificacao || 7;
      const dataNotificacao = new Date(dataExpiracao);
      dataNotificacao.setDate(dataNotificacao.getDate() - diasAntecedencia);

      // Verificar se hoje é o dia da notificação
      if (hoje >= dataNotificacao && !treinoAtivo.notificacao_expiracao_enviada) {
        const diasRestantes = Math.ceil((dataExpiracao.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        
        console.log(`Criando notificações para treino ${treinoAtivo.treino_id} - ${diasRestantes} dias restantes`);

        // Notificação para o coach
        const { error: notifCoachError } = await supabase
          .from('notificacoes')
          .insert({
            coach_id: treinoAtivo.treinos.coach_id,
            aluno_id: treinoAtivo.aluno_id,
            tipo: 'expiracao_treino',
            titulo: `Treino expirando em ${diasRestantes} dias`,
            mensagem: `O treino "${treinoAtivo.treinos.nome}" do aluno ${treinoAtivo.alunos.nome} expira em ${diasRestantes} dias (${dataExpiracao.toLocaleDateString('pt-BR')}).`,
            lida: false,
          });

        if (notifCoachError) {
          console.error('Erro ao criar notificação para coach:', notifCoachError);
        } else {
          console.log(`Notificação criada para coach sobre treino ${treinoAtivo.treino_id}`);
        }

        // Notificação para o aluno
        const { error: notifAlunoError } = await supabase
          .from('notificacoes')
          .insert({
            coach_id: treinoAtivo.treinos.coach_id,
            aluno_id: treinoAtivo.aluno_id,
            tipo: 'expiracao_treino',
            titulo: `Seu treino expira em ${diasRestantes} dias`,
            mensagem: `Seu treino "${treinoAtivo.treinos.nome}" expira em ${diasRestantes} dias (${dataExpiracao.toLocaleDateString('pt-BR')}). Entre em contato com seu professor para renovação.`,
            lida: false,
          });

        if (notifAlunoError) {
          console.error('Erro ao criar notificação para aluno:', notifAlunoError);
        } else {
          console.log(`Notificação criada para aluno sobre treino ${treinoAtivo.treino_id}`);
        }

        // Marcar notificação como enviada
        const { error: updateError } = await supabase
          .from('alunos_treinos')
          .update({ notificacao_expiracao_enviada: true })
          .eq('id', treinoAtivo.id);

        if (updateError) {
          console.error('Erro ao atualizar flag de notificação:', updateError);
        }

        notificacoesCriadas.push({
          treino_id: treinoAtivo.treino_id,
          aluno: treinoAtivo.alunos.nome,
          dias_restantes: diasRestantes,
        });
      }

      // Desativar treino se expirou
      if (dataExpiracao < hoje && treinoAtivo.ativo) {
        console.log(`Desativando treino expirado: ${treinoAtivo.treino_id}`);
        
        const { error: desativarError } = await supabase
          .from('alunos_treinos')
          .update({ ativo: false })
          .eq('id', treinoAtivo.id);

        if (desativarError) {
          console.error('Erro ao desativar treino:', desativarError);
        }
      }
    }

    console.log(`Processo concluído. ${notificacoesCriadas.length} notificações criadas.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Verificação concluída. ${notificacoesCriadas.length} notificações criadas.`,
        notificacoes: notificacoesCriadas,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Erro na função:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
