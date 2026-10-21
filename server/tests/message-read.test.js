const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

/**
 * Espelha a regra de message-read.ts (CJS para node:test).
 */
function isIncomingUnreadMessage(msg, userId) {
  if (!userId || msg.lida) return false;
  if (msg.destinatario_id != null && String(msg.destinatario_id) === String(userId)) {
    return true;
  }
  return msg.remetente_id != null && String(msg.remetente_id) !== String(userId);
}

describe('message unread detection', () => {
  const me = 'aaaaaaaa-0000-4000-8000-000000000001';
  const coach = 'bbbbbbbb-0000-4000-8000-000000000002';

  test('mensagem do coach não lida conta como pendente', () => {
    assert.equal(
      isIncomingUnreadMessage({ lida: false, remetente_id: coach }, me),
      true,
    );
  });

  test('própria mensagem não conta (mesmo não lida)', () => {
    assert.equal(
      isIncomingUnreadMessage({ lida: false, remetente_id: me }, me),
      false,
    );
  });

  test('já lida não conta', () => {
    assert.equal(
      isIncomingUnreadMessage({ lida: true, remetente_id: coach }, me),
      false,
    );
  });

  test('filtro legado por destinatario_id ainda funciona', () => {
    assert.equal(
      isIncomingUnreadMessage(
        { lida: false, remetente_id: coach, destinatario_id: me },
        me,
      ),
      true,
    );
  });

  test('bug antigo: só destinatario_id sem o campo → nunca marcava', () => {
    const msg = { lida: false, remetente_id: coach };
    // critério errado (destinatario_id === me) falhava porque o campo não existe
    assert.equal(msg.destinatario_id === me && !msg.lida, false);
    // critério correcto
    assert.equal(isIncomingUnreadMessage(msg, me), true);
  });
});
