// server.js (VERSÃO API DIRETA - Valor Fixo R$ 19,99)
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

// VALOR FIXO DO PRODUTO
const VALOR_FIXO = "19.99";
const paymentStatus = {};

// Função para obter access token da EFI
async function getEfiToken() {
    try {
        const auth = Buffer.from(
            `${process.env.EFI_CLIENT_ID}:${process.env.EFI_CLIENT_SECRET}`
        ).toString('base64');

        const response = await axios({
            method: 'POST',
            url: 'https://api-pix.gerencianet.com.br/oauth/token',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            data: {
                grant_type: 'client_credentials'
            }
        });

        return response.data.access_token;
    } catch (error) {
        console.error('❌ Erro ao obter token:', error.response?.data || error.message);
        throw error;
    }
}

// Rota para GERAR PIX com valor fixo
app.post('/gerar-pix', async (req, res) => {
    try {
        console.log('🔄 Iniciando geração de PIX...');
        
        // Obter token
        const accessToken = await getEfiToken();
        
        const body = {
            calendario: {
                expiracao: 3600 // 1 hora
            },
            valor: {
                original: VALOR_FIXO // ⚠️ VALOR FIXO R$ 19,99
            },
            chave: process.env.EFI_CHAVE_PIX, // Seu celular +5566981107376
            infoAdicionais: [
                {
                    nome: 'Produto',
                    valor: 'Meu Produto - Valor Fixo R$ 19,99'
                }
            ]
        };

        console.log('📦 Criando cobrança na EFI...');
        
        // Criar cobrança na EFI
        const chargeResponse = await axios({
            method: 'POST',
            url: 'https://api-pix.gerencianet.com.br/v2/cob',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            data: body
        });

        const charge = chargeResponse.data;
        
        // Gerar QR Code
        const qrcodeResponse = await axios({
            method: 'GET',
            url: `https://api-pix.gerencianet.com.br/v2/loc/${charge.loc.id}/qrcode`,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        const qrcode = qrcodeResponse.data;

        // Armazena o status usando txid como chave
        const paymentId = charge.txid;
        paymentStatus[paymentId] = {
            status: "created",
            valor: VALOR_FIXO,
            createdAt: new Date()
        };
        
        console.log(`✅ PIX gerado com sucesso! TXID: ${paymentId}`);
        console.log(`💰 Valor fixo: R$ ${VALOR_FIXO}`);

        res.json({
            success: true,
            paymentId: paymentId,
            qrCodeBase64: qrcode.imagemQrcode, // QR Code em base64
            copiaECola: qrcode.qrcode, // Código copia/cola
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

// WEBHOOK da EFI - Só aceita R$ 19,99
app.post('/webhook-efi', (req, res) => {
    try {
        console.log("🔔 Webhook da EFI recebido!");
        
        const { pix } = req.body;
        
        if (pix && pix.length > 0) {
            for (const payment of pix) {
                const { txid, valor } = payment;
                const valorRecebido = (valor / 100).toFixed(2);
                
                console.log(`💰 Tentativa de pagamento - TXID: ${txid}`);
                console.log(`💵 Valor recebido: R$ ${valorRecebido}`);
                
                // ⚠️ VALIDAÇÃO DO VALOR FIXO
                if (valorRecebido === VALOR_FIXO) {
                    // ✅ VALOR CORRETO - PAGAMENTO ACEITO
                    paymentStatus[txid] = {
                        ...paymentStatus[txid],
                        status: 'paid',
                        paidAt: new Date(),
                        valorRecebido: valorRecebido
                    };
                    
                    console.log(`✅ PAGAMENTO CONFIRMADO: ${txid}`);
                    
                } else {
                    // ❌ VALOR INCORRETO - PAGAMENTO REJEITADO
                    paymentStatus[txid] = {
                        ...paymentStatus[txid],
                        status: 'valor_incorreto',
                        valorRecebido: valorRecebido,
                        rejectedAt: new Date()
                    };
                    
                    console.log(`❌ PAGAMENTO REJEITADO: Valor incorreto`);
                }
            }
        }

        res.status(200).json({ 
            success: true, 
            message: "Webhook processado" 
        });
        
    } catch (error) {
        console.error('❌ Erro no webhook:', error);
        res.status(500).json({ 
            success: false, 
            error: "Erro no processamento" 
        });
    }
});

// Verificar status do pagamento
app.get('/check-status/:paymentId', (req, res) => {
    const paymentId = req.params.paymentId;
    const payment = paymentStatus[paymentId];
    
    if (!payment) {
        return res.json({ 
            success: false,
            status: 'not_found',
            message: 'Pagamento não encontrado'
        });
    }
    
    res.json({ 
        success: true,
        paymentId: paymentId,
        status: payment.status,
        valorEsperado: VALOR_FIXO,
        valorRecebido: payment.valorRecebido,
        message: payment.status === 'paid' ? '✅ Pagamento confirmado!' : 
                payment.status === 'valor_incorreto' ? '❌ Valor incorreto' : 
                '⏳ Aguardando pagamento'
    });
});

// Rota para listar todos os pagamentos (debug)
app.get('/payments', (req, res) => {
    res.json({
        success: true,
        totalPayments: Object.keys(paymentStatus).length,
        valorFixo: VALOR_FIXO,
        chavePix: process.env.EFI_CHAVE_PIX,
        payments: paymentStatus
    });
});

// Health check
app.get('/', (req, res) => {
    res.json({ 
        message: 'Sistema de PIX com EFI funcionando!',
        valorFixo: `R$ ${VALOR_FIXO}`,
        chavePix: process.env.EFI_CHAVE_PIX,
        endpoints: {
            gerarPix: 'POST /gerar-pix',
            webhook: 'POST /webhook-efi',
            checkStatus: 'GET /check-status/:paymentId',
            listPayments: 'GET /payments'
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor EFI rodando na porta ${PORT}`);
    console.log(`💰 VALOR FIXO: R$ ${VALOR_FIXO}`);
    console.log(`📱 CHAVE PIX: ${process.env.EFI_CHAVE_PIX}`);
    console.log(`📍 Webhook: https://grupo-backend-xagu.onrender.com/webhook-efi`);
    console.log(`🔗 Health: https://grupo-backend-xagu.onrender.com/`);
});
