import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Inicializando Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request) {
  try {
    // 1. Fazer a requisição para a API da Medicalsys
    const response = await fetch("https://gateway.medicalsys.com.br:9000/integracoes/agenda/", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "apikey": "8FxD2eUsODMO8IZWMHZaNpt78av9Vy6k", 
        "customer_api_key": "SqdACjyxnXuYqL8ilnwTvXHroEOvFHFR" // <- Adicionado o Customer API Key
      },
    });

    // 2. Tratamento de Erro Detalhado
    if (!response.ok) {
      // Captura o corpo do erro que a Medicalsys retornar (se existir)
      const errorText = await response.text();
      console.error("Detalhes do erro da Medicalsys:", errorText);
      
      throw new Error(`Código ${response.status}. Detalhes do servidor deles: ${errorText || "Sem mensagem de erro."}`);
    }

    const dadosAgendamentos = await response.json();

    // Se a API deles retornar vazio
    if (!dadosAgendamentos || dadosAgendamentos.length === 0) {
      return NextResponse.json({ success: true, message: "A API conectou, mas não há agendamentos para importar." });
    }

    // 3. Mapeamento (Ajuste conforme os campos reais que voltarem da API)
    const registrosParaInserir = dadosAgendamentos.map((item) => ({
      data: item.data_agendamento || new Date().toISOString().slice(0, 10), 
      horario: item.hora_inicio || "00:00",
      medico_profissional: item.nome_medico || "Não informado",
      status: "importado"
    }));

    // 4. Salvar no Supabase
    const { data, error } = await supabase
      .from("bloqueios_horarios") // Altere para a sua tabela real de agendamentos se for diferente
      .insert(registrosParaInserir);

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      message: `${registrosParaInserir.length} agendamentos importados com sucesso!` 
    });

  } catch (error) {
    console.error("Falha na importação:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}