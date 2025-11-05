// server.js (VERSÃO CORRIGIDA - IDs normalizados)

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

const PUSHIN_TOKEN = process.env.PUSHIN_TOKEN;
const paymentStatus = {};

// Rota para GERAR PIX
app.post('/gerar-pix', async (req, res) => {
    try {
        const apiUrl = 'https://api.pushinpay.com.br/api/pix/cashIn';
        
        const paymentData = {
            value: 999,
            webhook_url: `https://grupo-backend-xagu.onrender.com/webhook-pushinpay` 
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${PUSHIN_TOKEN}`
            },
            body: JSON.stringify(paymentData)
        });

        const data = await response.json();
        
        if (!response.ok || !data.id) {
            console.error('ERRO na API PushinPay:', data);
            throw new Error(data.message || 'Resposta inválida da API');
        }

        // Armazena o ID em minúsculas para consistência
        const normalizedId = data.id.toLowerCase();
        paymentStatus[normalizedId] = "created";
        
        console.log(`✅ PIX gerado com sucesso! ID: ${normalizedId}`);

        res.json({
            paymentId: normalizedId, // Retorna em minúsculas para o frontend
            qrCodeBase64: data.qr_code_base64,
            copiaECola: data.qr_code
        });

    } catch (error) {
        console.error('Erro ao gerar PIX:', error.message);
        res.status(500).json({ error: 'Não foi possível gerar o PIX.' });
    }
});

// Webhook - VERSÃO CORRIGIDA (IDs normalizados)
app.post('/webhook-pushinpay', (req, res) => {
    console.log("Webhook da PushinPay recebido!");
    
    const webhookData = req.body;
    console.log("Dados do Webhook:", webhookData);

    if (webhookData && webhookData.id) {
        // CORREÇÃO: Normaliza o ID para minúsculas
        const normalizedId = webhookData.id.toLowerCase();
        
        console.log(`🎉 Webhook recebido - ID: ${normalizedId}, Status: ${webhookData.status}`);
        
        if (webhookData.status === 'paid') {
            paymentStatus[normalizedId] = 'paid';
            console.log(`💰 PAGAMENTO CONFIRMADO: ${normalizedId}`);
            console.log(`👤 Pagador: ${webhookData.payer_name}`);
            console.log(`💳 Valor: R$ ${(webhookData.value / 100).toFixed(2)}`);
        } else {
            paymentStatus[normalizedId] = webhookData.status;
            console.log(`Status atualizado: ${normalizedId} -> ${webhookData.status}`);
        }
    }

    res.status(200).json({ success: true, message: "Webhook processado" });
});

// Verificar status do pagamento - VERSÃO CORRIGIDA
app.get('/check-status/:paymentId', (req, res) => {
    // CORREÇÃO: Normaliza o ID para minúsculas
    const paymentId = req.params.paymentId.toLowerCase();
    const status = paymentStatus[paymentId] || 'not_found';
    
    res.json({ 
        paymentId,
        status: status,
        message: status === 'paid' ? 'Pagamento confirmado!' : 'Aguardando pagamento'
    });
});

// Rota para listar todos os pagamentos (útil para debug)
app.get('/payments', (req, res) => {
    res.json({
        totalPayments: Object.keys(paymentStatus).length,
        payments: paymentStatus
    });
});

// Health check
app.get('/', (req, res) => {
    res.json({ 
        message: 'Sistema de PIX funcionando!',
        endpoints: {
            gerarPix: 'POST /gerar-pix',
            webhook: 'POST /webhook-pushinpay',
            checkStatus: 'GET /check-status/:paymentId',
            listPayments: 'GET /payments'
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📍 Webhook: https://grupo-backend-xagu.onrender.com/webhook-pushinpay`);
});
