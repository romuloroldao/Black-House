import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { isAgentDailyEnabled } from "@/lib/agent-daily-enabled";
import { trackAgentEvent } from "@/lib/agent-analytics";

export type AgentCardAction = {
  type?: string;
  name?: string;
  args?: Record<string, unknown>;
};

export type AgentCardItem = {
  name: string;
  quantity?: string | null;
};

export type AgentActionCardModel = {
  id?: string;
  type?: string;
  title?: string;
  body?: string;
  items?: AgentCardItem[];
  primary_action?: AgentCardAction | null;
  secondary_action?: AgentCardAction | null;
};

export type AgentThreadItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  cards?: AgentActionCardModel[];
  at: string;
};

export type AgentUiOpenTarget =
  | "hoje"
  | "dieta"
  | "treino"
  | "treino_sessao"
  | "meal_photo"
  | "checkin"
  | "coach_chat"
  | "progress"
  | "progress_photos"
  | "reports"
  | "videos"
  | "profile"
  | "blocked_financial"
  | "blocked_operational";

type UseStudentAgentOptions = {
  mealKeys?: string[];
  onOpenUi?: (target: AgentUiOpenTarget, args?: Record<string, unknown>) => void;
  onAfterMutation?: () => void;
  /** Auto-ensure session + hydrate on mount when agent home is active */
  autoHydrate?: boolean;
};

function mapServerMessages(raw: unknown[]): AgentThreadItem[] {
  const out: AgentThreadItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const m = row as {
      id?: string;
      role?: string;
      content?: string | null;
      payload?: { cards?: AgentActionCardModel[] } | null;
      created_at?: string;
    };
    if (m.role !== "user" && m.role !== "assistant") continue;
    out.push({
      id: String(m.id || `${m.role}-${out.length}`),
      role: m.role,
      content: String(m.content || ""),
      cards: Array.isArray(m.payload?.cards) ? m.payload!.cards! : undefined,
      at: m.created_at || new Date().toISOString(),
    });
  }
  return out;
}

