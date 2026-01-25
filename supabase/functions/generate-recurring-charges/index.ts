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

    console.log('Starting recurring charges generation...');

    // Buscar todas as configurações ativas de cobrança recorrente
    const { data: configs, error: configError } = await supabaseClient
      .from('recurring_charges_config')
      .select(`
        *,
        alunos:aluno_id(id, nome, email, coach_id),
        payment_plans:payment_plan_id(id, nome, valor, dia_vencimento, frequencia)
      `)
      .eq('ativo', true);

    if (configError) {
      console.error('Error fetching configs:', configError);
      throw configError;
    }

    console.log(`Found ${configs?.length || 0} active recurring charge configs`);

    const today = new Date();
    const currentDay = today.getDate();
    const results = [];

    for (const config of configs || []) {
      try {
        // Determinar o dia de vencimento
        const dueDay = config.dia_vencimento_customizado || config.payment_plans?.dia_vencimento;
        
        // Se não é o dia de gerar cobrança, pular
        if (dueDay !== currentDay) {
          console.log(`Skipping ${config.alunos.nome} - not due day (${dueDay} vs ${currentDay})`);
          continue;
        }

        // Verificar se aluno está na lista de exceções ativas
        const { data: exception } = await supabaseClient
          .from('financial_exceptions')
          .select('*')
          .eq('aluno_id', config.aluno_id)
          .eq('ativo', true)
          .gte('data_fim', today.toISOString().split('T')[0])
          .maybeSingle();

        if (exception && exception.tipo === 'isento') {
          console.log(`Skipping ${config.alunos.nome} - has active exemption`);
          continue;
        }

        // Calcular valor (com desconto se houver exceção)
        let value = config.valor_customizado || config.payment_plans?.valor;
        
        if (exception) {
          if (exception.valor_desconto) {
            value = value - exception.valor_desconto;
          } else if (exception.percentual_desconto) {
            value = value * (1 - exception.percentual_desconto / 100);
          }
        }

        // Verificar se já existe cobrança para este mês
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        const { data: existingPayment } = await supabaseClient
          .from('asaas_payments')
          .select('id')
          .eq('aluno_id', config.aluno_id)
          .gte('due_date', firstDayOfMonth.toISOString().split('T')[0])
          .lte('due_date', lastDayOfMonth.toISOString().split('T')[0])
          .maybeSingle();

        if (existingPayment) {
          console.log(`Skipping ${config.alunos.nome} - payment already exists for this month`);
          continue;
        }

        // Calcular data de vencimento
        const dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);
        if (dueDate < today) {
          dueDate.setMonth(dueDate.getMonth() + 1);
        }

        const dueDateStr = dueDate.toISOString().split('T')[0];

        // Criar cobrança
        console.log(`Creating charge for ${config.alunos.nome}: R$ ${value} - Due: ${dueDateStr}`);

        const response = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/create-asaas-payment`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              alunoId: config.aluno_id,
              value: value,
              description: `Mensalidade - ${config.payment_plans?.nome || 'Plano Padrão'}`,
              billingType: 'PIX',
              dueDate: dueDateStr,
            }),
          }
        );

        const result = await response.json();
        
        if (response.ok) {
          results.push({
            aluno: config.alunos.nome,
            value,
            dueDate: dueDateStr,
            success: true,
          });
          console.log(`✓ Charge created for ${config.alunos.nome}`);
        } else {
          results.push({
            aluno: config.alunos.nome,
            error: result.error,
            success: false,
          });
          console.error(`✗ Failed to create charge for ${config.alunos.nome}:`, result.error);
        }

      } catch (error) {
        console.error(`Error processing ${config.alunos.nome}:`, error);
        results.push({
          aluno: config.alunos?.nome || 'Unknown',
          error: error.message,
          success: false,
        });
      }
    }

    console.log('Recurring charges generation completed');

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
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
