import { cpf, cnpj } from "cpf-cnpj-validator";

/* ===================================================
 TELEFONE
=================================================== */

export function maskPhone(value: string): string {
  const clean = value.replace(/\D/g, "").slice(0, 11);

  if (clean.length > 6) {
    return clean.replace(/(\d{2})(\d{5})(\d{1,4})/, "($1) $2-$3");
  } else if (clean.length > 2) {
    return clean.replace(/(\d{2})(\d{1,5})/, "($1) $2");
  } else if (clean.length > 0) {
    return clean.replace(/(\d{1,2})/, "($1");
  }

  return clean;
}

/* ===================================================
DATA DE NASCIMENTO (dd/mm/aaaa)
=================================================== */

export function maskDate(value: string): string {
  const clean = value.replace(/\D/g, "").slice(0, 8);

  if (clean.length > 4) {
    return clean.replace(/(\d{2})(\d{2})(\d{1,4})/, "$1/$2/$3");
  } else if (clean.length > 2) {
    return clean.replace(/(\d{2})(\d{1,2})/, "$1/$2");
  }

  return clean;
}

export function validateDate(value: string): boolean {
  const clean = value.replace(/\D/g, "");

  if (clean.length !== 8) return false;

  const day = Number(clean.slice(0, 2));
  const month = Number(clean.slice(2, 4)) - 1;
  const year = Number(clean.slice(4, 8));

  const date = new Date(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return false;
  }

  // Não permite data futura
  if (date > new Date()) return false;

  return true;
}

/* ===================================================
CPF
=================================================== */

export function maskCPF(value: string): string {
  const clean = value.replace(/\D/g, "").slice(0, 11);

  return clean
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function validateCPF(value: string): boolean {
  const clean = value.replace(/\D/g, "");
  return cpf.isValid(clean);
}

/* ===================================================
CNPJ
=================================================== */

export function maskCNPJ(value: string): string {
  const clean = value.replace(/\D/g, "").slice(0, 14);

  return clean
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function validateCNPJ(value: string): boolean {
  const clean = value.replace(/\D/g, "");
  return cnpj.isValid(clean);
}

/* ===================================================
 CPF ou CNPJ automático
=================================================== */

export function maskCpfCnpj(value: string): string {
  const clean = value.replace(/\D/g, "");

  if (clean.length <= 11) {
    return maskCPF(clean);
  }

  return maskCNPJ(clean);
}

export function validateCpfCnpj(value: string): boolean {
  const clean = value.replace(/\D/g, "");

  if (clean.length <= 11) {
    return cpf.isValid(clean);
  }

  return cnpj.isValid(clean);
}

// retira as máscaras para enviar só números
export function onlyNumbers(value?: string | null) {
  if (!value) return "";
  return value.replace(/\D/g, "");
}