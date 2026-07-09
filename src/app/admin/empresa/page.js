"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { 
  Trash2, Activity, Calendar as CalendarIcon, 
  ChevronLeft, ChevronRight, User, Plus, Server, 
  CheckCircle2, AlertCircle, CalendarDays, Zap, X,
  DollarSign, FileQuestion, Menu, Stethoscope, CreditCard, Lock, Filter,
  ChevronDown, Check
} from "lucide-react";
import Navbar from "@/components/Navbar";

const HORARIOS_OPCOES = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", 
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", 
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00"
];

// --- FUNÇÕES UTILITÁRIAS ---
// Garante a data atual no fuso horário local, e não em UTC
const getHojeLocal = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// --- ANIMAÇÕES ---
const spring = { type: "spring", stiffness: 400, damping: 30 };
const fadeUp = { initial: { opacity: 0, y: 15 }, animate: { opacity: 1, y: 0, transition: spring }, exit: { opacity: 0, y: -10, transition: { duration: 0.15 } } };
const staggerContainer = { animate: { transition: { staggerChildren: 0.05 } } };
const staggerItem = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: spring } };

// --- HOOKS CUSTOMIZADOS ---
function useOutsideClick(ref, callback) {
  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        callback();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref, callback]);
}

// --- COMPONENTES UI ARTESANAIS ---

const SidebarItem = ({ id, icon: Icon, label, activeView, onClick }) => (
  <button onClick={() => onClick(id)} className={`group w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all duration-300 relative ${activeView === id ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-900"}`}>
    {activeView === id && <motion.div layoutId="active-tab" className="absolute inset-0 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-zinc-200/50 rounded-2xl -z-10" transition={spring} />}
    <Icon size={18} className={activeView === id ? "text-zinc-900" : "text-zinc-400 group-hover:text-zinc-900 transition-colors"} />
    <span className="text-sm font-semibold tracking-wide">{label}</span>
  </button>
);

const CustomSelect = ({ value, onChange, options, label, icon: Icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);
  useOutsideClick(ref, () => setIsOpen(false));

  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div className="relative flex flex-col gap-1.5 w-full" ref={ref}>
      {label && <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">{label}</label>}
      <button type="button" onClick={() => setIsOpen(!isOpen)} className={`flex items-center justify-between w-full px-4 py-3.5 bg-white border ${isOpen ? 'border-zinc-900 ring-4 ring-zinc-900/5' : 'border-zinc-200/80 hover:border-zinc-300'} rounded-2xl text-sm font-medium text-zinc-900 transition-all shadow-sm`}>
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} className="text-zinc-400" />}
          <span className="truncate">{selectedOption?.label}</span>
        </div>
        <ChevronDown size={16} className={`text-zinc-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, y: 5, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 5, scale: 0.98 }} transition={{ duration: 0.15 }} className="absolute z-50 top-full left-0 right-0 mt-2 bg-white border border-zinc-200 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col max-h-60 overflow-y-auto custom-scrollbar">
            {options.map((opt) => (
              <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setIsOpen(false); }} className={`flex items-center justify-between px-4 py-3 text-sm transition-colors ${value === opt.value ? 'bg-zinc-50 font-bold text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50 font-medium'}`}>
                {opt.label}
                {value === opt.value && <Check size={14} className="text-zinc-900" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CustomDatePicker = ({ value, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [calDate, setCalDate] = useState(value ? new Date(value + "T12:00:00") : new Date());
  const ref = useRef(null);
  useOutsideClick(ref, () => setIsOpen(false));

  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const handleSelect = (d) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const displayDate = value ? new Date(value + "T12:00:00").toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : "Selecionar Data";

  return (
    <div className="relative flex flex-col gap-1.5 w-full" ref={ref}>
      {label && <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">{label}</label>}
      <button type="button" onClick={() => setIsOpen(!isOpen)} className={`flex items-center justify-between w-full px-4 py-3.5 bg-white border ${isOpen ? 'border-zinc-900 ring-4 ring-zinc-900/5' : 'border-zinc-200/80 hover:border-zinc-300'} rounded-2xl text-sm text-zinc-900 transition-all shadow-sm`}>
        <div className="flex items-center gap-2 font-medium">
          <CalendarIcon size={16} className="text-zinc-400" />
          {displayDate}
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, y: 5, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 5, scale: 0.98 }} className="absolute z-50 top-full left-0 mt-2 w-72 bg-white border border-zinc-200 rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.12)] p-5">
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold text-sm capitalize">{calDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</span>
              <div className="flex gap-1">
                <button type="button" onClick={() => setCalDate(new Date(year, month - 1, 1))} className="p-1.5 text-zinc-400 hover:bg-zinc-50 rounded-lg transition-colors"><ChevronLeft size={16}/></button>
                <button type="button" onClick={() => setCalDate(new Date(year, month + 1, 1))} className="p-1.5 text-zinc-400 hover:bg-zinc-50 rounded-lg transition-colors"><ChevronRight size={16}/></button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-y-2 gap-x-1 text-center">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d,i) => <div key={i} className="text-[10px] font-bold text-zinc-300 uppercase">{d}</div>)}
              {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const isSelected = value === dateStr;
                return (
                  <button key={d} type="button" onClick={() => handleSelect(d)} className={`h-8 w-full rounded-xl text-xs transition-all flex items-center justify-center ${isSelected ? 'bg-zinc-900 text-white font-bold' : 'hover:bg-zinc-100 text-zinc-700 font-medium'}`}>
                    {d}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TextInput = ({ label, type = "text", ...props }) => (
  <div className="flex flex-col gap-1.5 w-full">
    {label && <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">{label}</label>}
    <input type={type} className="w-full px-4 py-3.5 bg-white border border-zinc-200/80 rounded-2xl text-sm font-medium text-zinc-900 outline-none transition-all duration-300 focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/5 shadow-sm placeholder:text-zinc-300" {...props} />
  </div>
);

const ToggleSwitch = ({ checked, onChange, label }) => (
  <label className="flex items-center cursor-pointer select-none gap-3">
    <div className="relative">
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className={`block w-10 h-6 rounded-full transition-colors ${checked ? 'bg-zinc-900' : 'bg-zinc-200'}`}></div>
      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'transform translate-x-4' : ''}`}></div>
    </div>
    {label && <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{label}</span>}
  </label>
);

