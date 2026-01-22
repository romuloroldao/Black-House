// Asaas Service
// Integração completa com API do Asaas para pagamentos

const axios = require('axios');

class AsaasService {
    constructor(apiKey, environment = 'production') {
        this.apiKey = apiKey;
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

    /**
     * Cria pagamento completo (cliente + pagamento)
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
