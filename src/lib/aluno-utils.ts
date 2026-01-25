// ============================================================================
// UTILITÁRIOS PARA BUSCAR ALUNO
// ============================================================================
// DESIGN-ALUNO-CANONICO-UNIFICADO-005: Aluno canônico sempre via GET /api/alunos/me
// Esta função está DEPRECATED - Use apiClient.getMe() diretamente
// ============================================================================

import { apiClient } from "./api-client";

/**
 * @deprecated DESIGN-ALUNO-CANONICO-UNIFICADO-005
 * Use apiClient.getMe() diretamente ao invés desta função
 * 
 * Busca o aluno vinculado ao usuário autenticado via rota canônica
 * 
 * @param userId - ID do usuário autenticado (user.id) - não usado mais
 * @param userEmail - Email do usuário autenticado (user.email) - não usado mais
 * @returns Aluno encontrado ou null
 */
export async function getAlunoByUser(userId: string, userEmail?: string) {
  try {
    // DESIGN-ALUNO-CANONICO-UNIFICADO-005: Usar rota canônica GET /api/alunos/me
    const aluno = await apiClient.getMe();
    return aluno || null;
  } catch (error) {
    console.error("Erro ao buscar aluno:", error);
    return null;
  }
}
