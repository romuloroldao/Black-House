const { assertProfileAllowsAction } = require('../services/profile-completeness.service');

/**
 * Bloqueia acções quando o hard gate de perfil incompleto está activo.
 */
function requireCompleteProfile(pool) {
  return async (req, res, next) => {
    try {
      if (!req.aluno?.id) {
        return res.status(403).json({ error: 'Aluno não resolvido', error_code: 'ALUNO_NOT_RESOLVED' });
      }
      await assertProfileAllowsAction(pool, req.aluno);
      return next();
    } catch (error) {
      if (error.code === 'PROFILE_INCOMPLETE') {
        return res.status(403).json({
          error: error.message,
          error_code: 'PROFILE_INCOMPLETE',
          ...error.details,
        });
      }
      console.error('requireCompleteProfile:', error);
      return res.status(500).json({ error: error.message || 'Erro de perfil' });
    }
  };
}

module.exports = requireCompleteProfile;
