/**
 * Equivalência alimentar isocalórica (logicaTabela).
 * Substituição apenas no mesmo grupo (tipo_id) com Q_sub = (Q_ref × Kcal_ref) / Kcal_sub.
 */
import type { Food, QuantityUnit } from '@/lib/foodService';
import { macroScaleFactor } from '@/lib/foodService';

export type SubstituicaoIsocalorica = {
  alimento: Food;
  quantidadeEquivalente: number;
  kcalReferencia: number;
  kcalEquivalente: number;
  formula: string;
};

export function kcalPorPorcao(
  food: Food,
  quantidade: number,
  unidade: QuantityUnit | string = 'g',
): number {
  const fator = macroScaleFactor(quantidade, unidade, food.portion);
  return (food.calories || 0) * fator;
}

export function calcularQuantidadeEquivalente(
  foodRef: Food,
  quantidadeRef: number,
  unidadeRef: QuantityUnit | string,
  foodSub: Food,
): number | null {
  const kcalTotal = kcalPorPorcao(foodRef, quantidadeRef, unidadeRef);
  const kcalSub = foodSub.calories || 0;
  if (kcalTotal <= 0 || kcalSub <= 0) return null;
  return (kcalTotal / kcalSub) * (foodSub.portion || 100);
}

export function sameEquivalenceGroup(a: Food, b: Food): boolean {
  if (!a.tipo_id || !b.tipo_id) return false;
  return String(a.tipo_id) === String(b.tipo_id);
}

export function canSubstitute(food: Food | null | undefined): boolean {
  if (!food?.tipo_id) return false;
  if ((food.calories || 0) <= 0) return false;
  const nome = (food.tipo_nome || '').toLowerCase();
  if (nome.includes('livres para consumo') || nome.includes('vegetais a')) return false;
  return true;
}

export function listarSubstituicoesIsocaloricas(
  foodRef: Food,
  quantidadeRef: number,
  unidadeRef: QuantityUnit | string,
  candidatos: Food[],
  opts?: { limit?: number },
): SubstituicaoIsocalorica[] {
  const limit = opts?.limit ?? 100;
  const kcalRef = kcalPorPorcao(foodRef, quantidadeRef, unidadeRef);
  if (kcalRef <= 0 || !canSubstitute(foodRef)) return [];

  const out: SubstituicaoIsocalorica[] = [];

  for (const sub of candidatos) {
    if (!sub || sub.id === foodRef.id) continue;
    if (!sameEquivalenceGroup(foodRef, sub)) continue;
    if (!canSubstitute(sub)) continue;

    const qtd = calcularQuantidadeEquivalente(foodRef, quantidadeRef, unidadeRef, sub);
    if (qtd == null || !Number.isFinite(qtd) || qtd <= 0) continue;

    out.push({
      alimento: sub,
      quantidadeEquivalente: Math.round(qtd * 10) / 10,
      kcalReferencia: Math.round(kcalRef * 10) / 10,
      kcalEquivalente: Math.round(kcalPorPorcao(sub, qtd, 'g') * 10) / 10,
      formula: `(${quantidadeRef}${unidadeRef} → ${kcalRef.toFixed(0)} kcal) ÷ ${sub.calories.toFixed(1)} kcal/100g`,
    });
  }

  out.sort((a, b) =>
    Math.abs(a.quantidadeEquivalente - quantidadeRef) -
    Math.abs(b.quantidadeEquivalente - quantidadeRef),
  );

  return out.slice(0, limit);
}
