import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import {
  defaultPreference,
  getOnboardingDefinition,
  migrateLegacyOverviewDone,
  readCachedPreference,
  shouldAutoShowOnboarding,
  trackOnboardingEvent,
  writeCachedPreference,
  type OnboardingPreference,
  type OnboardingState,
} from "@/lib/onboarding";

const ONBOARDING_PREFS_PATH = "/api/alunos/me/onboarding-preferences";

type Options = {
  onboardingId: string;
  /** Quando false, não auto-abre (ex.: hard gate, loading, submit). */
  enabled?: boolean;
  /** Atraso antes do auto-show (ms). */
  delayMs?: number;
};

export function useFeatureOnboarding({
  onboardingId,
  enabled = true,
  delayMs = 600,
}: Options) {
  const { user } = useAuth();
  const alunoKey = user?.id || null;
  const definition = getOnboardingDefinition(onboardingId);
  const [preference, setPreference] = useState<OnboardingPreference | null>(null);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const hydratedRef = useRef(false);
  const viewedRef = useRef(false);
  const autoShownRef = useRef(false);

  const persist = useCallback(
    async (next: OnboardingPreference) => {
      setPreference(next);
      writeCachedPreference(alunoKey, next);
      const result = await apiClient.requestSafe<{ item: OnboardingPreference }>(
        ONBOARDING_PREFS_PATH,
        {
          method: "PUT",
          body: JSON.stringify({
            onboarding_id: next.onboarding_id,
            version: next.version,
            state: next.state,
            dismiss_permanently: next.dismiss_permanently,
            current_step: next.current_step,
          }),
        },
      );
      if (result.success && result.data?.item) {
        writeCachedPreference(alunoKey, result.data.item);
        setPreference(result.data.item);
      }
      // Falha de rede: cache local mantém a preferência (não reapresenta em loop).
    },
    [alunoKey],
  );

  useEffect(() => {
    if (!definition || !alunoKey) {
      setReady(true);
      return;
    }
    let cancelled = false;
    hydratedRef.current = false;

    (async () => {
      const legacy =
        onboardingId === "portal-overview" ? migrateLegacyOverviewDone(alunoKey) : null;
      const cached = readCachedPreference(alunoKey, onboardingId) || legacy;

      const list = await apiClient.requestSafe<{ items: OnboardingPreference[] }>(
        ONBOARDING_PREFS_PATH,
      );

      let resolved: OnboardingPreference =
        cached || defaultPreference(onboardingId, definition.version);

      if (list.success && Array.isArray(list.data?.items)) {
        const fromServer = list.data.items.find((i) => i.onboarding_id === onboardingId);
        if (fromServer) {
          resolved = fromServer;
        } else if (legacy && legacy.state !== "never") {
          // Empurra migração legado → servidor uma vez.
          void persist(legacy);
          resolved = legacy;
        }
      }

      if (cancelled) return;
      setPreference(resolved);
      writeCachedPreference(alunoKey, resolved);
      setStepIndex(resolved.current_step || 0);
      setReady(true);
      hydratedRef.current = true;
      trackOnboardingEvent("onboarding_eligible", {
        id: onboardingId,
        version: definition.version,
        state: resolved.state,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [alunoKey, definition, onboardingId, persist]);

  useEffect(() => {
    if (!ready || !definition || !enabled || !hydratedRef.current) return;
    if (autoShownRef.current || open) return;
    const auto = shouldAutoShowOnboarding({
      definition,
      preference,
      blocked: !enabled,
    });
    if (!auto) return;

    const t = window.setTimeout(() => {
      if (autoShownRef.current) return;
      autoShownRef.current = true;
      setOpen(true);
      if (!viewedRef.current) {
        viewedRef.current = true;
        trackOnboardingEvent("onboarding_viewed", {
          id: onboardingId,
          version: definition.version,
        });
        void persist({
          ...(preference || defaultPreference(onboardingId, definition.version)),
          version: definition.version,
          state: "in_progress",
          current_step: 0,
          dismiss_permanently: false,
        });
      }
    }, delayMs);
    return () => window.clearTimeout(t);
  }, [ready, definition, enabled, preference, onboardingId, delayMs, persist, open]);

  useEffect(() => {
    if (!open || !definition) return;
    const step = definition.steps[stepIndex];
    if (!step) return;
    trackOnboardingEvent("onboarding_step_viewed", {
      id: onboardingId,
      version: definition.version,
      step: step.id,
      index: stepIndex,
    });
    const target = step.target ? document.querySelector(step.target) : null;
    if (target instanceof HTMLElement) {
      target.setAttribute("data-onboarding-active", "true");
      target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    return () => {
      document.querySelectorAll("[data-onboarding-active]").forEach((el) => {
        el.removeAttribute("data-onboarding-active");
      });
    };
  }, [open, stepIndex, definition, onboardingId]);

  const updateState = useCallback(
    async (state: OnboardingState, step = stepIndex) => {
      if (!definition) return;
      const next: OnboardingPreference = {
        onboarding_id: onboardingId,
        version: definition.version,
        state,
        dismiss_permanently: state === "dismissed_permanently",
        current_step: step,
        completed_at:
          state === "completed" || state === "dismissed_permanently"
            ? new Date().toISOString()
            : preference?.completed_at || null,
      };
      await persist(next);
    },
    [definition, onboardingId, persist, preference?.completed_at, stepIndex],
  );

  const next = useCallback(() => {
    if (!definition) return;
    if (stepIndex < definition.steps.length - 1) {
      const n = stepIndex + 1;
      setStepIndex(n);
      void updateState("in_progress", n);
      return;
    }
    setOpen(false);
    void updateState("completed", stepIndex);
    trackOnboardingEvent("onboarding_completed", {
      id: onboardingId,
      version: definition.version,
    });
    try {
      window.dispatchEvent(
        new CustomEvent("blackhouse:onboarding-closed", { detail: { id: onboardingId } }),
      );
    } catch {
      /* ignore */
    }
  }, [definition, stepIndex, updateState, onboardingId]);

  const emitClosed = useCallback(() => {
    try {
      window.dispatchEvent(
        new CustomEvent("blackhouse:onboarding-closed", { detail: { id: onboardingId } }),
      );
    } catch {
      /* ignore */
    }
  }, [onboardingId]);

  const skip = useCallback(() => {
    if (!definition) return;
    setOpen(false);
    void updateState("skipped", stepIndex);
    trackOnboardingEvent("onboarding_skipped", {
      id: onboardingId,
      version: definition.version,
      step: definition.steps[stepIndex]?.id,
    });
    emitClosed();
  }, [definition, onboardingId, stepIndex, updateState, emitClosed]);

  const dismissPermanently = useCallback(() => {
    if (!definition) return;
    setOpen(false);
    void updateState("dismissed_permanently", stepIndex);
    trackOnboardingEvent("onboarding_dismissed_permanently", {
      id: onboardingId,
      version: definition.version,
    });
    emitClosed();
  }, [definition, onboardingId, stepIndex, updateState, emitClosed]);

  const reopen = useCallback(() => {
    if (!definition) return;
    setStepIndex(0);
    setOpen(true);
    viewedRef.current = true;
    trackOnboardingEvent("onboarding_reopened", {
      id: onboardingId,
      version: definition.version,
    });
    void updateState("in_progress", 0);
  }, [definition, onboardingId, updateState]);

  return {
    definition,
    preference,
    ready,
    open,
    stepIndex,
    step: definition?.steps[stepIndex] ?? null,
    next,
    skip,
    dismissPermanently,
    reopen,
    setOpen,
  };
}
