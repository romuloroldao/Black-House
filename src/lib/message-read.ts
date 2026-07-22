/**
 * Mensagens no schema actual NÃO têm destinatario_id.
 * Não lida = lida=false e remetente ≠ utilizador actual (mensagem recebida).
 */
export function isIncomingUnreadMessage(
  msg: { lida?: boolean | null; remetente_id?: string | null; destinatario_id?: string | null },
  userId: string | undefined | null,
): boolean {
  if (!userId || msg.lida) return false;
  // Compat: se algum payload legado ainda enviar destinatario_id, aceitar.
  if (msg.destinatario_id != null && String(msg.destinatario_id) === String(userId)) {
    return true;
  }
  return msg.remetente_id != null && String(msg.remetente_id) !== String(userId);
}

export function countIncomingUnread(
  mensagens: Array<{ lida?: boolean | null; remetente_id?: string | null; destinatario_id?: string | null }>,
  userId: string | undefined | null,
): number {
  if (!userId || !Array.isArray(mensagens)) return 0;
  return mensagens.filter((m) => isIncomingUnreadMessage(m, userId)).length;
}
