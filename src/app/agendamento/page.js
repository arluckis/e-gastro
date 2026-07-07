"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase"; 
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import axios from "axios";
import { 
  ArrowRight, CheckCircle, AlertTriangle, Activity, User, 
  HeartPulse, Search, Pencil, ChevronLeft, ChevronRight, 
  ShieldCheck, CreditCard, Calendar as CalendarIcon 
} from "lucide-react";

import Navbar from "@/components/Navbar";
import SidebarPremium from "@/components/SidebarPremium";

// ==========================================
// 1. CONFIGURAÇÕES GERAIS E INTEGRAÇÕES
// ==========================================
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_MP_PUBLIC_KEY) {
  initMercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY, { locale: 'pt-BR' });
}

const URL_WEBHOOK_PUSH = "https://acessoapi.rmchat.com.br/w/875a4a21-8b19-42f1-97d7-d420f72f4310";

const dispararPushRmChat = async (telefonePaciente, nomePaciente) => {
  try {
    const numeroLimpo = "55" + telefonePaciente.replace(/\D/g, "");
    console.log("🚀 Disparando Push para o RM Chat...", { nome: nomePaciente, numero: numeroLimpo });

    const payload = {
      name: nomePaciente,
      number: numeroLimpo
    };

    const response = await axios.post(URL_WEBHOOK_PUSH, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log("✅ Paciente injetado no RM Chat com sucesso via Push!", response.data);
    return response.data;

  } catch (error) {
    console.error("❌ Falha ao enviar Push para o RM Chat:", error?.response?.data || error.message);
  }
};

const MAPA_SERVICOS = {
  "1": { tipo: "Consulta", medico: "Dra. Simone" },
  "2": { tipo: "Consulta", medico: "Dr. Brilhante" },
  "3": { tipo: "Consulta", medico: "Dr. Tiago Lima" },
  "4": { tipo: "Consulta", medico: "Dr. Thiago Dyavy" },
  "5": { tipo: "Consulta", medico: "Dra. Candice (Psicologia)" },
  "6": { tipo: "Exame", exame: "Endoscopia Digestiva Alta" },
  "7": { tipo: "Exame", exame: "Colonoscopia" }
};

const PRECOS = { 
  "Dra. Simone": 450, "Dr. Brilhante": 2, "Dr. Tiago Lima": 350, 
  "Dr. Thiago Dyavy": 350, "Dra. Candice (Psicologia)": 200,
  "Endoscopia Digestiva Alta": 500, "Colonoscopia": 750, "Retirada de Balão Gástrico": 1100
};

const HORARIOS_BASE = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const NOME_ETAPAS = ["Sincronização", "Identificação", "Especialidade", "Modalidade", "Agenda", "Checkout", "Concluído"];

// ==========================================
// 2. MÁSCARAS E VALIDAÇÕES (ZOD)
// ==========================================
const masks = {
  cpf: (v) => v.replace(/\D/g, "").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})/, "$1-$2").replace(/(-\d{2})\d+?$/, "$1"),
  phone: (v) => v.replace(/\D/g, "").replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").replace(/(-\d{4})\d+?$/, "$1"),
  date: (v) => v.replace(/\D/g, "").replace(/(\d{2})(\d)/, "$1/$2").replace(/(\d{2})(\d)/, "$1/$2").replace(/(\/\d{4})\d+?$/, "$1")
};

const helpers = {
  isValidDate: (str) => {
    const reg = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[012])\/(19|20)\d\d$/;
    if (!reg.test(str)) return false;
    const [d, m, y] = str.split('/').map(Number);
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  },
  calcAge: (str) => {
    if (!str) return 0;
    const [d, m, y] = str.split('/').map(Number);
    return Math.abs(new Date(Date.now() - new Date(y, m - 1, d).getTime()).getUTCFullYear() - 1970);
  },
  toDBDate: (str) => str ? str.split('/').reverse().join('-') : null,
  getToday: () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
};

const schema = z.object({
  cpf: z.string().length(14, "O CPF precisa ter 14 dígitos"),
  nome: z.string().min(2, "Informe seu nome"),
  sobrenome: z.string().min(2, "Informe seu sobrenome"),
  telefone_whatsapp: z.string().min(14, "WhatsApp incompleto"),
  data_nascimento: z.string().refine(helpers.isValidDate, { message: "Data inválida" }),
  email: z.string().email("E-mail inválido"),
  tipo_servico: z.enum(["Consulta", "Retorno", "Exame"]).optional(),
  medico_profissional: z.string().optional(),
  subtipo_exame: z.string().optional(),
  modalidade: z.enum(["Particular", "Convênio"]).optional(),
  data_agendamento: z.string().optional(),
  horario_agendamento: z.string().optional(),
});

// ==========================================
// 3. COMPONENTE PRINCIPAL (PAGE)
// ==========================================
export default function AgendamentoPremium() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  return (
    <div className="flex min-h-screen w-full bg-[#FAFAFA] dark:bg-black text-zinc-900 dark:text-zinc-50 transition-colors duration-500 font-sans antialiased">
      <SidebarPremium isExpanded={isSidebarExpanded} setIsExpanded={setIsSidebarExpanded} />
      <Navbar />
      <main className={`flex-1 relative flex flex-col items-center transition-[margin] duration-500 ease-in-out w-full h-full min-h-screen overflow-hidden ${isSidebarExpanded ? "md:ml-[260px]" : "md:ml-[88px]"}`}>
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center w-full"><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-8 h-8 border-[3px] border-zinc-900 border-t-transparent rounded-full" /></div>}>
          <AgendamentoForm />
        </Suspense>
      </main>
    </div>
  );
}

