// Webhook Routes
// Endpoints para receber webhooks externos (Asaas, etc)

const express = require('express');
const router = express.Router();

class WebhookController {
    constructor(pool, notificationService, asaasWebhookToken) {
        this.pool = pool;
        this.notificationService = notificationService;
        this.asaasWebhookToken = asaasWebhookToken;
    }

    /**
     * Valida assinatura do webhook do Asaas
     */
    validateAsaasSignature(req) {
        // Asaas envia token no header ou no body
        const token = req.headers['asaas-access-token'] || req.body.token;
        
        if (!token) {
            return false;
        }

        // Validação segura (timing-safe)
        const crypto = require('crypto');
        return crypto.timingSafeEqual(
            Buffer.from(token),
            Buffer.from(this.asaasWebhookToken)
        );
    }

    /**
     * Valida IP do webhook (se whitelist configurada)
     */
    validateIP(req) {
        const whitelist = process.env.ASAAS_WEBHOOK_IP_WHITELIST;
        
        if (!whitelist) {
            // Se não houver whitelist, permitir todos (não recomendado em produção)
            return true;
        }

        const allowedIPs = whitelist.split(',').map(ip => ip.trim());
        const clientIP = req.ip || req.connection.remoteAddress;
        
        return allowedIPs.includes(clientIP);
    }

    /**
     * Valida tamanho do payload
     */
    validatePayloadSize(req) {
        const contentLength = parseInt(req.get('content-length') || '0');
        const maxSize = 1024 * 1024; // 1MB
        
        return contentLength <= maxSize;
    }

    /**
     * Handler para webhooks do Asaas
     */
    async handleAsaasWebhook(req, res) {
        const startTime = Date.now();
        
        try {
            // Validar tamanho do payload
            if (!this.validatePayloadSize(req)) {
                console.warn('[Webhook] Payload muito grande');
                return res.status(413).json({ error: 'Payload muito grande' });
            }

            // Validar IP (se whitelist configurada)
            if (!this.validateIP(req)) {
                console.warn('[Webhook] IP não autorizado:', req.ip);
                return res.status(403).json({ error: 'IP não autorizado' });
            }

            // Validar assinatura
            if (!this.validateAsaasSignature(req)) {
                console.warn('[Webhook] Tentativa de webhook não autorizada');
                return res.status(401).json({ error: 'Não autorizado' });
            }

            const event = req.body.event;
            const payment = req.body.payment;

            console.log(`[Webhook] Evento recebido do Asaas: ${event}`, payment);

            // Buscar pagamento no banco pelo externalReference ou payment_id
            let paymentRecord = null;
            
            if (payment.externalReference) {
                // Extrair ID do aluno do externalReference (formato: payment_{alunoId}_{timestamp})
                const match = payment.externalReference.match(/payment_(\d+)_/);
                if (match) {
                    const alunoId = match[1];
                    const result = await this.pool.query(
                        `SELECT * FROM public.asaas_payments 
                         WHERE aluno_id = $1 
                         ORDER BY created_at DESC 
                         LIMIT 1`,
                        [alunoId]
                    );
                    if (result.rows.length > 0) {
                        paymentRecord = result.rows[0];
                    }
                }
            }

            // Se não encontrou pelo externalReference, buscar pelo payment_id do Asaas
            if (!paymentRecord && payment.id) {
                const result = await this.pool.query(
                    'SELECT * FROM public.asaas_payments WHERE asaas_payment_id = $1',
                    [payment.id]
                );
                if (result.rows.length > 0) {
                    paymentRecord = result.rows[0];
                }
            }

            if (!paymentRecord) {
                console.warn(`[Webhook] Pagamento não encontrado no banco: ${payment.id || payment.externalReference}`);
                return res.status(404).json({ error: 'Pagamento não encontrado' });
            }

            // Mapear evento para status
            const statusMap = {
                'PAYMENT_RECEIVED': 'RECEIVED',
                'PAYMENT_CONFIRMED': 'CONFIRMED',
                'PAYMENT_OVERDUE': 'OVERDUE',
                'PAYMENT_DELETED': 'CANCELLED',
                'PAYMENT_RESTORED': 'PENDING'
            };

            const newStatus = statusMap[event] || paymentRecord.status;

            // Atualizar status no banco
            await this.pool.query(
                `UPDATE public.asaas_payments 
                 SET status = $1, 
                     asaas_payment_id = COALESCE($2, asaas_payment_id),
                     pix_copy_paste = COALESCE($3, pix_copy_paste),
                     invoice_url = COALESCE($4, invoice_url),
                     updated_at = NOW()
                 WHERE id = $5`,
                [
                    newStatus,
                    payment.id || paymentRecord.asaas_payment_id,
                    payment.pixCopyPaste || payment.pix?.copyPaste || paymentRecord.pix_copy_paste,
                    payment.invoiceUrl || payment.invoiceUrl || paymentRecord.invoice_url,
                    paymentRecord.id
                ]
            );

            // Buscar coach_id do aluno
            const alunoResult = await this.pool.query(
                'SELECT coach_id FROM public.alunos WHERE id = $1',
                [paymentRecord.aluno_id]
            );

            if (alunoResult.rows.length > 0) {
                const coachId = alunoResult.rows[0].coach_id;

                // Notificar via WebSocket
                await this.notificationService.notifyPaymentStatus(
                    paymentRecord.id,
                    coachId,
                    newStatus,
                    {
                        asaasPaymentId: payment.id,
                        pixCopyPaste: payment.pixCopyPaste || payment.pix?.copyPaste,
                        invoiceUrl: payment.invoiceUrl
                    }
                );
            }

            // Salvar evento do webhook para auditoria
            await this.pool.query(
                `INSERT INTO public.webhook_events 
                 (source, event_type, payload, processed, created_at)
                 VALUES ($1, $2, $3, true, NOW())`,
                ['asaas', event, JSON.stringify(req.body)]
            );

            console.log(`[Webhook] Pagamento ${paymentRecord.id} atualizado para status ${newStatus}`);

            res.json({ success: true, message: 'Webhook processado' });
        } catch (error) {
            console.error('[Webhook] Erro ao processar webhook do Asaas:', error);
            
            // Salvar evento com erro
            try {
                await this.pool.query(
                    `INSERT INTO public.webhook_events 
                     (source, event_type, payload, processed, error_message, created_at)
                     VALUES ($1, $2, $3, false, $4, NOW())`,
                    ['asaas', req.body.event || 'UNKNOWN', JSON.stringify(req.body), error.message]
                );
            } catch (dbError) {
                console.error('[Webhook] Erro ao salvar evento de webhook:', dbError);
            }

            res.status(500).json({ error: 'Erro ao processar webhook' });
        }
    }
}

/**
 * Factory function para criar router de webhooks
 */
function createWebhookRouter(pool, notificationService, asaasWebhookToken) {
    const router = express.Router();
    const controller = new WebhookController(pool, notificationService, asaasWebhookToken);

    // Webhook do Asaas
    router.post('/asaas', (req, res) => controller.handleAsaasWebhook(req, res));

    return router;
}

module.exports = createWebhookRouter;
