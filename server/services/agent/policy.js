/**
 * Policy de autonomia do agente (níveis 0–4).
 */

const AUTONOMY = {
  READ: 0,
  SUGGEST: 1,
  WRITE_LOW: 2,
  APPROVAL: 3,
  HUMAN_ONLY: 4,
};

function assertToolAllowed({ tool, autonomyMax, accessBlocked }) {
  if (!tool) {
    return { allowed: false, reason: 'tool_not_found', decision: 'deny_unknown_tool' };
  }
  if (tool.autonomy >= AUTONOMY.HUMAN_ONLY) {
    return {
      allowed: false,
      reason: 'high_impact_forbidden',
      decision: 'refuse_high_impact',
    };
  }
  // Nível 3: nunca auto-executa — sempre approval (mesmo se autonomyMax < 3)
  if (tool.autonomy >= AUTONOMY.APPROVAL) {
    return {
      allowed: false,
      reason: 'requires_approval',
      decision: 'requires_approval',
      needsApproval: true,
    };
  }
  if (tool.autonomy > autonomyMax) {
    return {
      allowed: false,
      reason: `autonomy_required_${tool.autonomy}_max_${autonomyMax}`,
      decision: 'autonomy_cap',
    };
  }
  if (accessBlocked && tool.autonomy >= AUTONOMY.WRITE_LOW && tool.name !== 'open_ui') {
    return {
      allowed: false,
      reason: 'student_access_blocked',
      decision: 'deny_blocked_access',
    };
  }
  return { allowed: true };
}

module.exports = {
  AUTONOMY,
  assertToolAllowed,
};
