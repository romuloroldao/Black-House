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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    
    if (!user) {
      throw new Error('Não autorizado');
    }

    const { alunoId } = await req.json();

    console.log('Creating Asaas customer for aluno:', alunoId);

    // Buscar dados do aluno
    const { data: aluno, error: alunoError } = await supabaseClient
      .from('alunos')
      .select('*')
      .eq('id', alunoId)
      .eq('coach_id', user.id)
      .single();

    if (alunoError || !aluno) {
      throw new Error('Aluno não encontrado');
    }

    // Verificar se já existe customer
    const { data: existingCustomer } = await supabaseClient
      .from('asaas_customers')
      .select('*')
      .eq('aluno_id', alunoId)
      .maybeSingle();

    if (existingCustomer) {
      return new Response(
        JSON.stringify({ success: true, customer: existingCustomer }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configuração do coach
    const { data: config } = await supabaseClient
      .from('asaas_config')
      .select('*')
      .eq('coach_id', user.id)
      .maybeSingle();

    const isSandbox = config?.is_sandbox ?? true;
    const baseUrl = isSandbox 
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://api.asaas.com/v3';

    // Criar customer na Asaas
    const asaasResponse = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': Deno.env.get('ASAAS_API_KEY') ?? '',
      },
      body: JSON.stringify({
        name: aluno.nome,
        email: aluno.email,
        cpfCnpj: aluno.cpf_cnpj || undefined,
        phone: aluno.telefone || undefined,
      }),
    });

    if (!asaasResponse.ok) {
      const errorData = await asaasResponse.json();
      console.error('Asaas API error:', errorData);
      throw new Error(`Erro ao criar customer: ${JSON.stringify(errorData)}`);
    }

    const asaasCustomer = await asaasResponse.json();
    console.log('Customer created in Asaas:', asaasCustomer.id);

    // Salvar no banco
    const { data: customer, error: insertError } = await supabaseClient
      .from('asaas_customers')
      .insert({
        aluno_id: alunoId,
        asaas_customer_id: asaasCustomer.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting customer:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true, customer }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});