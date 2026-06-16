import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';

export async function POST(request) {
  try {
    const body = await request.json();

    // 1. INICIALIZA O MERCADO PAGO COM SUA CHAVE DE PRODUÇÃO
    // Certifique-se de que no seu arquivo .env exista a variável MP_ACCESS_TOKEN
    const client = new MercadoPagoConfig({ 
      accessToken: process.env.MP_ACCESS_TOKEN || '' 
    });

    const payment = new Payment(client);

    // 2. CRIA A COBRANÇA REAL
    const response = await payment.create({
      body: {
        transaction_amount: Number(body.amount), // O valor real que vem do seu front
        token: body.token,
        description: body.description,
        installments: body.installments,
        payment_method_id: body.payment_method_id,
        issuer_id: body.issuer_id,
        payer: {
          email: body.payer.email,
          identification: {
            type: body.payer.identification.type,
            number: body.payer.identification.number,
          },
        },
      },
    });

    // 3. DEVOLVE A RESPOSTA PRO FRONTEND
    return NextResponse.json({ 
      success: true,
      status: response.status,
      status_detail: response.status_detail,
      id: response.id 
    }, { status: 201 });

  } catch (error) {
    console.error("Erro interno do servidor MP:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Falha na transação. Tente novamente." 
    }, { status: 500 });
  }
}