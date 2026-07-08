import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "ID ausente" }, { status: 400 });
    }

    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || '' });
    const payment = new Payment(client);
    
    // Busca o status atualizado do pagamento
    const paymentData = await payment.get({ id });

    return NextResponse.json({ 
      success: true, 
      status: paymentData.status // Vai retornar "approved", "pending", etc.
    });

  } catch (error) {
    console.error("Erro ao verificar pagamento:", error);
    return NextResponse.json({ success: false, error: "Falha na verificação" }, { status: 500 });
  }
}