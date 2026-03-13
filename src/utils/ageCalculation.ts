function ageCalculation(dataNascimento: string): number {
  const [dia, mes, ano] = dataNascimento.split("/").map(Number);

  const nascimento = new Date(ano, mes - 1, dia);
  const hoje = new Date();

  let idade = hoje.getFullYear() - nascimento.getFullYear();

  const mesAtual = hoje.getMonth();
  const diaAtual = hoje.getDate();

  if (
    mesAtual < nascimento.getMonth() ||
    (mesAtual === nascimento.getMonth() && diaAtual < nascimento.getDate())
  ) {
    idade--;
  }

  return idade;
}

export default ageCalculation
