/**
 * Tool registry — catálogo e dispatch tipado.
 */

const { readTools } = require('./tools/read-context');
const { writeTools } = require('./tools/write-execution');
const { actionTools, highImpactTools } = require('./tools/action-ui');
const { webInspirationTools } = require('./tools/web-inspiration');
const { assertToolAllowed } = require('./policy');
const agentRepo = require('../../repositories/agent.repository');

const ALL_TOOLS = [
  ...readTools,
  ...webInspirationTools,
  ...writeTools,
  ...actionTools,
  ...highImpactTools,
];
const TOOL_MAP = new Map(ALL_TOOLS.map((t) => [t.name, t]));

function listToolsForPrompt({ includeHighImpact = false } = {}) {
  return ALL_TOOLS.filter((t) => includeHighImpact || t.autonomy < 4).map((t) => ({
    name: t.name,
    description: t.description,
    autonomy: t.autonomy,
  }));
}

function getTool(name) {
  return TOOL_MAP.get(name) || null;
}

/**
 * Executa tool com policy + audit.
 */
async function dispatchTool(ctx, { name, args = {} }) {
  const tool = getTool(name);
  const started = Date.now();
  const policy = assertToolAllowed({
    tool,
    autonomyMax: ctx.autonomyMax ?? 2,
    accessBlocked: Boolean(ctx.accessBlocked),
  });

  if (!policy.allowed) {
    if (ctx.runId) {
      await agentRepo.insertDecision(ctx.pool, {
        run_id: ctx.runId,
        kind: policy.decision,
        reason: policy.reason,
        payload: { tool: name, args },
      });
      await agentRepo.insertToolCall(ctx.pool, {
        run_id: ctx.runId,
        tool_name: name,
        autonomy_level: tool?.autonomy ?? 4,
        args,
        result: { denied: true, reason: policy.reason },
        ok: false,
        error_message: policy.reason,
        latency_ms: Date.now() - started,
      });
    }

    // draft_message cria approval via caminho especial
    if (policy.needsApproval && tool?.name === 'draft_message_to_coach') {
      try {
        const parsed = tool.inputSchema.parse(args || {});
        const result = await tool.execute(ctx, parsed);
        return { ok: true, pending_approval: true, ...result };
      } catch (err) {
        return { ok: false, error: err.message, code: err.code || 'APPROVAL_ERROR' };
      }
    }

    return {
      ok: false,
      denied: true,
      reason: policy.reason,
      decision: policy.decision,
    };
  }

  try {
    const parsed = tool.inputSchema.parse(args || {});
    const result = await tool.execute(ctx, parsed);
    if (ctx.runId) {
      await agentRepo.insertToolCall(ctx.pool, {
        run_id: ctx.runId,
        tool_name: name,
        autonomy_level: tool.autonomy,
        args: parsed,
        result,
        ok: true,
        latency_ms: Date.now() - started,
      });
    }
    return result;
  } catch (err) {
    if (ctx.runId) {
      await agentRepo.insertToolCall(ctx.pool, {
        run_id: ctx.runId,
        tool_name: name,
        autonomy_level: tool.autonomy,
        args,
        result: null,
        ok: false,
        error_message: err.message,
        latency_ms: Date.now() - started,
      });
    }
    return {
      ok: false,
      error: err.message,
      code: err.code || 'TOOL_ERROR',
      statusCode: err.statusCode,
    };
  }
}

module.exports = {
  ALL_TOOLS,
  listToolsForPrompt,
  getTool,
  dispatchTool,
};
