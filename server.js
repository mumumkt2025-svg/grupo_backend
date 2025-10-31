// server.js (Versão com simulador para teste local)

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const PUSHIN_TOKEN = process.env.PUSHIN_TOKEN;
const paymentStatus = {};

app.use(express.static(path.join(__dirname, '')));

app.post('/gerar-pix', async (req, res) => {
    try {
        const apiUrl = 'https://api.pushinpay.com.br/api/pix/cashIn';
        // Para testes locais, não precisamos enviar o webhook_url real
        const paymentData = { value: 1999 };

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

        // Guarda o status e mostra o ID no terminal para podermos simular
        paymentStatus[data.id] = "created";
        console.log(`\n✅ PIX gerado com sucesso! ID para teste: ${data.id}\n`);

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

// Rota para o cliente verificar o status (já existente)
app.get('/check-status/:paymentId', (req, res) => {
    const { paymentId } = req.params;
    const status = paymentStatus[paymentId] || 'not_found';
    res.json({ status: status });
});

// =================================================================
// ROTA DE SIMULAÇÃO: O nosso "botão mágico" para testar
// =================================================================
app.get('/confirmar-pagamento/:paymentId', (req, res) => {
    const { paymentId } = req.params;
    if (paymentStatus[paymentId]) {
        paymentStatus[paymentId] = 'paid';
        console.log(`\n✅ Pagamento SIMULADO com sucesso para o ID: ${paymentId}\n`);
        res.send(`<h1>Pagamento para o ID ${paymentId} foi confirmado! Volte para a outra aba para ver o redirecionamento.</h1>`);
    } else {
        res.status(404).send('<h1>ID de pagamento não encontrado.</h1>');
    }
});
// =================================================================


app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});