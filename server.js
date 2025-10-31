// server.js (VERSÃO DE TESTE SUPER SIMPLES)

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

const PUSHIN_TOKEN = process.env.PUSHIN_TOKEN;

// Rota de teste simples para garantir que o servidor está no ar
app.get('/', (req, res) => {
    res.send('Backend está funcionando!');
});

// Rota para GERAR O PIX
app.post('/gerar-pix', async (req, res) => {
    // Adicionando cabeçalho CORS manualmente para este teste
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    try {
        const apiUrl = 'https://api.pushinpay.com.br/api/pix/cashIn';
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
        
        if (!response.ok) {
            console.error('ERRO na API PushinPay:', data);
            throw new Error('Falha na autenticação com a PushinPay');
        }

        res.json({
            qrCodeBase64: data.qr_code_base64,
            copiaECola: data.qr_code
        });

    } catch (error) {
        console.error('Erro ao gerar PIX:', error.message);
        res.status(500).json({ error: 'Não foi possível gerar o PIX.' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
