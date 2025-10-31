// server.js (Versão Final com correção para ler o webhook)

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================================================================
//  CORREÇÃO AQUI: Ensinando o servidor a ler diferentes tipos de "envelopes"
// ==================================================================
app.use(express.json()); // Para 'envelopes' do tipo JSON
app.use(express.text()); // Para 'envelopes' do tipo texto puro (provável caso da PushinPay)
// ==================================================================

app.use(cors());

const PUSHIN_TOKEN = process.env.PUSHIN_TOKEN;
const paymentStatus = {};

app.use(express.static(path.join(__dirname, '')));

// Rota para GERAR O PIX (sem alterações)
app.post('/gerar-pix', async (req, res) => {
    try {
        const apiUrl = 'https://api.pushinpay.com.br/api/pix/cashIn';
        const paymentData = {
            value: 1999,
            webhook_url: `https://grupo-backend-xagu.onrender.com/webhook-pushinpay` 
        };
        // ... (resto do código igual)
        const response = await fetch(apiUrl, { /* ... */ });
        const data = await response.json();
        if (!response.ok || !data.id) { throw new Error(data.message || 'Resposta inválida da API'); }
        paymentStatus[data.id] = "created";
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

// ROTA DO WEBHOOK: Agora com uma verificação extra
app.post('/webhook-pushinpay', (req, res) => {
    console.log("Webhook da PushinPay recebido!");
    let webhookData = req.body;

    // Tenta "abrir o envelope" se ele veio como texto
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

// Rota de verificação de status (sem alterações)
app.get('/check-status/:paymentId', (req, res) => {
    const { paymentId } = req.params;
    const status = paymentStatus[paymentId] || 'not_found';
    res.json({ status: status });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
