import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('Starting payment reminders...');

    // Buscar configurações ativas com lembrete habilitado
    const { data: configs, error: configError } = await supabaseClient
      .from('recurring_charges_config')
      .select(`
        *,
        alunos:aluno_id(id, nome, email, telefone, coach_id)
      `)
      .eq('ativo', true)
      .eq('enviar_lembrete', true);

    if (configError) {
      console.error('Error fetching configs:', configError);
      throw configError;
    }

    console.log(`Found ${configs?.length || 0} configs with reminders enabled`);

    const today = new Date();
    const results = [];

    for (const config of configs || []) {
      try {
        const daysAhead = config.dias_antecedencia_lembrete || 3;
        const reminderDate = new Date(today);
        reminderDate.setDate(reminderDate.getDate() + daysAhead);
        
        // Buscar pagamentos pendentes que vencem na data do lembrete
        const { data: payments, error: paymentsError } = await supabaseClient
          .from('asaas_payments')
          .select('*')
          .eq('aluno_id', config.aluno_id)
          .eq('status', 'PENDING')
          .eq('due_date', reminderDate.toISOString().split('T')[0]);

        if (paymentsError) {
          console.error('Error fetching payments:', paymentsError);
          continue;
        }

        if (!payments || payments.length === 0) {
          continue;
        }

        for (const payment of payments) {
          console.log(`Sending reminder to ${config.alunos.nome} for payment ${payment.id}`);

          // Criar notificação no sistema
          await supabaseClient
            .from('notificacoes')
            .insert({
              coach_id: config.alunos.coach_id,
              aluno_id: config.aluno_id,
              tipo: 'lembrete_pagamento',
              titulo: 'Lembrete de Pagamento',
              mensagem: `Olá ${config.alunos.nome}! Seu pagamento de R$ ${payment.value.toFixed(2)} vence em ${daysAhead} dias (${payment.due_date}). Por favor, efetue o pagamento para evitar atrasos.`,
              link: `/student?tab=payments`,
            });

          results.push({
            aluno: config.alunos.nome,
            payment_id: payment.id,
            due_date: payment.due_date,
            value: payment.value,
            success: true,
          });

          console.log(`✓ Reminder sent to ${config.alunos.nome}`);
        }

      } catch (error) {
        console.error(`Error processing reminder for ${config.alunos.nome}:`, error);
        results.push({
          aluno: config.alunos?.nome || 'Unknown',
          error: error.message,
          success: false,
        });
      }
    }

    console.log('Payment reminders completed');

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: results.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
