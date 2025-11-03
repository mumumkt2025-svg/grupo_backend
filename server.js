// server.js (VERSÃO CORRIGIDA PARA x-www-form-urlencoded)

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// CONFIGURAÇÃO CORRIGIDA - Middleware para URL encoded
app.use(express.urlencoded({ extended: true })); // ← ESTA É A CORREÇÃO PRINCIPAL
app.use(express.json());
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

// ROTA DO WEBHOOK - VERSÃO CORRIGIDA PARA URL ENCODED
app.post('/webhook-pushinpay', (req, res) => {
    console.log("Webhook da PushinPay recebido!");
    console.log("Headers:", req.headers);
    console.log("Content-Type:", req.headers['content-type']);
    
    // Os dados agora virão em req.body diretamente, pois usamos express.urlencoded()
    const webhookData = req.body;
    
    console.log("Dados do Webhook:", webhookData);

    if (webhookData && webhookData.id) {
        console.log(`🎉 Webhook recebido - ID: ${webhookData.id}, Status: ${webhookData.status}`);
        
        if (webhookData.status === 'paid') {
            console.log(`💰 Pagamento CONFIRMADO: ${webhookData.id}`);
            paymentStatus[webhookData.id] = 'paid';
        } else {
            console.log(`Status do pagamento ${webhookData.id}: ${webhookData.status}`);
            paymentStatus[webhookData.id] = webhookData.status;
        }
    } else {
        console.log("Webhook recebido, mas dados não no formato esperado:", webhookData);
        
        // Debug adicional - mostrar todas as chaves do body
        console.log("Chaves disponíveis no req.body:", Object.keys(webhookData || {}));
    }

    res.status(200).json({ received: true, message: "Webhook processado" });
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
