import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o Coleman, assistente operacional do portal do aluno Black House.

ESCOPO PERMITIDO (apenas isto):
- Dúvidas sobre o plano de dieta/cardápio atribuído (refeições, quantidades, substituições do mesmo grupo)
- Dúvidas sobre o treino atribuído (séries, reps, ordem, descanso, T.E.P. = carga/esforço percebido)
- Como usar o check-in semanal e o que cada pergunta significa em termos práticos
- Navegação do app (onde achar treino, dieta, progresso)

FORA DE ESCOPO — recuse com educação e sugira falar com o coach:
- Diagnóstico médico, interpretação de exames, prescrição ou ajuste de fármacos/hormônios
- Alterar calorias/macros do plano sem orientação do coach
- Treinos novos ou progressões agressivas não previstas no plano
- Temas financeiros, jurídicos ou de saúde mental clínica

REGRAS:
1. Responda em português do Brasil, curto e claro (máx. ~120 palavras salvo se o aluno pedir detalhe).
2. Quando houver contexto do plano do aluno abaixo, CITE-O. Não invente alimentos/exercícios que não estejam no contexto.
3. Se a pergunta for ambígua ou sensível, diga que o coach é a melhor pessoa e sugira o Chat.
4. Nunca diga que é médico ou nutricionista prescritor.
5. Se não souber, admita e oriente a abrir o Chat com o coach.

No final, se a dúvida exigir julgamento clínico ou mudança de plano, acrescente a linha:
[ESCALATE_COACH]`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user?.email) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const message = String(body?.message || "").trim();
    const history = Array.isArray(body?.history) ? body.history.slice(-8) : [];

    if (!message || message.length > 2000) {
      return new Response(
        JSON.stringify({ error: "Mensagem inválida" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: aluno } = await supabase
      .from("alunos")
      .select("id, nome, peso")
      .eq("email", user.email)
      .maybeSingle();

    if (!aluno) {
      return new Response(
        JSON.stringify({ error: "Aluno não encontrado" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const [{ data: dieta }, { data: alunoTreino }] = await Promise.all([
      supabase
        .from("dietas")
        .select("id, nome, objetivo")
        .eq("aluno_id", aluno.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("alunos_treinos")
        .select("treinos(id, nome, categoria, dificuldade, duracao, exercicios)")
        .eq("aluno_id", aluno.id)
        .eq("ativo", true)
        .order("data_inicio", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    let dietItemsSummary = "";
    if (dieta?.id) {
      const { data: itens } = await supabase
        .from("itens_dieta")
        .select("refeicao, quantidade, alimentos(nome)")
        .eq("dieta_id", dieta.id)
        .limit(40);
      if (itens?.length) {
        dietItemsSummary = itens
          .map((i: any) => `- ${i.refeicao}: ${i.alimentos?.nome || "?"} (${i.quantidade}g)`)
          .join("\n");
      }
    }

    const treino = (alunoTreino as any)?.treinos;
    let workoutSummary = "";
    if (treino) {
      const exs = Array.isArray(treino.exercicios)
        ? treino.exercicios
            .slice(0, 20)
            .map(
              (e: any, idx: number) =>
                `${idx + 1}. ${e.nome} — ${e.series || "?"}x${e.repeticoes || "?"} descanso ${e.descanso || "?"}`
            )
            .join("\n")
        : "";
      workoutSummary = `Treino: ${treino.nome} (${treino.categoria || "?"}, ${treino.dificuldade || "?"}, ${treino.duracao || "?"} min)\n${exs}`;
    }

    const contextBlock = `
CONTEXTO DO ALUNO (use como fonte; não invente além disto):
Nome: ${aluno.nome || "Aluno"}
Peso registrado: ${aluno.peso ?? "não informado"} kg
Dieta ativa: ${dieta?.nome || "nenhuma"} — objetivo: ${dieta?.objetivo || "n/d"}
Itens (amostra):
${dietItemsSummary || "(sem itens)"}
${workoutSummary || "Treino: nenhum ativo"}
`.trim();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({
          reply:
            "O Coleman está temporariamente indisponível. Use o Chat com seu coach para tirar a dúvida agora.",
          escalate: true,
          reason: "missing_api_key",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const messages = [
      { role: "system", content: `${SYSTEM_PROMPT}\n\n${contextBlock}` },
      ...history
        .filter(
          (m: any) =>
            m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string"
        )
        .map((m: any) => ({
          role: m.role,
          content: String(m.content).slice(0, 2000),
        })),
      { role: "user", content: message },
    ];

    const aiRes = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          temperature: 0.3,
        }),
      }
    );

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("Coleman AI error:", aiRes.status, errText);
      return new Response(
        JSON.stringify({
          reply:
            "Não consegui responder agora. Abra o Chat com seu coach — ele é a melhor opção neste momento.",
          escalate: true,
          reason: "ai_upstream",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const aiJson = await aiRes.json();
    let reply =
      aiJson?.choices?.[0]?.message?.content?.trim() ||
      "Não tenho uma resposta clara. Prefira falar com seu coach no Chat.";

    const escalate =
      reply.includes("[ESCALATE_COACH]") ||
      /fale com (o )?seu coach|falar com (o )?coach/i.test(reply);
    reply = reply.replace(/\[ESCALATE_COACH\]/g, "").trim();

    return new Response(
      JSON.stringify({ reply, escalate }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("coleman-assist error:", error);
    return new Response(
      JSON.stringify({
        reply:
          "Ocorreu um erro ao consultar o Coleman. Use o Chat com seu coach.",
        escalate: true,
        reason: "exception",
        error: error?.message,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
