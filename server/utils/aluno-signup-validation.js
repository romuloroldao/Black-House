/**
 * Validação dos campos obrigatórios no cadastro do aluno (signup).
 */

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function isValidCpf(cpfRaw) {
  const cpf = onlyDigits(cpfRaw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(cpf[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(cpf[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(cpf[10]);
}

/**
 * @param {object} body
 * @returns {{ ok: true, data: { nome: string, cpf_cnpj: string, peso: number, altura: number } } | { ok: false, error: string, fields?: string[] }}
 */
function validateAlunoSignupProfile(body) {
  const nome = String(body?.full_name || body?.nome || '').trim();
  const email = String(body?.email || '').trim();
  const cpf_cnpj = onlyDigits(body?.cpf_cnpj || body?.cpf);
  const peso = body?.peso != null && body?.peso !== '' ? Number(body.peso) : NaN;
  const altura = body?.altura != null && body?.altura !== '' ? Number(body.altura) : NaN;

  const missing = [];
  if (!nome || nome.length < 3) missing.push('nome');
  if (!email) missing.push('email');
  if (!cpf_cnpj) missing.push('cpf_cnpj');
  if (!Number.isFinite(peso) || peso <= 0) missing.push('peso');
  if (!Number.isFinite(altura) || altura <= 0) missing.push('altura');

  if (missing.length > 0) {
    return {
      ok: false,
      error: 'Preencha todos os campos obrigatórios: Nome, Email, CPF, Peso e Altura.',
      fields: missing,
    };
  }

  if (!isValidCpf(cpf_cnpj)) {
    return { ok: false, error: 'CPF inválido', fields: ['cpf_cnpj'] };
  }

  if (peso > 500) {
    return { ok: false, error: 'Peso deve estar entre 1 e 500 kg', fields: ['peso'] };
  }

  if (altura < 100 || altura > 250) {
    return {
      ok: false,
      error: 'Altura deve estar entre 100 e 250 cm',
      fields: ['altura'],
    };
  }

  return {
    ok: true,
    data: { nome, cpf_cnpj, peso: Math.round(peso), altura: Math.round(altura) },
  };
}

module.exports = {
  onlyDigits,
  isValidCpf,
  validateAlunoSignupProfile,
};
