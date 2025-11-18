/**
 * Utilitários para cálculos nutricionais seguindo a planilha Excel
 * Todos os cálculos usam valores por 100g/ml como referência
 */

export interface NutritionValues {
  kcal: number;
  cho: number;
  ptn: number;
  lip: number;
  origem_ptn: string;
}

export interface Alimento {
  quantidade_referencia_g: number;
  kcal_por_referencia: number;
  cho_por_referencia: number;
  ptn_por_referencia: number;
  lip_por_referencia: number;
  origem_ptn: string;
}

/**
 * Calcula os valores nutricionais de um alimento para uma quantidade específica
 * Fórmula: valor = (quantidade_consumida / quantidade_referencia) × valor_referencia
 */
export function calcularNutrientes(
  alimento: Alimento,
  quantidadeConsumida: number
): NutritionValues {
  const fator = quantidadeConsumida / alimento.quantidade_referencia_g;

  return {
    kcal: alimento.kcal_por_referencia * fator,
    cho: alimento.cho_por_referencia * fator,
    ptn: alimento.ptn_por_referencia * fator,
    lip: alimento.lip_por_referencia * fator,
    origem_ptn: alimento.origem_ptn,
  };
}

/**
 * Calcula o percentual energético de cada macronutriente
 * CHO e PTN = 4 kcal/g
 * LIP = 9 kcal/g
 */
export function calcularPercentualEnergetico(
  cho: number,
  ptn: number,
  lip: number,
  metaCalorica?: number
): { percCho: number; percPtn: number; percLip: number; totalKcal: number } {
  const kcalCho = cho * 4;
  const kcalPtn = ptn * 4;
  const kcalLip = lip * 9;
  const totalKcal = kcalCho + kcalPtn + kcalLip;

  const base = metaCalorica || totalKcal;

  return {
    percCho: base > 0 ? (kcalCho / base) * 100 : 0,
    percPtn: base > 0 ? (kcalPtn / base) * 100 : 0,
    percLip: base > 0 ? (kcalLip / base) * 100 : 0,
    totalKcal,
  };
}

/**
 * Separa proteína por origem (Animal vs Vegetal)
 */
export function separarProteinaPorOrigem(itens: Array<{ ptn: number; origem_ptn: string }>) {
  let ptnAnimal = 0;
  let ptnVegetal = 0;

  itens.forEach((item) => {
    if (item.origem_ptn.toLowerCase().includes("animal")) {
      ptnAnimal += item.ptn;
    } else {
      ptnVegetal += item.ptn;
    }
  });

  return { ptnAnimal, ptnVegetal, ptnTotal: ptnAnimal + ptnVegetal };
}

/**
 * Calcula meta calórica baseada em peso e kcal/kg
 */
export function calcularMetaCalorica(peso: number, kcalPorKg: number): number {
  return peso * kcalPorKg;
}

/**
 * Calcula ingestão de água recomendada
 */
export function calcularAguaRecomendada(peso: number): { min: number; max: number } {
  return {
    min: peso * 25, // ml
    max: peso * 50, // ml
  };
}

/**
 * Calcula meta de proteína baseada em peso e g/kg
 */
export function calcularMetaProteina(peso: number, proteinaPorKg: number): number {
  return peso * proteinaPorKg;
}

/**
 * Valida se o plano está dentro da meta (tolerância de 5%)
 */
export function validarMetaCalorica(
  totalKcal: number,
  metaCalorica: number
): { valido: boolean; diferenca: number; percDiferenca: number } {
  const diferenca = Math.abs(totalKcal - metaCalorica);
  const percDiferenca = (diferenca / metaCalorica) * 100;

  return {
    valido: percDiferenca <= 5,
    diferenca,
    percDiferenca,
  };
}

/**
 * Valida se a fibra está acima do limite (30g/dia)
 */
export function validarFibra(fibraTotal: number): { excedeu: boolean; diferenca: number } {
  const limiteMax = 30;
  return {
    excedeu: fibraTotal > limiteMax,
    diferenca: Math.max(0, fibraTotal - limiteMax),
  };
}

/**
 * Calcula quantidade equivalente para substituição por kcal
 * Fórmula: qtd_B = qtd_A × (kcal_A / kcal_B)
 */
export function calcularSubstituicaoPorKcal(
  alimentoA: Alimento,
  quantidadeA: number,
  alimentoB: Alimento
): number {
  const fatorA = quantidadeA / alimentoA.quantidade_referencia_g;
  const kcalA = alimentoA.kcal_por_referencia * fatorA;
  
  const kcalBPor100g = (alimentoB.kcal_por_referencia / alimentoB.quantidade_referencia_g) * 100;
  
  return kcalBPor100g > 0 ? (kcalA / kcalBPor100g) * 100 : 0;
}

/**
 * Calcula quantidade equivalente para substituição por CHO
 * Fórmula: qtd_B = qtd_A × (CHO_A / CHO_B)
 */
export function calcularSubstituicaoPorCho(
  alimentoA: Alimento,
  quantidadeA: number,
  alimentoB: Alimento
): number {
  const fatorA = quantidadeA / alimentoA.quantidade_referencia_g;
  const choA = alimentoA.cho_por_referencia * fatorA;
  
  const choBPor100g = (alimentoB.cho_por_referencia / alimentoB.quantidade_referencia_g) * 100;
  
  return choBPor100g > 0 ? (choA / choBPor100g) * 100 : 0;
}

/**
 * Soma totais de uma lista de valores nutricionais
 */
export function somarTotais(valores: NutritionValues[]): Omit<NutritionValues, "origem_ptn"> {
  return valores.reduce(
    (acc, val) => ({
      kcal: acc.kcal + val.kcal,
      cho: acc.cho + val.cho,
      ptn: acc.ptn + val.ptn,
      lip: acc.lip + val.lip,
    }),
    { kcal: 0, cho: 0, ptn: 0, lip: 0 }
  );
}
