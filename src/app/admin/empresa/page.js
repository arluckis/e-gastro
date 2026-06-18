"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Filter, Trash2, Key, Save, Activity, Calendar } from "lucide-react";
import Navbar from "@/components/Navbar";

const HORARIOS_OPCOES = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const MEDICOS = ["Todos", "Dra. Simone", "Dr. Brilhante", "Dr. Tiago Lima", "Dr. Thiago Dyavy", "Dra. Candice (Psicologia)"];

export default function EmpresaAdmin() {
  // Estados do Filtro Avançado de Bloqueio
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [medicoSelecionado, setMedicoSelecionado] = useState("Todos");
  const [horariosBloquear, setHorariosBloquear] = useState([]);

  // Chaves da Empresa
  const [keys, setKeys] = useState({ supabase_url: "", supabase_anon_key: "", mp_public_key: "", mp_anon_token: "" });
  
  // Lista de Bloqueios Existentes
  const [bloqueios, setBloqueios] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Estado para o Loading da Importação Medicalsys
  const [importLoading, setImportLoading] = useState(false);

  useEffect(() => {
    fetchBloqueios();
    fetchConfigEmpresa();
  }, []);

  const fetchBloqueios = async () => {
    const { data } = await supabase.from("bloqueios_horarios").select("*").order("data", { ascending: true });
    if (data) setBloqueios(data);
  };

  const fetchConfigEmpresa = async () => {
    const { data } = await supabase.from("empresas").select("*").limit(1).maybeSingle();
    if (data) setKeys(data);
  };

  const toggleHorarioSelecao = (hora) => {
    if (horariosBloquear.includes(hora)) {
      setHorariosBloquear(horariosBloquear.filter(h => h !== hora));
    } else {
      setHorariosBloquear([...horariosBloquear, hora]);
    }
  };

  const aplicarBloqueioEmLote = async (e) => {
    e.preventDefault();
    if (!dataInicio || horariosBloquear.length === 0) return;
    setLoading(true);

    const listaDatas = [];
    let dataAtual = new Date(dataInicio + "T00:00:00");
    const dataTermino = dataFim ? new Date(dataFim + "T00:00:00") : dataAtual;

    while (dataAtual <= dataTermino) {
      listaDatas.push(dataAtual.toISOString().slice(0, 10));
      dataAtual.setDate(dataAtual.getDate() + 1);
    }

    const inserts = [];
    listaDatas.forEach(dt => {
      horariosBloquear.forEach(hr => {
        inserts.push({ data: dt, horario: hr, medico_profissional: medicoSelecionado });
      });
    });

    const { error } = await supabase.from("bloqueios_horarios").insert(inserts);
    if (!error) {
      setHorariosBloquear([]);
      fetchBloqueios();
    }
    setLoading(false);
  };

  const deletarBloqueio = async (id) => {
    await supabase.from("bloqueios_horarios").delete().eq("id", id);
    fetchBloqueios();
  };

  const salvarChavesConfig = async () => {
    setLoading(true);
    // Nota: Como é uma página de configuração, no futuro pode ser ideal usar um .update() ou .upsert()
    const { error } = await supabase.from("empresas").insert([ { ...keys, nome: "Clínica Padrão", slug: "padrao" } ]);
    setLoading(false);
  };

  // Função para chamar a API de Integração com o Medicalsys
  const importarAgendamentosMedicalsys = async () => {
    setImportLoading(true);
    try {
      const res = await fetch("/api/importar-agenda", {
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        alert(data.message);
        fetchBloqueios(); // Atualiza a lista de bloqueios/agendamentos na tela
      } else {
        alert("Erro ao importar: " + data.error);
      }
    } catch (error) {
      console.error("Erro na requisição:", error);
      alert("Falha de comunicação com o servidor.");
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F8FAFC] p-6 pt-28 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
      <Navbar />
      
      {/* 1. PAINEL DE FILTROS AVANÇADOS (ESQUERDA) */}
      <div className="lg:col-span-2 bg-white border border-gray-100 rounded-[2rem] shadow-sm p-6 space-y-6">
        <div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2"><Filter className="text-[#9FC131]" size={20} /> Restrição Avançada de Agenda</h2>
          <p className="text-xs text-gray-400 font-medium">Inabilite dias inteiros ou horários específicos em lote instantaneamente.</p>
        </div>

        <form onSubmit={aplicarBloqueioEmLote} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest ml-1">Data Início</label>
              <input required type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full mt-1.5 p-3.5 bg-gray-50 border border-gray-100 rounded-xl font-semibold text-sm outline-none text-gray-900 focus:ring-2 focus:ring-[#9FC131]" />
            </div>
            <div>
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest ml-1">Data Fim (Múltiplos Dias)</label>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-full mt-1.5 p-3.5 bg-gray-50 border border-gray-100 rounded-xl font-semibold text-sm outline-none text-gray-900 focus:ring-2 focus:ring-[#9FC131]" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest ml-1">Aplicar para qual Profissional?</label>
            <select value={medicoSelecionado} onChange={(e) => setMedicoSelecionado(e.target.value)} className="w-full mt-1.5 p-3.5 bg-gray-50 border border-gray-100 rounded-xl font-semibold text-sm outline-none text-gray-900 focus:ring-2 focus:ring-[#9FC131]">
              {MEDICOS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest ml-1 block mb-2">Selecione os Horários para Bloqueio</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {HORARIOS_OPCOES.map(hr => {
                const isSelected = horariosBloquear.includes(hr);
                return (
                  <button type="button" key={hr} onClick={() => toggleHorarioSelecao(hr)} className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${isSelected ? "bg-red-500 text-white border-red-500 shadow-md shadow-red-500/20" : "bg-white text-gray-700 border-gray-200 hover:border-red-300"}`}>
                    {hr}
                  </button>
                );
              })}
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-4 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-widest rounded-full transition-all">
            {loading ? "Aplicando Restrições..." : "Inabilitar Horários Selecionados"}
          </button>
        </form>

        {/* TABELA DE BLOQUEIOS ATIVOS */}
        <div className="pt-6 border-t border-gray-100">
          <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider mb-3">Bloqueios de Agenda Ativos</h3>
          <div className="max-h-[220px] overflow-y-auto space-y-2 pr-2">
            {bloqueios.length === 0 ? <p className="text-xs text-gray-400 font-medium">Nenhuma restrição imposta no momento.</p> : bloqueios.map(bl => (
              <div key={bl.id} className="flex items-center justify-between p-3 bg-red-50/50 border border-red-100 rounded-xl">
                <span className="text-xs font-bold text-gray-700">{bl.data.split("-").reverse().join("/")} às {bl.horario} — <span className="text-red-600 font-black">{bl.medico_profissional}</span></span>
                <button onClick={() => deletarBloqueio(bl.id)} className="text-gray-400 hover:text-red-600 p-1 transition-colors"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* COLUNA DA DIREITA (AGRUPA CHAVES E INTEGRAÇÕES) */}
      <div className="flex flex-col gap-8">
        
        {/* 2. PAINEL DE CHAVES DE INTEGRAÇÃO */}
        <div className="bg-white border border-gray-100 rounded-[2rem] shadow-sm p-6 space-y-6 h-fit">
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2"><Key className="text-[#9FC131]" size={20} /> Credenciais da Empresa</h2>
            <p className="text-xs text-gray-400 font-medium">Configure suas chaves públicas e secretas do Supabase e Mercado Pago de forma isolada.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest ml-1">Supabase Public URL</label>
              <input type="text" value={keys?.supabase_url || ""} onChange={(e) => setKeys({...keys, supabase_url: e.target.value})} placeholder="https://your-project.supabase.co" className="w-full mt-1.5 p-3.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-[#9FC131]" />
            </div>
            <div>
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest ml-1">Supabase Anon Key</label>
              <input type="password" value={keys?.supabase_anon_key || ""} onChange={(e) => setKeys({...keys, supabase_anon_key: e.target.value})} placeholder="eyJhbGciOi..." className="w-full mt-1.5 p-3.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-[#9FC131]" />
            </div>
            <div>
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest ml-1">Mercado Pago Public Key</label>
              <input type="text" value={keys?.mp_public_key || ""} onChange={(e) => setKeys({...keys, mp_public_key: e.target.value})} placeholder="APP_USR-..." className="w-full mt-1.5 p-3.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-[#9FC131]" />
            </div>
            <div>
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest ml-1">Mercado Pago Access Token</label>
              <input type="password" value={keys?.mp_anon_token || ""} onChange={(e) => setKeys({...keys, mp_anon_token: e.target.value})} placeholder="TEST-..." className="w-full mt-1.5 p-3.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-[#9FC131]" />
            </div>

            <button onClick={salvarChavesConfig} className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold uppercase tracking-widest rounded-full transition-all flex items-center justify-center gap-2">
              <Save size={14} /> Salvar Parâmetros API
            </button>
          </div>
        </div>

        {/* 3. PAINEL DE INTEGRAÇÕES EXTERNAS */}
        <div className="bg-white border border-gray-100 rounded-[2rem] shadow-sm p-6 space-y-6 h-fit">
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Activity className="text-blue-600" size={20} /> Sincronização Externa
            </h2>
            <p className="text-xs text-gray-400 font-medium">
              Importe a base de agendamentos diretamente do sistema Medicalsys.
            </p>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <div className="flex items-start gap-3">
              <Calendar className="text-blue-600 mt-1" size={24} />
              <div className="w-full">
                <h4 className="text-sm font-bold text-gray-900">Agenda Medicalsys</h4>
                <p className="text-xs text-gray-600 mt-1 mb-4">
                  Baixe os agendamentos disponíveis e grave-os no seu Supabase.
                </p>
                <button 
                  onClick={importarAgendamentosMedicalsys} 
                  disabled={importLoading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all"
                >
                  {importLoading ? "Sincronizando..." : "Importar Agendamentos"}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}