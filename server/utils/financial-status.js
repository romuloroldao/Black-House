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

async function getStudentPaymentStatus(pool, { alunoId = null, email = null } = {}) {
    const aluno = await resolveAlunoForFinancialStatus(pool, { alunoId, email });

    if (!aluno) {
        return {
            payment_status: 'CURRENT',
            aluno: null,
            active_exception: null,
            reason: 'student_not_found',
        };
    }

    const cached = await pool.query(
        'SELECT payment_status, access_status, in_grace_period, grace_days_remaining FROM public.student_access_state WHERE aluno_id = $1 LIMIT 1',
        [aluno.id],
    );
    if (cached.rows[0]) {
        const activeException = await getActiveFinancialException(pool, aluno.id);
        const row = cached.rows[0];
        const effectiveStatus =
          row.access_status === 'blocked' ? row.payment_status
          : row.in_grace_period ? 'CURRENT'
          : row.payment_status;
        return {
            payment_status: effectiveStatus,
            aluno,
            active_exception: activeException,
            access_status: row.access_status,
            in_grace_period: row.in_grace_period,
            grace_days_remaining: row.grace_days_remaining,
            reason: 'access_state_cache',
        };
    }

    const activeException = await getActiveFinancialException(pool, aluno.id);
    if (activeException && NON_BLOCKING_EXCEPTION_TYPES.has(activeException.tipo)) {
        return {
            payment_status: 'CURRENT',
            aluno,
            active_exception: activeException,
            reason: `financial_exception_${activeException.tipo}`,
        };
    }

    const paymentResult = await pool.query(
        `SELECT 
            CASE 
                WHEN status = 'OVERDUE' THEN 'OVERDUE'
                WHEN status = 'PENDING' AND due_date < CURRENT_DATE THEN 'PENDING_AFTER_DUE_DATE'
                ELSE 'CURRENT'
            END as payment_status
         FROM public.asaas_payments 
         WHERE aluno_id = $1
           AND (status = 'OVERDUE' OR (status = 'PENDING' AND due_date < CURRENT_DATE))
         ORDER BY due_date ASC
         LIMIT 1`,
        [aluno.id],
    );

    return {
        payment_status: paymentResult.rows[0]?.payment_status || 'CURRENT',
        aluno,
        active_exception: activeException,
        reason: paymentResult.rows.length > 0 ? 'payment_due' : 'no_overdue_payment',
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
    getStudentPaymentStatus,
    applyFinancialExceptionToAmount,
};
