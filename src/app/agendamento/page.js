"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase"; 
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { ArrowRight, ArrowLeft, CheckCircle, AlertTriangle, Sparkles, ShieldCheck, Calendar as CalendarIcon, Clock, CreditCard, Lock, ChevronLeft, ChevronRight, Activity } from "lucide-react";

// ==========================================
// INICIALIZAÇÃO MERCADO PAGO (PRODUÇÃO)
// ==========================================
if (process.env.NEXT_PUBLIC_MP_PUBLIC_KEY) {
  initMercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY, { locale: 'pt-BR' });
}

// ==========================================
// FUNÇÕES UTILITÁRIAS
// ==========================================
const maskCPF = (value) => {
  if (!value) return "";
  return value.replace(/\D/g, "").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})/, "$1-$2").replace(/(-\d{2})\d+?$/, "$1"); 
};
const maskPhone = (value) => {
  if (!value) return "";
  return value.replace(/\D/g, "").replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").replace(/(-\d{4})\d+?$/, "$1");
};
const calculateAge = (dob) => {
  if (!dob) return 0;
  return Math.abs(new Date(Date.now() - new Date(dob).getTime()).getUTCFullYear() - 1970);
};
const getLocalTodayStr = () => {
  const tzoffset = (new Date()).getTimezoneOffset() * 60000; 
  return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 10);
};

// ==========================================
// SCHEMAS E REGRAS
// ==========================================
const agendamentoSchema = z.object({
  nome_completo: z.string().min(5, "Informe seu nome completo").includes(" ", { message: "Obrigatório nome e sobrenome" }),
  cpf: z.string().length(14, "O CPF precisa ter 14 dígitos"),
  telefone_whatsapp: z.string().min(14, "WhatsApp incompleto"),
  data_nascimento: z.string().refine((date) => !isNaN(Date.parse(date)), { message: "Informe sua data de nascimento" }),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  tipo_servico: z.enum(["Consulta", "Retorno", "Exame"]).optional(),
  medico_profissional: z.string().optional(),
  subtipo_exame: z.string().optional(),
  modalidade: z.enum(["Particular", "Convênio"]).optional(),
  data_agendamento: z.string().optional(),
  horario_agendamento: z.string().optional(),
});

const PRECOS = { "Dra. Simone": 450, "Dr. Brilhante": 2, "Dr. Tiago Lima": 350, "Dr. Thiago Dyavy": 350, "Dra. Candice (Psicologia)": 200 };
const HORARIOS_BASE = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const NOME_ETAPAS = ["Sincronização", "Identificação", "Especialidade", "Modalidade", "Agenda", "Checkout", "Concluído"];

export default function AgendamentoPremium() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-10 h-10 border-4 border-[#9FC131] border-t-transparent rounded-full" /></div>}>
      <AgendamentoForm />
    </Suspense>
  );
}

