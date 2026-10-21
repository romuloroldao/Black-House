/**
 * Endpoint para criar pagamento no Asaas
 * Substitui a Edge Function do Supabase
 */

// Este endpoint requer integração com SDK do Asaas
// Por enquanto, retorna estrutura básica que pode ser expandida

async function createAsaasPayment(pool, req) {
    const { alunoId, value, billingType, dueDate, description } = req.body;
    const coachId = req.user.id;

    if (!alunoId || !value || !billingType || !dueDate) {
        throw new Error('Campos obrigatórios: alunoId, value, billingType, dueDate');
    }

    // TODO: Implementar integração com Asaas SDK
    // Por enquanto, criar registro local no banco
    // Quando integrar Asaas SDK, fazer chamada real à API
    
    // 1. Buscar dados do aluno
    const alunoResult = await pool.query(
        'SELECT * FROM public.alunos WHERE id = $1 AND coach_id = $2',
        [alunoId, coachId]
    );

    if (alunoResult.rows.length === 0) {
        throw new Error('Aluno não encontrado');
    }

    const aluno = alunoResult.rows[0];

    // 2. Criar pagamento no banco local
    // Quando integrado com Asaas, criar cliente e pagamento via SDK primeiro
    const paymentResult = await pool.query(
        `INSERT INTO public.asaas_payments (
            aluno_id, 
            coach_id, 
            value, 
            billing_type, 
            due_date, 
            description,
            status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
        RETURNING *`,
        [alunoId, coachId, value, billingType, dueDate, description || null]
    );

    const payment = paymentResult.rows[0];

    // TODO: Quando Asaas SDK estiver configurado:
    // - Criar/buscar cliente no Asaas
    // - Criar pagamento no Asaas
    // - Atualizar registro local com payment_id do Asaas, pix_copy_paste, invoice_url, etc.

    return {
        success: true,
        payment: {
            id: payment.id,
            aluno_id: payment.aluno_id,
            value: payment.value,
            billing_type: payment.billing_type,
            due_date: payment.due_date,
            description: payment.description,
            status: payment.status,
            // TODO: Adicionar campos do Asaas quando integrado:
            // payment_id: asaasPayment.id,
            // pix_copy_paste: asaasPayment.pixCopyPaste,
            // invoice_url: asaasPayment.invoiceUrl,
        }
    };
}

module.exports = { createAsaasPayment };
