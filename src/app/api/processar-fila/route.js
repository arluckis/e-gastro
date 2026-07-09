import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import axios from 'axios';

const URL_RMCHAT = "https://acessoapi.rmchat.com.br/w/875a4a21-8b19-42f1-97d7-d420f72f4310";

export async function GET(request) {
  try {
    const agora = new Date().toISOString();

    const { data: mensagens, error } = await supabase
      .from('fila_mensagens')
      .select('*')
      .eq('status', 'pendente')
      .lte('data_hora_programada', agora)
      .limit(30); 

    if (error) throw error;
    if (!mensagens || mensagens.length === 0) {
      return NextResponse.json({ message: 'Nenhuma mensagem na fila para agora.' });
    }

    for (const msg of mensagens) {
      // Formata o número removendo traços e o 9º dígito se for celular do Brasil
      let num = msg.telefone_whatsapp.replace(/\D/g, "");
      if (num.length === 11 && num.charAt(2) === '9') {
        num = num.substring(0, 2) + num.substring(3);
      }
      const numeroLimpo = num;
      
      try {
        await axios.post(URL_RMCHAT, { 
          name: msg.nome_paciente, 
          number: numeroLimpo,
          texto: msg.mensagem
        });
        await supabase.from('fila_mensagens').update({ status: 'enviada' }).eq('id', msg.id);
      } catch (err) {
        console.error(`Erro ao enviar para ${msg.nome_paciente}:`, err.message);
      }
    }

    return NextResponse.json({ success: true, disparos: mensagens.length });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}