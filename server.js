// server.js (VERSÃO CORRIGIDA)

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// CONFIGURAÇÃO CORRIGIDA DO MIDDLEWARE
app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf; // Guarda o corpo original para debug
    }
}));
app.use(express.text({ type: 'application/json' })); // Fallback para texto
app.use(cors());

const PUSHIN_TOKEN = process.env.PUSHIN_TOKEN;
const paymentStatus = {};

// Rota para GERAR O PIX (mantida igual)
app.post('/gerar-pix', async (req, res) => {
    try {
        const apiUrl = 'https://api.pushinpay.com.br/api/pix/cashIn';
        
        const paymentData = {
            value: 299,
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

        paymentStatus[data.id] = "created";
        console.log(`✅ PIX gerado com sucesso! ID: ${data.id}`);

        res.json({
            paymentId: data.id,
            qrCodeBase64: data.qr_code_base64,
            copiaECola: data.qr_code
        });

    } catch (error) {
        console.error('Erro ao gerar PIX:', error.message);
        res.status(500).json({ error: 'Não foi possível gerar o PIX.' });
    }
});

// ROTA DO WEBHOOK - VERSÃO CORRIGIDA
app.post('/webhook-pushinpay', (req, res) => {
    console.log("Webhook da PushinPay recebido!");
    
    // DEBUG: Log do cabeçalho para ver o content-type
    console.log("Headers:", req.headers);
    console.log("Content-Type:", req.headers['content-type']);
    
    let webhookData = req.body;

    // Se for string, tenta fazer parse
    if (typeof webhookData === 'string') {
        console.log("Corpo recebido como string:", webhookData);
        try {
            webhookData = JSON.parse(webhookData);
        } catch (e) {
            console.error("Erro ao fazer parse do JSON:", e.message);
            console.log("String original:", webhookData);
        }
    }
    
    console.log("Dados do Webhook (após parse):", webhookData);

    // Verificação mais robusta dos dados
    if (webhookData && webhookData.id) {
        console.log(`Webhook recebido para pagamento: ${webhookData.id}`);
        console.log(`Status: ${webhookData.status}`);
        
        if (webhookData.status === 'paid') {
            console.log(`🎉 Pagamento ${webhookData.id} foi CONFIRMADO!`);
            paymentStatus[webhookData.id] = 'paid';
        } else {
            console.log(`Status do pagamento ${webhookData.id}: ${webhookData.status}`);
            paymentStatus[webhookData.id] = webhookData.status;
        }
    } else {
        console.log("Webhook recebido sem dados válidos:", webhookData);
    }

    res.status(200).json({ received: true });
});

// Rota de verificação de status
app.get('/check-status/:paymentId', (req, res) => {
    const { paymentId } = req.params;
    const status = paymentStatus[paymentId] || 'not_found';
    res.json({ status: status });
});

// Rota de health check
app.get('/', (req, res) => {
    res.json({ 
        message: 'Servidor rodando',
        webhookEndpoint: '/webhook-pushinpay'
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Webhook configurado em: https://grupo-backend-xagu.onrender.com/webhook-pushinpay`);
});
