/**
 * Testes da política de onboarding (node:test).
 * Executar: node --test src/lib/onboarding/policy.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

/** Cópia espelhada da lógica TS para validar no Node sem bundler. */
function shouldAutoShowOnboarding(input) {
  if (input.blocked) return false;
  const pref = input.preference;
  const def = input.definition;
  if (!pref) return true;
  if (pref.dismiss_permanently || pref.state === "dismissed_permanently") return false;
  if (pref.version < def.version && def.forceReshowOnVersionBump) return true;
  if (pref.state === "never" || pref.state === "in_progress") return true;
  return false;
}

const def = { id: "checkin-weekly", version: 1, forceReshowOnVersionBump: false, steps: [] };
const defV2 = { ...def, version: 2, forceReshowOnVersionBump: true };

describe("shouldAutoShowOnboarding", () => {
  it("mostra quando nunca visto", () => {
    assert.equal(shouldAutoShowOnboarding({ definition: def, preference: null }), true);
  });

  it("não mostra quando dismissed_permanently", () => {
    assert.equal(
      shouldAutoShowOnboarding({
        definition: defV2,
        preference: {
          onboarding_id: "checkin-weekly",
          version: 1,
          state: "dismissed_permanently",
          dismiss_permanently: true,
          current_step: 0,
        },
      }),
      false,
    );
  });

  it("não mostra completed na mesma versão", () => {
    assert.equal(
      shouldAutoShowOnboarding({
        definition: def,
        preference: {
          onboarding_id: "checkin-weekly",
          version: 1,
          state: "completed",
          dismiss_permanently: false,
          current_step: 2,
        },
      }),
      false,
    );
  });

  it("skipped não é dismiss permanente (mesma versão: sem auto)", () => {
    assert.equal(
      shouldAutoShowOnboarding({
        definition: def,
        preference: {
          onboarding_id: "checkin-weekly",
          version: 1,
          state: "skipped",
          dismiss_permanently: false,
          current_step: 0,
        },
      }),
      false,
    );
  });

  it("forceReshow reabre completed em versão nova, mas não dismiss", () => {
    assert.equal(
      shouldAutoShowOnboarding({
        definition: defV2,
        preference: {
          onboarding_id: "checkin-weekly",
          version: 1,
          state: "completed",
          dismiss_permanently: false,
          current_step: 2,
        },
      }),
      true,
    );
    assert.equal(
      shouldAutoShowOnboarding({
        definition: defV2,
        preference: {
          onboarding_id: "checkin-weekly",
          version: 1,
          state: "dismissed_permanently",
          dismiss_permanently: true,
          current_step: 0,
        },
      }),
      false,
    );
  });

  it("blocked impede auto-show", () => {
    assert.equal(
      shouldAutoShowOnboarding({ definition: def, preference: null, blocked: true }),
      false,
    );
  });
});
