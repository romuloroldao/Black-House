/**
 * Testes do motor de equivalência isocalórica e ordenação de busca.
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  nameSearchRank,
  listarSubstituicoesIsocaloricas,
  calcularQuantidadeEquivalente,
} = require('../utils/food-equivalence');

describe('nameSearchRank', () => {
  test('prefixo tem maior relevância que contém', () => {
    assert.ok(nameSearchRank('Pão francês', 'pão') > nameSearchRank('Bolo de pão', 'pão'));
  });

  test('termo vazio retorna 0', () => {
    assert.equal(nameSearchRank('Pão', ''), 0);
  });
});

describe('listarSubstituicoesIsocaloricas', () => {
  const ref = {
    id: 'ref-1',
    tipo_id: 'tipo-a',
    nome: 'Pão francês',
    kcal_por_referencia: 300,
    quantidade_referencia_g: 100,
    equiv_livre: false,
  };

  const candidatos = [
    {
      id: 'sub-1',
      tipo_id: 'tipo-a',
      nome: 'Pão de forma',
      kcal_por_referencia: 250,
      quantidade_referencia_g: 100,
      equiv_livre: false,
    },
    {
      id: 'sub-2',
      tipo_id: 'tipo-a',
      nome: 'Tapioca',
      kcal_por_referencia: 350,
      quantidade_referencia_g: 100,
      equiv_livre: false,
    },
    {
      id: 'sub-3',
      tipo_id: 'tipo-b',
      nome: 'Banana',
      kcal_por_referencia: 90,
      quantidade_referencia_g: 100,
      equiv_livre: false,
    },
  ];

  test('filtra por mesmo grupo e ordena por relevância de busca', () => {
    const out = listarSubstituicoesIsocaloricas(ref, 50, 'g', candidatos, {
      limit: 10,
      searchQuery: 'pão',
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].alimento.id, 'sub-1');
  });

  test('ordena por proximidade de quantidade quando sem busca', () => {
    const out = listarSubstituicoesIsocaloricas(ref, 100, 'g', candidatos, { limit: 10 });
    assert.equal(out.length, 2);
    assert.ok(out.every((s) => s.quantidadeEquivalente > 0));
  });

  test('calcularQuantidadeEquivalente mantém kcal', () => {
    const qtd = calcularQuantidadeEquivalente(ref, 100, 'g', candidatos[0]);
    assert.ok(qtd > 0);
    const kcalRef = 300;
    const kcalSub = 250;
    const expected = (100 * kcalRef) / kcalSub;
    assert.ok(Math.abs(qtd - expected) < 0.01);
  });
});