const ButtonPrimary = ({ children, onClick, disabled, className = "", icon: Icon }) => (
  <motion.button whileTap={!disabled ? { scale: 0.97 } : {}} onClick={onClick} disabled={disabled} className={`relative overflow-hidden bg-zinc-900 hover:bg-black text-white px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-[0_8px_20px_rgba(0,0,0,0.12)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}>
    {Icon && <Icon size={16} />}
    {children}
  </motion.button>
);

// --- COMPONENTE EXTRAÍDO (Evita o erro de Hook dentro de Map) ---
const ServicoCard = ({ srv, onSave, loading }) => {
  const [localSrv, setLocalSrv] = useState({ 
    preco: srv.preco, 
    dias_bloqueio_padrao: srv.dias_bloqueio_padrao, 
    tipo_contagem_dias: srv.tipo_contagem_dias 
  });

  return (
    <motion.div variants={staggerItem} className="bg-white border border-zinc-200/80 p-8 rounded-[2rem] shadow-sm flex flex-col justify-between group relative overflow-hidden">
      <div className="relative z-10">
        <span className="inline-block px-3 py-1.5 bg-zinc-100 text-zinc-600 text-[10px] font-black uppercase tracking-widest rounded-lg mb-5">{srv.tipo}</span>
        <h3 className="font-black text-2xl text-zinc-900 mb-8">{srv.nome}</h3>
        
        <div className="space-y-5">
          <TextInput label="Valor Total Integral (R$)" type="number" value={localSrv.preco} onChange={(e) => setLocalSrv({...localSrv, preco: e.target.value})} />
          <div className="flex flex-col sm:flex-row gap-4">
            <TextInput label="Dias Bloqueio Pré-exame" type="number" value={localSrv.dias_bloqueio_padrao} onChange={(e) => setLocalSrv({...localSrv, dias_bloqueio_padrao: e.target.value})} />
            <CustomSelect label="Contagem" value={localSrv.tipo_contagem_dias || 'corridos'} onChange={(val) => setLocalSrv({...localSrv, tipo_contagem_dias: val})} options={[{value:'corridos',label:'Corridos'}, {value:'uteis',label:'Úteis'}]} />
          </div>
        </div>
      </div>
      <ButtonPrimary disabled={loading} onClick={() => onSave(srv.id, localSrv)} className="mt-8 w-full">Salvar Alterações</ButtonPrimary>
    </motion.div>
  );
};

// ==========================================
// COMPONENTE PRINCIPAL (EMPRESA ADMIN)
// ==========================================

export default function EmpresaAdmin() {
  const [activeView, setActiveView] = useState("agenda");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Data States
  const [bloqueios, setBloqueios] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [perguntas, setPerguntas] = useState([]);
  
  // UI States
  const [loading, setLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Agenda Filters & States
  const [filterMedico, setFilterMedico] = useState("Todos");
  const [showBlockedInAgenda, setShowBlockedInAgenda] = useState(false);
  
  // Restrições Tab State
  const [restricaoTab, setRestricaoTab] = useState("lista"); // 'lista' | 'criar'
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [medicoSelecionado, setMedicoSelecionado] = useState("Todos");
  const [horariosBloquear, setHorariosBloquear] = useState([]);
  
  // Calendar States (Corrigido para usar fuso local)
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(getHojeLocal());

  // Triagem States
  const [isAddingTriagem, setIsAddingTriagem] = useState(false);
  const [novaTriagem, setNovaTriagem] = useState({ servico_id: "", pergunta: "", opcoes: [] });
  const [novaOpcao, setNovaOpcao] = useState({ texto_opcao: "", regra_bloqueio_dias: 0, tipo_contagem_dias: "corridos" });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    fetchBloqueios();
    fetchAgendamentos();
    fetchServicos();
    fetchPerguntas();
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchBloqueios = async () => {
    const { data } = await supabase.from("bloqueios_horarios").select("*").order("horario", { ascending: true });
    if (data) setBloqueios(data);
  };

  const fetchAgendamentos = async () => {
    // 1. CORREÇÃO: Usando 'nome_completo' conforme o schema
    const { data, error } = await supabase
      .from("agendamentos")
      .select(`*, pacientes (id, cpf, nome_completo)`) 
      .order("horario_agendamento", { ascending: true });

    if (error) {
      console.error("🚨 ERRO SUPABASE (Agendamentos):", error.message);
      showToast(`Erro na consulta: ${error.message}`, "error");
    }

    if (data) {
      setAgendamentos(data);
    }
  };

  const fetchServicos = async () => {
    const { data } = await supabase.from("servicos").select("*").order("tipo", { ascending: true });
    if (data) setServicos(data);
  };

  const fetchPerguntas = async () => {
    const { data: pergs } = await supabase.from("perguntas_triagem").select("*, servicos(nome)");
    const { data: ops } = await supabase.from("opcoes_triagem").select("*");
    if (pergs && ops) {
      setPerguntas(pergs.map(p => ({ ...p, opcoes: ops.filter(o => o.pergunta_id === p.id) })));
    }
  };

  // --- CALENDAR LOGIC ---
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const resetToToday = () => {
    setCurrentDate(new Date());
    setSelectedDay(getHojeLocal());
  };

  const handleMenuClick = (id) => {
    setActiveView(id);
    setIsMobileMenuOpen(false);
  };

  const toggleHorarioSelecao = (hr) => {
    setHorariosBloquear(prev => prev.includes(hr) ? prev.filter(h => h !== hr) : [...prev, hr]);
  };

  // --- ACTIONS ---
  const aplicarBloqueioEmLote = async () => {
    if (!dataInicio || horariosBloquear.length === 0) return showToast("Selecione a data e ao menos um horário.", "error");
    setLoading(true);

    const listaDatas = [];
    let dtAtual = new Date(dataInicio + "T12:00:00");
    const dtFim = dataFim ? new Date(dataFim + "T12:00:00") : dtAtual;

    while (dtAtual <= dtFim) {
      listaDatas.push(dtAtual.toISOString().slice(0, 10));
      dtAtual.setDate(dtAtual.getDate() + 1);
    }

    const inserts = listaDatas.flatMap(dt => horariosBloquear.map(hr => ({ data: dt, horario: hr, medico_profissional: medicoSelecionado })));
    const { error } = await supabase.from("bloqueios_horarios").insert(inserts);
    
    if (!error) {
      setHorariosBloquear([]); setDataInicio(""); setDataFim("");
      fetchBloqueios();
      setRestricaoTab("lista"); // Volta para a lista
      showToast(`${inserts.length} restrições aplicadas.`);
    } else {
      showToast("Erro ao aplicar bloqueios.", "error");
    }
    setLoading(false);
  };

  const deletarBloqueio = async (id) => {
    await supabase.from("bloqueios_horarios").delete().eq("id", id);
    fetchBloqueios();
    showToast("Bloqueio removido.");
  };

  const handleAtualizarServico = async (id, srvData) => {
    setLoading(true);
    await supabase.from("servicos").update({ preco: Number(srvData.preco), dias_bloqueio_padrao: Number(srvData.dias_bloqueio_padrao), tipo_contagem_dias: srvData.tipo_contagem_dias }).eq("id", id);
    showToast("Serviço atualizado!");
    setLoading(false);
  };

  const adicionarOpcaoLocal = () => {
    if(!novaOpcao.texto_opcao) return showToast("Digite um texto para a opção", "error");
    setNovaTriagem(p => ({...p, opcoes: [...p.opcoes, {...novaOpcao, id: Date.now()}]}));
    setNovaOpcao({ texto_opcao: "", regra_bloqueio_dias: 0, tipo_contagem_dias: "corridos" });
  };
  const removerOpcaoLocal = (id) => setNovaTriagem(p => ({...p, opcoes: p.opcoes.filter(o => o.id !== id)}));
  
  const salvarNovaTriagem = async () => {
    if(!novaTriagem.servico_id || !novaTriagem.pergunta || novaTriagem.opcoes.length === 0) return showToast("Preencha todos os campos.", "error");
    setLoading(true);
    const { data: perguntaSalva } = await supabase.from("perguntas_triagem").insert({ servico_id: novaTriagem.servico_id, pergunta: novaTriagem.pergunta }).select().single();
    if(perguntaSalva){
      await supabase.from("opcoes_triagem").insert(novaTriagem.opcoes.map(op => ({ pergunta_id: perguntaSalva.id, texto_opcao: op.texto_opcao, regra_bloqueio_dias: op.regra_bloqueio_dias, tipo_contagem_dias: op.tipo_contagem_dias })));
      showToast("Triagem cadastrada!"); setIsAddingTriagem(false); setNovaTriagem({ servico_id: "", pergunta: "", opcoes: [] }); fetchPerguntas();
    }
    setLoading(false);
  };

  // --- FILTROS COMPUTADOS ---
  const agendamentosFiltrados = useMemo(() => {
    return agendamentos
      .filter(a => a.data_agendamento === selectedDay)
      .filter(a => {
        if (filterMedico === "Todos") return true;
        const profExame = a.tipo_servico === "Exame" ? a.subtipo_exame : a.medico_profissional;
        return profExame === filterMedico;
      });
  }, [agendamentos, selectedDay, filterMedico]);

  const bloqueiosFiltrados = useMemo(() => {
    return bloqueios
      .filter(b => b.data === selectedDay)
      .filter(b => filterMedico === "Todos" || b.medico_profissional === filterMedico);
  }, [bloqueios, selectedDay, filterMedico]);

  // Lista mista para a aba Agenda
  const eventosAgendaMista = useMemo(() => {
    const arr = [...agendamentosFiltrados.map(a => ({...a, tipo: 'agendamento'}))];
    if (showBlockedInAgenda) {
      arr.push(...bloqueiosFiltrados.map(b => ({...b, tipo: 'bloqueio'})));
    }
    return arr.sort((a, b) => {
      const hA = a.tipo === 'agendamento' ? a.horario_agendamento : a.horario;
      const hB = b.tipo === 'agendamento' ? b.horario_agendamento : b.horario;
      return (hA || "").localeCompare(hB || "");
    });
  }, [agendamentosFiltrados, bloqueiosFiltrados, showBlockedInAgenda]);

  // Opções para CustomSelect
  const servicosOptions = [
    { value: "Todos", label: "Todos os Profissionais/Exames" },
    ...servicos.map(s => ({ value: s.nome, label: s.nome }))
  ];

  return (
    <div className="h-screen w-screen bg-[#F4F4F5] flex flex-col font-sans overflow-hidden text-zinc-900 selection:bg-zinc-900 selection:text-white">
      <Navbar />

      <motion.button whileTap={{ scale: 0.9 }} className="md:hidden fixed bottom-6 right-6 z-50 p-4 bg-zinc-900 text-white rounded-full shadow-2xl" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </motion.button>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -40, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.9 }} transition={spring}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-3 px-5 py-3 rounded-full bg-zinc-900/90 backdrop-blur-md text-white shadow-xl border border-white/10">
            {toast.type === "success" ? <CheckCircle2 size={16} className="text-green-400" /> : <AlertCircle size={16} className="text-red-400" />}
            <span className="text-sm font-medium tracking-wide">{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-1 pt-[72px] overflow-hidden relative">
        
        {/* Sidebar */}
        <aside className={`absolute md:relative z-40 h-full w-[260px] bg-white border-r border-zinc-200/60 flex flex-col p-4 transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}`}>
          <div className="mb-8 px-4 pt-4">
            <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Painel Admin</h2>
            <p className="text-xl font-black text-zinc-900 tracking-tight">Gestão Clínica</p>
          </div>
          <LayoutGroup>
            <nav className="flex flex-col gap-1 flex-1">
              <SidebarItem id="agenda" icon={CalendarDays} label="Agendamentos" activeView={activeView} onClick={handleMenuClick} />
              <SidebarItem id="bloqueios" icon={Lock} label="Restrições" activeView={activeView} onClick={handleMenuClick} />
              <SidebarItem id="financeiro" icon={DollarSign} label="Serviços & Preços" activeView={activeView} onClick={handleMenuClick} />
              <SidebarItem id="triagem" icon={FileQuestion} label="Motor de Triagem" activeView={activeView} onClick={handleMenuClick} />
              <div className="mt-auto"><SidebarItem id="sync" icon={Zap} label="Integração ERP" activeView={activeView} onClick={handleMenuClick} /></div>
            </nav>
          </LayoutGroup>
        </aside>

        {isMobileMenuOpen && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-zinc-900/20 backdrop-blur-sm z-30 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />}

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-[#F4F4F5] md:rounded-tl-[2rem] border-t border-l border-zinc-200/50 shadow-[-10px_-10px_30px_rgba(0,0,0,0.02)]">
          <AnimatePresence mode="wait">
            
            {/* VIEW: AGENDA & PACIENTES */}
            {activeView === "agenda" && (
              <motion.div key="agenda" {...fadeUp} className="flex-1 flex flex-col h-full overflow-hidden w-full max-w-7xl mx-auto md:p-6 lg:p-8">
                
                <div className="bg-white rounded-[2rem] border border-zinc-200/60 shadow-sm flex flex-col h-full overflow-hidden">
                  
                  {/* Cabeçalho da Agenda */}
                  <div className="px-6 md:px-8 py-6 border-b border-zinc-100 flex flex-col md:flex-row gap-6 justify-between md:items-center bg-zinc-50/30">
                    <div>
                      <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Agenda de Pacientes</h2>
                      <div className="flex items-center gap-4 mt-3">
                        <ToggleSwitch checked={showBlockedInAgenda} onChange={setShowBlockedInAgenda} label="Ver Horários Bloqueados" />
                      </div>
                    </div>
                    
                    <div className="w-full md:w-72">
                      <CustomSelect label="Filtrar Agenda" value={filterMedico} onChange={setFilterMedico} options={servicosOptions} icon={Filter} />
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                    {/* CALENDÁRIO MENOR */}
                    <div className="w-full md:w-[320px] border-r border-zinc-100 p-6 flex flex-col overflow-y-auto">
                      <div className="flex justify-between items-center mb-6">
                        <span className="font-bold capitalize text-zinc-900">{currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                        <div className="flex gap-1 bg-zinc-50 rounded-lg p-0.5 border border-zinc-200/50">
                          <button onClick={prevMonth} className="p-1.5 text-zinc-400 hover:text-zinc-900 transition-colors"><ChevronLeft size={16}/></button>
                          <button onClick={nextMonth} className="p-1.5 text-zinc-400 hover:text-zinc-900 transition-colors"><ChevronRight size={16}/></button>
                        </div>
                      </div>
                      <div className="grid grid-cols-7 gap-y-2 gap-x-1">
                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d,i) => <div key={i} className="text-center text-[10px] font-bold text-zinc-300 uppercase">{d}</div>)}
                        {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                          const isSel = selectedDay === dateStr;
                          const isTod = getHojeLocal() === dateStr;
                          
                          // Lógica Inteligente dos Dots (Respeita o Filtro)
                          const hasAgend = agendamentos.some(a => a.data_agendamento === dateStr && (filterMedico === "Todos" || (a.tipo_servico === "Exame" ? a.subtipo_exame === filterMedico : a.medico_profissional === filterMedico)));
                          const hasBlock = showBlockedInAgenda && bloqueios.some(b => b.data === dateStr && (filterMedico === "Todos" || b.medico_profissional === filterMedico));

                          return (
                            <button key={i} onClick={() => setSelectedDay(dateStr)} className={`relative h-10 w-full rounded-xl text-sm transition-all ${isSel ? "bg-zinc-900 text-white font-bold shadow-md" : isTod ? "bg-zinc-100 font-bold" : "hover:bg-zinc-50 text-zinc-600 font-medium"}`}>
                              {i + 1}
                              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
                                {hasAgend && <div className={`w-1 h-1 rounded-full ${isSel ? 'bg-white' : 'bg-green-500'}`} />}
                                {hasBlock && <div className={`w-1 h-1 rounded-full ${isSel ? 'bg-red-300' : 'bg-red-400'}`} />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* LISTA DE EVENTOS */}
                    <div className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar bg-[#FAFAFA]/50">
                      <h3 className="text-lg font-bold text-zinc-900 mb-6 flex items-center gap-2">
                        <CalendarDays size={18} className="text-zinc-400"/>
                        {new Date(selectedDay + "T12:00:00").toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </h3>
                      
                      <AnimatePresence mode="popLayout">
                        {eventosAgendaMista.length === 0 ? (
                          <motion.div key="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-20 text-center flex flex-col items-center justify-center">
                            <div className="w-20 h-20 bg-white border border-zinc-200 rounded-[2rem] flex items-center justify-center text-zinc-300 mb-6 shadow-sm"><User size={28}/></div>
                            <p className="text-zinc-500 text-sm font-medium">Nenhum evento corresponde aos filtros nesta data.</p>
                          </motion.div>
                        ) : (
                          <motion.div key="list-state" variants={staggerContainer} initial="initial" animate="animate" exit={{ opacity: 0 }} className="space-y-4">
                            {eventosAgendaMista.map((ev) => {
                              const isAgendamento = ev.tipo === 'agendamento';
                              const tituloPrincipal = isAgendamento ? (ev.tipo_servico === "Exame" ? ev.subtipo_exame : ev.medico_profissional) : ev.medico_profissional;
                              const hrFormat = (ev.horario_agendamento || ev.horario)?.substring(0,5);

                              return (
                                <motion.div key={ev.id} variants={staggerItem} layout className={`bg-white border ${isAgendamento ? 'border-zinc-200/80 hover:border-zinc-300' : 'border-red-100 hover:border-red-200'} p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 transition-colors relative overflow-hidden`}>
                                  {!isAgendamento && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-400" />}
                                  
                                  <div className="bg-zinc-50 border border-zinc-100 px-4 py-3 rounded-xl text-center min-w-[76px] shadow-inner">
                                    <span className="text-lg font-black text-zinc-900 tracking-tighter">{hrFormat}</span>
                                  </div>
                                  
                                  <div className="flex-1">
                                    {isAgendamento ? (
                                      <>
                                        {/* 2. CORREÇÃO: Usando 'nome_completo' na renderização também */}
                                        <h4 className="text-base font-bold text-zinc-900 flex items-center flex-wrap gap-2">
                                          {ev.pacientes?.nome_completo ? ev.pacientes.nome_completo : "Paciente não identificado"}
                                          {ev.pacientes?.cpf && <span className="text-xs font-medium text-zinc-400 px-2 py-0.5 bg-zinc-100 rounded-md">CPF: {ev.pacientes.cpf}</span>}
                                        </h4>
                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                          <span className="bg-zinc-100 text-zinc-700 text-[10px] font-bold uppercase px-2.5 py-1 rounded-md flex items-center gap-1"><Stethoscope size={12}/> {tituloPrincipal}</span>
                                          <span className="bg-zinc-100 text-zinc-500 text-[10px] font-bold uppercase px-2.5 py-1 rounded-md">{ev.tipo_servico}</span>
                                          <span className={`${ev.status_pagamento_antecipado ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'} text-[10px] font-bold uppercase px-2.5 py-1 rounded-md flex items-center gap-1`}><CreditCard size={12}/> {ev.status_pagamento_antecipado ? "Pago" : "Pendente"}</span>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <h4 className="text-base font-bold text-zinc-500 flex items-center gap-2">Paciente da Plataforma MedicalSys {ev.status === "importado" && <span className="bg-blue-50 text-blue-600 text-[9px] uppercase px-2 py-0.5 rounded-md flex items-center gap-1"><Server size={10}/> ERP</span>}</h4>
                                        <p className="text-sm font-medium text-zinc-900 mt-1">{tituloPrincipal}</p>
                                      </>
                                    )}
                                  </div>
                                </motion.div>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* VIEW: RESTRIÇÕES DE AGENDA */}
            {activeView === "bloqueios" && (
              <motion.div key="bloqueios" {...fadeUp} className="flex-1 flex flex-col h-full overflow-hidden w-full max-w-5xl mx-auto md:p-6 lg:p-8">
                <div className="bg-white rounded-[2rem] border border-zinc-200/60 shadow-sm flex flex-col h-full overflow-hidden">
                  <div className="px-6 md:px-8 pt-8 pb-4 border-b border-zinc-100">
                    <h2 className="text-3xl font-black text-zinc-900 tracking-tight mb-6">Restrições de Agenda</h2>
                    
                    <div className="flex gap-4 border-b border-zinc-200">
                      <button onClick={() => setRestricaoTab("lista")} className={`pb-3 text-sm font-bold tracking-wide transition-colors relative ${restricaoTab === "lista" ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-700"}`}>
                        Lista de Bloqueios
                        {restricaoTab === "lista" && <motion.div layoutId="restTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900" />}
                      </button>
                      <button onClick={() => setRestricaoTab("criar")} className={`pb-3 text-sm font-bold tracking-wide transition-colors relative ${restricaoTab === "criar" ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-700"}`}>
                        Nova Restrição
                        {restricaoTab === "criar" && <motion.div layoutId="restTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                    <AnimatePresence mode="wait">
                      {restricaoTab === "lista" ? (
                        <motion.div key="lista" initial={{opacity:0, x:-10}} animate={{opacity:1, x:0}} exit={{opacity:0, x:10}}>
                          <div className="max-w-xs mb-8">
                            <CustomDatePicker label="Filtrar por Data" value={selectedDay} onChange={setSelectedDay} />
                          </div>

                          {bloqueiosFiltrados.length === 0 ? (
                            <div className="text-center py-20">
                              <p className="text-zinc-500 font-medium">Agenda livre nesta data.</p>
                            </div>
                          ) : (
                            <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {bloqueiosFiltrados.map((b) => (
                                <motion.div key={b.id} variants={staggerItem} layout className="group bg-white border border-zinc-200 p-5 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                                  <div>
                                    <h4 className="text-lg font-black text-zinc-900 flex items-center gap-2">
                                      {b.horario?.substring(0,5)}
                                      {b.status === "importado" && <span className="bg-blue-50 text-blue-600 text-[9px] uppercase px-2 py-0.5 rounded flex items-center gap-1"><Server size={10}/> ERP</span>}
                                    </h4>
                                    <p className="text-xs font-semibold text-zinc-500 mt-1 uppercase tracking-widest">{b.medico_profissional}</p>
                                  </div>
                                  {b.status !== "importado" && (
                                    <button onClick={() => deletarBloqueio(b.id)} className="w-10 h-10 rounded-full bg-zinc-50 text-zinc-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-colors">
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </motion.div>
                              ))}
                            </motion.div>
                          )}
                        </motion.div>
                      ) : (
                        <motion.div key="criar" initial={{opacity:0, x:10}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-10}} className="max-w-2xl mx-auto">
                          <div className="bg-zinc-50/50 border border-zinc-200/80 p-8 rounded-[2rem]">
                            <h3 className="text-sm font-bold uppercase text-zinc-900 tracking-widest mb-8 flex items-center gap-2"><Lock size={16}/> Configurar Restrição</h3>
                            <div className="space-y-6">
                              <div className="flex flex-col md:flex-row gap-4">
                                <CustomDatePicker label="Data Inicial" value={dataInicio} onChange={setDataInicio} />
                                <CustomDatePicker label="Data Final (Opc.)" value={dataFim} onChange={setDataFim} />
                              </div>
                              <CustomSelect label="Profissional / Exame Alvo" value={medicoSelecionado} onChange={setMedicoSelecionado} options={servicosOptions} />
                              
                              <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1 mb-3 block">Horários Afetados</label>
                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                  {HORARIOS_OPCOES.map(hr => (
                                    <button type="button" key={hr} onClick={() => toggleHorarioSelecao(hr)} className={`py-3 rounded-xl text-xs font-bold transition-all border ${horariosBloquear.includes(hr) ? "bg-zinc-900 text-white border-zinc-900 shadow-md" : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"}`}>
                                      {hr}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              
                              <div className="pt-4 border-t border-zinc-200">
                                <ButtonPrimary onClick={aplicarBloqueioEmLote} disabled={loading} className="w-full py-5">
                                  {loading ? "Processando Lote..." : "Confirmar Bloqueio"}
                                </ButtonPrimary>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}

            {/* VIEW: FINANCEIRO & SERVIÇOS */}
            {activeView === "financeiro" && (
              <motion.div key="financeiro" {...fadeUp} className="p-6 md:p-10 mx-auto w-full max-w-6xl overflow-y-auto h-full custom-scrollbar">
                <div className="mb-10">
                  <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Catálogo de Serviços</h2>
                  <p className="text-sm text-zinc-500 mt-2 font-medium">Gerencie a política financeira e os prazos de bloqueio de agendamento por serviço.</p>
                </div>
                
                <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {servicos.map(srv => (
                    <ServicoCard key={srv.id} srv={srv} onSave={handleAtualizarServico} loading={loading} />
                  ))}
                </motion.div>
              </motion.div>
            )}

            {/* VIEW: TRIAGEM & REGRAS */}
            {activeView === "triagem" && (
              <motion.div key="triagem" {...fadeUp} className="p-6 md:p-10 mx-auto w-full max-w-5xl overflow-y-auto h-full custom-scrollbar">
                <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                  <div>
                    <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Motor de Triagem</h2>
                    <p className="text-sm text-zinc-500 mt-2 font-medium">Condicione exames com formulários clínicos. Respostas podem travar agendamentos.</p>
                  </div>
                  {!isAddingTriagem && (
                    <ButtonPrimary onClick={() => setIsAddingTriagem(true)} icon={Plus}>Nova Regra Clínica</ButtonPrimary>
                  )}
                </div>

                <AnimatePresence>
                  {isAddingTriagem && (
                    <motion.div initial={{ opacity: 0, height: 0, y: -10 }} animate={{ opacity: 1, height: "auto", y: 0 }} exit={{ opacity: 0, height: 0, y: -10 }} className="mb-10 bg-white border border-zinc-200/80 p-8 rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.06)] overflow-hidden">
                      <div className="flex justify-between items-center mb-8 border-b border-zinc-100 pb-6">
                        <h3 className="font-black text-xl text-zinc-900">Configurar Nova Diretriz</h3>
                        <button onClick={() => setIsAddingTriagem(false)} className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"><X size={18}/></button>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-6 mb-8">
                        <CustomSelect label="Exame/Consulta Afetada" value={novaTriagem.servico_id} onChange={val => setNovaTriagem({...novaTriagem, servico_id: val})} options={[{value:"", label:"Selecione o alvo..."}, ...servicos.map(s => ({value: s.id, label: s.nome}))]} />
                        <TextInput label="A Pergunta" placeholder="Ex: Toma Losartana?" value={novaTriagem.pergunta} onChange={e => setNovaTriagem({...novaTriagem, pergunta: e.target.value})} />
                      </div>

                      <div className="bg-zinc-50/50 p-6 border border-zinc-200/60 rounded-3xl mb-8">
                        <h4 className="text-[11px] font-bold uppercase text-zinc-400 tracking-widest mb-4 ml-1">Mapear Opções de Resposta</h4>
                        <div className="flex flex-col lg:flex-row gap-4 items-end">
                          <div className="flex-1 w-full"><TextInput label="Texto" placeholder="Ex: Sim" value={novaOpcao.texto_opcao} onChange={e => setNovaOpcao({...novaOpcao, texto_opcao: e.target.value})} /></div>
                          <div className="w-full lg:w-32"><TextInput label="Bloqueio" type="number" value={novaOpcao.regra_bloqueio_dias} onChange={e => setNovaOpcao({...novaOpcao, regra_bloqueio_dias: e.target.value})} /></div>
                          <div className="w-full lg:w-48"><CustomSelect label="Tipo" value={novaOpcao.tipo_contagem_dias} onChange={val => setNovaOpcao({...novaOpcao, tipo_contagem_dias: val})} options={[{value:'corridos',label:'Corridos'}, {value:'uteis',label:'Úteis'}]} /></div>
                          <button onClick={adicionarOpcaoLocal} className="w-full lg:w-auto h-[52px] px-6 bg-white border border-zinc-200 text-zinc-900 rounded-xl font-bold flex items-center justify-center hover:border-zinc-900 hover:bg-zinc-50 transition-all shadow-sm"><Plus size={20}/></button>
                        </div>

                        {novaTriagem.opcoes.length > 0 && (
                          <div className="mt-6 space-y-3">
                            {novaTriagem.opcoes.map(op => (
                              <div key={op.id} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm">
                                <div><span className="font-bold text-zinc-900">{op.texto_opcao}</span> <span className="bg-zinc-100 text-zinc-500 text-[10px] font-bold uppercase px-2 py-1 rounded ml-3">Impede {op.regra_bloqueio_dias} {op.tipo_contagem_dias}</span></div>
                                <button onClick={() => removerOpcaoLocal(op.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <ButtonPrimary disabled={loading} onClick={salvarNovaTriagem} className="w-full py-5">
                        {loading ? "Salvando..." : "Registrar Regra"}
                      </ButtonPrimary>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {perguntas.map(perg => (
                    <motion.div variants={staggerItem} key={perg.id} className="bg-white border border-zinc-200/80 p-8 rounded-[2rem] shadow-sm relative group flex flex-col h-full">
                      <button onClick={async () => { if(window.confirm("Apagar pergunta?")){ await supabase.from("perguntas_triagem").delete().eq("id", perg.id); fetchPerguntas(); showToast("Removida."); } }} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white border border-red-100 text-red-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 flex items-center justify-center shadow-sm"><Trash2 size={16} /></button>
                      <div className="mb-8 pr-12">
                        <span className="inline-block px-3 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-lg mb-4">{perg.servicos?.nome || "Geral"}</span>
                        <h3 className="font-black text-xl text-zinc-900 leading-tight">{perg.pergunta}</h3>
                      </div>
                      <div className="grid gap-3 mt-auto">
                        {perg.opcoes.map(op => (
                          <div key={op.id} className="flex justify-between items-center p-4 bg-zinc-50 border border-zinc-100 rounded-xl">
                            <span className="text-sm font-bold text-zinc-700">{op.texto_opcao}</span>
                            <span className="text-[10px] text-zinc-400 font-bold uppercase bg-white border px-2 py-1 rounded shadow-sm">+{op.regra_bloqueio_dias} {op.tipo_contagem_dias.charAt(0)}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            )}

            {/* VIEW: SYNC EXTERNO */}
            {activeView === "sync" && (
              <motion.div key="tech" {...fadeUp} className="p-6 md:p-10 mx-auto w-full max-w-4xl overflow-y-auto h-full custom-scrollbar">
                <div className="mb-12">
                  <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Sincronização ERP</h2>
                  <p className="text-sm text-zinc-500 mt-2 font-medium">Extraia horários indisponíveis do sistema interno da clínica (Medicalsys).</p>
                </div>
                <div className="bg-gradient-to-br from-zinc-900 to-black p-8 md:p-12 rounded-[2rem] shadow-2xl relative overflow-hidden group">
                  <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/20 blur-[100px] rounded-full pointer-events-none group-hover:bg-blue-500/30 transition-all duration-1000"/>
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10 text-center md:text-left">
                    <div className="w-20 h-20 bg-zinc-800 border border-zinc-700 rounded-[2rem] flex items-center justify-center text-blue-400 shadow-2xl flex-shrink-0">
                      <Server size={32} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-black text-white">Medicalsys Webhook</h3>
                      <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
                        Ao forçar a sincronização, o portal consome a API da Medicalsys, cruza as agendas preenchidas pelos recepcionistas locais e injeta bloqueios automáticos aqui para evitar choques de horário.
                      </p>
                      <button onClick={async () => { setImportLoading(true); try { const r=await fetch("/api/importar-agenda",{method:"POST"}); const d=await r.json(); if(d.success){showToast(d.message); fetchBloqueios();} else showToast(d.error,"error"); } catch(e){showToast("Erro API", "error");} finally{setImportLoading(false);}}} disabled={importLoading} className="mt-8 px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center md:justify-start w-full md:w-auto gap-3 shadow-[0_10px_30px_rgba(37,99,235,0.3)]">
                        {importLoading ? <><Activity size={16} className="animate-spin" /> Processando Integração...</> : "Forçar Sincronização Agora"}
                      </button>
                    </div>
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