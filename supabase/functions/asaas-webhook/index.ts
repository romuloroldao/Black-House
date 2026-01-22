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

    const payload = await req.json();
    console.log('Received webhook from Asaas:', payload);

    const { event, payment } = payload;

    if (!payment || !payment.id) {
      console.log('Invalid webhook payload');
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Atualizar status do pagamento no banco
    const { error: updateError } = await supabaseClient
      .from('asaas_payments')
      .update({
        status: payment.status,
        invoice_url: payment.invoiceUrl || undefined,
        bank_slip_url: payment.bankSlipUrl || undefined,
      })
      .eq('asaas_payment_id', payment.id);

    if (updateError) {
      console.error('Error updating payment:', updateError);
    } else {
      console.log(`Payment ${payment.id} updated with status: ${payment.status}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});