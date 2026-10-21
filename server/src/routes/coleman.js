import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { config } from "../config.js";
import { authenticate } from "../middleware/auth.js";
import { COLEMAN_SYSTEM_PROMPT } from "../lib/coleman-prompt.js";

const router = Router();

const bodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .max(8)
    .optional()
    .default([]),
});

async function loadAlunoContext(email) {
  const alunoResult = await pool.query(
    `SELECT id, nome, peso FROM public.alunos WHERE email = $1 LIMIT 1`,
    [email]
  );
  const aluno = alunoResult.rows[0];
  if (!aluno) return null;

  const dietaResult = await pool.query(
    `SELECT id, nome, objetivo FROM public.dietas
     WHERE aluno_id = $1
     ORDER BY created_at DESC NULLS LAST
     LIMIT 1`,
    [aluno.id]
  );
  const dieta = dietaResult.rows[0] || null;

  let dietItemsSummary = "";
  if (dieta?.id) {
    const itensResult = await pool.query(
      `SELECT i.refeicao, i.quantidade, a.nome AS alimento_nome
       FROM public.itens_dieta i
       LEFT JOIN public.alimentos a ON a.id = i.alimento_id
       WHERE i.dieta_id = $1
       LIMIT 40`,
      [dieta.id]
    );
    if (itensResult.rows.length) {
      dietItemsSummary = itensResult.rows
        .map(
          (i) =>
            `- ${i.refeicao}: ${i.alimento_nome || "?"} (${i.quantidade}g)`
        )
        .join("\n");
    }
  }

  const treinoResult = await pool.query(
    `SELECT t.id, t.nome, t.categoria, t.dificuldade, t.duracao, t.exercicios
     FROM public.alunos_treinos at
     JOIN public.treinos t ON t.id = at.treino_id
     WHERE at.aluno_id = $1 AND at.ativo = true
     ORDER BY at.data_inicio DESC NULLS LAST
     LIMIT 1`,
    [aluno.id]
  );
  const treino = treinoResult.rows[0] || null;

  let workoutSummary = "";
  if (treino) {
    const exs = Array.isArray(treino.exercicios)
      ? treino.exercicios
          .slice(0, 20)
          .map(
            (e, idx) =>
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

  return { aluno, contextBlock };
}

router.post("/api/coleman", authenticate, async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Mensagem inválida" });
  }

  const { message, history } = parsed.data;

  try {
    const ctx = await loadAlunoContext(req.user.email);
    if (!ctx) {
      return res.status(404).json({ error: "Aluno não encontrado" });
    }

    if (!config.lovableApiKey) {
      return res.json({
        reply:
          "O Coleman está temporariamente indisponível. Use o Chat com seu coach para tirar a dúvida agora.",
        escalate: true,
        reason: "missing_api_key",
      });
    }

    const messages = [
      {
        role: "system",
        content: `${COLEMAN_SYSTEM_PROMPT}\n\n${ctx.contextBlock}`,
      },
      ...history.map((m) => ({
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
          Authorization: `Bearer ${config.lovableApiKey}`,
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
      console.error("[coleman] AI error:", aiRes.status, errText);
      return res.json({
        reply:
          "Não consegui responder agora. Abra o Chat com seu coach — ele é a melhor opção neste momento.",
        escalate: true,
        reason: "ai_upstream",
      });
    }

    const aiJson = await aiRes.json();
    let reply =
      aiJson?.choices?.[0]?.message?.content?.trim() ||
      "Não tenho uma resposta clara. Prefira falar com seu coach no Chat.";

    const escalate =
      reply.includes("[ESCALATE_COACH]") ||
      /fale com (o )?seu coach|falar com (o )?coach/i.test(reply);
    reply = reply.replace(/\[ESCALATE_COACH\]/g, "").trim();

    return res.json({ reply, escalate });
  } catch (error) {
    console.error("[coleman]", error);
    return res.json({
      reply:
        "Ocorreu um erro ao consultar o Coleman. Use o Chat com seu coach.",
      escalate: true,
      reason: "exception",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
