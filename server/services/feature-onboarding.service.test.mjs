/**
 * Validação do serviço de onboarding (sem DB).
 * node --test server/services/feature-onboarding.service.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const svc = require("./feature-onboarding.service.js");

describe("feature-onboarding.service", () => {
  it("expõe estados e eventos válidos", () => {
    assert.ok(svc.VALID_STATES.has("never"));
    assert.ok(svc.VALID_STATES.has("dismissed_permanently"));
    assert.ok(svc.VALID_EVENTS.has("viewed"));
    assert.ok(svc.VALID_EVENTS.has("step_viewed"));
    assert.equal(svc.VALID_EVENTS.has("unknown"), false);
  });

  it("recordEvent rejeita payload inválido", async () => {
    const fakePool = { query: async () => ({ rows: [] }) };
    await assert.rejects(
      () => svc.recordEvent(fakePool, "aluno", { onboarding_id: "", event_name: "viewed" }),
      /inválido/,
    );
    await assert.rejects(
      () =>
        svc.recordEvent(fakePool, "aluno", {
          onboarding_id: "checkin-weekly",
          event_name: "hack",
        }),
      /inválido/,
    );
  });
});
