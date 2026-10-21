const logger = require('../utils/logger');

function inferArquivoTipo(nome) {
    if (!nome) return null;
    const lower = String(nome).toLowerCase();
    if (lower.endsWith('.pdf')) return 'pdf';
    if (lower.endsWith('.csv')) return 'csv';
    if (lower.endsWith('.xlsx')) return 'xlsx';
    return 'outro';
}

function buildImportResumo({ modo, dieta, stats, replaceActiveDiet, alunoNome }) {
    const parts = [];
    if (modo === 'create') {
        parts.push(alunoNome ? `Novo aluno: ${alunoNome}` : 'Novo aluno');
    } else {
        parts.push('Dieta vinculada');
    }
    if (dieta?.nome) parts.push(`"${String(dieta.nome).trim()}"`);
    const itens = stats?.itens_criados;
    if (typeof itens === 'number' && itens > 0) {
        parts.push(`${itens} item(ns)`);
    }
    const refeicoes = stats?.refeicoes_criadas;
    if (typeof refeicoes === 'number' && refeicoes > 0) {
        parts.push(`${refeicoes} refeição(ões)`);
    }
    if (replaceActiveDiet) parts.push('substituiu dieta activa');
    return parts.join(' · ') || 'Importação concluída';
}

/**
 * @param {import('pg').PoolClient} client
 */
async function insertImportHistory(client, row) {
    const {
        coachId,
        alunoId,
        modo,
        meta = {},
        dietaId = null,
        replaceActiveDiet = false,
        stats = {},
        dieta = null,
        alunoNome = null,
    } = row;

    const arquivoNome = meta.arquivo_nome || meta.fileName || null;
    const arquivoTipo = meta.arquivo_tipo || inferArquivoTipo(arquivoNome);
    const resumo = buildImportResumo({
        modo,
        dieta,
        stats,
        replaceActiveDiet,
        alunoNome,
    });

    const result = await client.query(
        `INSERT INTO public.importacoes (
            coach_id, aluno_id, modo, arquivo_nome, arquivo_tipo,
            dieta_id, replace_active_diet, stats, resumo
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
        RETURNING id, created_at, resumo`,
        [
            coachId,
            alunoId,
            modo,
            arquivoNome,
            arquivoTipo,
            dietaId,
            Boolean(replaceActiveDiet),
            JSON.stringify(stats || {}),
            resumo,
        ],
    );

    logger.info('Importação registada no histórico', {
        importacao_id: result.rows[0]?.id,
        aluno_id: alunoId,
        modo,
    });

    return result.rows[0];
}

async function listImportHistory(db, { coachId, userRole, alunoId, limit = 20 }) {
    const safeLimit = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 100);
    const params = [];
    const conditions = [];

    if (alunoId) {
        params.push(alunoId);
        conditions.push(`i.aluno_id = $${params.length}`);
    }

    if (userRole !== 'admin') {
        params.push(coachId);
        conditions.push(`i.coach_id = $${params.length}`);
    }

    params.push(safeLimit);
    const limitIdx = params.length;

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await db.query(
        `SELECT
            i.id,
            i.created_at,
            i.coach_id,
            i.aluno_id,
            i.modo,
            i.arquivo_nome,
            i.arquivo_tipo,
            i.dieta_id,
            i.replace_active_diet,
            i.stats,
            i.resumo,
            a.nome AS aluno_nome,
            d.nome AS dieta_nome
        FROM public.importacoes i
        INNER JOIN public.alunos a ON a.id = i.aluno_id
        LEFT JOIN public.dietas d ON d.id = i.dieta_id
        ${where}
        ORDER BY i.created_at DESC
        LIMIT $${limitIdx}`,
        params,
    );

    return rows;
}

module.exports = {
    insertImportHistory,
    listImportHistory,
    buildImportResumo,
};