export function useStudentAgent(options: UseStudentAgentOptions = {}) {
  const enabled = isAgentDailyEnabled();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [thread, setThread] = useState<AgentThreadItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [weightDialogOpen, setWeightDialogOpen] = useState(false);
  const ensuringRef = useRef<Promise<string | null> | null>(null);
  const hydrateRef = useRef<Promise<void> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (!enabled) return null;
    if (sessionId) return sessionId;
    if (ensuringRef.current) return ensuringRef.current;

    ensuringRef.current = (async () => {
      const res = await apiClient.getOrCreateAgentSessionSafe();
      if (!res.success || !res.data?.id) {
        setError(res.success === false ? res.error : "Não foi possível iniciar o assistente");
        trackAgentEvent("agent_error", { stage: "ensure_session" });
        return null;
      }
      const id = String(res.data.id);
      setSessionId(id);
      return id;
    })();

    try {
      return await ensuringRef.current;
    } finally {
      ensuringRef.current = null;
    }
  }, [enabled, sessionId]);

  const hydrateMessages = useCallback(async () => {
    if (!enabled) return;
    if (hydrateRef.current) return hydrateRef.current;

    hydrateRef.current = (async () => {
      const sid = await ensureSession();
      if (!sid) {
        setHydrated(true);
        return;
      }
      const res = await apiClient.getAgentMessagesSafe(sid);
      if (res.success && Array.isArray(res.data?.messages)) {
        const mapped = mapServerMessages(res.data.messages);
        if (mapped.length > 0) {
          setThread(mapped);
          trackAgentEvent("agent_hydrate", { count: mapped.length });
        }
      }
      setHydrated(true);
    })();

    try {
      await hydrateRef.current;
    } finally {
      hydrateRef.current = null;
    }
  }, [enabled, ensureSession]);

  useEffect(() => {
    if (!enabled || !options.autoHydrate) return;
    void hydrateMessages();
    trackAgentEvent("agent_home_view");
  }, [enabled, options.autoHydrate, hydrateMessages]);

  const openSheet = useCallback(() => {
    setSheetOpen(true);
    void hydrateMessages();
  }, [hydrateMessages]);

  const send = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || !enabled) return;

      setStatus("sending");
      setError(null);
      setSheetOpen(true);
      trackAgentEvent("agent_intent_sent", { length: text.length });

      const sid = await ensureSession();
      if (!sid) {
        setStatus("error");
        return;
      }

      setThread((prev) => [
        ...prev,
        {
          id: `u-${Date.now()}`,
          role: "user",
          content: text,
          at: new Date().toISOString(),
        },
      ]);

      const res = await apiClient.postAgentMessageSafe(sid, text, optionsRef.current.mealKeys);
      if (!res.success) {
        setStatus("error");
        setError(res.error || "Falha ao contactar o assistente");
        trackAgentEvent("agent_error", { stage: "send" });
        return;
      }

      const cards = Array.isArray(res.data?.cards) ? res.data.cards : [];
      setThread((prev) => [
        ...prev,
        {
          id: res.data?.message?.id || `a-${Date.now()}`,
          role: "assistant",
          content: res.data?.assistant_text || "Pronto.",
          cards,
          at: new Date().toISOString(),
        },
      ]);
      setStatus("idle");

      const tools = Array.isArray(res.data?.tool_results) ? res.data.tool_results : [];
      const mutated = tools.some(
        (t: { name?: string; result?: { ok?: boolean } }) =>
          (t?.name === "complete_meal" ||
            t?.name === "log_body_weight" ||
            t?.name === "complete_workout_session" ||
            t?.name === "apply_substitution") &&
          t?.result?.ok,
      );
      if (mutated) {
        optionsRef.current.onAfterMutation?.();
      }
    },
    [enabled, ensureSession],
  );

  const handleOpenUi = useCallback((action: AgentCardAction) => {
    const target = String(action.args?.target || "") as AgentUiOpenTarget;
    if (!target) return;
    trackAgentEvent("agent_card_action", { type: "open_ui", target });
    if (target === "hoje") {
      setSheetOpen(false);
      return;
    }
    try {
      sessionStorage.setItem("bh-agent-resume", "1");
    } catch {
      /* ignore */
    }
    setSheetOpen(false);
    optionsRef.current.onOpenUi?.(target, action.args || {});
  }, []);

  const submitWeight = useCallback(
    async (pesoKg: number) => {
      setWeightDialogOpen(false);
      setStatus("sending");
      setError(null);
      const sid = await ensureSession();
      if (!sid) {
        setStatus("error");
        return;
      }
      // Envia como intent estruturado para o fast path do backend
      await send(`Registar peso ${pesoKg} kg`);
    },
    [ensureSession, send],
  );

  const runCardAction = useCallback(
    async (action: AgentCardAction | null | undefined) => {
      if (!action) return;
      const type = action.type || (action.name === "open_ui" ? "open_ui" : "tool");
      trackAgentEvent("agent_card_action", {
        type,
        name: action.name || null,
      });

      if (type === "open_ui" || action.name === "open_ui") {
        handleOpenUi(action);
        return;
      }

      if (type === "approve" || type === "reject") {
        const approvalId = String(action.args?.approval_id || "");
        if (!approvalId) return;
        setStatus("sending");
        const res = await apiClient.decideAgentApprovalSafe(
          approvalId,
          type === "approve" ? "approved" : "rejected",
        );
        setStatus("idle");
        setThread((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            role: "assistant",
            content: res.success
              ? type === "approve"
                ? "Rascunho aprovado."
                : "Rascunho descartado."
              : "Não foi possível actualizar a aprovação.",
            at: new Date().toISOString(),
          },
        ]);
        return;
      }

      if (action.name === "complete_meal" && action.args) {
        setStatus("sending");
        const res = await apiClient.putRefeicaoConclusaoSafe({
          dieta_id: String(action.args.dieta_id),
          meal_key: String(action.args.meal_key),
          plano: String(action.args.plano || "A"),
          concluido: true,
          origem: "agent",
        });
        setStatus("idle");
        if (res.success) {
          optionsRef.current.onAfterMutation?.();
          await send("O que faço agora?");
        } else {
          setError(res.error || "Não foi possível concluir a refeição");
          setStatus("error");
        }
        return;
      }

      if (action.name === "log_body_weight") {
        const raw = action.args?.peso_kg;
        const peso = typeof raw === "number" ? raw : Number(raw);
        if (Number.isFinite(peso) && peso > 0) {
          await send(`Registar peso ${peso} kg`);
        } else {
          setWeightDialogOpen(true);
        }
        return;
      }

      if (action.name === "ask_weight" || action.name === "prompt_weight") {
        setWeightDialogOpen(true);
        return;
      }

      if (action.name) {
        await send(action.name);
      }
    },
    [handleOpenUi, send],
  );

  /** Ao regressar de UI especializada, retoma continuidade */
  const resumeIfNeeded = useCallback(async () => {
    let should = false;
    try {
      should = sessionStorage.getItem("bh-agent-resume") === "1";
      if (should) sessionStorage.removeItem("bh-agent-resume");
    } catch {
      /* ignore */
    }
    if (!should || !enabled) return;
    await hydrateMessages();
    await send("Voltei. O que faço agora?");
  }, [enabled, hydrateMessages, send]);

  return {
    enabled,
    sheetOpen,
    setSheetOpen,
    openSheet,
    status,
    error,
    thread,
    send,
    runCardAction,
    sessionId,
    hydrated,
    hydrateMessages,
    weightDialogOpen,
    setWeightDialogOpen,
    submitWeight,
    resumeIfNeeded,
  };
}
