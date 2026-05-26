const { getAlunoUserLinkColumn } = require('./aluno-link-column');

function isTechnicalImportEmail(email) {
    if (!email) return false;
    const e = String(email).trim().toLowerCase();
    return e.includes('@blackhouse.local') || /^import-/.test(e);
}

/**
 * Estado do acesso do aluno ao portal (/portal-aluno).
 */
async function getAlunoPortalStatus(pool, alunoId, { coachId, isAdmin }) {
    const linkCol = await getAlunoUserLinkColumn(pool);

    const alunoRes = await pool.query(
        `SELECT id, nome, email, coach_id, ${linkCol} AS link_user_id FROM public.alunos WHERE id = $1`,
        [alunoId],
    );
    if (alunoRes.rows.length === 0) {
        return { error: 'NOT_FOUND' };
    }
    const aluno = alunoRes.rows[0];
    if (!isAdmin && coachId && aluno.coach_id && String(aluno.coach_id) !== String(coachId)) {
        return { error: 'FORBIDDEN' };
    }

    const alunoEmail = String(aluno.email || '').trim();
    const technicalEmail = isTechnicalImportEmail(alunoEmail);

    let lastCheckinAt = null;
    try {
        const chk = await pool.query(
            `SELECT created_at FROM public.weekly_checkins
             WHERE aluno_id = $1 ORDER BY created_at DESC NULLS LAST LIMIT 1`,
            [alunoId],
        );
        lastCheckinAt = chk.rows[0]?.created_at ?? null;
    } catch {
        /* tabela pode não existir em ambientes antigos */
    }

    let lastImportAt = null;
    try {
        const imp = await pool.query(
            `SELECT created_at FROM public.importacoes
             WHERE aluno_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [alunoId],
        );
        lastImportAt = imp.rows[0]?.created_at ?? null;
    } catch {
        /* importacoes opcional */
    }

    const hints = [];
    const base = {
        aluno_id: aluno.id,
        aluno_nome: aluno.nome,
        aluno_email: alunoEmail,
        is_technical_import_email: technicalEmail,
        user_id: null,
        credential_email: null,
        email_confirmed_at: null,
        email_match_candidate: null,
        last_checkin_at: lastCheckinAt,
        last_import_at: lastImportAt,
        hints,
    };

    if (aluno.link_user_id) {
        const userRes = await pool.query(
            `SELECT id, email, email_confirmed_at FROM app_auth.users WHERE id = $1`,
            [aluno.link_user_id],
        );
        const user = userRes.rows[0];
        if (!user) {
            return {
                ...base,
                status: 'no_access',
                hints: ['Vínculo inválido na ficha — credencial não encontrada. Revincule em Vínculos.'],
            };
        }
        const confirmed = Boolean(user.email_confirmed_at);
        if (confirmed) {
            hints.push('O aluno pode usar o portal com o email da credencial vinculada.');
            if (lastCheckinAt) {
                hints.push('Último check-in semanal registado no portal.');
            }
            return {
                ...base,
                status: 'active',
                user_id: user.id,
                credential_email: user.email,
                email_confirmed_at: user.email_confirmed_at,
                hints,
            };
        }
        return {
            ...base,
            status: 'pending_email',
            user_id: user.id,
            credential_email: user.email,
            email_confirmed_at: null,
            hints: [
                'Credencial vinculada, mas o email ainda não foi confirmado.',
                'O aluno deve abrir o link de confirmação enviado no registo.',
            ],
        };
    }

    let emailMatchCandidate = null;
    if (alunoEmail && !technicalEmail) {
        const matchRes = await pool.query(
            `SELECT u.id, u.email, u.email_confirmed_at
             FROM app_auth.users u
             INNER JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'aluno'
             WHERE LOWER(TRIM(u.email)) = LOWER(TRIM($1))
               AND NOT EXISTS (
                 SELECT 1 FROM public.alunos a WHERE a.${linkCol} = u.id
               )
             LIMIT 1`,
            [alunoEmail],
        );
        if (matchRes.rows[0]) {
            emailMatchCandidate = {
                user_id: matchRes.rows[0].id,
                email: matchRes.rows[0].email,
                email_confirmed_at: matchRes.rows[0].email_confirmed_at,
            };
        }
    }

    if (emailMatchCandidate) {
        const canLink = Boolean(emailMatchCandidate.email_confirmed_at);
        hints.push(
            canLink
                ? `Encontrámos cadastro no portal com o mesmo email (${emailMatchCandidate.email}).`
                : `Cadastro com email igual existe, mas ainda sem confirmação de email.`,
        );
        return {
            ...base,
            status: 'match_available',
            email_match_candidate: emailMatchCandidate,
            hints,
        };
    }

    if (technicalEmail) {
        hints.push(
            'Email técnico de importação — o aluno precisa de criar cadastro no portal ou vincular credencial em Vínculos.',
        );
    } else {
        hints.push(
            'Sem credencial vinculada — o aluno ainda não acede ao portal com esta ficha.',
        );
        hints.push('Convide o aluno a registar-se ou vincule manualmente em Vínculos.');
    }

    return {
        ...base,
        status: 'no_access',
        email_match_candidate: null,
        hints,
    };
}

module.exports = {
    getAlunoPortalStatus,
    isTechnicalImportEmail,
};
