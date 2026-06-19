"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Trash2, Key, Save, Activity, Calendar as CalendarIcon, 
  ChevronLeft, ChevronRight, Clock, User, Plus, Server, 
  Settings, CheckCircle2, AlertCircle, CalendarDays, Zap, X 
} from "lucide-react";
import Navbar from "@/components/Navbar";

// NOVA GRADE DE HORÁRIOS: 30 em 30 Minutos
const HORARIOS_OPCOES = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", 
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", 
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00"
];
const MEDICOS = ["Todos", "Dra. Simone", "Dr. Brilhante", "Dr. Tiago Lima", "Dr. Thiago Dyavy", "Dra. Candice (Psicologia)"];

export default function EmpresaAdmin() {
  const [activeView, setActiveView] = useState("agenda");

  const [bloqueios, setBloqueios] = useState([]);
  const [keys, setKeys] = useState({ supabase_url: "", supabase_anon_key: "", mp_public_key: "", mp_anon_token: "" });
  
  const [loading, setLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [medicoSelecionado, setMedicoSelecionado] = useState("Todos");
  const [horariosBloquear, setHorariosBloquear] = useState([]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    fetchBloqueios();
    fetchConfigEmpresa();
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchBloqueios = async () => {
    const { data } = await supabase.from("bloqueios_horarios").select("*").order("horario", { ascending: true });
    if (data) setBloqueios(data);
  };

  const fetchConfigEmpresa = async () => {
    const { data } = await supabase.from("empresas").select("*").limit(1).maybeSingle();
    if (data) setKeys(data);
  };

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const resetToToday = () => {
    setCurrentDate(new Date());
    setSelectedDay(new Date().toISOString().slice(0, 10));
  };

  const toggleHorarioSelecao = (hora) => {
    setHorariosBloquear(prev => prev.includes(hora) ? prev.filter(h => h !== hora) : [...prev, hora]);
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
      setDataInicio("");
      setDataFim("");
      setIsAddingBlock(false);
      fetchBloqueios();
      setCurrentDate(new Date(listaDatas[0] + "T12:00:00"));
      setSelectedDay(listaDatas[0]);
      showToast(`${inserts.length} restrições aplicadas com sucesso.`);
    } else {
      showToast("Erro ao aplicar bloqueios.", "error");
    }
    setLoading(false);
  };

  const deletarBloqueio = async (id) => {
    await supabase.from("bloqueios_horarios").delete().eq("id", id);
    fetchBloqueios();
    showToast("Evento removido da agenda.");
  };

  const salvarChavesConfig = async () => {
    setLoading(true);
    await supabase.from("empresas").insert([{ ...keys, nome: "Clínica Padrão", slug: "padrao" }]);
    showToast("Credenciais atualizadas com sucesso.");
    setLoading(false);
  };

  const importarAgendamentosMedicalsys = async () => {
    setImportLoading(true);
    try {
      const res = await fetch("/api/importar-agenda", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        fetchBloqueios();
      } else {
        showToast(data.error, "error");
      }
    } catch (error) {
      showToast("Falha de comunicação com o servidor.", "error");
    } finally {
      setImportLoading(false);
    }
  };

  const bloqueiosDoDia = bloqueios.filter(b => b.data === selectedDay);

  const SidebarItem = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setActiveView(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative ${
        activeView === id ? "text-zinc-900 font-bold" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 font-medium"
      }`}
    >
      {activeView === id && (
        <motion.div layoutId="activeTab" className="absolute inset-0 bg-white shadow-sm border border-zinc-200/60 rounded-xl -z-10" />
      )}
      <Icon size={18} className={activeView === id ? "text-[#9FC131]" : "text-zinc-400"} />
      <span className="text-sm">{label}</span>
    </button>
  );

  return (
    <div className="h-screen w-screen bg-[#F7F7F9] flex flex-col font-sans overflow-hidden">
      <Navbar />

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-full bg-zinc-900/90 backdrop-blur-md text-white shadow-2xl border border-white/10">
            {toast.type === "success" ? <CheckCircle2 size={16} className="text-[#9FC131]" /> : <AlertCircle size={16} className="text-red-400" />}
            <span className="text-xs font-semibold tracking-wide">{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-1 pt-20 overflow-hidden">
        
        <aside className="w-64 flex-shrink-0 bg-[#F7F7F9] border-r border-zinc-200/60 flex flex-col p-4 pt-8 hidden md:flex">
          <div className="mb-8 px-4">
            <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Painel de Controle</h2>
            <p className="text-xl font-black text-zinc-900 tracking-tight">Administração</p>
          </div>
          <nav className="flex flex-col gap-2">
            <SidebarItem id="agenda" icon={CalendarDays} label="Agenda & Visão Geral" />
            <SidebarItem id="sync" icon={Zap} label="Motor de Sincronização" />
            <SidebarItem id="config" icon={Settings} label="Chaves do Sistema" />
          </nav>
        </aside>

        <main className="flex-1 flex flex-col relative overflow-hidden bg-white md:rounded-tl-[2rem] border-t border-l border-zinc-200/50 shadow-[-10px_-10px_30px_rgba(0,0,0,0.02)]">
          <AnimatePresence mode="wait">
            
            {activeView === "agenda" && (
              <motion.div key="agenda" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
                
                <div className="w-full lg:w-[450px] flex-shrink-0 border-r border-zinc-100 flex flex-col p-6 md:p-8 bg-white overflow-y-auto custom-scrollbar">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-2xl font-black text-zinc-900 tracking-tight capitalize">
                        {currentDate.toLocaleString('pt-BR', { month: 'long' })} <span className="text-zinc-400 font-medium">{year}</span>
                      </h2>
                    </div>
                    <div className="flex gap-1 bg-zinc-50 p-1 rounded-full border border-zinc-100">
                      <button onClick={prevMonth} className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-white rounded-full transition-all shadow-sm"><ChevronLeft size={16} /></button>
                      <button onClick={resetToToday} className="px-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-all">Hoje</button>
                      <button onClick={nextMonth} className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-white rounded-full transition-all shadow-sm"><ChevronRight size={16} /></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-y-4 gap-x-1 mb-8">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dia => (
                      <div key={dia} className="text-center text-[10px] font-bold text-zinc-400 uppercase">{dia}</div>
                    ))}
                    {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                    
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const isSelected = selectedDay === dateStr;
                      const isToday = new Date().toISOString().slice(0, 10) === dateStr;
                      const dayBlocks = bloqueios.filter(b => b.data === dateStr);
                      
                      return (
                        <button key={day} onClick={() => setSelectedDay(dateStr)}
                          className={`relative flex flex-col items-center justify-center h-10 w-full rounded-xl transition-all ${
                            isSelected ? "bg-zinc-900 text-white shadow-md font-bold scale-105" 
                            : isToday ? "bg-zinc-100 text-zinc-900 font-bold" 
                            : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                          }`}>
                          <span className="text-sm">{day}</span>
                          {dayBlocks.length > 0 && (
                            <div className="absolute bottom-1 w-1 h-1 rounded-full bg-[#9FC131]" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-auto pt-6 border-t border-zinc-100">
                    {!isAddingBlock ? (
                      <button onClick={() => setIsAddingBlock(true)} className="w-full py-4 border-2 border-dashed border-zinc-200 hover:border-[#9FC131] hover:bg-[#9FC131]/5 text-zinc-500 hover:text-[#9FC131] text-xs font-bold uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2">
                        <Plus size={16} /> Nova Restrição de Agenda
                      </button>
                    ) : (
                      <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} onSubmit={aplicarBloqueioEmLote} className="bg-zinc-50 p-5 rounded-3xl border border-zinc-200/60 space-y-4">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="text-xs font-black uppercase tracking-widest text-zinc-900">Configurar Bloqueio</h4>
                          <button type="button" onClick={() => setIsAddingBlock(false)} className="text-zinc-400 hover:text-red-500 transition-colors"><X size={16} /></button>
                        </div>
                        <input required type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full p-3 bg-white border border-zinc-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#9FC131]" />
                        <select value={medicoSelecionado} onChange={(e) => setMedicoSelecionado(e.target.value)} className="w-full p-3 bg-white border border-zinc-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#9FC131]">
                          {MEDICOS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        {/* AQUI ESTÁ A GRADE DE 30 MINUTOS */}
                        <div className="grid grid-cols-4 gap-1.5 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                          {HORARIOS_OPCOES.map(hr => (
                            <button type="button" key={hr} onClick={() => toggleHorarioSelecao(hr)} 
                              className={`py-2 rounded-lg text-[10px] font-bold transition-all border ${horariosBloquear.includes(hr) ? "bg-zinc-900 text-white border-zinc-900 shadow-sm" : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"}`}>
                              {hr}
                            </button>
                          ))}
                        </div>
                        <button type="submit" disabled={loading} className="w-full py-3 bg-[#9FC131] hover:bg-[#8eb02c] text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all mt-2 shadow-md">
                          {loading ? "Salvando..." : "Confirmar Bloqueio"}
                        </button>
                      </motion.form>
                    )}
                  </div>
                </div>

                <div className="flex-1 bg-[#FAFAFA] flex flex-col h-full overflow-hidden">
                  <div className="p-6 md:p-8 pb-4 flex-shrink-0">
                    <h3 className="text-xl font-black text-zinc-900 tracking-tight">
                      {selectedDay ? new Date(selectedDay + "T12:00:00").toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : "Agenda"}
                    </h3>
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">
                      {bloqueiosDoDia.length} Registro{bloqueiosDoDia.length !== 1 && 's'} Encontrado{bloqueiosDoDia.length !== 1 && 's'}
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 md:px-8 pb-8 custom-scrollbar">
                    <AnimatePresence mode="popLayout">
                      {bloqueiosDoDia.length === 0 ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center text-center max-w-xs mx-auto">
                          <div className="w-16 h-16 rounded-3xl bg-zinc-100 flex items-center justify-center text-zinc-300 mb-4 rotate-3"><CalendarIcon size={28} /></div>
                          <p className="text-sm font-bold text-zinc-900">Agenda Livre</p>
                          <p className="text-xs text-zinc-500 mt-2 leading-relaxed">Nenhum evento ou restrição foi orquestrado para esta data. O sistema está aberto para marcações.</p>
                        </motion.div>
                      ) : (
                        <div className="space-y-3">
                          {bloqueiosDoDia.map((bl) => (
                            <motion.div key={bl.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                              className="group relative bg-white border border-zinc-200/60 p-4 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-all overflow-hidden">
                              <div className={`absolute left-0 top-0 bottom-0 w-1 ${bl.status === "importado" ? "bg-blue-500" : "bg-red-500"}`} />
                              <div className="pl-3">
                                <div className="flex items-center gap-3 mb-1">
                                  <span className="text-lg font-black text-zinc-900 tracking-tighter">{bl.horario}</span>
                                  {bl.status === "importado" && <span className="bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md flex items-center gap-1"><Server size={10} /> Medicalsys</span>}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                                  <User size={12} /> {bl.medico_profissional}
                                </div>
                              </div>
                              <button onClick={() => deletarBloqueio(bl.id)} className="w-8 h-8 rounded-full bg-zinc-50 text-zinc-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 hover:text-red-500">
                                <Trash2 size={14} />
                              </button>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}

            {activeView === "sync" && (
              <motion.div key="sync" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-8 max-w-3xl mx-auto w-full">
                <div className="mb-10">
                  <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Motor de Sincronização</h2>
                  <p className="text-sm text-zinc-500 mt-2">Conecte-se às APIs externas para manter sua base de dados atualizada em tempo real.</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-100/50 p-8 rounded-[2rem] shadow-sm">
                  <div className="flex flex-col sm:flex-row items-start gap-5">
                    <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20 flex-shrink-0">
                      <Activity size={24} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-black text-zinc-900">Medicalsys Gateway</h3>
                      <p className="text-sm text-zinc-600 mt-2 leading-relaxed">
                        Inicia o download e cruzamento de dados de todos os agendamentos da API oficial da Medicalsys, de hoje até o final do ano. Duplicações são ignoradas automaticamente.
                      </p>
                      <button onClick={importarAgendamentosMedicalsys} disabled={importLoading} className="mt-6 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center w-full sm:w-auto gap-2 shadow-[0_8px_20px_rgba(37,99,235,0.2)]">
                        {importLoading ? <><Activity size={16} className="animate-pulse" /> Processando Lote...</> : "Iniciar Sincronização"}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeView === "config" && (
              <motion.div key="config" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-8 max-w-3xl mx-auto w-full">
                <div className="mb-10">
                  <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Chaves de Instância</h2>
                  <p className="text-sm text-zinc-500 mt-2">Configure os parâmetros de conexão do seu ambiente Supabase e Mercado Pago.</p>
                </div>
                <div className="bg-white border border-zinc-200/60 p-6 md:p-8 rounded-[2rem] shadow-sm space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">Supabase Public URL</label>
                    <input type="text" value={keys?.supabase_url || ""} onChange={(e) => setKeys({...keys, supabase_url: e.target.value})} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-[#9FC131] transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">Supabase Anon Key</label>
                    <input type="password" value={keys?.supabase_anon_key || ""} onChange={(e) => setKeys({...keys, supabase_anon_key: e.target.value})} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-[#9FC131] transition-all" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">Mercado Pago Public Key</label>
                      <input type="text" value={keys?.mp_public_key || ""} onChange={(e) => setKeys({...keys, mp_public_key: e.target.value})} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-[#9FC131] transition-all" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">Mercado Pago Token</label>
                      <input type="password" value={keys?.mp_anon_token || ""} onChange={(e) => setKeys({...keys, mp_anon_token: e.target.value})} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-[#9FC131] transition-all" />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-zinc-100">
                    <button onClick={salvarChavesConfig} className="w-full md:w-auto px-8 py-4 bg-zinc-900 hover:bg-black text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-zinc-900/20">
                      <Save size={16} /> Salvar Alterações
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E4E4E7; border-radius: 10px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: #D4D4D8; }
      `}} />
    </div>
  );
}