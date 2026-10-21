const { parseAlunoIdFromExternalRef } = require('../coach-asaas');

function normalizePhoneDigits(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length > 11 ? digits.slice(-11) : digits;
}

function normalizeNameForMatch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function namesMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const aParts = a.split(' ').filter(Boolean);
  const bParts = b.split(' ').filter(Boolean);
  if (aParts.length >= 2 && bParts.length >= 2) {
    const aFirstLast = `${aParts[0]} ${aParts[aParts.length - 1]}`;
    const bFirstLast = `${bParts[0]} ${bParts[bParts.length - 1]}`;
    if (aFirstLast === bFirstLast) return true;
  }
  return a.includes(b) || b.includes(a);
}

function phonesMatch(asaasPhones, alunoPhone) {
  const normalizedAluno = normalizePhoneDigits(alunoPhone);
  if (!normalizedAluno) return false;
  return asaasPhones.some((p) => {
    if (!p) return false;
    return p === normalizedAluno || p.endsWith(normalizedAluno) || normalizedAluno.endsWith(p);
  });
}

function asaasCustomerPhones(customer) {
  return [customer.mobilePhone, customer.phone].map(normalizePhoneDigits).filter(Boolean);
}

async function findAlunoByNameAndPhone(pool, customer, { coachId = null } = {}) {
  const asaasPhones = asaasCustomerPhones(customer);
  const asaasName = normalizeNameForMatch(customer.name);
  if (!asaasName || asaasPhones.length === 0) return null;

  const params = [];
  let sql = `SELECT id, coach_id, nome, telefone FROM public.alunos
             WHERE telefone IS NOT NULL AND btrim(telefone) <> ''`;
  if (coachId) {
    params.push(coachId);
    sql += ` AND coach_id = $${params.length}`;
  }

  const result = await pool.query(sql, params);
  const matches = result.rows.filter((row) => {
    if (!phonesMatch(asaasPhones, row.telefone)) return false;
    return namesMatch(normalizeNameForMatch(row.nome), asaasName);
  });

  if (matches.length === 1) {
    return { alunoId: matches[0].id, coachId: matches[0].coach_id };
  }
  return null;
}

async function resolveAlunoAndCoachForAsaasCustomer(pool, customer, { coachId = null } = {}) {
  const alunoIdFromRef = parseAlunoIdFromExternalRef(customer.externalReference);
  if (alunoIdFromRef) {
    const params = [alunoIdFromRef];
    let sql = 'SELECT id, coach_id FROM public.alunos WHERE id = $1';
    if (coachId) {
      params.push(coachId);
      sql += ' AND coach_id = $2';
    }
    sql += ' LIMIT 1';
    const r = await pool.query(sql, params);
    if (r.rows[0]) return { alunoId: r.rows[0].id, coachId: r.rows[0].coach_id };
  }

  if (customer.email) {
    const params = [customer.email];
    let sql = 'SELECT id, coach_id FROM public.alunos WHERE lower(email) = lower($1)';
    if (coachId) {
      params.push(coachId);
      sql += ` AND coach_id = $${params.length}`;
    }
    const r = await pool.query(sql, params);
    if (r.rows.length === 1) return { alunoId: r.rows[0].id, coachId: r.rows[0].coach_id };
  }

  if (customer.cpfCnpj) {
    const digits = String(customer.cpfCnpj).replace(/\D/g, '');
    if (digits) {
      const params = [digits];
      let sql = `SELECT id, coach_id FROM public.alunos
                 WHERE regexp_replace(COALESCE(cpf_cnpj, ''), '\\D', '', 'g') = $1`;
      if (coachId) {
        params.push(coachId);
        sql += ` AND coach_id = $${params.length}`;
      }
      const r = await pool.query(sql, params);
      if (r.rows.length === 1) return { alunoId: r.rows[0].id, coachId: r.rows[0].coach_id };
    }
  }

  const byNamePhone = await findAlunoByNameAndPhone(pool, customer, { coachId });
  if (byNamePhone) return byNamePhone;

  return { alunoId: null, coachId: null };
}

module.exports = {
  normalizePhoneDigits,
  normalizeNameForMatch,
  namesMatch,
  phonesMatch,
  asaasCustomerPhones,
  findAlunoByNameAndPhone,
  resolveAlunoAndCoachForAsaasCustomer,
};
