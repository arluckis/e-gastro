import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request) {
  try {
    // 1. CALCULA AS DATAS (De hoje até 31 de dezembro do ano atual)
    const hoje = new Date();
    const dataDeHoje = hoje.toISOString().slice(0, 10);
    const anoAtual = hoje.getFullYear();
    const dataFimDeAno = `${anoAtual}-12-31`;
    
    // Passamos o momento_inicio e o momento_final na URL
    let urlAtual = `https://gateway.medicalsys.com.br:9000/integracoes/agenda/?momento_inicio=${dataDeHoje}&momento_final=${dataFimDeAno}`;
    
    let todosAgendamentos = [];
    let limiteDePaginas = 0; // TRAVA DE SEGURANÇA (Max 50 páginas = 1.000 agendamentos)
    
    console.log(`Buscando agendamentos de ${dataDeHoje} até ${dataFimDeAno}...`);

    // 2. LOOP PROTEGIDO PARA BAIXAR AS PÁGINAS
    while (urlAtual && limiteDePaginas < 50) {
      limiteDePaginas++;
      console.log(`Buscando página ${limiteDePaginas} em: ${urlAtual}`);

      const response = await fetch(urlAtual, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "apikey": "8FxD2eUsODMO8IZWMHZaNpt78av9Vy6k",
          "msys-costumer-apikey": "SqdACjyxnXuYqL8ilnwTvXHroEOvFHFR"
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Código ${response.status}. Detalhes: ${errorText || "Sem mensagem."}`);
      }

      const dados = await response.json();

      if (!Array.isArray(dados) && dados.results) {
        todosAgendamentos = todosAgendamentos.concat(dados.results);
        
        if (dados.next) {
          urlAtual = dados.next.replace("http://", "https://");
        } else {
          urlAtual = null;
        }
      } else if (Array.isArray(dados)) {
        todosAgendamentos = todosAgendamentos.concat(dados);
        urlAtual = null; 
      } else {
        urlAtual = null;
      }
    }

    if (todosAgendamentos.length === 0) {
      return NextResponse.json({ success: true, message: `Nenhum agendamento encontrado entre ${dataDeHoje} e ${dataFimDeAno}.` });
    }

    // 3. BUSCAR O QUE JÁ EXISTE NO SUPABASE PARA NÃO DUPLICAR
    const { data: agendamentosExistentes, error: erroBusca } = await supabase
      .from("bloqueios_horarios")
      .select("data, horario, medico_profissional");

    if (erroBusca) throw erroBusca;

    const mapaExistentes = new Set(
      agendamentosExistentes?.map(ag => `${ag.data}|${ag.horario}|${ag.medico_profissional}`) || []
    );

    // 4. FORMATAR E FILTRAR
    const registrosParaInserir = todosAgendamentos
      .map((item) => {
        const horaFormatada = item.horario_inicio ? item.horario_inicio.slice(0, 5) : "00:00"; 
        return {
          data: item.momento, 
          horario: horaFormatada,
          medico_profissional: item.medico?.nome || "Não informado",
        };
      })
      .filter((item) => {
        // Garantia extra de que a data está no futuro ou hoje
        if (item.data < dataDeHoje) return false;
        
        // Ignora duplicados já existentes no Supabase
        const chaveAPI = `${item.data}|${item.horario}|${item.medico_profissional}`;
        return !mapaExistentes.has(chaveAPI);
      });

    // 5. SALVAR NO BANCO DE DADOS
    if (registrosParaInserir.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: `Busca finalizada. Todos os ${todosAgendamentos.length} agendamentos até o fim do ano já estão sincronizados.` 
      });
    }

    const { error } = await supabase
      .from("bloqueios_horarios")
      .insert(registrosParaInserir);

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      message: `${registrosParaInserir.length} novos agendamentos (até o fim do ano) sincronizados com sucesso!` 
    });

  } catch (error) {
    console.error("Falha no processo de importação:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}