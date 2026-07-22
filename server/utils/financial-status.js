const NON_BLOCKING_EXCEPTION_TYPES = new Set(['isento', 'bolsa', 'acordo_pagamento']);
const NO_AUTO_CHARGE_EXCEPTION_TYPES = new Set(['isento', 'bolsa']);

async function resolveAlunoForFinancialStatus(pool, { alunoId = null, email = null } = {}) {
    if (alunoId) {
        const result = await pool.query(
            'SELECT id, coach_id, email, nome FROM public.alunos WHERE id = $1 LIMIT 1',
            [alunoId],
        );
        return result.rows[0] || null;
    }

    if (email) {
        const result = await pool.query(
            'SELECT id, coach_id, email, nome FROM public.alunos WHERE lower(email) = lower($1) LIMIT 1',
            [email],
        );
        return result.rows[0] || null;
    }

    return null;
}

async function getActiveFinancialException(pool, alunoId) {
    if (!alunoId) return null;

    const result = await pool.query(
        `SELECT *
         FROM public.financial_exceptions
         WHERE aluno_id = $1
           AND ativo = true
           AND data_inicio <= CURRENT_DATE
           AND (data_fim IS NULL OR data_fim >= CURRENT_DATE)
         ORDER BY
           CASE tipo
             WHEN 'isento' THEN 1
             WHEN 'bolsa' THEN 2
             WHEN 'acordo_pagamento' THEN 3
             WHEN 'desconto' THEN 4
             ELSE 9
           END,
           created_at DESC NULLS LAST
         LIMIT 1`,
        [alunoId],
    );

    return result.rows[0] || null;
}

/**
 * Calcula payment_status a partir de asaas_payments (fonte de verdade local).
 * NÃO lê student_access_state — usado pelo motor de recálculo e como fallback.
 *
 * Regras anti-falso-positivo:
 * 1) Ignora OVERDUE quando existe RECEIVED/CONFIRMED quase duplicado
 *    (mesmo valor ±5%, vencimento ±3 dias) — reemissão de parcela.
 * 2) Ignora OVERDUE de planos antigos quando já existe série mais recente
 *    RECEIVED/CONFIRMED com vencimento posterior ao overdue.
 */
async function computePaymentStatusFromPayments(pool, alunoId) {
    const paymentResult = await pool.query(
        `SELECT p.status,
                p.due_date,
                CASE
                  WHEN p.status = 'OVERDUE' THEN 'OVERDUE'
                  WHEN p.status = 'PENDING' AND p.due_date < CURRENT_DATE THEN 'PENDING_AFTER_DUE_DATE'
                  ELSE 'CURRENT'
                END AS payment_status
         FROM public.asaas_payments p
         WHERE p.aluno_id = $1
           AND p.deleted_at IS NULL
           AND (p.status = 'OVERDUE' OR (p.status = 'PENDING' AND p.due_date < CURRENT_DATE))
           AND NOT EXISTS (
             -- Duplicata reemitida (quase mesmo valor/data)
             SELECT 1
             FROM public.asaas_payments s
             WHERE s.aluno_id = p.aluno_id
               AND s.deleted_at IS NULL
               AND s.id <> p.id
               AND s.status IN ('RECEIVED', 'CONFIRMED')
               AND s.due_date IS NOT NULL
               AND p.due_date IS NOT NULL
               AND ABS(s.due_date::date - p.due_date::date) <= 3
               AND ABS(COALESCE(s.value, 0) - COALESCE(p.value, 0))
                   <= GREATEST(COALESCE(p.value, 0) * 0.05, 1)
           )
           AND NOT EXISTS (
             -- Plano/série mais recente (dívida antiga > 60 dias com pagamento posterior)
             SELECT 1
             FROM public.asaas_payments newer
             WHERE newer.aluno_id = p.aluno_id
               AND newer.deleted_at IS NULL
               AND newer.id <> p.id
               AND newer.status IN ('RECEIVED', 'CONFIRMED')
               AND newer.due_date IS NOT NULL
               AND p.due_date IS NOT NULL
               AND newer.due_date::date > p.due_date::date
               AND p.due_date::date < (CURRENT_DATE - INTERVAL '60 days')
           )
         ORDER BY p.due_date ASC NULLS LAST
         LIMIT 1`,
        [alunoId],
    );

    if (!paymentResult.rows[0]) {
        return {
            payment_status: 'CURRENT',
            oldest_due: null,
            reason: 'no_overdue_payment',
        };
    }

    return {
        payment_status: paymentResult.rows[0].payment_status,
        oldest_due: paymentResult.rows[0].due_date || null,
        reason: 'payment_due',
    };
}

/**
 * @param {object} opts
 * @param {string|null} opts.alunoId
 * @param {string|null} opts.email
 * @param {boolean} [opts.bypassCache] — se true, ignora student_access_state
 */
