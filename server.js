// server.js (VERSÃO ENDPOINT CORRETO - pagarcontas.api.efipay.com.br)
require('dotenv').config();
const express = require('express');
const https = require('https');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

const VALOR_FIXO = "19.99";
const paymentStatus = {};

// AGENT HTTPS
const agent = new https.Agent({
  rejectUnauthorized: false
});

// Função para obter token
async function getEfiToken() {
    try {
        console.log('🔑 Obtendo token da EFI...');
        
        const auth = Buffer.from(
            `${process.env.EFI_CLIENT_ID}:${process.env.EFI_CLIENT_SECRET}`
        ).toString('base64');

        const response = await axios({
            method: 'POST',
            url: 'https://pagarcontas.api.efipay.com.br/v1/oauth/token',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            data: {
                grant_type: 'client_credentials'
            },
            httpsAgent: agent
        });

        console.log('✅ Token obtido com sucesso!');
        return response.data.access_token;
        
    } catch (error) {
        console.error('❌ Erro ao obter token:', error.response?.data || error.message);
        throw error;
    }
}

// Rota para GERAR PIX
app.post('/gerar-pix', async (req, res) => {
    try {
        console.log('🔄 Iniciando geração de PIX...');
        
        const accessToken = await getEfiToken();
        
        const body = {
            calendario: {
                expiracao: 3600
            },
            valor: {
                original: VALOR_FIXO
            },
            chave: process.env.EFI_CHAVE_PIX,
            infoAdicionais: [
                {
                    nome: 'Produto',
                    valor: 'Meu Produto - R$ 19,99'
                }
            ]
        };

        console.log('📦 Criando cobrança PIX...');
        
        // USANDO ENDPOINT PIX CORRETO
        const chargeResponse = await axios({
            method: 'POST',
            url: 'https://pix.api.efipay.com.br/v2/cob', // ENDPOINT PIX
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            data: body,
            httpsAgent: agent
        });

        const charge = chargeResponse.data;
        
        console.log('📷 Gerando QR Code...');
        const qrcodeResponse = await axios({
            method: 'GET',
            url: `https://pix.api.efipay.com.br/v2/loc/${charge.loc.id}/qrcode`,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            httpsAgent: agent
        });

        const qrcode = qrcodeResponse.data;
        const paymentId = charge.txid;
        
        paymentStatus[paymentId] = {
            status: "created", 
            valor: VALOR_FIXO,
            createdAt: new Date()
        };
        
        console.log(`✅ PIX gerado com sucesso! TXID: ${paymentId}`);

        res.json({
            success: true,
            paymentId: paymentId,
            qrCodeBase64: qrcode.imagemQrcode,
            copiaECola: qrcode.qrcode,
            valor: VALOR_FIXO,
            chavePix: process.env.EFI_CHAVE_PIX,
            message: "Pague exatamente R$ 19,99"
        });

    } catch (error) {
        console.error('❌ Erro ao gerar PIX:', error.response?.data || error.message);
        
        res.status(500).json({ 
            success: false,
            error: 'Não foi possível gerar o PIX.',
            details: error.response?.data || error.message
        });
    }
});

// Webhook
app.post('/webhook-efi', (req, res) => {
    console.log("🔔 Webhook recebido:", JSON.stringify(req.body, null, 2));
    
    const { pix } = req.body;
    if (pix && pix.length > 0) {
        for (const payment of pix) {
            const { txid, valor } = payment;
            const valorRecebido = (valor / 100).toFixed(2);
            
            if (valorRecebido === VALOR_FIXO) {
                paymentStatus[txid] = {
                    status: 'paid',
                    paidAt: new Date(),
                    valorRecebido: valorRecebido
                };
                console.log(`✅ Pagamento confirmado: ${txid}`);
            }
        }
    }

    res.status(200).json({ success: true });
});

// Health check
app.get('/', (req, res) => {
    res.json({ 
        message: 'Sistema de PIX EFI funcionando!',
        valorFixo: `R$ ${VALOR_FIXO}`,
        endpoints: {
            gerarPix: 'POST /gerar-pix',
            webhook: 'POST /webhook-efi'
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`💰 VALOR FIXO: R$ ${VALOR_FIXO}`);
    console.log(`📍 Webhook: https://grupo-backend-xagu.onrender.com/webhook-efi`);
});
