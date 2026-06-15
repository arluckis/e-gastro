import { MercadoPagoConfig, Payment } from 'mercadopago';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();

    // Trava de segurança: Verifica se a chave privada existe
    if (!process.env.MP_ACCESS_TOKEN) {
      return NextResponse.json({ success: false, error: "Falta a chave MP_ACCESS_TOKEN no .env.local e reiniciar o servidor." }, { status: 500 });
    }

    // Inicializa o cliente do MP
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const payment = new Payment(client);

    // Cria o pagamento com Chave de Idempotência (Obrigatório na v2)
    const result = await payment.create({
      body: {
        transaction_amount: body.transaction_amount,
        token: body.token,
        description: body.description || 'Consulta E-Gastro',
        installments: body.installments,
        payment_method_id: body.payment_method_id,
        issuer_id: body.issuer_id,
        payer: body.payer // O Brick já manda o payer formatado
      },
      requestOptions: {
        idempotencyKey: crypto.randomUUID() // Evita cobrança duplicada
      }
    });

    return NextResponse.json({ success: true, id: result.id, status: result.status });

  } catch (error) {
    // Agora o terminal vai gritar o erro real em vermelho!
    console.error("============= ERRO CRÍTICO MERCADO PAGO =============");
    console.error(error);
    
    // Tenta extrair a mensagem oficial do Mercado Pago para mandar para a Dynamic Island
    const mpError = error.message || error.cause?.[0]?.description || "Erro desconhecido no servidor.";
    
    return NextResponse.json({ success: false, error: mpError }, { status: 500 });
  }
}