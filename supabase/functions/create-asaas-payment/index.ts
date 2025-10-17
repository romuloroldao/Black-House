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

    const { alunoId, value, description, billingType, dueDate } = await req.json();

    console.log('Creating payment for aluno:', alunoId);

    // Buscar ou criar customer
    let { data: customer } = await supabaseClient
      .from('asaas_customers')
      .select('*')
      .eq('aluno_id', alunoId)
      .maybeSingle();

    if (!customer) {
      // Criar customer primeiro
      const createCustomerRes = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/create-asaas-customer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.get('Authorization')!,
          },
          body: JSON.stringify({ alunoId }),
        }
      );

      const customerData = await createCustomerRes.json();
      customer = customerData.customer;
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

    // Criar cobrança na Asaas
    const asaasResponse = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': Deno.env.get('ASAAS_API_KEY') ?? '',
      },
      body: JSON.stringify({
        customer: customer.asaas_customer_id,
        billingType: billingType,
        value: value,
        dueDate: dueDate,
        description: description,
      }),
    });

    if (!asaasResponse.ok) {
      const errorData = await asaasResponse.json();
      console.error('Asaas API error:', errorData);
      throw new Error(`Erro ao criar cobrança: ${JSON.stringify(errorData)}`);
    }

    const asaasPayment = await asaasResponse.json();
    console.log('Payment created in Asaas:', asaasPayment.id);

    // Salvar no banco
    const { data: payment, error: insertError } = await supabaseClient
      .from('asaas_payments')
      .insert({
        coach_id: user.id,
        aluno_id: alunoId,
        asaas_payment_id: asaasPayment.id,
        asaas_customer_id: customer.asaas_customer_id,
        value: value,
        description: description,
        billing_type: billingType,
        status: asaasPayment.status,
        due_date: dueDate,
        invoice_url: asaasPayment.invoiceUrl,
        bank_slip_url: asaasPayment.bankSlipUrl,
        pix_qr_code: asaasPayment.qrCode?.encodedImage,
        pix_copy_paste: asaasPayment.qrCode?.payload,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting payment:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true, payment, asaasPayment }),
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