function AgendamentoForm() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // DYNAMIC ISLAND STATE
  const [islandState, setIslandState] = useState("default");
  const [islandMessage, setIslandMessage] = useState("");
  const timeoutRef = useRef(null);
  
  const [isSmartLink, setIsSmartLink] = useState(false);
  const [personalizedName, setPersonalizedName] = useState("");
  const [dataUltimaConsulta, setDataUltimaConsulta] = useState(null);

  // Calendário
  const [calendarMonth, setCalendarMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [horariosOcupados, setHorariosOcupados] = useState([]);
  const [buscandoHorarios, setBuscandoHorarios] = useState(false);

  const { register, watch, trigger, setValue, getFieldState, reset } = useForm({
    resolver: zodResolver(agendamentoSchema),
    mode: "onChange"
  });
  const formData = watch();

  const showIslandError = (msg) => {
    setIslandMessage(msg);
    setIslandState("error");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIslandState("default");
    }, 4000); 
  };
  
  const setNormalIsland = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (islandState === "error") setIslandState("default");
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

  useEffect(() => {
    const nomeUrl = searchParams.get("nome");
    const cpfUrl = searchParams.get("cpf");
    if (nomeUrl && cpfUrl) {
      setValue("nome_completo", nomeUrl); setPersonalizedName(nomeUrl.split(" ")[0]); setValue("cpf", maskCPF(cpfUrl));
      if (searchParams.get("whatsapp")) setValue("telefone_whatsapp", maskPhone(searchParams.get("whatsapp")));
      if (searchParams.get("servico")) setValue("tipo_servico", searchParams.get("servico"));
      if (searchParams.get("medico")) setValue("medico_profissional", searchParams.get("medico"));
      setIsSmartLink(true); setStep(0); 
    }
  }, [searchParams, setValue]);

  useEffect(() => {
    const buscarDisponibilidade = async () => {
      if (!formData.data_agendamento || !formData.medico_profissional) return;
      setBuscandoHorarios(true); setValue("horario_agendamento", ""); 
      const { data, error } = await supabase.from("agendamentos").select("horario_agendamento").eq("data_agendamento", formData.data_agendamento).eq("medico_profissional", formData.medico_profissional);
      if (!error && data) setHorariosOcupados(data.map(ag => ag.horario_agendamento.substring(0, 5)));
      setBuscandoHorarios(false);
    };
    buscarDisponibilidade();
  }, [formData.data_agendamento, formData.medico_profissional, setValue]);

  const checkFields = async (fields) => {
    const isValid = await trigger(fields);
    if (!isValid) {
      const firstErrorMsg = fields.map(f => getFieldState(f).error?.message).find(msg => msg !== undefined);
      if (firstErrorMsg) showIslandError(firstErrorMsg);
      return false;
    }
    setNormalIsland(); return true;
  };

  const salvarNoBanco = async (status_pagamento) => {
    try {
      let pacienteId = null;
      const { data: pacienteExistente } = await supabase.from("pacientes").select("id").eq("cpf", formData.cpf).maybeSingle();

      if (pacienteExistente) pacienteId = pacienteExistente.id;
      else {
        const { data: novoPaciente, error: erroInsert } = await supabase.from("pacientes").insert({
          nome_completo: formData.nome_completo, cpf: formData.cpf, telefone_whatsapp: formData.telefone_whatsapp,
          email: formData.email || null, data_nascimento: formData.data_nascimento
        }).select().single();
        if (erroInsert) throw erroInsert;
        pacienteId = novoPaciente.id;
      }

      const { error: erroAgendamento } = await supabase.from("agendamentos").insert({
        paciente_id: pacienteId, tipo_servico: formData.tipo_servico, subtipo_exame: formData.subtipo_exame || null,
        medico_profissional: formData.medico_profissional || "A definir", modalidade: formData.modalidade || "Não se aplica",
        data_agendamento: formData.data_agendamento, horario_agendamento: formData.horario_agendamento,
        status_pagamento_antecipado: status_pagamento, valor_total: formData.tipo_servico === "Retorno" ? 0 : PRECOS[formData.medico_profissional] || 0
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
      if (step === 0) { setNormalIsland(); setLoading(false); setStep(1); return; }

      if (step === 1) {
        if (!(await checkFields(["nome_completo", "cpf", "telefone_whatsapp", "data_nascimento"]))) { setLoading(false); setIslandState("default"); return; }
      }

      if (step === 2) {
        if (!formData.tipo_servico) { showIslandError("Por favor, selecione um serviço."); setLoading(false); return; }
        
        if (formData.medico_profissional === "Dra. Simone") {
          const { data: paciente } = await supabase.from("pacientes").select("id").eq("cpf", formData.cpf).maybeSingle();
          if (!paciente) { showIslandError("A Dra. Simone atende apenas retornos."); setLoading(false); return; }
          const { data: historico } = await supabase.from("agendamentos").select("id").eq("paciente_id", paciente.id).limit(1).maybeSingle();
          if (!historico) { showIslandError("Você não tem consultas finalizadas com a Dra. Simone."); setLoading(false); return; }
        }

        if (formData.tipo_servico === "Retorno") {
          const { data: paciente } = await supabase.from("pacientes").select("id").eq("cpf", formData.cpf).maybeSingle();
          if (!paciente) { showIslandError("Cadastro não encontrado para marcar retorno."); setLoading(false); return; }
          const { data: ult } = await supabase.from("agendamentos").select("data_agendamento").eq("paciente_id", paciente.id).eq("tipo_servico", "Consulta").order("data_agendamento", { ascending: false }).limit(1).maybeSingle();
          if (!ult) { showIslandError("Não encontramos uma consulta anterior."); setLoading(false); return; }
          setDataUltimaConsulta(new Date(ult.data_agendamento));
        }

        if (formData.tipo_servico === "Exame" && ["Endoscopia Digestiva Alta", "Colonoscopia"].includes(formData.subtipo_exame)) {
          if (calculateAge(formData.data_nascimento) >= 65) {
             if (!window.confirm("ALERTA DE RISCO CIRÚRGICO:\nPacientes 65+ exigem liberação cardiológica. Confirma ciência?")) { setNormalIsland(); setLoading(false); return; }
          }
        }
      }

      if (step === 3) {
        if (!formData.modalidade && formData.tipo_servico !== "Retorno") { showIslandError("Defina Convênio ou Particular."); setLoading(false); return; }
      }

      if (step === 4) {
        if (!formData.data_agendamento || !formData.horario_agendamento) { showIslandError("Escolha um dia e um horário."); setLoading(false); return; }
        
        if (formData.tipo_servico === "Retorno" && dataUltimaConsulta) {
          const diffDays = Math.ceil(Math.abs(new Date(formData.data_agendamento) - dataUltimaConsulta) / (1000 * 60 * 60 * 24));
          if (diffDays > 30) { showIslandError(`Sua última consulta foi há ${diffDays} dias. Máximo é 30.`); setLoading(false); return; }
        }

        if (formData.modalidade === "Convênio" || formData.tipo_servico === "Retorno") {
          if (!(await salvarNoBanco(false))) { showIslandError("Erro de comunicação com o banco."); setLoading(false); return; }
          await dispararWebhook(false);
          setIslandState("success"); setLoading(false); setStep(6); return;
        }
      }

      setNormalIsland(); setLoading(false); setStep(p => p + 1);
    } catch (err) { showIslandError("Instabilidade temporária."); setLoading(false); }
  };

  const prevStep = () => {
    setNormalIsland();
    window.history.back(); 
  };

  // ==========================================
  // MOTOR DE PAGAMENTO DINÂMICO
  // ==========================================
  const getValorConsulta = () => PRECOS[formData.medico_profissional] || 0;
  
  // Calcula o valor da entrada (50%)
  const valorEntrada = getValorConsulta() / 2;
  
  // Evita enviar R$ 0,00 para o Mercado Pago se der algum bug na leitura
  const initializationMP = { amount: valorEntrada > 0 ? valorEntrada : 1 };

  const onSubmitMP = async (param) => {
    return new Promise(async (resolve) => {
      setIslandState("loading");
      
      try {
        const res = await fetch("/api/pagamento", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            ...param.formData, 
            amount: valorEntrada, // <- Manda o valor real calculado
            description: `Consulta Particular - ${formData.medico_profissional}` 
          })
        });
        
        const textResponse = await res.text();
        let data;
        try {
          data = JSON.parse(textResponse);
        } catch (e) {
          showIslandError("Nosso servidor bloqueou a requisição. Tente novamente.");
          resolve(); 
          return;
        }
        
        if (data.success && (data.status === "approved" || data.status === "in_process")) {
           const salvo = await salvarNoBanco(true); 
           if (!salvo) { 
             showIslandError("Pagamento APROVADO, mas o banco falhou em salvar o agendamento."); 
             resolve();
             return; 
           }
           
           await dispararWebhook(true);
           setIslandState("success"); 
           setStep(6);
           resolve();
        } else if (data.success && data.status === "rejected") {
           const recusas = {
              cc_rejected_high_risk: "Antifraude MP: Dados suspeitos ou bloqueados.",
              cc_rejected_duplicated_payment: "Pagamento duplicado. Aguarde ou mude o horário.",
              cc_rejected_bad_filled_security_code: "CVV incorreto.",
              cc_rejected_call_for_authorize: "Cartão requer autorização."
           };
           const motivo = recusas[data.status_detail] || `Recusado pelo banco emissor.`;
           showIslandError(motivo);
           resolve();
        } else {
           showIslandError(data.error || "Pagamento recusado. Verifique os dados.");
           resolve();
        }
      } catch (error) {
        showIslandError("Erro crítico ao comunicar com o servidor. Tente novamente.");
        resolve(); 
      }
    });
  };

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } }, exit: { opacity: 0, transition: { duration: 0.2 } } };
  const itemVariants = { hidden: { opacity: 0, y: 15, filter: "blur(8px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring", stiffness: 300, damping: 24 } } };
  const inputClass = "w-full mt-2 p-4 md:p-5 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#9FC131] outline-none shadow-sm transition-shadow appearance-none opacity-100 text-gray-900 placeholder:text-gray-400 font-semibold text-base";

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDay = (y, m) => new Date(y, m, 1).getDay();
  const handlePrevMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  const handleNextMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));

  const renderCalendar = () => {
    const y = calendarMonth.getFullYear(); const m = calendarMonth.getMonth();
    const daysInMonth = getDaysInMonth(y, m); const firstDay = getFirstDay(y, m);
    const today = getLocalTodayStr();
    let days = [];
    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="h-10" />);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = new Date(y, m, day).toLocaleDateString('en-CA');
      const isPast = dateStr < today;
      const isSel = formData.data_agendamento === dateStr;
      days.push(
        <button key={day} disabled={isPast} onClick={(e) => { e.preventDefault(); setValue("data_agendamento", dateStr); setNormalIsland(); }} className={`h-10 w-full rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-300 ${isPast ? "text-gray-200 cursor-not-allowed" : "hover:bg-[#9FC131]/10 text-gray-700"} ${isSel ? "bg-[#9FC131] text-white shadow-md scale-110 z-10 relative" : ""}`}>
          {day}
        </button>
      );
    }
    return days;
  };

  return (
    <div className="fixed inset-0 bg-[#F4F4F5] flex flex-col items-center justify-end md:justify-center p-0 md:p-8 selection:bg-[#9FC131] selection:text-white">
      <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 15, repeat: Infinity }} className="absolute inset-0 bg-gradient-to-tr from-[#9FC131]/10 to-transparent pointer-events-none" />

      {/* DYNAMIC ISLAND PRO */}
      <div className="fixed top-4 md:top-6 left-0 right-0 z-[100] flex justify-center pointer-events-none px-4">
        <motion.div layout transition={{ type: "spring", stiffness: 400, damping: 25 }} className={`pointer-events-auto rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.15)] overflow-hidden flex items-center px-5 py-3 cursor-pointer border max-w-full ${islandState === "error" ? "bg-red-50 border-red-500/30 text-red-600" : islandState === "success" ? "bg-green-500 border-green-400 text-white" : "bg-black/80 backdrop-blur-2xl border-white/10 text-white"}`} onClick={() => setNormalIsland()}>
          <AnimatePresence mode="wait">
            {islandState === "error" ? (
               <motion.div key="err" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: [0, -5, 5, -5, 5, 0] }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.4 }} className="flex items-center gap-3 font-semibold text-sm whitespace-normal text-left leading-tight">
                 <AlertTriangle size={18} className="text-red-500 shrink-0" /> <span className="line-clamp-2">{islandMessage}</span>
               </motion.div>
            ) : islandState === "loading" ? (
              <motion.div key="load" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 font-semibold text-sm">
                 <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, ease: "linear", duration: 1 }}><Activity size={18} className="text-[#9FC131]" /></motion.div> Orquestrando...
              </motion.div>
            ) : step === 6 ? (
               <motion.div key="ok" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 font-semibold text-sm"><CheckCircle size={18} /> Protocolo Gerado</motion.div>
            ) : (
              <motion.div key="def" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-4">
                 <div className="flex gap-1.5 items-center shrink-0">
                   {NOME_ETAPAS.slice(1, 6).map((_, i) => (<motion.div key={i} layout className={`h-1.5 rounded-full transition-all duration-500 ${step === i + 1 ? "w-6 bg-[#9FC131]" : step > i + 1 ? "w-1.5 bg-[#9FC131]/50" : "w-1.5 bg-gray-600"}`} />))}
                 </div>
                 <div className="text-xs font-semibold tracking-wider text-gray-300 border-l border-gray-700 pl-4 truncate">{NOME_ETAPAS[step]}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <motion.div layout className="w-full max-w-5xl h-[92vh] md:h-[85vh] md:max-h-[800px] mt-0 bg-white/95 md:bg-white/80 md:backdrop-blur-3xl border-t md:border border-white/60 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] md:shadow-[0_30px_80px_rgba(0,0,0,0.07)] rounded-t-[2rem] md:rounded-[2.5rem] flex flex-col relative z-10 overflow-hidden">
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className="p-5 md:p-12 min-h-full flex flex-col justify-start md:justify-center pb-32 pt-20 md:pt-12">
            <AnimatePresence mode="wait">
              
              {/* TELA 0 */}
              {step === 0 && (
                <motion.div key="s0" variants={containerVariants} initial="hidden" animate="show" exit="exit" className="flex flex-col items-center justify-center h-full text-center gap-6">
                  <motion.div variants={itemVariants} className="w-24 h-24 bg-gradient-to-br from-[#9FC131] to-emerald-600 rounded-full flex items-center justify-center shadow-2xl mb-4"><Sparkles className="text-white w-12 h-12" /></motion.div>
                  <motion.div variants={itemVariants}><h2 className="text-5xl font-extrabold text-gray-900">Olá, {personalizedName}!</h2><p className="text-gray-500 mt-4 text-lg font-medium max-w-md mx-auto">Sincronizamos os dados do WhatsApp para agilizar.</p></motion.div>
                </motion.div>
              )}

              {/* TELA 1 */}
              {step === 1 && (
                <motion.div key="s1" variants={containerVariants} initial="hidden" animate="show" exit="exit" className="flex flex-col gap-6 md:gap-8 w-full max-w-4xl mx-auto">
                  <motion.div variants={itemVariants}><h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight">Identificação</h2><p className="text-gray-500 font-medium mt-2 text-base md:text-lg">Sua base de dados segura.</p></motion.div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <motion.div variants={itemVariants} className="md:col-span-2">
                      <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest ml-1">Nome Completo</label>
                      <input {...register("nome_completo")} onChange={() => setNormalIsland()} className={inputClass} placeholder="Como deseja ser chamado?" />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                      <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest ml-1">CPF</label>
                      <input {...register("cpf")} onChange={(e) => { setValue("cpf", maskCPF(e.target.value)); setNormalIsland(); }} className={inputClass} placeholder="000.000.000-00" />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                      <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest ml-1">Nascimento</label>
                      <input type="date" {...register("data_nascimento")} onChange={() => setNormalIsland()} className={inputClass} />
                    </motion.div>
                    <motion.div variants={itemVariants} className="md:col-span-2">
                      <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest ml-1">WhatsApp</label>
                      <input {...register("telefone_whatsapp")} onChange={(e) => { setValue("telefone_whatsapp", maskPhone(e.target.value)); setNormalIsland(); }} className={inputClass} placeholder="(00) 90000-0000" />
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {/* TELA 2 */}
              {step === 2 && (
                <motion.div key="s2" variants={containerVariants} initial="hidden" animate="show" exit="exit" className="flex flex-col gap-6 md:gap-8 w-full">
                  <motion.div variants={itemVariants}><h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight">O que você precisa?</h2></motion.div>
                  <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start w-full">
                    <motion.div variants={itemVariants} className="w-full md:w-1/3 grid grid-cols-1 gap-3 md:gap-4">
                      {["Consulta", "Retorno", "Exame"].map((serv) => (
                        <button key={serv} onClick={(e) => { e.preventDefault(); setValue("tipo_servico", serv); setValue("medico_profissional", ""); setValue("subtipo_exame", ""); setNormalIsland(); }} className={`p-4 md:p-5 border-2 rounded-2xl flex items-center justify-between transition-all duration-300 ${formData.tipo_servico === serv ? "border-[#9FC131] bg-[#9FC131] text-white shadow-xl scale-[1.02]" : "border-gray-100 text-gray-600 hover:bg-gray-50"}`}>
                          <span className="font-bold">{serv}</span> {formData.tipo_servico === serv && <ArrowRight size={18} />}
                        </button>
                      ))}
                    </motion.div>
                    <AnimatePresence mode="wait">
                      {(formData.tipo_servico === "Consulta" || formData.tipo_servico === "Retorno") && (
                        <motion.div key="med" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="w-full md:w-2/3 space-y-3">
                          <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest ml-1">Corpo Clínico</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mt-2">
                            {Object.keys(PRECOS).map((medico) => (
                              <button key={medico} onClick={(e) => { e.preventDefault(); setValue("medico_profissional", medico); setNormalIsland(); }} className={`w-full flex items-center p-4 md:p-5 border-2 rounded-2xl cursor-pointer transition-all duration-300 text-left ${formData.medico_profissional === medico ? "border-[#9FC131] bg-white shadow-xl shadow-[#9FC131]/10 scale-[1.02] ring-2 ring-[#9FC131]/20" : "border-gray-100 hover:bg-gray-50"}`}>
                                <div className={`w-6 h-6 rounded-full border-2 mr-3 md:mr-4 flex items-center justify-center shrink-0 ${formData.medico_profissional === medico ? "border-[#9FC131]" : "border-gray-200"}`}>
                                  {formData.medico_profissional === medico && <motion.div layoutId="dotMed" className="w-3 h-3 bg-[#9FC131] rounded-full" /> }
                                </div>
                                <span className={`font-bold text-sm md:text-base ${formData.medico_profissional === medico ? "text-gray-900" : "text-gray-600"}`}>{medico}</span>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                      {formData.tipo_servico === "Exame" && (
                        <motion.div key="exa" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="w-full md:w-2/3 space-y-3">
                          <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest ml-1">Selecione o Exame</label>
                          <div className="grid grid-cols-1 gap-3 md:gap-4 mt-2">
                            {["Endoscopia Digestiva Alta", "Colonoscopia", "Retirada de Balão Gástrico"].map((exame) => (
                              <button key={exame} onClick={(e) => { e.preventDefault(); setValue("subtipo_exame", exame); setNormalIsland(); }} className={`w-full flex items-center p-4 md:p-5 border-2 rounded-2xl cursor-pointer transition-all duration-300 text-left ${formData.subtipo_exame === exame ? "border-[#9FC131] bg-white shadow-xl shadow-[#9FC131]/10 scale-[1.02] ring-2 ring-[#9FC131]/20" : "border-gray-100 hover:bg-gray-50"}`}>
                                <div className={`w-6 h-6 rounded-full border-2 mr-3 md:mr-4 flex items-center justify-center shrink-0 ${formData.subtipo_exame === exame ? "border-[#9FC131]" : "border-gray-200"}`}>
                                  {formData.subtipo_exame === exame && <motion.div layoutId="dotExa" className="w-3 h-3 bg-[#9FC131] rounded-full" /> }
                                </div>
                                <span className={`font-bold text-sm md:text-base ${formData.subtipo_exame === exame ? "text-gray-900" : "text-gray-600"}`}>{exame}</span>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {/* TELA 3 */}
              {step === 3 && (
                 <motion.div key="s3" variants={containerVariants} initial="hidden" animate="show" exit="exit" className="flex flex-col gap-6 w-full">
                   <motion.h2 variants={itemVariants} className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight text-center mb-4 md:mb-6">Como deseja prosseguir?</motion.h2>
                   {formData.tipo_servico === "Retorno" ? (
                     <motion.div variants={itemVariants} className="max-w-xl mx-auto w-full p-6 md:p-8 bg-[#9FC131]/10 rounded-3xl border border-[#9FC131]/30 text-center shadow-inner">
                        <ShieldCheck className="w-12 h-12 md:w-16 md:h-16 text-[#9FC131] mx-auto mb-4" />
                        <h3 className="text-xl md:text-2xl font-bold text-gray-900">Agendamento de Retorno</h3>
                     </motion.div>
                   ) : (
                     <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 max-w-2xl mx-auto w-full">
                        <button onClick={(e) => { e.preventDefault(); setValue("modalidade", "Convênio"); setNormalIsland(); }} className={`p-8 md:p-10 border-2 rounded-3xl flex flex-col items-center gap-4 transition-all duration-300 ${formData.modalidade === "Convênio" ? "border-[#9FC131] bg-[#9FC131]/5 shadow-2xl scale-[1.02]" : "border-gray-100 hover:border-[#9FC131]/30"}`}>
                          <ShieldCheck className={formData.modalidade === "Convênio" ? "text-[#9FC131]" : "text-gray-300"} size={40} />
                          <span className="font-extrabold text-lg md:text-xl text-gray-900">Plano de Saúde</span>
                        </button>
                        <button onClick={(e) => { e.preventDefault(); setValue("modalidade", "Particular"); setNormalIsland(); }} className={`p-8 md:p-10 border-2 rounded-3xl flex flex-col items-center gap-4 transition-all duration-300 ${formData.modalidade === "Particular" ? "border-[#9FC131] bg-[#9FC131]/5 shadow-2xl scale-[1.02]" : "border-gray-100 hover:border-[#9FC131]/30"}`}>
                          <CreditCard className={formData.modalidade === "Particular" ? "text-[#9FC131]" : "text-gray-300"} size={40} />
                          <span className="font-extrabold text-lg md:text-xl text-gray-900">Particular</span>
                        </button>
                     </motion.div>
                   )}
                 </motion.div>
              )}

              {/* TELA 4 */}
              {step === 4 && (
                <motion.div key="s4" variants={containerVariants} initial="hidden" animate="show" exit="exit" className="flex flex-col gap-6 w-full">
                  <motion.div variants={itemVariants}><h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight">Agenda</h2></motion.div>
                  <div className="flex flex-col md:flex-row gap-6 md:gap-8 flex-1 w-full">
                    <motion.div variants={itemVariants} className="w-full md:w-1/2 bg-gray-50/50 border border-gray-100 rounded-3xl p-5 md:p-6 h-fit">
                      <div className="flex justify-between items-center mb-6">
                        <button onClick={(e) => { e.preventDefault(); handlePrevMonth(); }} className="p-2 hover:bg-white shadow-sm rounded-full transition-all"><ChevronLeft size={20}/></button>
                        <h3 className="font-extrabold text-gray-800 uppercase tracking-widest text-sm">{calendarMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
                        <button onClick={(e) => { e.preventDefault(); handleNextMonth(); }} className="p-2 hover:bg-white shadow-sm rounded-full transition-all"><ChevronRight size={20}/></button>
                      </div>
                      <div className="grid grid-cols-7 gap-1 md:gap-2 text-center mb-2">{['D','S','T','Q','Q','S','S'].map((dia, i) => <div key={i} className="text-[11px] font-extrabold text-gray-400">{dia}</div>)}</div>
                      <div className="grid grid-cols-7 gap-1 md:gap-2">{renderCalendar()}</div>
                    </motion.div>
                    <motion.div variants={itemVariants} className="w-full md:w-1/2">
                      <AnimatePresence mode="wait">
                        {formData.data_agendamento ? (
                          <motion.div key="times" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white border border-gray-100 p-5 md:p-6 rounded-3xl shadow-lg h-fit">
                            <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                              Horários <Clock size={12}/> {buscandoHorarios && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-3 h-3 border-2 border-[#9FC131] border-t-transparent rounded-full ml-auto" />}
                            </label>
                            <div className="grid grid-cols-3 gap-2 md:gap-3">
                              {HORARIOS_BASE.map((hora) => {
                                const isOcupado = horariosOcupados.includes(hora);
                                return (
                                  <button key={hora} disabled={isOcupado || buscandoHorarios} onClick={(e) => { e.preventDefault(); setValue("horario_agendamento", hora); setNormalIsland(); }} className={`py-3 rounded-2xl font-bold transition-all duration-300 border ${isOcupado ? "bg-gray-50 text-gray-300 border-transparent cursor-not-allowed line-through" : formData.horario_agendamento === hora ? "bg-[#9FC131] text-white border-[#9FC131] shadow-xl shadow-[#9FC131]/30 scale-105" : "bg-white text-gray-700 border-gray-200 hover:border-[#9FC131] hover:shadow-md"}`}>
                                    {hora}
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full border-2 border-dashed border-gray-200 rounded-3xl flex items-center justify-center text-gray-400 font-medium p-6 text-center min-h-[150px] bg-gray-50/30">
                            Selecione um dia no calendário.
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {/* TELA 5: CHECKOUT */}
              {step === 5 && (
                <motion.div key="s5" variants={containerVariants} initial="hidden" animate="show" exit="exit" className="flex flex-col gap-6 w-full max-w-xl mx-auto">
                  <motion.div variants={itemVariants} className="text-center">
                    <div className="w-14 h-14 md:w-16 md:h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4 shadow-xl"><Lock className="text-white w-6 h-6 md:w-8 md:h-8" /></div>
                    <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">Checkout Seguro</h2>
                  </motion.div>
                  
                  <motion.div variants={itemVariants} className="bg-gray-50/80 p-5 md:p-8 rounded-3xl border border-gray-100 shadow-inner w-full relative z-10">
                    <div className="flex justify-between items-center border-b border-gray-200 pb-4 mb-4">
                      <span className="text-gray-500 font-medium text-xs md:text-sm">Serviço: {formData.tipo_servico}</span>
                      <span className="font-bold text-gray-900 text-xs md:text-sm">R$ {getValorConsulta().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-lg mb-8">
                      <span className="font-bold text-gray-900">Entrada Hoje (50%)</span>
                      <span className="font-extrabold text-[#8eb02c] text-2xl md:text-3xl tracking-tight">R$ {valorEntrada.toFixed(2)}</span>
                    </div>

                    <div className="w-full relative z-30 min-h-[350px]">
                      {process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ? (
                        <Payment 
                          initialization={initializationMP} 
                          onSubmit={onSubmitMP} 
                          customization={{ paymentMethods: { creditCard: 'all', debitCard: 'all' } }} 
                        />
                      ) : (
                        <div className="p-6 bg-red-50 text-red-600 rounded-xl border border-red-200 text-center font-medium text-sm">Chave Pública do Mercado Pago ausente.</div>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {/* TELA 6: SUCESSO */}
              {step === 6 && (
                <motion.div key="s6" variants={containerVariants} initial="hidden" animate="show" className="flex flex-col items-center justify-center text-center w-full my-auto py-10">
                  <motion.div variants={itemVariants} className="relative">
                    <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0, 0.5, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 bg-[#9FC131] rounded-full blur-2xl" />
                    <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-[#9FC131] to-emerald-500 rounded-full flex items-center justify-center shadow-2xl relative z-10">
                      <motion.svg initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: "easeInOut" }} className="w-12 h-12 md:w-16 md:h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </motion.svg>
                    </div>
                  </motion.div>
                  <motion.h2 variants={itemVariants} className="text-4xl md:text-6xl font-extrabold text-gray-900 tracking-tight mt-8">Magnífico!</motion.h2>
                  <motion.p variants={itemVariants} className="text-gray-500 mt-4 font-medium text-base md:text-lg max-w-md">Agendamento para o dia <strong>{formData.data_agendamento?.split("-").reverse().join("/")}</strong> às <strong>{formData.horario_agendamento}</strong> confirmado.</motion.p>
                  <motion.div variants={itemVariants} className="mt-8 bg-gray-50 p-5 md:p-6 rounded-3xl border border-gray-100 shadow-sm w-full max-w-sm">
                    <p className="text-[10px] md:text-[11px] font-extrabold text-gray-400 uppercase tracking-widest mb-2">Protocolo Integrado</p>
                    <p className="text-3xl md:text-4xl font-mono font-black text-gray-900 tracking-widest">{Math.floor(100000 + Math.random() * 900000)}</p>
                  </motion.div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>

        {/* STICKY FOOTER */}
        {step < 6 && (
          <div className="shrink-0 w-full bg-white/95 border-t border-gray-100 p-4 md:p-5 px-6 md:px-10 flex justify-between items-center z-40 pb-safe">
            {step > 1 ? (
              <button onClick={(e) => { e.preventDefault(); prevStep(); }} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-extrabold text-[11px] md:text-xs uppercase tracking-widest py-3 transition-colors">
                <ArrowLeft size={16} /> Voltar
              </button>
            ) : <div />}

            {step !== 5 && (
              <button onClick={(e) => { e.preventDefault(); nextStep(); }} disabled={loading} className={`relative overflow-hidden text-white px-8 md:px-12 py-3.5 md:py-4 rounded-full font-extrabold text-[11px] md:text-xs uppercase tracking-widest flex items-center gap-3 transition-all duration-300 disabled:opacity-50 disabled:scale-100 bg-gray-900 shadow-xl hover:bg-[#9FC131] active:scale-95`}>
                <span className="relative z-10">{loading ? "Orquestrando" : (step === 4 && formData.modalidade === "Convênio" ? "Finalizar" : "Continuar")}</span>
                {!loading && <ArrowRight size={16} className="relative z-10" />}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}