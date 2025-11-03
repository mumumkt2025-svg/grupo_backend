// server.js (Versão Final com Abridor de Cartas Universal)

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const cors = require('cors'); 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // Habilita o CORS para todas as rotas

const PUSHIN_TOKEN = process.env.PUSHIN_TOKEN;
const paymentStatus = {};

// Rota para GERAR O PIX (Funcional)
app.post('/gerar-pix', express.json(), async (req, res) => { // Adiciona o leitor de JSON só aqui
    try {
        const apiUrl = 'https://api.pushinpay.com.br/api/pix/cashIn';
        const paymentData = { value: 1999 }; // Não enviamos webhook_url

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

// ==================================================================
//  CORREÇÃO AQUI: Rota do Webhook com o "Abridor Universal"
// ==================================================================
app.post('/webhook-pushinpay', express.raw({ type: '*/*' }), (req, res) => {
    console.log("Webhook da PushinPay recebido!");
    let webhookData;

    try {
        // O "abridor universal" pega os dados como um "buffer" (dados brutos)
        // Nós convertemos para texto e depois tentamos ler como JSON.
        const rawBody = req.body.toString();
        console.log("Dados Brutos Recebidos:", rawBody); // Vamos ver o que realmente chegou
        webhookData = JSON.parse(rawBody);
    } catch (e) {
        console.error("Não foi possível parsear o corpo do webhook:", e.message);
        webhookData = {}; // Define como objeto vazio se falhar
    }
    
    console.log("Dados do Webhook (Após Parse):", webhookData);

    if (webhookData && webhookData.status === 'paid' && webhookData.id) {
        console.log(`Pagamento ${webhookData.id} foi confirmado!`);
        paymentStatus[webhookData.id] = 'paid';
    }

    res.status(200).send('OK');
});

// ROTA DE VERIFICAÇÃO DE STATUS
app.get('/check-status/:paymentId', (req, res) => {
    const { paymentId } = req.params;
    const status = paymentStatus[paymentId] || 'not_found';
    res.json({ status: status });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
