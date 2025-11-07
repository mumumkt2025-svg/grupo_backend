// server.js (VERSÃO DEBUG - Vamos ver o erro real)
require('dotenv').config();
const express = require('express');
const https = require('https');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

// VALOR FIXO
const VALOR_FIXO = "19.99";
const paymentStatus = {};

// AGENT HTTPS
const agent = new https.Agent({
  rejectUnauthorized: false
});

// DEBUG: Log das variáveis de ambiente (sem mostrar segredos)
console.log('🔍 DEBUG - Variáveis de ambiente:');
console.log('EFI_CLIENT_ID:', process.env.EFI_CLIENT_ID ? '✅ Configurado' : '❌ Faltando');
console.log('EFI_CLIENT_SECRET:', process.env.EFI_CLIENT_SECRET ? '✅ Configurado' : '❌ Faltando');
console.log('EFI_CHAVE_PIX:', process.env.EFI_CHAVE_PIX ? '✅ Configurado' : '❌ Faltando');
console.log('EFI_SANDBOX:', process.env.EFI_SANDBOX);

// Função para obter token
async function getEfiToken() {
    try {
        console.log('🔑 Tentando obter token da EFI...');
        
        const auth = Buffer.from(
            `${process.env.EFI_CLIENT_ID}:${process.env.EFI_CLIENT_SECRET}`
        ).toString('base64');

        console.log('📡 Endpoint:', 'https://api-pix-h.gerencianet.com.br/oauth/token');
        
        const response = await axios({
            method: 'POST',
            url: 'https://api-pix-h.gerencianet.com.br/oauth/token',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            data: {
                grant_type: 'client_credentials'
            },
            httpsAgent: agent,
            timeout: 10000
        });

        console.log('✅ Token obtido com sucesso!');
        return response.data.access_token;
        
    } catch (error) {
        console.error('❌ ERRO DETALHADO no token:');
        console.error('Código:', error.code);
        console.error('Mensagem:', error.message);
        console.error('Response:', error.response?.data);
        console.error('Status:', error.response?.status);
        throw error;
    }
}

// Rota para GERAR PIX
app.post('/gerar-pix', async (req, res) => {
    try {
        console.log('🔄 Iniciando geração de PIX...');
        
        const accessToken = await getEfiToken();
        
        const body = {
            calendario: { expiracao: 3600 },
            valor: { original: VALOR_FIXO },
            chave: process.env.EFI_CHAVE_PIX,
            infoAdicionais: [{ nome: 'Produto', valor: 'Meu Produto - R$ 19,99' }]
        };

        console.log('📦 Criando cobrança...');
        
        const chargeResponse = await axios({
            method: 'POST',
            url: 'https://api-pix-h.gerencianet.com.br/v2/cob',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            data: body,
            httpsAgent: agent,
            timeout: 10000
        });

        const charge = chargeResponse.data;
        
        console.log('📷 Gerando QR Code...');
        const qrcodeResponse = await axios({
            method: 'GET',
            url: `https://api-pix-h.gerencianet.com.br/v2/loc/${charge.loc.id}/qrcode`,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            httpsAgent: agent
        });

        const qrcode = qrcodeResponse.data;
        const paymentId = charge.txid;
        
        paymentStatus[paymentId] = { status: "created", valor: VALOR_FIXO, createdAt: new Date() };
        
        console.log(`✅ PIX gerado! TXID: ${paymentId}`);

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
        console.error('❌ ERRO FINAL no PIX:');
        console.error('Código:', error.code);
        console.error('Mensagem:', error.message);
        console.error('Response data:', error.response?.data);
        console.error('Response status:', error.response?.status);
        
        res.status(500).json({ 
            success: false,
            error: 'Não foi possível gerar o PIX.',
            details: error.response?.data || error.message,
            code: error.code
        });
    }
});

// Webhook
app.post('/webhook-efi', (req, res) => {
    console.log("🔔 Webhook recebido:", JSON.stringify(req.body));
    res.status(200).json({ success: true });
});

// Health check
app.get('/', (req, res) => {
    res.json({ 
        message: 'Sistema de PIX funcionando!',
        valorFixo: `R$ ${VALOR_FIXO}`,
        status: 'debug'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`💰 VALOR FIXO: R$ ${VALOR_FIXO}`);
});
