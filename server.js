// server.js (Versão com a URL de Webhook CORRETA)

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.text());
app.use(cors());

const PUSHIN_TOKEN = process.env.PUSHIN_TOKEN;
const paymentStatus = {};

// Rota para GERAR O PIX
app.post('/gerar-pix', async (req, res) => {
    try {
        const apiUrl = 'https://api.pushinpay.com.br/api/pix/cashIn';
        
        // ==========================================================
        //  A CORREÇÃO ESTÁ AQUI:
        //  Apontamos o webhook para o SEU backend, não para o webhook.site
        // ==========================================================
        const paymentData = {
            value: 299, // Seu valor de R$ 2,99 em centavos
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

// ROTA DO WEBHOOK: Pronta para receber o aviso
app.post('/webhook-pushinpay', (req, res) => {
    console.log("Webhook da PushinPay recebido!");
    let webhookData = req.body;

    if (typeof webhookData === 'string' && webhookData.length > 0) {
        try {
            webhookData = JSON.parse(webhookData);
        } catch (e) {
            console.error("Não foi possível parsear o corpo do webhook como JSON:", webhookData);
        }
    }
    
    console.log("Dados do Webhook:", webhookData);

    if (webhookData && webhookData.status === 'paid' && webhookData.id) {
        console.log(`Pagamento ${webhookData.id} foi confirmado!`);
        paymentStatus[webhookData.id] = 'paid';
    }

    res.status(200).send('OK');
});

// Rota de verificação de status
app.get('/check-status/:paymentId', (req, res) => {
    const { paymentId } = req.params;
    const status = paymentStatus[paymentId] || 'not_found';
    res.json({ status: status });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
