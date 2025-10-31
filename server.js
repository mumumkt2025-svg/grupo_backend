// server.js (Versão Final Completa)

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const cors = require('cors'); // Importa o pacote CORS

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json()); // Essencial para o webhook
app.use(cors()); // Habilita que seu frontend (na Netlify) possa conversar com este backend

const PUSHIN_TOKEN = process.env.PUSHIN_TOKEN; // Pega o token que você configurou na Render

// Objeto para guardar o status dos pagamentos.
const paymentStatus = {};

// Rota para GERAR O PIX
app.post('/gerar-pix', async (req, res) => {
    try {
        const apiUrl = 'https://api.pushinpay.com.br/api/pix/cashIn';
        const paymentData = {
            value: 1999, // Valor em centavos (1999 = R$ 19,99)
            // ==================================================================
            //  AQUI ESTÁ A MUDANÇA: Usando a sua URL real da Render
            // ==================================================================
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
        
        if (!response.ok || !data.id || !data.qr_code_base64) {
            console.error('ERRO na API PushinPay:', data);
            throw new Error(data.message || 'Resposta inválida da API');
        }

        paymentStatus[data.id] = "created";
        console.log(`✅ PIX gerado com sucesso! ID para teste: ${data.id}`);

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

// ROTA DO WEBHOOK: Onde a PushinPay vai avisar que o pagamento foi confirmado
app.post('/webhook-pushinpay', (req, res) => {
    console.log("Webhook da PushinPay recebido!");
    const webhookData = req.body;
    console.log(webhookData);

    if (webhookData && webhookData.status === 'paid' && webhookData.id) {
        console.log(`Pagamento ${webhookData.id} foi confirmado!`);
        paymentStatus[webhookData.id] = 'paid';
    }

    res.status(200).send('OK');
});

// ROTA DE VERIFICAÇÃO: Onde o frontend pergunta se o pagamento já foi feito
app.get('/check-status/:paymentId', (req, res) => {
    const { paymentId } = req.params;
    const status = paymentStatus[paymentId] || 'not_found';
    res.json({ status: status });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
