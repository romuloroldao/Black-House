/**
 * Valida valores de POST /api/checkins antes do INSERT (espelha CHECK constraints da BD).
 */

const ENUMS = {
  beliscou_fora_plano: ['prejudicando', 'comprometido'],
  apetite: ['alto', 'normal', 'ruim'],
  recursos_hormonais: ['sim', 'nao', 'nao_uso'],
  media_horas_sono: ['4-5', '5-6', '6-8'],
  lida_desafios: ['nao_lida_bem', 'as_vezes_abate', 'lida_bem'],
  convivio_familiar: ['ruim', 'bom', 'otimo'],
  convivio_trabalho: ['ruim', 'bom', 'otimo'],
  postura_problemas: ['nao_sabe_resolver', 'resiliente'],
  media_evacuacoes: ['dias_sem', '1', '2', '3', 'mais_4'],
  formato_fezes: ['tipo1', 'tipo2', 'tipo3', 'tipo4', 'tipo5', 'tipo6', 'tipo7'],
};

const SCALE_1_5 = new Set(['seguiu_plano_nota', 'autoestima']);

function invalidFieldMessage(field) {
  const labels = {
    beliscou_fora_plano: 'Beliscou fora do plano',
    seguiu_plano_nota: 'Seguiu o plano alimentar',
    apetite: 'Apetite',
    recursos_hormonais: 'Recursos hormonais',
    media_horas_sono: 'Média de horas de sono',
    lida_desafios: 'Lida com desafios',
    convivio_familiar: 'Convívio familiar',
    convivio_trabalho: 'Convívio no trabalho',
    postura_problemas: 'Postura frente a problemas',
    autoestima: 'Autoestima',
    media_evacuacoes: 'Média de evacuações',
    formato_fezes: 'Formato das fezes',
  };
  return labels[field] || field;
}

/**
 * @param {Record<string, unknown>} data
 * @returns {{ ok: true } | { ok: false, field: string, message: string }}
 */
function validateCheckinFieldValues(data) {
  for (const field of Object.keys(ENUMS)) {
    const value = data[field];
    if (value == null || value === '') continue;
    if (!ENUMS[field].includes(String(value))) {
      return {
        ok: false,
        field,
        message: `Valor inválido em "${invalidFieldMessage(field)}". Revise o formulário e tente novamente.`,
      };
    }
  }

  for (const field of SCALE_1_5) {
    const raw = data[field];
    if (raw == null || raw === '') continue;
    const n = parseInt(String(raw), 10);
    if (Number.isNaN(n) || n < 1 || n > 5) {
      return {
        ok: false,
        field,
        message: `"${invalidFieldMessage(field)}" deve ser uma nota de 1 a 5.`,
      };
    }
  }

  return { ok: true };
}

/**
 * @param {Error & { code?: string, constraint?: string }} err
 * @returns {{ message: string, error_code: string } | null}
 */
function mapCheckinDbError(err) {
  if (!err || err.code !== '23514') return null;
  const c = String(err.constraint || '');
  if (c.includes('autoestima')) {
    return { message: 'Autoestima deve ser uma nota de 1 a 5.', error_code: 'CHECKIN_VALIDATION' };
  }
  if (c.includes('seguiu_plano')) {
    return { message: 'Nota do plano alimentar deve ser de 1 a 5.', error_code: 'CHECKIN_VALIDATION' };
  }
  return {
    message: 'Alguns valores do check-in são inválidos. Revise o formulário e tente novamente.',
    error_code: 'CHECKIN_VALIDATION',
  };
}

module.exports = {
  validateCheckinFieldValues,
  mapCheckinDbError,
};
