// Asaas Service
// Integração completa com API do Asaas para pagamentos

const axios = require('axios');

function normalizeAsaasApiKey(raw) {
    const value = String(raw ?? '')
        .normalize('NFKC')
        // Remove whitespace/control chars e zero-width comuns de copy/paste
        .replace(/[\s\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g, '')
        // Remove aspas/backticks acidentais no início/fim (copy/paste)
        .replace(/^['"`]+|['"`]+$/g, '')
        // Garante header-safe (Node): mantém apenas ASCII visível
        .replace(/[^\x21-\x7E]/g, '')
        .trim();

    if (!value) {
        const err = new Error('Chave API Asaas inválida ou vazia.');
        err.statusCode = 400;
        throw err;
    }

    return value;
}

class AsaasService {
    constructor(apiKey, environment = 'production') {
        this.apiKey = normalizeAsaasApiKey(apiKey);
        this.environment = environment;
        this.baseURL = environment === 'production' 
            ? 'https://www.asaas.com/api/v3'
            : 'https://sandbox.asaas.com/api/v3';
        
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'access_token': this.apiKey,
                'Content-Type': 'application/json'
            },
            timeout: parseInt(process.env.ASAAS_TIMEOUT) || 10000 // 10 segundos
        });
    }

    /**
     * Cria ou busca cliente no Asaas
     */
    async createOrGetCustomer({ name, email, cpfCnpj, phone, externalId }) {
        try {
            // Tentar buscar cliente existente pelo externalId
            if (externalId) {
                try {
                    const searchResult = await this.client.get('/customers', {
                        params: { externalReference: externalId }
                    });

                    if (searchResult.data.data && searchResult.data.data.length > 0) {
                        return searchResult.data.data[0];
                    }
                } catch (error) {
                    // Cliente não encontrado, continuar para criar
                }
            }

            // Criar novo cliente
            const customerData = {
                name,
                email,
                cpfCnpj,
                phone,
                externalReference: externalId
            };

            const response = await this.client.post('/customers', customerData);
            return response.data;
        } catch (error) {
            console.error('Erro ao criar/buscar cliente no Asaas:', error.response?.data || error.message);
            throw new Error(`Erro ao criar cliente no Asaas: ${error.response?.data?.errors?.[0]?.description || error.message}`);
        }
    }

    /**
     * Cria pagamento no Asaas
     */
    async createPayment({ 
        customerId, 
        value, 
        billingType, 
        dueDate, 
        description,
        externalReference,
        installmentCount,
        installmentValue
    }) {
        try {
            const paymentData = {
                customer: customerId,
                billingType: billingType || 'BOLETO', // BOLETO, PIX, CREDIT_CARD
                value: parseFloat(value).toFixed(2),
                dueDate: dueDate,
                description: description || 'Pagamento',
                externalReference: externalReference
            };

            // Se for parcelado
            if (installmentCount && installmentCount > 1) {
                paymentData.installmentCount = installmentCount;
                paymentData.installmentValue = parseFloat(installmentValue).toFixed(2);
            }

            const response = await this.client.post('/payments', paymentData);
            return response.data;
        } catch (error) {
            console.error('Erro ao criar pagamento no Asaas:', error.response?.data || error.message);
            throw new Error(`Erro ao criar pagamento no Asaas: ${error.response?.data?.errors?.[0]?.description || error.message}`);
        }
    }

    /**
     * Busca pagamento por ID
     */
    async getPayment(paymentId) {
        try {
            const response = await this.client.get(`/payments/${paymentId}`);
            return response.data;
        } catch (error) {
            console.error('Erro ao buscar pagamento no Asaas:', error.response?.data || error.message);
            throw new Error(`Erro ao buscar pagamento no Asaas: ${error.message}`);
        }
    }

    /**
     * Verifica se a chave API e o ambiente (sandbox/produção) estão correctos.
     */
    async verifyConnection() {
        try {
            const response = await this.client.get('/customers', { params: { limit: 1 } });
            return { ok: true, object: response.data?.object, totalCount: response.data?.totalCount };
        } catch (error) {
            const msg =
                error.response?.data?.errors?.[0]?.description ||
                error.response?.data?.message ||
                error.message;
            const err = new Error(msg || 'Falha ao contactar a API Asaas');
            err.statusCode = error.response?.status;
            throw err;
        }
    }

    /**
     * Cancela pagamento
     */
    async cancelPayment(paymentId) {
        try {
            const response = await this.client.delete(`/payments/${paymentId}`);
            return response.data;
        } catch (error) {
            console.error('Erro ao cancelar pagamento no Asaas:', error.response?.data || error.message);
            throw new Error(`Erro ao cancelar pagamento no Asaas: ${error.message}`);
        }
    }

    async updateCustomer(customerId, data) {
        try {
            const response = await this.client.put(`/customers/${customerId}`, {
                name: data.name,
                email: data.email,
                cpfCnpj: data.cpfCnpj,
                phone: data.phone,
                externalReference: data.externalReference,
            });
            return response.data;
        } catch (error) {
            console.error('Erro ao atualizar cliente no Asaas:', error.response?.data || error.message);
            throw new Error(`Erro ao atualizar cliente no Asaas: ${error.response?.data?.errors?.[0]?.description || error.message}`);
        }
    }

    async listCustomers({ offset = 0, limit = 100 } = {}) {
        const response = await this.client.get('/customers', { params: { offset, limit } });
        return response.data;
    }

    async listPayments({ offset = 0, limit = 100, updatedSince = null } = {}) {
        const params = { offset, limit };
        if (updatedSince) params['dateUpdated[ge]'] = updatedSince;
        const response = await this.client.get('/payments', { params });
        return response.data;
    }

    async listSubscriptions({ offset = 0, limit = 100 } = {}) {
        const response = await this.client.get('/subscriptions', { params: { offset, limit } });
        return response.data;
    }

    async createSubscription(data) {
        const response = await this.client.post('/subscriptions', data);
        return response.data;
    }

    async updateSubscription(subscriptionId, data) {
        const response = await this.client.put(`/subscriptions/${subscriptionId}`, data);
        return response.data;
    }

    async cancelSubscription(subscriptionId) {
        const response = await this.client.delete(`/subscriptions/${subscriptionId}`);
        return response.data;
    }

    async createWebhook(data) {
        const response = await this.client.post('/webhooks', data);
        return response.data;
    }

    async updateWebhook(webhookId, data) {
        const response = await this.client.put(`/webhooks/${webhookId}`, data);
        return response.data;
    }

    async listWebhooks() {
        const response = await this.client.get('/webhooks');
        return response.data;
    }

    async deleteWebhook(webhookId) {
        const response = await this.client.delete(`/webhooks/${webhookId}`);
        return response.data;
    }

    /**
     * Cria pagamento completo (cliente + pagamento) — legado; preferir outbound-commander
     */
    async createCompletePayment({ 
        alunoId,
        alunoNome,
        alunoEmail,
        alunoCpf,
        alunoTelefone,
        value,
        billingType,
        dueDate,
        description,
        installmentCount,
        installmentValue
    }) {
        try {
            // Criar ou buscar cliente
            const customer = await this.createOrGetCustomer({
                name: alunoNome,
                email: alunoEmail,
                cpfCnpj: alunoCpf,
                phone: alunoTelefone,
                externalId: `aluno_${alunoId}`
            });

            // Criar pagamento
            const payment = await this.createPayment({
                customerId: customer.id,
                value,
                billingType,
                dueDate,
                description,
                externalReference: `payment_${alunoId}_${Date.now()}`,
                installmentCount,
                installmentValue
            });

            return {
                customer,
                payment
            };
        } catch (error) {
            console.error('Erro ao criar pagamento completo:', error);
            throw error;
        }
    }
}

module.exports = AsaasService;
