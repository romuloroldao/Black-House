/**
 * Facade do Agent Foundation (Phase 1b) — portal aluno.
 */

const orchestrator = require('./orchestrator');
const agentRepo = require('../../repositories/agent.repository');
const { listToolsForPrompt, getTool, dispatchTool } = require('./tool-registry');
const { AUTONOMY, assertToolAllowed } = require('./policy');
const { buildStudentAgentContext } = require('./context-builder');

module.exports = {
  ...orchestrator,
  agentRepo,
  listToolsForPrompt,
  getTool,
  dispatchTool,
  AUTONOMY,
  assertToolAllowed,
  buildStudentAgentContext,
};
