// server.js (VERSÃO WIINPAY COM VERIFICAÇÃO REAL)
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const VALOR_FIXO = "19.99";
const paymentStatus = {};

// GERAR PIX WIINPAY
app.post('/gerar-pix', async (req, res) => {
    try {
        console.log('🔄 Gerando PIX WiinPay...');
        
        const response = await axios({
            method: 'POST',
            url: 'https://api.wiinpay.com.br/payment/create',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            data: {
                api_key: process.env.WIINPAY_API_KEY,
                value: 19.99, // VALOR FIXO R$ 19,99
                name: "Cliente Site",
                email: "cliente@site.com", 
                description: "Meu Produto - Valor Fixo R$ 19,99",
                webhook_url: "", // VAZIO - SEM WEBHOOK
                metadata: {
                    produto: "Meu Produto",
                    valor_fixo: "19.99"
                }
            }
        });

        const data = response.data;
        
        // Verificar estrutura da resposta
        const paymentId = data.id || data.payment_id || data.transaction_id;
        
        if (!paymentId) {
            throw new Error('ID do pagamento não retornado');
        }

        paymentStatus[paymentId] = {
            status: "pending",
            valor: VALOR_FIXO,
            createdAt: new Date(),
            qrCode: data.qr_code,
            qrCodeBase64: data.qr_code_base64 || data.qr_code_image,
            pixCode: data.pix_code || data.copy_paste,
            rawData: data // Guarda resposta completa
        };

        console.log(`✅ PIX WiinPay gerado! ID: ${paymentId}`);

        res.json({
            success: true,
            paymentId: paymentId,
            qrCodeBase64: data.qr_code_base64 || data.qr_code_image || data.qr_code,
            copiaECola: data.pix_code || data.copy_paste || data.qr_code,
            valor: VALOR_FIXO,
            chavePix: "Sistema WiinPay",
            message: "Pague exatamente R$ 19,99"
        });

    } catch (error) {
        console.error('❌ Erro WiinPay:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false,
            error: 'Não foi possível gerar o PIX.',
            details: error.response?.data || error.message
        });
    }
});

// VERIFICAR STATUS REAL NA WIINPAY
app.get('/check-payment/:paymentId', async (req, res) => {
    try {
        const paymentId = req.params.paymentId;
        
        console.log(`🔍 Verificando status real do pagamento: ${paymentId}`);
        
        // Consultar status REAL na WiinPay
        const response = await axios({
            method: 'GET',
            url: `https://api.wiinpay.com.br/payment/list/${paymentId}`,
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${process.env.WIINPAY_API_KEY}`,
                'User-Agent': 'insomnia/11.1.0'
            }
        });

        const paymentData = response.data;
        
        console.log('📊 Dados do pagamento:', JSON.stringify(paymentData, null, 2));
        
        // Verificar status e valor
        const status = paymentData.status || paymentData.payment_status;
        const valorRecebido = parseFloat(paymentData.value || paymentData.amount).toFixed(2);
        
        let statusFinal = 'pending';
        
        if (status === 'paid' || status === 'approved' || status === 'completed') {
            // VALIDAÇÃO DO VALOR FIXO
            if (valorRecebido === VALOR_FIXO) {
                statusFinal = 'paid';
                console.log(`✅ PAGAMENTO CONFIRMADO: ${paymentId} - Valor correto!`);
            } else {
                statusFinal = 'valor_incorreto';
                console.log(`❌ VALOR INCORRETO: R$ ${valorRecebido}`);
            }
        }
        
        // Atualizar status
        paymentStatus[paymentId] = {
            ...paymentStatus[paymentId],
            status: statusFinal,
            valorRecebido: valorRecebido,
            lastChecked: new Date(),
            rawStatusData: paymentData
        };

        const updatedPayment = paymentStatus[paymentId];
        
        res.json({ 
            success: true,
            paymentId: paymentId,
            status: updatedPayment.status,
            valorEsperado: VALOR_FIXO,
            valorRecebido: updatedPayment.valorRecebido,
            statusWiinPay: status,
            message: updatedPayment.status === 'paid' ? '✅ Pagamento confirmado!' : 
                    updatedPayment.status === 'valor_incorreto' ? '❌ Valor incorreto' : 
                    '⏳ Aguardando pagamento...'
        });

    } catch (error) {
        console.error('❌ Erro ao verificar pagamento:', error.response?.data || error.message);
        
        // Se der erro, retorna status atual do cache
        const payment = paymentStatus[req.params.paymentId];
        
        res.json({ 
            success: false,
            paymentId: req.params.paymentId,
            status: payment?.status || 'error',
            valorEsperado: VALOR_FIXO,
            message: 'Erro ao verificar pagamento'
        });
    }
});

// Rota rápida para o frontend (usa cache)
app.get('/check-status/:paymentId', (req, res) => {
    const paymentId = req.params.paymentId;
    const payment = paymentStatus[paymentId];
    
    res.json({ 
        success: true,
        paymentId: paymentId,
        status: payment?.status || 'not_found',
        valorEsperado: VALOR_FIXO,
        valorRecebido: payment?.valorRecebido,
        message: payment?.status === 'paid' ? '✅ Pagamento confirmado!' : 
                payment?.status === 'valor_incorreto' ? '❌ Valor incorreto' : 
                '⏳ Aguardando pagamento...'
    });
});

// Health check
app.get('/', (req, res) => {
    res.json({ 
        message: 'Sistema WiinPay funcionando!',
        valorFixo: 'R$ 19,99',
        observacao: 'Com verificação REAL de status'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor WiinPay rodando na porta ${PORT}`);
    console.log(`💰 VALOR FIXO: R$ 19,99`);
    console.log(`✅ COM verificação real de status`);
});