async function getStudentPaymentStatus(pool, { alunoId = null, email = null, bypassCache = false } = {}) {
    const aluno = await resolveAlunoForFinancialStatus(pool, { alunoId, email });

    if (!aluno) {
        return {
            payment_status: 'CURRENT',
            aluno: null,
            active_exception: null,
            reason: 'student_not_found',
        };
    }

    const activeException = await getActiveFinancialException(pool, aluno.id);
    if (activeException && NON_BLOCKING_EXCEPTION_TYPES.has(activeException.tipo)) {
        return {
            payment_status: 'CURRENT',
            aluno,
            active_exception: activeException,
            access_status: 'granted',
            in_grace_period: false,
            grace_days_remaining: null,
            reason: `financial_exception_${activeException.tipo}`,
        };
    }

    if (!bypassCache) {
        const cached = await pool.query(
            `SELECT payment_status, access_status, in_grace_period, grace_days_remaining
             FROM public.student_access_state WHERE aluno_id = $1 LIMIT 1`,
            [aluno.id],
        );
        if (cached.rows[0]) {
            const row = cached.rows[0];
            // Se a cache diz granted mas payment_status ainda é bloqueante, confiar no access_status
            // só quando in_grace; caso contrário, se access granted e status OVERDUE, revalidar nos pagamentos.
            if (row.access_status === 'blocked') {
                return {
                    payment_status: row.payment_status,
                    aluno,
                    active_exception: activeException,
                    access_status: row.access_status,
                    in_grace_period: row.in_grace_period,
                    grace_days_remaining: row.grace_days_remaining,
                    reason: 'access_state_cache',
                };
            }
            if (row.in_grace_period) {
                return {
                    payment_status: 'CURRENT',
                    aluno,
                    active_exception: activeException,
                    access_status: row.access_status,
                    in_grace_period: true,
                    grace_days_remaining: row.grace_days_remaining,
                    reason: 'access_state_cache_grace',
                };
            }
            // access granted: se payment_status cache ainda é bloqueante, recalcular dos pagamentos
            // (corrige cache stale após pagamento).
            if (
                row.payment_status === 'OVERDUE' ||
                row.payment_status === 'PENDING_AFTER_DUE_DATE'
            ) {
                const fresh = await computePaymentStatusFromPayments(pool, aluno.id);
                return {
                    payment_status: fresh.payment_status,
                    aluno,
                    active_exception: activeException,
                    access_status: fresh.payment_status === 'CURRENT' ? 'granted' : row.access_status,
                    in_grace_period: false,
                    grace_days_remaining: null,
                    reason: fresh.reason === 'no_overdue_payment'
                        ? 'cache_stale_healed'
                        : 'access_state_cache_revalidated',
                    oldest_due: fresh.oldest_due,
                };
            }
            return {
                payment_status: row.payment_status || 'CURRENT',
                aluno,
                active_exception: activeException,
                access_status: row.access_status,
                in_grace_period: row.in_grace_period,
                grace_days_remaining: row.grace_days_remaining,
                reason: 'access_state_cache',
            };
        }
    }

    const fresh = await computePaymentStatusFromPayments(pool, aluno.id);
    return {
        payment_status: fresh.payment_status,
        aluno,
        active_exception: activeException,
        reason: fresh.reason,
        oldest_due: fresh.oldest_due,
    };
}

function applyFinancialExceptionToAmount(value, activeException) {
    const originalValue = Number(value);
    if (!Number.isFinite(originalValue) || originalValue <= 0) {
        return {
            shouldCharge: false,
            value: 0,
            originalValue,
            reason: 'invalid_value',
        };
    }

    if (!activeException) {
        return {
            shouldCharge: true,
            value: originalValue,
            originalValue,
            reason: null,
        };
    }

    if (NO_AUTO_CHARGE_EXCEPTION_TYPES.has(activeException.tipo)) {
        return {
            shouldCharge: false,
            value: 0,
            originalValue,
            reason: `financial_exception_${activeException.tipo}`,
        };
    }

    if (activeException.tipo === 'desconto') {
        let discountedValue = originalValue;

        if (activeException.percentual_desconto != null) {
            const percent = Number(activeException.percentual_desconto);
            if (Number.isFinite(percent) && percent > 0) {
                discountedValue -= originalValue * Math.min(percent, 100) / 100;
            }
        }

        if (activeException.valor_desconto != null) {
            const discount = Number(activeException.valor_desconto);
            if (Number.isFinite(discount) && discount > 0) {
                discountedValue -= discount;
            }
        }

        discountedValue = Math.max(0, Number(discountedValue.toFixed(2)));

        return {
            shouldCharge: discountedValue > 0,
            value: discountedValue,
            originalValue,
            reason: 'financial_exception_desconto',
        };
    }

    return {
        shouldCharge: true,
        value: originalValue,
        originalValue,
        reason: `financial_exception_${activeException.tipo}`,
    };
}

module.exports = {
    NON_BLOCKING_EXCEPTION_TYPES,
    NO_AUTO_CHARGE_EXCEPTION_TYPES,
    getActiveFinancialException,
    computePaymentStatusFromPayments,
    getStudentPaymentStatus,
    applyFinancialExceptionToAmount,
};
