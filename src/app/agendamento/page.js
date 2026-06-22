"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase"; 
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { 
  ArrowRight, ArrowLeft, CheckCircle, AlertTriangle, Sparkles, 
  ShieldCheck, Calendar as CalendarIcon, CreditCard, 
  Lock, ChevronLeft, ChevronRight, Activity, User, HeartPulse, Search
} from "lucide-react";
import Navbar from "@/components/Navbar";

if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_MP_PUBLIC_KEY) {
  initMercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY, { locale: 'pt-BR' });
}

// --- DICIONÁRIO DE INTEGRAÇÃO RMChat / TYPEBOT ---
const MAPA_SERVICOS = {
  "1": { tipo: "Consulta", medico: "Dra. Simone" },
  "2": { tipo: "Consulta", medico: "Dr. Brilhante" },
  "3": { tipo: "Consulta", medico: "Dr. Tiago Lima" },
  "4": { tipo: "Consulta", medico: "Dr. Thiago Dyavy" },
  "5": { tipo: "Consulta", medico: "Dra. Candice (Psicologia)" },
  "6": { tipo: "Exame", exame: "Endoscopia Digestiva Alta" },
  "7": { tipo: "Exame", exame: "Colonoscopia" }
};

// --- UTILITÁRIOS ---
const maskCPF = (v) => v.replace(/\D/g, "").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})/, "$1-$2").replace(/(-\d{2})\d+?$/, "$1"); 
const maskPhone = (v) => v.replace(/\D/g, "").replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").replace(/(-\d{4})\d+?$/, "$1");
const maskDate = (v) => v.replace(/\D/g, "").replace(/(\d{2})(\d)/, "$1/$2").replace(/(\d{2})(\d)/, "$1/$2").replace(/(\/\d{4})\d+?$/, "$1");

const isValidDate = (dateString) => {
  const regex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[012])\/(19|20)\d\d$/;
  if (!regex.test(dateString)) return false;
  const [day, month, year] = dateString.split('/').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

const calculateAge = (dobString) => {
  if (!dobString) return 0;
  const [day, month, year] = dobString.split('/').map(Number);
  const dob = new Date(year, month - 1, day);
  return Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970);
};

const convertDateToDBFormat = (dateString) => {
  if (!dateString) return null;
  const [day, month, year] = dateString.split('/');
  return `${year}-${month}-${day}`;
};

const getLocalTodayStr = () => {
  const tzoffset = (new Date()).getTimezoneOffset() * 60000; 
  return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 10);
};

// --- SCHEMA ---
const agendamentoSchema = z.object({
  cpf: z.string().length(14, "O CPF precisa ter 14 dígitos"),
  nome_completo: z.string().min(5, "Informe seu nome completo").includes(" ", { message: "Insira nome e sobrenome" }),
  telefone_whatsapp: z.string().min(14, "WhatsApp incompleto"),
  data_nascimento: z.string().refine(isValidDate, { message: "Data inválida (DD/MM/AAAA)" }),
  email: z.string().email("E-mail inválido, verifique a digitação"),
  tipo_servico: z.enum(["Consulta", "Retorno", "Exame"]).optional(),
  medico_profissional: z.string().optional(),
  subtipo_exame: z.string().optional(),
  modalidade: z.enum(["Particular", "Convênio"]).optional(),
  data_agendamento: z.string().optional(),
  horario_agendamento: z.string().optional(),
});

const PRECOS = { 
  "Dra. Simone": 450, "Dr. Brilhante": 2, "Dr. Tiago Lima": 350, 
  "Dr. Thiago Dyavy": 350, "Dra. Candice (Psicologia)": 200,
  "Endoscopia Digestiva Alta": 500, "Colonoscopia": 750, "Retirada de Balão Gástrico": 1100
};

// --- GRADE DE HORÁRIOS: 1 EM 1 HORA ---
const HORARIOS_BASE = [
  "09:00", "10:00", "11:00", "12:00", "13:00", 
  "14:00", "15:00", "16:00", "17:00", "18:00"
];

const NOME_ETAPAS = ["Sincronização", "Identificação", "Especialidade", "Modalidade", "Agenda", "Checkout", "Concluído"];

export default function AgendamentoPremium() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-8 h-8 border-2 border-[#9FC131] border-t-transparent rounded-full" />
      </div>
    }>
      <AgendamentoForm />
    </Suspense>
  );
}

