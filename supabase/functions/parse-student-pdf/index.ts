import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, fileName } = await req.json();

    if (!pdfBase64) {
      throw new Error('PDF base64 é obrigatório');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    console.log('Processando PDF:', fileName);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente especializado em extrair dados de fichas de alunos de personal trainers/nutricionistas.
            
Extraia os seguintes dados do PDF em formato JSON:

{
  "aluno": {
    "nome": "string",
    "peso": number (em kg, apenas número),
    "altura": number (em cm, apenas número, opcional),
    "idade": number (apenas número, opcional),
    "objetivo": "string (opcional)"
  },
  "dieta": {
    "nome": "string (nome do plano alimentar)",
    "objetivo": "string",
    "refeicoes": [
      {
        "nome": "string (ex: Refeição 1, Café da manhã, etc)",
        "alimentos": [
          {
            "nome": "string",
            "quantidade": "string (ex: 100g, 2 unidades, etc)"
          }
        ]
      }
    ],
    "macros": {
      "proteina": number (em gramas, opcional),
      "carboidrato": number (em gramas, opcional),
      "gordura": number (em gramas, opcional),
      "calorias": number (kcal, opcional)
    }
  },
  "suplementos": [
    {
      "nome": "string",
      "dosagem": "string",
      "observacao": "string (opcional)"
    }
  ],
  "farmacos": [
    {
      "nome": "string",
      "dosagem": "string",
      "observacao": "string (opcional)"
    }
  ],
  "orientacoes": "string (orientações gerais, opcional)"
}

IMPORTANTE:
- Retorne APENAS o JSON válido, sem markdown ou explicações
- Se algum dado não estiver presente, omita o campo ou use null
- Separe suplementos de fármacos (medicamentos/hormônios)
- Extraia todas as refeições encontradas
- Mantenha os nomes dos alimentos como estão no documento`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extraia os dados deste PDF de ficha de aluno:'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 4096,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro da API:', errorText);
      throw new Error(`Erro ao processar PDF: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Resposta vazia da IA');
    }

    console.log('Resposta da IA:', content);

    // Parse JSON da resposta
    let parsedData;
    try {
      // Remove possíveis marcadores de código
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Erro ao fazer parse do JSON:', parseError);
      throw new Error('Não foi possível extrair dados estruturados do PDF');
    }

    return new Response(JSON.stringify({ success: true, data: parsedData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
