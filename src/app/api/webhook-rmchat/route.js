import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    // Lê o JSON que a RM Chat enviou
    const data = await request.json();
    
    console.log("🔔 [WEBHOOK RM CHAT] Evento recebido:", data.event);

    // Navega pelo JSON para extrair exatamente o userId e o contactId
    const userId = data?.contact?.leadStatus?.userId;
    const contactId = data?.contact?.id;
    const contactName = data?.contact?.name;

    console.log(`👤 Usuário ID: ${userId} | Contato: ${contactName} (ID: ${contactId})`);

    // AQUI VOCÊ PODE FAZER O QUE QUISER COM O USERID!
    // Exemplo: Salvar no Supabase, atualizar o agendamento, etc.

    // Responde para a RM Chat que recebemos com sucesso (obrigatório para webhooks)
    return NextResponse.json({ success: true, received: true }, { status: 200 });

  } catch (error) {
    console.error("❌ Erro ao processar webhook:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}