function AgendamentoForm() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [islandState, setIslandState] = useState("default");
  const [islandMessage, setIslandMessage] = useState("");
  const timeoutRef = useRef(null);
  
  const [isSmartLink, setIsSmartLink] = useState(false);
  const [personalizedName, setPersonalizedName] = useState("");
  const [dataUltimaConsulta, setDataUltimaConsulta] = useState(null);

  const [calendarMonth, setCalendarMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [horariosOcupados, setHorariosOcupados] = useState([]);
  const [buscandoHorarios, setBuscandoHorarios] = useState(false);

  const [userFound, setUserFound] = useState(false);
  const [checkingUser, setCheckingUser] = useState(false);

  const { register, watch, trigger, setValue, formState: { errors }, reset } = useForm({
    resolver: zodResolver(agendamentoSchema),
    mode: "onChange"
  });
  const formData = watch();

  const progressPercentage = (['nome_completo', 'cpf', 'telefone_whatsapp', 'data_nascimento', 'email'].filter(field => {
    const val = formData[field];
    return val && val.length > 0 && !errors[field];
  }).length / 5) * 100;

  const showIslandMessage = (msg, type = "error") => {
    setIslandMessage(msg); setIslandState(type);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (type !== "loading" && type !== "success" && step !== 6) {
      timeoutRef.current = setTimeout(() => setIslandState("default"), 3500); 
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("egastro_agendamento");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.step > 1 && parsed.step < 6) setStep(parsed.step);
        if (parsed.data) reset(parsed.data); 
      } catch (e) {}
    }
  }, [reset]);

  useEffect(() => {
    if (step < 6) localStorage.setItem("egastro_agendamento", JSON.stringify({ step, data: formData }));
    else localStorage.removeItem("egastro_agendamento"); 
  }, [step, formData]);

  useEffect(() => {
    window.history.pushState({ step }, "", window.location.href);
    const handlePopState = (e) => {
      if (e.state && e.state.step !== undefined) setStep(e.state.step); 
      else if (step > 1 && step < 6) setStep(prev => prev - 1);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [step]);

  // --- TRATAMENTO DOS PARÂMETROS DA URL (INTEGRAÇÃO CHATBOT) ---
  useEffect(() => {
    const nomeUrl = searchParams.get("nome");
    const cpfUrl = searchParams.get("cpf");
    const paramCodResposta = searchParams.get("medico"); 

    if (nomeUrl && cpfUrl) {
      setValue("nome_completo", nomeUrl); 
      setPersonalizedName(nomeUrl.split(" ")[0]); 
      setValue("cpf", maskCPF(cpfUrl));
      
      if (searchParams.get("whatsapp")) {
        setValue("telefone_whatsapp", maskPhone(searchParams.get("whatsapp")));
      }

      // Aplica o Dicionário do Fluxo do RMChat
      if (paramCodResposta && MAPA_SERVICOS[paramCodResposta]) {
        const mapeamento = MAPA_SERVICOS[paramCodResposta];
        setValue("tipo_servico", mapeamento.tipo);
        
        if (mapeamento.medico) {
          setValue("medico_profissional", mapeamento.medico);
        }
        if (mapeamento.exame) {
          setValue("subtipo_exame", mapeamento.exame);
        }
      } 
      // Fallback de Segurança caso passe texto em vez de número
      else if (paramCodResposta) {
        setValue("medico_profissional", paramCodResposta);
      }

      setIsSmartLink(true); 
      setStep(0); 
    }
  }, [searchParams, setValue]);

  const handleCpfLookup = async () => {
    if (formData.cpf?.length !== 14) return;
    setCheckingUser(true);
    try {
      const { data } = await supabase.from("pacientes").select("*").eq("cpf", formData.cpf).maybeSingle();
      if (data) {
        setValue("nome_completo", data.nome_completo || "");
        setValue("telefone_whatsapp", data.telefone_whatsapp || "");
        setValue("email", data.email || "");
        if (data.data_nascimento) {
            const [year, month, day] = data.data_nascimento.split('-');
            setValue("data_nascimento", `${day}/${month}/${year}`);
        }
        setUserFound(true); showIslandMessage("Bem-vindo de volta!", "success");
        setTimeout(() => setIslandState("default"), 2500);
      } else { setUserFound(false); }
    } catch (e) { console.error(e); } finally { setCheckingUser(false); }
  };

  useEffect(() => {
    if (formData.cpf?.length === 14 && !userFound && step === 1) handleCpfLookup();
  }, [formData.cpf]);

  useEffect(() => {
    const buscarDisponibilidade = async () => {
      if (!formData.data_agendamento) return;
      const profissional = formData.tipo_servico === "Exame" ? formData.subtipo_exame : formData.medico_profissional;
      if (!profissional) return;

      setBuscandoHorarios(true); setValue("horario_agendamento", ""); 

      try {
        const { data: ag } = await supabase.from("agendamentos").select("horario_agendamento, medico_profissional, subtipo_exame").eq("data_agendamento", formData.data_agendamento);
        const { data: bl } = await supabase.from("bloqueios_horarios").select("horario, medico_profissional").eq("data", formData.data_agendamento);

        const checkMatch = (nomeDB) => {
          if (!nomeDB) return false;
          if (nomeDB === "Todos") return true;
          const nForm = profissional.toLowerCase().replace(/dra\.|dr\./g, "").trim();
          const nDb = nomeDB.toLowerCase();
          const primeiroNomeForm = nForm.split(" ")[0]; 
          return nDb.includes(nForm) || nForm.includes(nDb) || nDb.includes(primeiroNomeForm);
        };

        const slotsAgendados = ag?.filter(a => checkMatch(a.medico_profissional) || checkMatch(a.subtipo_exame)).map(a => a.horario_agendamento.substring(0,5)) || [];
        const slotsBloqueados = bl?.filter(b => checkMatch(b.medico_profissional)).map(b => b.horario.substring(0,5)) || [];
        setHorariosOcupados([...new Set([...slotsAgendados, ...slotsBloqueados])]);
      } catch (error) {} finally { setBuscandoHorarios(false); }
    };
    buscarDisponibilidade();
  }, [formData.data_agendamento, formData.medico_profissional, formData.subtipo_exame, formData.tipo_servico, setValue]);

  const verificarHorarioPassado = (horaStr) => {
    const hojeStr = getLocalTodayStr();
    if (formData.data_agendamento !== hojeStr) return false;
    const agora = new Date();
    const [horas, minutos] = horaStr.split(":").map(Number);
    const dataSlot = new Date();
    dataSlot.setHours(horas, minutos, 0, 0);
    return dataSlot <= new Date(agora.getTime() + 60 * 60 * 1000);
  };

  const getValorConsulta = () => {
    if (formData.tipo_servico === "Exame" && formData.subtipo_exame) return PRECOS[formData.subtipo_exame] || 500;
    if (formData.medico_profissional) return PRECOS[formData.medico_profissional] || 0;
    return 0;
  };

  const salvarNoBanco = async (status_pagamento) => {
    try {
      let pacienteId = null;
      const { data: pacienteExistente } = await supabase.from("pacientes").select("id").eq("cpf", formData.cpf).maybeSingle();
      const dbDate = convertDateToDBFormat(formData.data_nascimento);

      if (pacienteExistente) {
        pacienteId = pacienteExistente.id;
        await supabase.from("pacientes").update({
          nome_completo: formData.nome_completo, telefone_whatsapp: formData.telefone_whatsapp, email: formData.email, data_nascimento: dbDate
        }).eq("id", pacienteId);
      } else {
        const { data: novoPaciente, error: erroInsert } = await supabase.from("pacientes").insert({
          nome_completo: formData.nome_completo, cpf: formData.cpf, telefone_whatsapp: formData.telefone_whatsapp, email: formData.email, data_nascimento: dbDate
        }).select().single();
        if (erroInsert) throw erroInsert;
        pacienteId = novoPaciente.id;
      }

      const { error: erroAgendamento } = await supabase.from("agendamentos").insert({
        paciente_id: pacienteId, tipo_servico: formData.tipo_servico, subtipo_exame: formData.subtipo_exame || null,
        medico_profissional: formData.medico_profissional || "A definir", modalidade: formData.modalidade || "Não se aplica",
        data_agendamento: formData.data_agendamento, horario_agendamento: formData.horario_agendamento,
        status_pagamento_antecipado: status_pagamento, valor_total: getValorConsulta()
      });
      if (erroAgendamento) throw erroAgendamento;
      return true;
    } catch (error) { return false; }
  };

  const dispararWebhook = async (status_pagamento) => {
    const url = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
    if (!url) return;
    try { await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({...formData, status_pagamento, data_criacao: new Date().toISOString()}) }); } catch (e) {}
  };

  const nextStep = async () => {
    setLoading(true); setIslandState("loading");

    try {
      if (step === 0) { setIslandState("default"); setLoading(false); setStep(1); return; }

      if (step === 1) {
        const isValid = await trigger(["cpf", "nome_completo", "telefone_whatsapp", "data_nascimento", "email"]);
        if (!isValid) { showIslandMessage("Verifique os campos em vermelho."); setLoading(false); return; }
      }

      if (step === 2) {
        if (!formData.tipo_servico) { showIslandMessage("Selecione um serviço."); setLoading(false); return; }
        if ((formData.tipo_servico === "Consulta" || formData.tipo_servico === "Retorno") && !formData.medico_profissional) { showIslandMessage("Selecione o profissional."); setLoading(false); return; }
        if (formData.tipo_servico === "Exame" && !formData.subtipo_exame) { showIslandMessage("Selecione o exame."); setLoading(false); return; }
        
        if (formData.medico_profissional === "Dra. Simone") {
          const { data: paciente } = await supabase.from("pacientes").select("id").eq("cpf", formData.cpf).maybeSingle();
          if (!paciente) { showIslandMessage("A Dra. Simone atende apenas retornos."); setLoading(false); return; }
          const { data: historico } = await supabase.from("agendamentos").select("id").eq("paciente_id", paciente.id).limit(1).maybeSingle();
          if (!historico) { showIslandMessage("Sem consultas finalizadas com a Dra. Simone."); setLoading(false); return; }
        }

        if (formData.tipo_servico === "Retorno") {
          const { data: paciente } = await supabase.from("pacientes").select("id").eq("cpf", formData.cpf).maybeSingle();
          if (!paciente) { showIslandMessage("Cadastro não encontrado para retorno."); setLoading(false); return; }
          const { data: ult } = await supabase.from("agendamentos").select("data_agendamento").eq("paciente_id", paciente.id).eq("tipo_servico", "Consulta").order("data_agendamento", { ascending: false }).limit(1).maybeSingle();
          if (!ult) { showIslandMessage("Não encontramos uma consulta anterior."); setLoading(false); return; }
          setDataUltimaConsulta(new Date(ult.data_agendamento));
        }

        if (formData.tipo_servico === "Exame" && ["Endoscopia Digestiva Alta", "Colonoscopia"].includes(formData.subtipo_exame)) {
          if (calculateAge(formData.data_nascimento) >= 65) {
             if (!window.confirm("ALERTA DE RISCO CIRÚRGICO:\nPacientes 65+ exigem liberação cardiológica. Confirma ciência?")) { setIslandState("default"); setLoading(false); return; }
          }
        }
      }

      if (step === 3) {
        if (!formData.modalidade && formData.tipo_servico !== "Retorno") { showIslandMessage("Defina Convênio ou Particular."); setLoading(false); return; }
      }

      if (step === 4) {
        if (!formData.data_agendamento || !formData.horario_agendamento) { showIslandMessage("Escolha um dia e um horário."); setLoading(false); return; }
        
        if (formData.tipo_servico === "Retorno" && dataUltimaConsulta) {
          const diffDays = Math.ceil(Math.abs(new Date(formData.data_agendamento).getTime() - dataUltimaConsulta.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > 30) { showIslandMessage(`Última consulta há ${diffDays} dias. Máximo é 30.`); setLoading(false); return; }
        }

        if (formData.tipo_servico === "Retorno" || formData.modalidade === "Convênio") {
          const salvo = await salvarNoBanco(false);
          if (salvo) {
            await dispararWebhook(false);
            showIslandMessage("Agendamento Concluído!", "success"); setLoading(false); setStep(6); return;
          }
          showIslandMessage("Erro ao salvar agendamento."); setLoading(false); return;
        }

        setStep(5); setLoading(false); setIslandState("default"); return;
      }

      setIslandState("default"); setLoading(false); setStep(p => p + 1);
    } catch (err) { showIslandMessage("Instabilidade temporária."); setLoading(false); }
  };

  const prevStep = () => { setIslandState("default"); window.history.back(); };

  const valorEntrada = getValorConsulta() / 2;
  const initializationMP = { amount: valorEntrada > 0 ? valorEntrada : 1 };

  const onSubmitMP = async (param) => {
    return new Promise(async (resolve) => {
      showIslandMessage("Processando pagamento...", "loading");
      try {
        const res = await fetch("/api/pagamento", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            ...param.formData, amount: valorEntrada, description: `Entrada - ${formData.medico_profissional || formData.subtipo_exame}` 
          })
        });
        const data = await res.json();
        if (data.success && (data.status === "approved" || data.status === "in_process")) {
           const salvo = await salvarNoBanco(true); 
           if (!salvo) { showIslandMessage("Pagamento OK, erro ao salvar. Contate o suporte."); resolve(); return; }
           await dispararWebhook(true);
           showIslandMessage("Pagamento Aprovado!", "success"); setStep(6); resolve();
        } else { showIslandMessage(data.error || "Pagamento recusado pela operadora."); resolve(); }
      } catch (error) { showIslandMessage("Erro de comunicação com o banco."); resolve(); }
    });
  };

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } }, exit: { opacity: 0, transition: { duration: 0.2 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20, filter: "blur(5px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring", stiffness: 350, damping: 25 } } };
  const inputClass = "w-full p-4 pt-6 bg-[#F9FAFB] border border-gray-200/80 rounded-2xl focus:bg-white focus:border-[#9FC131] focus:ring-4 focus:ring-[#9FC131]/10 outline-none transition-all text-gray-900 font-semibold text-[15px] shadow-sm peer placeholder-transparent";
  const labelClass = "absolute left-4 top-2 text-[10px] font-black text-gray-400 uppercase tracking-widest transition-all peer-placeholder-shown:top-5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-focus:top-2 peer-focus:text-[10px] peer-focus:font-black peer-focus:text-[#9FC131]";

  const renderCalendar = () => {
    const y = calendarMonth.getFullYear(); const m = calendarMonth.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const firstDay = new Date(y, m, 1).getDay();
    const today = getLocalTodayStr();
    let days = [];
    
    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="aspect-square" />);
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dateObj = new Date(y, m, day);
      const dayOfWeek = dateObj.getDay();
      
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isPast = dateStr < today || isWeekend;
      const isSel = formData.data_agendamento === dateStr;
      const isToday = dateStr === today;
      
      days.push(
        <motion.button 
          whileTap={!isPast ? { scale: 0.9 } : {}} key={day} disabled={isPast} 
          onClick={(e) => { e.preventDefault(); setValue("data_agendamento", dateStr); setIslandState("default"); }} 
          className={`aspect-square w-full rounded-2xl flex flex-col items-center justify-center text-sm font-bold transition-all duration-300 relative
            ${isPast ? "text-gray-300 cursor-not-allowed opacity-50 bg-gray-50/50" : "text-gray-700 hover:bg-gray-100/80"} 
            ${isToday && !isSel && !isPast ? "text-[#9FC131] border border-[#9FC131]/30 bg-[#9FC131]/5" : ""}
            ${isSel ? "bg-[#9FC131] text-white shadow-lg shadow-[#9FC131]/30 scale-[1.05] z-10" : ""}
          `}>
          {day}
          {isToday && !isSel && !isPast && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#9FC131]" />}
        </motion.button>
      );
    }
    return days;
  };

  const handlePrevMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  const handleNextMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));

  return (
    <div className="fixed inset-0 bg-[#F5F5F7] flex flex-col items-center justify-start md:justify-center p-0 md:p-8 pt-24 overflow-hidden selection:bg-[#9FC131] selection:text-white font-sans">
      <Navbar />
      
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-[#9FC131]/5 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* --- ILHA DINÂMICA --- */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex justify-center pointer-events-none w-full px-4">
        <motion.div layout transition={{ type: "spring", stiffness: 400, damping: 30 }} 
          className={`pointer-events-auto rounded-full shadow-2xl flex items-center px-5 py-3 border max-w-sm overflow-hidden
          ${islandState === "error" ? "bg-red-500/95 backdrop-blur-md border-red-400/50 text-white shadow-red-500/20" : 
            islandState === "success" ? "bg-[#9FC131]/95 backdrop-blur-md border-[#9FC131]/50 text-white shadow-[#9FC131]/20" : 
            islandState === "loading" ? "bg-gray-900/95 backdrop-blur-md border-gray-700/50 text-white" :
            "bg-white/80 backdrop-blur-xl border-gray-200 text-gray-800 shadow-xl"}`}>
          <AnimatePresence mode="wait">
            {islandState === "error" && (
               <motion.div key="err" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-sm font-bold">
                 <AlertTriangle size={18} /> <span className="truncate">{islandMessage}</span>
               </motion.div>
            )}
            {islandState === "success" && (
               <motion.div key="suc" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-sm font-bold">
                 <CheckCircle size={18} /> <span className="truncate">{islandMessage}</span>
               </motion.div>
            )}
            {islandState === "loading" && (
              <motion.div key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 text-sm font-bold">
                 <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, ease: "linear", duration: 1 }}><Activity size={18} className="text-[#9FC131]" /></motion.div> {islandMessage || "Processando..."}
              </motion.div>
            )}
            {islandState === "default" && (
              <motion.div key="def" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-4 mx-auto">
                 <div className="flex gap-1.5 items-center shrink-0">
                   {NOME_ETAPAS.slice(1, 6).map((_, i) => (<motion.div key={i} layout className={`h-1.5 rounded-full transition-all duration-500 ${step === i + 1 ? "w-6 bg-[#9FC131]" : step > i + 1 ? "w-1.5 bg-[#9FC131]/40" : "w-1.5 bg-gray-300"}`} />))}
                 </div>
                 <div className="text-xs font-bold tracking-wider text-gray-500 border-l border-gray-200 pl-4">{NOME_ETAPAS[step]}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <motion.div layout className="w-full max-w-[1000px] h-full md:max-h-[750px] bg-white md:bg-white/95 md:backdrop-blur-3xl md:rounded-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.03)] md:shadow-2xl border-t md:border border-white flex flex-col relative z-10 overflow-hidden rounded-t-[2rem]">
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className="p-6 md:p-14 min-h-full flex flex-col justify-start md:justify-center pb-32 pt-24 md:pt-14">
            <AnimatePresence mode="wait">
              
              {step === 0 && (
                <motion.div key="s0" variants={containerVariants} initial="hidden" animate="show" exit="exit" className="flex flex-col items-center justify-center text-center gap-6 m-auto">
                  <motion.div variants={itemVariants} className="w-20 h-20 bg-gradient-to-br from-[#9FC131] to-emerald-600 rounded-3xl flex items-center justify-center shadow-xl mb-2 rotate-3"><Sparkles className="text-white w-10 h-10" /></motion.div>
                  <motion.div variants={itemVariants}><h2 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight">Olá, {personalizedName}!</h2><p className="text-gray-500 mt-3 text-lg font-medium max-w-md mx-auto leading-relaxed">Puxamos seus dados em segurança para você não perder tempo.</p></motion.div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div key="s1" variants={containerVariants} initial="hidden" animate="show" exit="exit" className="flex flex-col gap-8 w-full max-w-3xl mx-auto mt-4">
                  <motion.div variants={itemVariants}>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight">Quem é você?</h2>
                    <p className="text-gray-500 mt-1 font-medium">Digite seu CPF para iniciarmos de forma segura.</p>
                  </motion.div>

                  <div className="space-y-5">
                    <motion.div variants={itemVariants} className="relative">
                      <input 
                        {...register("cpf")} onChange={(e) => setValue("cpf", maskCPF(e.target.value))}
                        className={`${inputClass} text-lg tracking-widest ${errors.cpf ? 'border-red-400 bg-red-50 focus:ring-red-500/10' : ''}`} 
                        placeholder="000.000.000-00" maxLength={14}
                      />
                      <label className={labelClass}>CPF</label>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        {checkingUser ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity }}><Activity size={20} className="text-[#9FC131]"/></motion.div> : <Search size={20} className="text-gray-300"/>}
                      </div>
                    </motion.div>

                    <AnimatePresence>
                      {(formData.cpf?.length === 14) && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-5 overflow-hidden pt-2">
                          
                          {!userFound && (
                            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mb-6">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${progressPercentage}%` }} className="h-full bg-[#9FC131]" transition={{ ease: "circOut", duration: 0.5 }} />
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="relative md:col-span-2">
                              <input {...register("nome_completo")} className={`${inputClass} ${errors.nome_completo ? 'border-red-400 focus:ring-red-500/10' : ''}`} placeholder="Nome Completo" />
                              <label className={labelClass}>Nome Completo</label>
                            </div>
                            
                            <div className="relative">
                              <input 
                                {...register("data_nascimento")} onChange={(e) => setValue("data_nascimento", maskDate(e.target.value))}
                                placeholder="DD/MM/AAAA" maxLength={10} className={`${inputClass} ${errors.data_nascimento ? 'border-red-400 focus:ring-red-500/10' : ''}`} 
                              />
                              <label className={labelClass}>Nascimento</label>
                            </div>

                            <div className="relative">
                              <input 
                                {...register("telefone_whatsapp")} onChange={(e) => setValue("telefone_whatsapp", maskPhone(e.target.value))}
                                className={`${inputClass} ${errors.telefone_whatsapp ? 'border-red-400 focus:ring-red-500/10' : ''}`} placeholder="(00) 90000-0000" maxLength={15}
                              />
                              <label className={labelClass}>WhatsApp</label>
                            </div>

                            <div className="relative md:col-span-2">
                              <input type="email" {...register("email")} className={`${inputClass} ${errors.email ? 'border-red-400 focus:ring-red-500/10' : ''}`} placeholder="seu@email.com" />
                              <label className={labelClass}>E-mail</label>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="s2" variants={containerVariants} initial="hidden" animate="show" exit="exit" className="flex flex-col gap-8 w-full">
                  <motion.div variants={itemVariants} className="text-center md:text-left"><h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">O que você precisa?</h2><p className="text-gray-500 font-medium mt-1">Selecione o serviço e o profissional.</p></motion.div>
                  <div className="flex flex-col md:flex-row gap-6 items-start w-full">
                    
                    <motion.div variants={itemVariants} className="w-full md:w-1/3 flex flex-col gap-3">
                      {[ {id: "Consulta", icon: User}, {id: "Retorno", icon: Activity}, {id: "Exame", icon: HeartPulse} ].map((serv) => (
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} key={serv.id} onClick={(e) => { e.preventDefault(); setValue("tipo_servico", serv.id); setValue("medico_profissional", ""); setValue("subtipo_exame", ""); setIslandState("default"); }} 
                          className={`p-5 rounded-2xl flex items-center gap-4 transition-all duration-300 border ${formData.tipo_servico === serv.id ? "border-[#9FC131] bg-[#9FC131]/10 text-[#9FC131] shadow-inner" : "border-gray-200 bg-white text-gray-600 hover:border-[#9FC131]/40 hover:bg-gray-50"}`}>
                          <serv.icon size={20} className={formData.tipo_servico === serv.id ? "text-[#9FC131]" : "text-gray-400"} />
                          <span className="font-bold text-gray-900">{serv.id}</span>
                        </motion.button>
                      ))}
                    </motion.div>

                    <AnimatePresence mode="wait">
                      {(formData.tipo_servico === "Consulta" || formData.tipo_servico === "Retorno") && (
                        <motion.div key="med" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="w-full md:w-2/3">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 block mb-3">Corpo Clínico</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {Object.keys(PRECOS).filter(k => k.includes("Dr") || k.includes("Dra")).map((medico) => (
                              <motion.button whileTap={{ scale: 0.98 }} key={medico} onClick={(e) => { e.preventDefault(); setValue("medico_profissional", medico); setIslandState("default"); }} 
                                className={`w-full flex items-center p-4 border rounded-2xl transition-all duration-300 text-left ${formData.medico_profissional === medico ? "border-[#9FC131] bg-white shadow-[0_8px_20px_rgba(159,193,49,0.15)] ring-1 ring-[#9FC131]" : "border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300"}`}>
                                <div className={`w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center shrink-0 ${formData.medico_profissional === medico ? "border-[#9FC131]" : "border-gray-300"}`}>
                                  {formData.medico_profissional === medico && <div className="w-2.5 h-2.5 bg-[#9FC131] rounded-full" /> }
                                </div>
                                <span className={`font-bold text-sm ${formData.medico_profissional === medico ? "text-gray-900" : "text-gray-600"}`}>{medico}</span>
                              </motion.button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                      {formData.tipo_servico === "Exame" && (
                        <motion.div key="exa" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="w-full md:w-2/3">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 block mb-3">Exames Disponíveis</label>
                          <div className="flex flex-col gap-3">
                            {["Endoscopia Digestiva Alta", "Colonoscopia", "Retirada de Balão Gástrico"].map((exame) => (
                              <motion.button whileTap={{ scale: 0.98 }} key={exame} onClick={(e) => { e.preventDefault(); setValue("subtipo_exame", exame); setIslandState("default"); }} 
                                className={`w-full flex items-center p-5 border rounded-2xl transition-all duration-300 text-left ${formData.subtipo_exame === exame ? "border-[#9FC131] bg-white shadow-[0_8px_20px_rgba(159,193,49,0.15)] ring-1 ring-[#9FC131]" : "border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300"}`}>
                                <div className={`w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center shrink-0 ${formData.subtipo_exame === exame ? "border-[#9FC131]" : "border-gray-300"}`}>
                                  {formData.subtipo_exame === exame && <div className="w-2.5 h-2.5 bg-[#9FC131] rounded-full" /> }
                                </div>
                                <span className={`font-bold text-sm ${formData.subtipo_exame === exame ? "text-gray-900" : "text-gray-600"}`}>{exame}</span>
                              </motion.button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                 <motion.div key="s3" variants={containerVariants} initial="hidden" animate="show" exit="exit" className="flex flex-col gap-8 w-full max-w-2xl mx-auto items-center">
                   <motion.div variants={itemVariants} className="text-center"><h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Pagamento</h2><p className="text-gray-500 font-medium mt-1">Como prefere seguir?</p></motion.div>
                   {formData.tipo_servico === "Retorno" ? (
                     <motion.div variants={itemVariants} className="w-full p-8 bg-[#9FC131]/10 rounded-3xl border border-[#9FC131]/20 text-center">
                        <ShieldCheck className="w-16 h-16 text-[#9FC131] mx-auto mb-4" />
                        <h3 className="text-2xl font-black text-gray-900">Retorno Gratuito</h3>
                        <p className="text-sm text-gray-600 mt-2">Você está dentro do prazo de retorno (30 dias).</p>
                     </motion.div>
                   ) : (
                     <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={(e) => { e.preventDefault(); setValue("modalidade", "Convênio"); setIslandState("default"); }} className={`p-8 border rounded-3xl flex flex-col items-center gap-4 transition-all duration-300 ${formData.modalidade === "Convênio" ? "border-[#9FC131] bg-[#9FC131]/5 shadow-xl ring-1 ring-[#9FC131]" : "border-gray-200 bg-white hover:border-[#9FC131]/40"}`}>
                          <ShieldCheck className={formData.modalidade === "Convênio" ? "text-[#9FC131]" : "text-gray-400"} size={40} />
                          <span className="font-black text-xl text-gray-900">Convênio</span>
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={(e) => { e.preventDefault(); setValue("modalidade", "Particular"); setIslandState("default"); }} className={`p-8 border rounded-3xl flex flex-col items-center gap-4 transition-all duration-300 ${formData.modalidade === "Particular" ? "border-[#9FC131] bg-[#9FC131]/5 shadow-xl ring-1 ring-[#9FC131]" : "border-gray-200 bg-white hover:border-[#9FC131]/40"}`}>
                          <CreditCard className={formData.modalidade === "Particular" ? "text-[#9FC131]" : "text-gray-400"} size={40} />
                          <span className="font-black text-xl text-gray-900">Particular</span>
                        </motion.button>
                     </motion.div>
                   )}
                 </motion.div>
              )}

              {step === 4 && (
                <motion.div key="s4" variants={containerVariants} initial="hidden" animate="show" exit="exit" className="flex flex-col gap-6 w-full">
                  <motion.div variants={itemVariants} className="text-center md:text-left"><h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Agenda Oficial</h2><p className="text-gray-500 font-medium mt-1">Toque em um dia para ver os horários vivos.</p></motion.div>
                  
                  <div className="flex flex-col md:flex-row gap-6 w-full">
                    <motion.div variants={itemVariants} className="w-full md:w-1/2 bg-white border border-gray-200/80 rounded-[2rem] p-6 shadow-sm flex flex-col">
                      <div className="flex justify-between items-center mb-6 px-2">
                        <button onClick={(e) => { e.preventDefault(); handlePrevMonth(); }} className="p-2 hover:bg-gray-100 rounded-full transition-all text-gray-500 hover:text-gray-900"><ChevronLeft size={20}/></button>
                        <h3 className="font-black text-gray-900 tracking-tight capitalize text-lg">{calendarMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
                        <button onClick={(e) => { e.preventDefault(); handleNextMonth(); }} className="p-2 hover:bg-gray-100 rounded-full transition-all text-gray-500 hover:text-gray-900"><ChevronRight size={20}/></button>
                      </div>
                      <div className="grid grid-cols-7 gap-2 text-center mb-2">{['D','S','T','Q','Q','S','S'].map((dia, i) => <div key={i} className="text-[10px] font-black text-gray-400 uppercase">{dia}</div>)}</div>
                      <div className="grid grid-cols-7 gap-2">{renderCalendar()}</div>
                    </motion.div>

                    <motion.div variants={itemVariants} className="w-full md:w-1/2 flex flex-col">
                      <AnimatePresence mode="wait">
                        {formData.data_agendamento ? (
                          <motion.div key="times" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white border border-gray-200/80 p-6 rounded-[2rem] shadow-sm h-full flex flex-col">
                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                              <div>
                                <h4 className="font-black text-gray-900 text-lg">Horários Livres</h4>
                                <p className="text-xs font-bold text-[#9FC131] uppercase tracking-widest mt-1">{new Date(formData.data_agendamento + "T12:00:00").toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}</p>
                              </div>
                              {buscandoHorarios && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-5 h-5 border-2 border-[#9FC131] border-t-transparent rounded-full" />}
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto custom-scrollbar flex-1 pr-2">
                              {HORARIOS_BASE.map((hora) => {
                                const isOcupado = horariosOcupados.includes(hora);
                                const isBloqueadoPorTempo = verificarHorarioPassado(hora);
                                const isDisabled = isOcupado || isBloqueadoPorTempo;

                                return (
                                  <motion.button 
                                    whileTap={!isDisabled ? { scale: 0.95 } : {}}
                                    key={hora} 
                                    disabled={isDisabled || buscandoHorarios} 
                                    onClick={(e) => { e.preventDefault(); setValue("horario_agendamento", hora); setIslandState("default"); }} 
                                    className={`py-4 rounded-2xl text-[14px] font-bold transition-all duration-300 border relative overflow-hidden
                                      ${isDisabled ? "bg-gray-50 text-gray-300 border-transparent cursor-not-allowed opacity-50" 
                                      : formData.horario_agendamento === hora ? "bg-[#9FC131] text-white border-[#9FC131] shadow-lg shadow-[#9FC131]/30" 
                                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-gray-50"}
                                    `}
                                  >
                                    {isDisabled && <div className="absolute top-1/2 left-3 right-3 h-px bg-gray-300 -translate-y-1/2 rotate-[-5deg]" />}
                                    {hora}
                                  </motion.button>
                                );
                              })}
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full border-2 border-dashed border-gray-200 rounded-[2rem] flex flex-col items-center justify-center text-gray-400 font-medium p-8 text-center bg-gray-50/50 min-h-[300px]">
                            <CalendarIcon size={32} className="mb-4 text-gray-300" />
                            <p className="text-sm font-bold text-gray-500">Selecione uma data à esquerda</p>
                            <p className="text-xs mt-1">Os horários disponíveis aparecerão aqui.</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {step === 5 && (
                <motion.div key="s5" variants={containerVariants} initial="hidden" animate="show" exit="exit" className="flex flex-col gap-6 w-full max-w-xl mx-auto">
                  <motion.div variants={itemVariants} className="text-center">
                    <div className="w-14 h-14 md:w-16 md:h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4 shadow-xl"><Lock className="text-white w-6 h-6 md:w-8 md:h-8" /></div>
                    <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">Checkout Seguro</h2>
                  </motion.div>
                  
                  <motion.div variants={itemVariants} className="bg-gray-50/80 p-5 md:p-8 rounded-3xl border border-gray-200/80 shadow-inner w-full relative z-10">
                    <div className="flex justify-between items-center border-b border-gray-200 pb-4 mb-4">
                      <span className="text-gray-500 font-medium text-xs md:text-sm">Serviço: {formData.tipo_servico === "Exame" ? formData.subtipo_exame : `${formData.tipo_servico} (${formData.medico_profissional})`}</span>
                      <span className="font-bold text-gray-900 text-xs md:text-sm">R$ {getValorConsulta().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-lg mb-8">
                      <span className="font-bold text-gray-900">Entrada Hoje (50%)</span>
                      <span className="font-extrabold text-[#8eb02c] text-2xl md:text-3xl tracking-tight">R$ {(getValorConsulta()/2).toFixed(2)}</span>
                    </div>

                    <div className="w-full relative z-30 min-h-[350px]">
                      {process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ? (
                        <Payment 
                          initialization={initializationMP} 
                          onSubmit={onSubmitMP} 
                          customization={{ paymentMethods: { creditCard: 'all', debitCard: 'all' } }} 
                        />
                      ) : (
                        <div className="p-6 bg-red-50 text-red-600 rounded-xl border border-red-200 text-center font-medium text-sm">Chave Pública MP ausente.</div>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {step === 6 && (
                <motion.div key="s6" initial="hidden" animate="show" className="flex flex-col items-center justify-center text-center h-full w-full max-w-md mx-auto py-10">
                  <motion.div variants={{ hidden: { scale: 0.5, opacity: 0 }, show: { scale: 1, opacity: 1, transition: { type: "spring", bounce: 0.5 } } }} className="relative w-32 h-32 mb-8">
                    <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }} className="absolute inset-0 bg-[#9FC131] rounded-full blur-3xl z-0" />
                    <div className="absolute inset-0 bg-gradient-to-tr from-[#9FC131] to-emerald-400 rounded-full flex items-center justify-center z-10 shadow-2xl border-4 border-white">
                      <motion.svg initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }} className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </motion.svg>
                    </div>
                  </motion.div>

                  <motion.h2 variants={{ hidden: { y: 20, opacity: 0 }, show: { y: 0, opacity: 1, transition: { delay: 0.4 } } }} className="text-4xl font-black text-gray-900 tracking-tight">Tudo Certo!</motion.h2>
                  <motion.p variants={{ hidden: { y: 20, opacity: 0 }, show: { y: 0, opacity: 1, transition: { delay: 0.5 } } }} className="text-gray-500 mt-2 font-medium">Seu agendamento foi confirmado para o dia <strong>{formData.data_agendamento?.split("-").reverse().join("/")}</strong> às <strong>{formData.horario_agendamento}</strong>.</motion.p>
                  
                  <motion.div variants={{ hidden: { y: 20, opacity: 0, scale: 0.95 }, show: { y: 0, opacity: 1, scale: 1, transition: { delay: 0.6 } } }} 
                    className="mt-8 bg-gray-50 p-6 rounded-3xl border border-gray-200 shadow-sm w-full relative overflow-hidden text-left">
                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-[#9FC131]" />
                    <div className="flex justify-between items-center mb-4 pl-2">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Paciente</span>
                      <span className="text-sm font-bold text-gray-900 truncate max-w-[150px]">{formData.nome_completo?.split(' ')[0]}</span>
                    </div>
                    <div className="flex justify-between items-center pt-4 pl-2 border-t border-gray-200/60 border-dashed">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Protocolo</span>
                      <span className="text-xl font-mono font-black text-[#9FC131]">#{Math.floor(100000 + Math.random() * 900000)}</span>
                    </div>
                  </motion.div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>

        {/* Rodapé Fixo */}
        {step < 6 && (
          <div className="shrink-0 w-full bg-white/90 backdrop-blur-xl border-t border-gray-100 p-4 md:p-5 px-6 md:px-10 flex justify-between items-center z-40 pb-safe relative">
            {step > 1 ? (
              <motion.button whileHover={{ x: -3 }} whileTap={{ scale: 0.95 }} onClick={(e) => { e.preventDefault(); prevStep(); }} className="flex items-center gap-2 text-gray-400 hover:text-gray-900 font-extrabold text-[11px] md:text-xs uppercase tracking-widest py-3 transition-colors">
                <ArrowLeft size={16} /> Voltar
              </motion.button>
            ) : <div />}

            {step !== 5 && (
              <motion.button 
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={(e) => { e.preventDefault(); nextStep(); }} 
                disabled={loading || (step === 1 && formData.cpf?.length !== 14)} 
                className={`relative overflow-hidden text-white px-8 md:px-12 py-3.5 md:py-4 rounded-full font-extrabold text-[11px] md:text-xs uppercase tracking-widest flex items-center gap-3 transition-all duration-300 disabled:opacity-50 disabled:scale-100 bg-gray-900 shadow-xl hover:bg-[#9FC131] hover:shadow-[#9FC131]/30 active:scale-95`}
              >
                <span className="relative z-10">{loading ? "Orquestrando..." : (step === 4 && (formData.modalidade === "Convênio" || formData.tipo_servico === "Retorno") ? "Finalizar" : "Continuar")}</span>
                {!loading && <ArrowRight size={16} className="relative z-10" />}
              </motion.button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}