// server.js (VERSÃO EFI - Valor Fixo R$ 19,99)
require('dotenv').config();
const express = require('express');
const Gerencianet = require('@gerencianet/gn-api-sdk-node');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

// Configuração da EFI
const gerencianet = new Gerencianet({
  client_id: process.env.EFI_CLIENT_ID,
  client_secret: process.env.EFI_CLIENT_SECRET,
  sandbox: process.env.EFI_SANDBOX === 'true' || true, // true para testes
  // certificate: './certificado.pem' // em produção
});

// VALOR FIXO DO PRODUTO
const VALOR_FIXO = "19.99";
const paymentStatus = {};

// Rota para GERAR PIX com valor fixo
app.post('/gerar-pix', async (req, res) => {
    try {
        console.log('🔄 Iniciando geração de PIX...');
        
        const body = {
            calendario: {
                expiracao: 3600 // 1 hora
            },
            valor: {
                original: VALOR_FIXO // ⚠️ VALOR FIXO R$ 19,99
            },
            chave: process.env.EFI_CHAVE_PIX, // Sua chave Pix aleatória
            infoAdicionais: [
                {
                    nome: 'Produto',
                    valor: 'Meu Produto - Valor Fixo R$ 19,99'
                },
                {
                    nome: 'Instrucoes',
                    valor: 'NAO ALTERE O VALOR - Pague apenas R$ 19,99'
                }
            ]
        };

        console.log('📦 Criando cobrança na EFI...');
        
        // Criar cobrança na EFI
        const charge = await gerencianet.pixCreateImmediateCharge([], body);
        
        // Gerar QR Code
        const qrcode = await gerencianet.pixGenerateQRCode({
            id: charge.loc.id
        });

        // Armazena o status usando txid como chave
        const paymentId = charge.txid;
        paymentStatus[paymentId] = {
            status: "created",
            valor: VALOR_FIXO,
            createdAt: new Date(),
            qrCode: qrcode.qrcode
        };
        
        console.log(`✅ PIX gerado com sucesso! TXID: ${paymentId}`);
        console.log(`💰 Valor fixo: R$ ${VALOR_FIXO}`);

        res.json({
            success: true,
            paymentId: paymentId,
            qrCodeBase64: qrcode.imagemQrcode, // QR Code em base64
            copiaECola: qrcode.qrcode, // Código copia/cola
            valor: VALOR_FIXO,
            message: "Pague exatamente R$ 19,99"
        });

    } catch (error) {
        console.error('❌ Erro ao gerar PIX:', error);
        console.error('Detalhes do erro:', error.response?.data || error.message);
        
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
        console.log("📦 Dados do Webhook:", JSON.stringify(req.body, null, 2));
        
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
                    console.log(`🎉 Produto liberado para o cliente!`);
                    
                    // Aqui você pode:
                    // - Enviar email de confirmação
                    // - Liberar acesso ao produto
                    // - Notificar o sistema
                    
                } else {
                    // ❌ VALOR INCORRETO - PAGAMENTO REJEITADO
                    paymentStatus[txid] = {
                        ...paymentStatus[txid],
                        status: 'valor_incorreto',
                        valorRecebido: valorRecebido,
                        rejectedAt: new Date()
                    };
                    
                    console.log(`❌ PAGAMENTO REJEITADO: Valor incorreto`);
                    console.log(`📌 Esperado: R$ ${VALOR_FIXO}, Recebido: R$ ${valorRecebido}`);
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
        payments: paymentStatus
    });
});

// Health check
app.get('/', (req, res) => {
    res.json({ 
        message: 'Sistema de PIX com EFI funcionando!',
        valorFixo: `R$ ${VALOR_FIXO}`,
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
    console.log(`📍 Webhook: https://grupo-backend-xagu.onrender.com/webhook-efi`);
    console.log(`🔗 Health: https://grupo-backend-xagu.onrender.com/`);
});