// ==========================================
// 4. COMPONENTE DE FORMULÁRIO (LÓGICA E UI)
// ==========================================
function AgendamentoForm() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0); 
  const [loading, setLoading] = useState(false);
  const [islandState, setIslandState] = useState("default");
  const [islandMessage, setIslandMessage] = useState("");
  const timeoutRef = useRef(null);
  
  const [pixData, setPixData] = useState(null);

  const [context, setContext] = useState({ isSmartLink: false, personalizedName: "", dataUltimaConsulta: null, userFound: false, checkingUser: false });
  const [calendarMonth, setCalendarMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [agenda, setAgenda] = useState({ ocupados: [], buscando: false });
  
  const [flags, setFlags] = useState({
    cpfUrl: false, nomeUrl: false, sobrenomeUrl: false, telUrl: false,
    unlockedCpf: false, unlockedNome: false, unlockedSobrenome: false, unlockedTel: false,
    exibirConfUri: false, confirmouUri: false
  });

  const { register, watch, trigger, setValue, formState: { errors }, reset } = useForm({ resolver: zodResolver(schema), mode: "onChange" });
  const formData = watch();
  const valorEntrada = (formData.tipo_servico === "Exame" ? (PRECOS[formData.subtipo_exame] || 500) : (PRECOS[formData.medico_profissional] || 0)) / 2;

  const showIsland = (msg, type = "error") => {
    setIslandMessage(msg); setIslandState(type);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!["loading", "success"].includes(type) && step !== 6) timeoutRef.current = setTimeout(() => setIslandState("default"), 3000);
  };

  useEffect(() => {
    const saved = localStorage.getItem("egastro_agendamento");
    if (saved) try { const { step: s, data } = JSON.parse(saved); if (s >= 0 && s < 6) { setStep(s); reset(data); } } catch (e) {}
  }, [reset]);

  useEffect(() => {
    step < 6 ? localStorage.setItem("egastro_agendamento", JSON.stringify({ step, data: formData })) : localStorage.removeItem("egastro_agendamento");
  }, [step, formData]);

  useEffect(() => {
    const nomeUrl = searchParams.get("nome"), cpfUrl = searchParams.get("cpf"), medicoUrl = searchParams.get("medico"), wppUrl = searchParams.get("whatsapp");
    if (nomeUrl && cpfUrl && !context.isSmartLink) {
      const parts = nomeUrl.trim().split(" ");
      setValue("nome", parts[0] || "");
      setValue("sobrenome", parts.slice(1).join(" ") || "");
      setValue("cpf", masks.cpf(cpfUrl));
      if (wppUrl) setValue("telefone_whatsapp", masks.phone(wppUrl));

      setFlags(f => ({ ...f, cpfUrl: true, nomeUrl: true, sobrenomeUrl: parts.length > 1, telUrl: !!wppUrl, exibirConfUri: !!medicoUrl }));
      setContext(c => ({ ...c, isSmartLink: true, personalizedName: parts[0] || "" }));
      
      if (medicoUrl) {
        const servico = MAPA_SERVICOS[medicoUrl];
        if (servico) {
          setValue("tipo_servico", servico.tipo);
          setValue(servico.medico ? "medico_profissional" : "subtipo_exame", servico.medico || servico.exame);
        } else setValue("medico_profissional", medicoUrl);
      }
      setStep(0);
    }
  }, [searchParams, setValue, context.isSmartLink]);

  const handleCpfLookup = async () => {
    if (formData.cpf?.length !== 14) return;
    setContext(c => ({ ...c, checkingUser: true }));
    if (!context.isSmartLink || flags.unlockedCpf) ["nome", "sobrenome", "telefone_whatsapp", "email", "data_nascimento"].forEach(f => setValue(f, ""));

    try {
      const { data } = await supabase.from("pacientes").select("*").eq("cpf", formData.cpf).maybeSingle();
      if (data) {
        if (data.nome_completo) {
          const p = data.nome_completo.trim().split(" ");
          setValue("nome", p[0] || ""); setValue("sobrenome", p.slice(1).join(" ") || "");
        }
        setValue("telefone_whatsapp", data.telefone_whatsapp || "");
        setValue("email", data.email || "");
        if (data.data_nascimento) setValue("data_nascimento", data.data_nascimento.split('-').reverse().join('/'));
        
        setContext(c => ({ ...c, userFound: true }));
        showIsland("Bem-vindo de volta!", "success");
        setTimeout(() => setIslandState("default"), 2000);
      } else setContext(c => ({ ...c, userFound: false }));
    } finally { setTimeout(() => setContext(c => ({ ...c, checkingUser: false })), 500); }
  };

  useEffect(() => { if (formData.cpf?.length === 14 && !context.userFound && step === 1 && !context.checkingUser) handleCpfLookup(); }, [formData.cpf]);

  useEffect(() => {
    if (!formData.data_agendamento) return;
    const prof = formData.tipo_servico === "Exame" ? formData.subtipo_exame : formData.medico_profissional;
    if (!prof) return;

    setAgenda(a => ({ ...a, buscando: true }));
    setValue("horario_agendamento", "");

    const fetchAgenda = async () => {
      try {
        const [{ data: ag }, { data: bl }] = await Promise.all([
          supabase.from("agendamentos").select("horario_agendamento, medico_profissional, subtipo_exame").eq("data_agendamento", formData.data_agendamento),
          supabase.from("bloqueios_horarios").select("horario, medico_profissional").eq("data", formData.data_agendamento)
        ]);

        const match = (nDB) => {
          if (!nDB) return false;
          if (nDB === "Todos") return true;
          const pNorm = prof.toLowerCase().replace(/dra\.|dr\./g, "").trim();
          return nDB.toLowerCase().includes(pNorm) || pNorm.includes(nDB.toLowerCase()) || nDB.toLowerCase().includes(pNorm.split(" ")[0]);
        };

        const slots = [
          ...(ag?.filter(a => match(a.medico_profissional) || match(a.subtipo_exame)).map(a => a.horario_agendamento.substring(0,5)) || []),
          ...(bl?.filter(b => match(b.medico_profissional)).map(b => b.horario.substring(0,5)) || [])
        ];
        setAgenda({ ocupados: [...new Set(slots)], buscando: false });
      } catch (e) { setAgenda(a => ({ ...a, buscando: false })); }
    };
    fetchAgenda();
  }, [formData.data_agendamento, formData.medico_profissional, formData.subtipo_exame, formData.tipo_servico, setValue]);

  const salvarNoBanco = async (pago) => {
    try {
      let pacienteId = (await supabase.from("pacientes").select("id").eq("cpf", formData.cpf).maybeSingle()).data?.id;
      const pacienteData = { nome_completo: `${formData.nome} ${formData.sobrenome}`.trim(), telefone_whatsapp: formData.telefone_whatsapp, email: formData.email, data_nascimento: helpers.toDBDate(formData.data_nascimento) };
      
      if (pacienteId) await supabase.from("pacientes").update(pacienteData).eq("id", pacienteId);
      else pacienteId = (await supabase.from("pacientes").insert({ cpf: formData.cpf, ...pacienteData }).select().single()).data.id;

      await supabase.from("agendamentos").insert({
        paciente_id: pacienteId, tipo_servico: formData.tipo_servico, subtipo_exame: formData.subtipo_exame || null,
        medico_profissional: formData.medico_profissional || "A definir", modalidade: formData.modalidade || "Não se aplica",
        data_agendamento: formData.data_agendamento, horario_agendamento: formData.horario_agendamento, status_pagamento_antecipado: pago, valor_total: valorEntrada * 2
      });
      return true;
    } catch { return false; }
  };

  const dispararWebhook = async (pago) => {
    if (!process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL) return;
    try {
      await fetch(process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...formData, nome_completo: `${formData.nome} ${formData.sobrenome}`.trim(), status_pagamento: pago, data_criacao: new Date().toISOString() }) });
    } catch {}
  };

  const nextStep = async () => {
    setLoading(true); showIsland("Processando...", "loading");
    try {
      if (step === 0) return setStep(1);
      if (step === 1 && !(await trigger(["cpf", "nome", "sobrenome", "telefone_whatsapp", "data_nascimento", "email"]))) return showIsland("Verifique os dados informados.");
      
      if (step === 2) {
        if (flags.exibirConfUri && flags.confirmouUri) return setStep(3);
        if (!formData.tipo_servico) return showIsland("Selecione um serviço.");
        if (["Consulta", "Retorno"].includes(formData.tipo_servico) && !formData.medico_profissional) return showIsland("Selecione o profissional.");
        if (formData.tipo_servico === "Exame" && !formData.subtipo_exame) return showIsland("Selecione o exame.");
        
        if (formData.medico_profissional === "Dra. Simone" || formData.tipo_servico === "Retorno") {
          const pid = (await supabase.from("pacientes").select("id").eq("cpf", formData.cpf).maybeSingle()).data?.id;
          if (!pid) return showIsland(formData.tipo_servico === "Retorno" ? "Cadastro não encontrado." : "A Dra. Simone atende apenas retornos.");
          const ult = await supabase.from("agendamentos").select("data_agendamento").eq("paciente_id", pid).eq("tipo_servico", "Consulta").order("data_agendamento", { ascending: false }).limit(1).maybeSingle();
          if (!ult.data) return showIsland("Sem histórico de consulta.");
          if (formData.tipo_servico === "Retorno") setContext(c => ({ ...c, dataUltimaConsulta: new Date(ult.data.data_agendamento) }));
        }

        if (formData.tipo_servico === "Exame" && ["Endoscopia Digestiva Alta", "Colonoscopia"].includes(formData.subtipo_exame) && helpers.calcAge(formData.data_nascimento) >= 65 && !window.confirm("Pacientes 65+ exigem liberação cardiológica. Confirma ciência?")) {
           setIslandState("default"); return;
        }
      }

      if (step === 3 && !formData.modalidade && formData.tipo_servico !== "Retorno") return showIsland("Defina a modalidade.");
      
      if (step === 4) {
        if (!formData.data_agendamento || !formData.horario_agendamento) return showIsland("Escolha uma data e horário.");
        if (formData.tipo_servico === "Retorno" && context.dataUltimaConsulta && Math.ceil(Math.abs(new Date(formData.data_agendamento) - context.dataUltimaConsulta) / 86400000) > 30) return showIsland("Prazo excedido (> 30 dias).");
        
        if (formData.tipo_servico === "Retorno" || formData.modalidade === "Convênio") {
          if (await salvarNoBanco(false)) { await dispararWebhook(false); showIsland("Agendamento Finalizado", "success"); return setStep(6); }
          return showIsland("Erro ao salvar.");
        }
        return setStep(5);
      }
      setStep(p => p + 1); setIslandState("default");
    } finally { setLoading(false); if (islandState === "loading") setIslandState("default"); }
  };

  const onSubmitMP = async (param) => {
    return new Promise(async (resolve) => {
      showIsland("Processando pagamento...", "loading");
      try {
        const mpPayer = param.formData?.payer || {};
        const payload = {
          ...param.formData,
          amount: Math.max(valorEntrada, 1),
          description: `Entrada - ${formData.medico_profissional || formData.subtipo_exame}`,
          payer: {
            ...mpPayer,
            email: mpPayer.email || formData.email,
            first_name: mpPayer.first_name || formData.nome,
            last_name: mpPayer.last_name || formData.sobrenome,
            identification: mpPayer.identification || {
              type: "CPF",
              number: formData.cpf ? formData.cpf.replace(/\D/g, "") : ""
            }
          }
        };

        const res = await fetch("/api/pagamento", { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify(payload) 
        });
        const data = await res.json();
        
        // Verifica se aprovado (cartão) OU pendente (PIX)
        if (data.success && ["approved", "in_process", "pending"].includes(data.status)) {
           
           const isPix = data.status === "pending";

           // Salva a vaga no banco (Se for PIX, salva como NÃO pago para apenas pré-reservar a vaga)
           if (!(await salvarNoBanco(!isPix))) { 
             showIsland("Erro ao gerar agendamento."); 
             return resolve(); 
           }

           // Se NÃO for Pix (ou seja, se for Cartão Aprovado), dispara a confirmação imediatamente
           if (!isPix) {
             await dispararWebhook(true);
             const telefonePaciente = formData.telefone_whatsapp;
             const nomePaciente = `${formData.nome} ${formData.sobrenome}`.trim();
             await dispararPushRmChat(telefonePaciente, nomePaciente);
             showIsland("Pagamento Aprovado", "success");
           } else {
             // Se for Pix, salva apenas os dados do QR Code na tela e NÃO dispara push/webhook agora
             if (data.transaction_data) {
               setPixData(data.transaction_data);
             }
             showIsland("Pix gerado com sucesso!", "success");
           }

           setStep(6);
        } else {
           showIsland("Pagamento recusado.");
        }
      } catch (err) { 
        showIsland("Erro de conexão com o servidor."); 
        console.error(err);
      }
      resolve();
    });
  };

  // --- CLASSES CSS COMPARTILHADAS ---
  const cnInputWrap = "relative rounded-xl bg-zinc-50/50 dark:bg-[#111111]/50 border border-zinc-200 dark:border-zinc-800 transition-all duration-300 focus-within:border-zinc-900 dark:focus-within:border-white focus-within:ring-1 focus-within:ring-zinc-900 dark:focus-within:ring-white overflow-hidden";
  const cnInput = "w-full p-3.5 pt-6 bg-transparent outline-none text-zinc-900 dark:text-white font-medium text-[16px] peer placeholder-transparent";
  const cnLabel = "absolute left-3.5 top-2 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest transition-all duration-300 peer-placeholder-shown:top-4 peer-placeholder-shown:text-[14px] peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:text-zinc-900 dark:peer-focus:text-white pointer-events-none";

  // ==========================================
  // FUNÇÃO DE TESTE - APAGAR DEPOIS
  // ==========================================
  const simulatePayment = async (e) => {
    e.preventDefault();
    showIsland("Simulando pagamento...", "loading");
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const salvo = await salvarNoBanco(true);
      if (!salvo) { 
        showIsland("Erro ao salvar recibo."); 
        return; 
      }
      
      await dispararWebhook(true);

      const telefonePaciente = formData.telefone_whatsapp;
      const nomePaciente = `${formData.nome} ${formData.sobrenome}`.trim();
      await dispararPushRmChat(telefonePaciente, nomePaciente);

      showIsland("Pagamento Aprovado (TESTE)", "success"); 
      setStep(6);
    } catch (error) {
      showIsland("Erro na simulação.");
    }
  };

  return (
    <>
      <div className="absolute inset-0 bg-[#FAFAFA] dark:bg-black -z-20 pointer-events-none" />
      
      {/* ILHA DINÂMICA */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[9999] w-full px-4 flex justify-center pointer-events-none">
        <motion.div layout className={`pointer-events-auto rounded-full px-5 py-2.5 max-w-sm flex transition-colors shadow-lg ${islandState === "error" ? "bg-red-500 text-white" : islandState === "success" ? "bg-[#9FC131] text-black font-medium" : "bg-black dark:bg-[#111111] text-white border border-transparent dark:border-white/10"}`}>
          <AnimatePresence mode="wait">
             {islandState === "error" && <motion.div key="e" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-2 text-xs"><AlertTriangle size={14} />{islandMessage}</motion.div>}
             {islandState === "success" && <motion.div key="s" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-2 text-xs"><CheckCircle size={14} />{islandMessage}</motion.div>}
             {islandState === "loading" && <motion.div key="l" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-3 text-xs"><Activity size={14} className="animate-spin opacity-80" />{islandMessage || "Processando"}</motion.div>}
             {islandState === "default" && <motion.div key="d" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-4"><div className="flex gap-1.5">{NOME_ETAPAS.slice(1,6).map((_, i) => <div key={i} className={`h-1 rounded-full transition-all ${step === i + 1 ? "w-4 bg-white" : step > i + 1 ? "w-1.5 bg-white/40" : "w-1.5 bg-white/10"}`}/>)}</div><div className="text-[10px] tracking-widest text-zinc-400 border-l border-zinc-700 pl-4 uppercase">{NOME_ETAPAS[step === 0 ? 1 : step]}</div></motion.div>}
          </AnimatePresence>
        </motion.div>
      </div>

      <div className="w-full h-full flex items-center justify-center p-0 md:p-8 pt-24 md:pt-28 z-10">
        <motion.div layout transition={{ type: "spring", stiffness: 450, damping: 35 }} className="w-full max-w-[800px] h-full md:h-[80vh] md:max-h-[700px] bg-white dark:bg-[#0A0A0A] md:rounded-[24px] border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden shadow-sm">
          
          {step >= 0 && step <= 5 && (
            <div className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-md">
              {step > 0 ? <button onClick={() => setStep(p => p - 1)} className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white text-[13px] font-medium"><ChevronLeft size={18} /> Voltar</button> : <div/>}
              {step !== 5 && !(step === 2 && flags.exibirConfUri && !flags.confirmouUri) && (
                <button onClick={nextStep} disabled={loading || (step===1 && formData.cpf?.length !== 14)} className="bg-zinc-900 dark:bg-white text-white dark:text-black font-bold text-[12px] px-6 py-2.5 rounded-full flex items-center gap-2 uppercase disabled:opacity-40">{loading ? "Processando" : (step === 4 && (formData.modalidade === "Convênio" || formData.tipo_servico === "Retorno") ? "Finalizar" : "Continuar")}{!loading && <ArrowRight size={16}/>}</button>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12">
            <AnimatePresence mode="wait">
              
              {step === 0 && (
                <motion.div key="s0" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="text-center mt-20 max-w-sm mx-auto">
                  <h1 className="text-4xl md:text-5xl font-light">Olá, <span className="font-medium">{context.personalizedName}</span>.</h1>
                  <p className="text-zinc-500 mt-4 text-sm">Conectamos o seu painel de agendamento ao ambiente clínico em segurança.</p>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div key="s1" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="max-w-lg mx-auto space-y-6">
                  <div><h2 className="text-3xl font-medium">Dados de Acesso</h2><p className="text-zinc-500 text-sm mt-2">Verifique ou insira as informações.</p></div>
                  
                  {context.isSmartLink && !flags.unlockedCpf && !flags.unlockedNome && !flags.unlockedSobrenome && !flags.unlockedTel ? (
                    <div className="p-6 bg-zinc-50 dark:bg-[#111111] border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                      <div className="flex justify-between items-start mb-6">
                        <h3 className="text-lg font-medium">Agendamento E-gastro<br/><span className="text-zinc-500 text-base">{formData.nome} {formData.sobrenome}</span></h3>
                        <button onClick={() => setFlags(f => ({ ...f, unlockedCpf:true, unlockedNome:true, unlockedSobrenome:true, unlockedTel:true }))} className="text-[11px] font-bold uppercase text-zinc-500 flex gap-1"><Pencil size={12}/> Editar</button>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm border-t border-zinc-200 dark:border-zinc-800 pt-4 mb-6">
                        <div><span className="text-[10px] font-bold text-zinc-400 uppercase">CPF</span><span className="block">{formData.cpf}</span></div>
                        <div><span className="text-[10px] font-bold text-zinc-400 uppercase">Telefone</span><span className="block">{formData.telefone_whatsapp || "—"}</span></div>
                      </div>
                      <div className="grid gap-4 border-t border-zinc-200 dark:border-zinc-800 pt-6">
                        <div className={cnInputWrap}><input {...register("data_nascimento")} onChange={e => setValue("data_nascimento", masks.date(e.target.value))} placeholder="DD/MM/AAAA" maxLength={10} className={cnInput} /><label className={cnLabel}>Data de Nascimento</label></div>
                        <div className={cnInputWrap}><input type="email" {...register("email")} className={cnInput} placeholder="seu@email.com" /><label className={cnLabel}>E-mail de Contato</label></div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className={flags.cpfUrl && !flags.unlockedCpf ? "p-4 bg-zinc-50 dark:bg-[#111111] border rounded-xl flex justify-between items-center" : cnInputWrap}>
                        {flags.cpfUrl && !flags.unlockedCpf ? (
                          <><div className="flex flex-col"><span className="text-[10px] font-bold text-zinc-500 uppercase">CPF Vinculado</span><span className="font-mono text-sm">{formData.cpf}</span></div><button onClick={() => setFlags(f => ({...f, unlockedCpf: true}))}><Pencil size={14} className="text-zinc-400"/></button></>
                        ) : (
                          <><input {...register("cpf")} onChange={e => setValue("cpf", masks.cpf(e.target.value))} maxLength={14} placeholder="000.000.000-00" className={`${cnInput} font-mono`} /><label className={cnLabel}>CPF do Paciente</label>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">{context.checkingUser ? <Activity size={16} className="text-zinc-400 animate-spin"/> : formData.cpf?.length === 14 ? <CheckCircle size={16} className="text-zinc-900 dark:text-white"/> : <Search size={16} className="text-zinc-300 dark:text-zinc-700"/>}</div></>
                        )}
                      </div>
                      
                      {formData.cpf?.length === 14 && !context.checkingUser && (
                        <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="space-y-4 pt-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className={cnInputWrap}><input {...register("nome")} className={cnInput} placeholder="Nome" /><label className={cnLabel}>Primeiro Nome</label></div>
                            <div className={cnInputWrap}><input {...register("sobrenome")} className={cnInput} placeholder="Sobrenome" /><label className={cnLabel}>Sobrenome Completo</label></div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <div className={cnInputWrap}><input {...register("data_nascimento")} onChange={e => setValue("data_nascimento", masks.date(e.target.value))} maxLength={10} className={cnInput} placeholder="DD/MM/AAAA"/><label className={cnLabel}>Nascimento</label></div>
                             <div className={cnInputWrap}><input {...register("telefone_whatsapp")} onChange={e => setValue("telefone_whatsapp", masks.phone(e.target.value))} maxLength={15} className={cnInput} placeholder="(00) 90000-0000"/><label className={cnLabel}>WhatsApp</label></div>
                          </div>
                          <div className={cnInputWrap}><input type="email" {...register("email")} className={cnInput} placeholder="seu@email.com"/><label className={cnLabel}>E-mail Pessoal</label></div>
                        </motion.div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="s2" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="max-w-2xl mx-auto space-y-6">
                  <div><h2 className="text-3xl font-medium">Direcionamento</h2><p className="text-zinc-500 text-sm mt-2">Selecione a categoria.</p></div>
                  
                  {flags.exibirConfUri && !flags.confirmouUri ? (
                    <div className="text-center max-w-md mx-auto py-6">
                      <h3 className="text-lg font-medium">Confirmar Especialista?</h3>
                      <div className="my-6 inline-block bg-zinc-50 dark:bg-[#111111] border px-6 py-4 rounded-2xl">
                        <span className="block font-medium">{formData.medico_profissional || formData.subtipo_exame}</span>
                        <span className="block text-[10px] font-bold text-zinc-400 uppercase mt-1">{formData.tipo_servico}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4"><button onClick={() => { setFlags(f => ({...f, exibirConfUri: false})); setValue("medico_profissional", ""); setValue("subtipo_exame", "");}} className="py-3 border rounded-xl font-medium text-sm">Alterar</button><button onClick={() => { setFlags(f => ({...f, confirmouUri: true})); setStep(3); }} className="py-3 bg-zinc-900 text-white dark:bg-white dark:text-black rounded-xl font-medium text-sm">Confirmar</button></div>
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row gap-6 w-full">
                      <div className="w-full md:w-1/3 flex flex-col gap-3">
                        {[{id: "Consulta", i: User}, {id: "Retorno", i: Activity}, {id: "Exame", i: HeartPulse}].map(s => (
                          <button key={s.id} onClick={() => { setValue("tipo_servico", s.id); setValue("medico_profissional", ""); setValue("subtipo_exame", ""); }} className={`p-4 rounded-xl flex items-center gap-4 border text-left w-full ${formData.tipo_servico === s.id ? "border-zinc-900 bg-zinc-50 dark:border-white dark:bg-[#111111]" : "border-zinc-200 dark:border-zinc-800"}`}><s.i size={18} className={formData.tipo_servico === s.id ? "" : "text-zinc-400"} /><span className={`text-sm ${formData.tipo_servico === s.id ? "font-semibold" : "font-medium"}`}>{s.id}</span></button>
                        ))}
                      </div>
                      <div className="w-full md:w-2/3">
                        {["Consulta", "Retorno"].includes(formData.tipo_servico) && (
                          <div><label className="text-[10px] font-bold text-zinc-400 uppercase mb-3 block">Corpo Clínico</label><div className="grid gap-3">{Object.keys(PRECOS).filter(k => k.includes("Dr")).map(m => <button key={m} onClick={() => setValue("medico_profissional", m)} className={`p-4 border rounded-xl text-left text-sm ${formData.medico_profissional === m ? "border-zinc-900 font-semibold bg-zinc-50 dark:border-white dark:bg-[#111111]" : "border-zinc-200 dark:border-zinc-800 font-medium text-zinc-600 dark:text-zinc-400"}`}>{m}</button>)}</div></div>
                        )}
                        {formData.tipo_servico === "Exame" && (
                          <div><label className="text-[10px] font-bold text-zinc-400 uppercase mb-3 block">Exames</label><div className="grid gap-3">{["Endoscopia Digestiva Alta", "Colonoscopia", "Retirada de Balão Gástrico"].map(e => <button key={e} onClick={() => setValue("subtipo_exame", e)} className={`p-4 border rounded-xl text-left text-sm ${formData.subtipo_exame === e ? "border-zinc-900 font-semibold bg-zinc-50 dark:border-white dark:bg-[#111111]" : "border-zinc-200 dark:border-zinc-800 font-medium text-zinc-600 dark:text-zinc-400"}`}>{e}</button>)}</div></div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="s3" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="max-w-lg mx-auto text-center space-y-6">
                  <div><h2 className="text-3xl font-medium">Garantia Financeira</h2><p className="text-zinc-500 text-sm mt-2">Escolha a cobertura.</p></div>
                  {formData.tipo_servico === "Retorno" ? (
                    <div className="p-6 border rounded-2xl"><ShieldCheck className="w-8 h-8 mx-auto mb-4" /><h3 className="text-lg font-medium">Retorno Isento</h3><p className="text-sm text-zinc-500 mt-2">Dentro da janela regulamentar.</p></div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {[{id: "Convênio", i: ShieldCheck, lbl: "Convênio Médico"}, {id: "Particular", i: CreditCard, lbl: "Particular"}].map(m => (
                        <button key={m.id} onClick={() => setValue("modalidade", m.id)} className={`p-6 border rounded-2xl flex flex-col items-center gap-4 ${formData.modalidade === m.id ? "border-zinc-900 bg-zinc-50 dark:border-white dark:bg-[#111111]" : "border-zinc-200 dark:border-zinc-800"}`}><m.i size={24} className={formData.modalidade === m.id ? "" : "text-zinc-400"} /><span className="font-medium text-sm">{m.lbl}</span></button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {step === 4 && (
                <motion.div key="s4" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="max-w-4xl mx-auto">
                  <div className="mb-8"><h2 className="text-3xl font-medium">Agendamento</h2><p className="text-zinc-500 text-sm mt-2">Sincronize uma data.</p></div>
                  <div className="flex flex-col md:flex-row gap-8">
                    
                    <div className="w-full md:w-1/2">
                      <div className="flex justify-between items-center mb-6"><button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="p-1.5"><ChevronLeft size={16}/></button><h3 className="font-medium text-sm capitalize">{calendarMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</h3><button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="p-1.5"><ChevronRight size={16}/></button></div>
                      <div className="grid grid-cols-7 gap-1 text-center mb-2">{['D','S','T','Q','Q','S','S'].map((d,i)=><div key={i} className="text-[10px] font-bold text-zinc-400 uppercase">{d}</div>)}</div>
                      <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() }).map((_, i) => <div key={`e-${i}`} className="aspect-square"/>)}
                        {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }).map((_, i) => {
                          const d = i + 1, y = calendarMonth.getFullYear(), m = calendarMonth.getMonth();
                          const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                          const isPast = dateStr < helpers.getToday() || [0, 6].includes(new Date(y, m, d).getDay());
                          const isSel = formData.data_agendamento === dateStr;
                          return (
                            <button key={d} disabled={isPast} onClick={() => setValue("data_agendamento", dateStr)} className={`aspect-square rounded-xl text-sm transition-all ${isPast ? "opacity-50 cursor-not-allowed text-zinc-300 dark:text-zinc-800" : isSel ? "bg-zinc-900 text-white dark:bg-white dark:text-black font-bold scale-105 shadow-md" : "hover:text-zinc-900 font-medium"}`}>{d}</button>
                          );
                        })}
                      </div>
                    </div>
                    
                    <div className="w-full md:w-1/2">
                      {formData.data_agendamento ? (
                         <div>
                           <div className="flex justify-between border-b pb-4 mb-4"><h4 className="font-medium text-sm">Horários</h4>{agenda.buscando && <Activity size={16} className="text-zinc-400 animate-spin"/>}</div>
                           <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[260px] pr-2">
                             {HORARIOS_BASE.map(h => {
                               const off = agenda.ocupados.includes(h) || (formData.data_agendamento === helpers.getToday() && new Date().setHours(...h.split(':'),0,0) <= Date.now() + 3600000);
                               return <button key={h} disabled={off} onClick={() => setValue("horario_agendamento", h)} className={`py-3 rounded-xl text-sm border ${off ? "border-transparent text-zinc-300 line-through cursor-not-allowed" : formData.horario_agendamento === h ? "bg-zinc-900 text-white dark:bg-white dark:text-black font-medium" : "border-zinc-200 dark:border-zinc-800"}`}>{h}</button>;
                             })}
                           </div>
                         </div>
                      ) : <div className="h-full border border-dashed rounded-2xl flex flex-col items-center justify-center text-zinc-500 min-h-[250px]"><CalendarIcon size={24} className="mb-4 opacity-50"/><p className="text-sm">Selecione uma data</p></div>}
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 5 && (
                <motion.div key="s5" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="max-w-md mx-auto">
                  <div className="text-center mb-6"><h2 className="text-3xl font-medium">Checkout</h2><p className="text-zinc-500 text-sm mt-2">Ambiente seguro verificado.</p></div>
                  <div className="p-8 rounded-3xl border bg-white dark:bg-[#0A0A0A] shadow-sm">
                    <div className="flex justify-between border-b pb-4 mb-4"><span className="text-zinc-500 text-sm">{formData.tipo_servico === "Exame" ? formData.subtipo_exame : formData.medico_profissional}</span><span className="text-sm">R$ {(valorEntrada*2).toFixed(2)}</span></div>
                    <div className="flex justify-between items-center mb-8"><span className="font-medium">Reserva (50%)</span><span className="font-medium text-xl">R$ {valorEntrada.toFixed(2)}</span></div>
                    {process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ? <Payment initialization={{ amount: valorEntrada > 0 ? valorEntrada : 1 }} onSubmit={onSubmitMP} customization={{ paymentMethods: { ticket: "all", bankTransfer: "all", creditCard: "all", debitCard: "all", mercadoPago: "all" }}} /> : <div className="p-4 bg-red-50 text-red-600 rounded-xl text-center text-sm">Credenciais Ausentes.</div>}
                    <button 
                        onClick={simulatePayment}
                        className="w-full mt-4 py-4 bg-indigo-600 text-white font-bold rounded-2xl uppercase tracking-widest text-[12px] hover:bg-indigo-700 transition-colors shadow-md flex items-center justify-center gap-2"
                      >
                        Simular Pagamento Aprovado
                      </button>
                  </div>
                </motion.div>
              )}

              {step === 6 && (
                <motion.div key="s6" initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="flex flex-col items-center justify-center text-center max-w-sm mx-auto py-8">
                  <div className={`w-16 h-16 rounded-full ${pixData ? "bg-indigo-600" : "bg-zinc-900 dark:bg-white"} text-white ${!pixData && "dark:text-black"} flex items-center justify-center mb-6`}>
                    {pixData ? <CreditCard size={32} /> : <CheckCircle size={32} />}
                  </div>
                  
                  {/* TEXTOS ADAPTADOS SE FOR PIX OU CARTÃO */}
                  <h2 className="text-3xl font-medium">{pixData ? "Finalize seu pagamento." : "Agendamento Confirmado."}</h2>
                  <p className="text-zinc-500 mt-3 text-sm">
                    {pixData 
                      ? `Sua vaga para o dia ${formData.data_agendamento?.split("-").reverse().join("/")} às ${formData.horario_agendamento}h está pré-reservada. Efetue o pagamento para garantir o agendamento.` 
                      : `Seu agendamento para o dia ${formData.data_agendamento?.split("-").reverse().join("/")} às ${formData.horario_agendamento}h foi registrado com sucesso.`}
                  </p>

                  {/* SEÇÃO DO PIX CONDICIONAL */}
                  {pixData && (
                    <div className="mt-8 p-6 rounded-2xl border w-full text-center bg-zinc-50 dark:bg-[#111111]">
                      <h3 className="text-[11px] font-bold uppercase text-zinc-500 mb-4 tracking-widest">Escaneie o QR Code</h3>
                      <img
                        src={`data:image/jpeg;base64,${pixData.qr_code_base64}`}
                        alt="QR Code Pix"
                        className="w-48 h-48 mx-auto rounded-xl border p-2 bg-white"
                      />
                      <div className="mt-6">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-2">Ou use o Copia e Cola</span>
                        <div className="flex bg-white dark:bg-black border rounded-xl p-2 items-center">
                          <input readOnly value={pixData.qr_code} className="w-full text-xs bg-transparent outline-none text-zinc-500 px-2 truncate" />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(pixData.qr_code);
                              showIsland("Código copiado!", "success");
                            }}
                            className="bg-zinc-900 text-white dark:bg-white dark:text-black px-4 py-2 rounded-lg text-xs font-bold"
                          >
                            Copiar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-8 p-6 rounded-2xl border w-full text-left bg-zinc-50 dark:bg-[#111111]">
                    <div className="flex justify-between mb-4"><span className="text-[10px] font-bold text-zinc-500 uppercase">Paciente</span><span className="text-sm font-medium">{formData.nome}</span></div>
                    <div className="flex justify-between border-t pt-4"><span className="text-[10px] font-bold text-zinc-500 uppercase">Status</span><span className="text-sm font-mono">{pixData ? "Aguardando Pagamento" : "Confirmado"}</span></div>
                  </div>

                  <a
                    href={pixData 
                      ? `https://wa.me/5584999999999?text=Ol%C3%A1%2C+estou+aguardando+a+confirma%C3%A7%C3%A3o+do+pagamento+da+minha+vaga!`
                      : `https://wa.me/5584999999999?text=Ol%C3%A1%2C+meu+agendamento+foi+confirmado!`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 flex items-center justify-center gap-2 bg-[#25D366] text-white py-4 px-6 rounded-2xl font-bold uppercase tracking-widest text-[12px] hover:bg-[#1ebe57] transition-colors w-full shadow-lg"
                  >
                    Voltar para o WhatsApp
                  </a>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </>
  );
}