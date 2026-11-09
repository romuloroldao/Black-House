/**
 * Substituição (lista completa) e categorias pessoais de alimentos — sem DB (pool falso).
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const subst = require('../services/alimento-substituicoes.service');
const cats = require('../services/coach-food-categories.service');

const TIPO = '11111111-1111-4111-8111-111111111111';

function food(id, nome, kcal) {
  return {
    id,
    nome,
    origem_ptn: 'Vegetal',
    tipo_id: TIPO,
    tipo_nome: 'Carboidratos',
    macro_predominante: 'CHO',
    equiv_livre: false,
    quantidade_referencia_g: 100,
    kcal_por_referencia: kcal,
    ptn_por_referencia: 2,
    cho_por_referencia: 20,
    lip_por_referencia: 1,
    alcool_por_referencia: 0,
    nome_normalizado: nome.toLowerCase(),
  };
}

function fakePool(ref, group) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (/WHERE a\.id = \$1/.test(sql)) return { rows: [ref] };
      return { rows: group };
    },
  };
}

describe('alimento-substituicoes SQL', () => {
  test('referência: colunas extra vêm antes do FROM (regressão "a.info_adicional does not exist")', async () => {
    const ref = food('00000000-0000-4000-8000-000000000001', 'Arroz', 130);
    const pool = fakePool(ref, []);
    await subst.getAlimentoRef(pool, ref.id);
    const sql = pool.calls[0].sql;
    assert.ok(sql.indexOf('a.info_adicional') < sql.indexOf('FROM public.alimentos'));
    assert.ok(!/JOIN[^]*,\s*a\.info_adicional/.test(sql));
  });
});

describe('listSubstituicoes all=1 (lista completa)', () => {
  const ref = food('00000000-0000-4000-8000-000000000001', 'Arroz', 130);
  const group = Array.from({ length: 60 }, (_, i) =>
    food(`00000000-0000-4000-8000-${String(i + 2).padStart(12, '0')}`, `Alimento ${i}`, 100 + i),
  );

  test('devolve o grupo inteiro, sem mínimo de caracteres e sem limite de 20/50', async () => {
    const pool = fakePool(ref, group);
    const out = await subst.listSubstituicoes(pool, { alimentoId: ref.id, all: true, q: 'x', limit: 5 });
    assert.equal(out.substituicoes.length, 60);
    assert.equal(out.mensagem, undefined);
    const grupoSql = pool.calls[1].sql;
    assert.ok(!/ILIKE/.test(grupoSql), 'all ignora o termo de busca');
  });

  test('busca rápida mantém mínimo de 2 caracteres e limite', async () => {
    const pool = fakePool(ref, group);
    const short = await subst.listSubstituicoes(pool, { alimentoId: ref.id, q: 'a' });
    assert.equal(short.substituicoes.length, 0);
    assert.match(short.mensagem, /2 caracteres/);
    const def = await subst.listSubstituicoes(fakePool(ref, group), { alimentoId: ref.id });
    assert.equal(def.substituicoes.length, subst.DEFAULT_LIMIT);
  });
});

describe('coach-food-categories validação', () => {
  test('nome: espaços normalizados, vazio e longo rejeitados', () => {
    assert.equal(cats.cleanNome('  Pães   e  massas '), 'Pães e massas');
    assert.throws(() => cats.cleanNome('   '), (e) => e.statusCode === 400 && e.code_ === 'NOME_OBRIGATORIO');
    assert.throws(() => cats.cleanNome('x'.repeat(61)), (e) => e.code_ === 'NOME_LONGO');
  });

  test('ids: deduplicados, uuid obrigatório, limite 500', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    assert.deepEqual(cats.cleanIds([id, id]), [id]);
    assert.throws(() => cats.cleanIds([]), (e) => e.code_ === 'SEM_ALIMENTOS');
    assert.throws(() => cats.cleanIds(['nope']), (e) => e.statusCode === 400 && e.code_ === 'ALIMENTO_INVALIDO');
    const many = Array.from({ length: 501 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
    assert.throws(() => cats.cleanIds(many), (e) => e.code_ === 'LIMITE_ALIMENTOS');
  });

  test('aluno lê as categorias do seu coach e nunca escreve', async () => {
    const pool = {
      async query(sql) {
        if (/information_schema/.test(sql)) return { rows: [{ column_name: 'user_id' }] };
        return { rows: [{ id: 'aluno-1', coach_id: 'coach-1' }] };
      },
    };
    const owner = await cats.resolveCategoryOwner(pool, { id: 'user-1', role: 'aluno' });
    assert.deepEqual(owner, { ownerId: 'coach-1', canWrite: false });
  });

  test('coach e admin são donos das próprias categorias', async () => {
    const pool = { query: async () => ({ rows: [] }) };
    assert.deepEqual(await cats.resolveCategoryOwner(pool, { id: 'c1', role: 'coach' }), {
      ownerId: 'c1',
      canWrite: true,
    });
    assert.deepEqual(await cats.resolveCategoryOwner(pool, { id: null, role: 'coach' }), {
      ownerId: null,
      canWrite: false,
    });
  });

  test('apagar categoria só remove ligações (alimentos ficam sem categoria)', async () => {
    const calls = [];
    const pool = {
      async query(sql, params) {
        calls.push(sql);
        return { rows: [{ id: params[0], alimentos_liberados: 3 }] };
      },
    };
    const out = await cats.deleteCategory(pool, 'c1', 'cat-1');
    assert.equal(out.alimentos_liberados, 3);
    assert.ok(calls.every((s) => !/DELETE FROM public\.alimentos/.test(s)));
  });
});
