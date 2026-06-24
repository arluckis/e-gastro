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
  ArrowRight, CheckCircle, AlertTriangle, Sparkles, 
  ShieldCheck, Calendar as CalendarIcon, CreditCard, 
  Lock, ChevronLeft, ChevronRight, Activity, User, HeartPulse, Search, Pencil
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
  nome: z.string().min(2, "Informe seu nome"),
  sobrenome: z.string().min(2, "Informe seu sobrenome"),
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
  "Dra. Simone": 450, 
  "Dr. Brilhante": 2, 
  "Dr. Tiago Lima": 350, 
  "Dr. Thiago Dyavy": 350, 
  "Dra. Candice (Psicologia)": 200,
  "Endoscopia Digestiva Alta": 500, 
  "Colonoscopia": 750, 
  "Retirada de Balão Gástrico": 1100
};

// --- GRADE DE HORÁRIOS: 1 EM 1 HORA ---
const HORARIOS_BASE = [
  "09:00", "10:00", "11:00", "12:00", "13:00", 
  "14:00", "15:00", "16:00", "17:00", "18:00"
];

const NOME_ETAPAS = ["Sincronização", "Identificação", "Especialidade", "Modalidade", "Agenda", "Checkout", "Concluído"];

export default function AgendamentoPremium() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-white transition-colors duration-500 selection:bg-[#9FC131] selection:text-black">
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center md:pl-[280px]">
          <motion.div 
            animate={{ rotate: 360 }} 
            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} 
            className="w-10 h-10 border-2 border-[#9FC131] border-t-transparent rounded-full" 
          />
        </div>
      }>
        <AgendamentoForm />
      </Suspense>
    </div>
  );
}

function AgendamentoForm() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [islandState, setIslandState] = useState("default");
  const [islandMessage, setIslandMessage] = useState("");
  const timeoutRef = useRef(null);
  const urlInitializedRef = useRef(false);
  
  const [isSmartLink, setIsSmartLink] = useState(false);
  const [personalizedName, setPersonalizedName] = useState("");
  const [dataUltimaConsulta, setDataUltimaConsulta] = useState(null);

  const [calendarMonth, setCalendarMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [horariosOcupados, setHorariosOcupados] = useState([]);
  const [buscandoHorarios, setBuscandoHorarios] = useState(false);

  const [userFound, setUserFound] = useState(false);
  const [checkingUser, setCheckingUser] = useState(false);

  // Controle de edição para campos oriundos da URL
  const [fieldsFromUrl, setFieldsFromUrl] = useState({
    cpf: false, nome: false, sobrenome: false, telefone_whatsapp: false
  });
  const [unlockedFields, setUnlockedFields] = useState({
    cpf: false, nome: false, sobrenome: false, telefone_whatsapp: false
  });

  // Gerenciamento do fluxo de direcionamento inteligente por URI
  const [confirmouMedicoUri, setConfirmouMedicoUri] = useState(false);
  const [exibirConfirmacaoUri, setExibirConfirmacaoUri] = useState(false);

  const { register, watch, trigger, setValue, formState: { errors }, reset } = useForm({
    resolver: zodResolver(agendamentoSchema),
    mode: "onChange"
  });
  const formData = watch();

  const progressPercentage = (['nome', 'sobrenome', 'cpf', 'telefone_whatsapp', 'data_nascimento', 'email'].filter(field => {
    const val = formData[field];
    return val && val.length > 0 && !errors[field];
  }).length / 6) * 100;

  const showIslandMessage = (msg, type = "error") => {
    setIslandMessage(msg); 
    setIslandState(type);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (type !== "loading" && type !== "success" && step !== 6) {
      timeoutRef.current = setTimeout(() => setIslandState("default"), 3000); 
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
    if (urlInitializedRef.current) return;

    const nomeUrl = searchParams.get("nome");
    const cpfUrl = searchParams.get("cpf");
    const paramCodResposta = searchParams.get("medico"); 

    if (nomeUrl && cpfUrl) {
      urlInitializedRef.current = true;
      
      const partesNome = nomeUrl.trim().split(" ");
      const primeiroNome = partesNome[0] || "";
      const sobrenomeCompleto = partesNome.slice(1).join(" ") || "";

      setValue("nome", primeiroNome);
      setValue("sobrenome", sobrenomeCompleto);
      setPersonalizedName(primeiroNome); 
      setValue("cpf", maskCPF(cpfUrl));
      
      const urlHasPhone = !!searchParams.get("whatsapp");
      if (urlHasPhone) {
        setValue("telefone_whatsapp", maskPhone(searchParams.get("whatsapp")));
      }

      setFieldsFromUrl({
        cpf: true,
        nome: true,
        sobrenome: sobrenomeCompleto.length > 0,
        telefone_whatsapp: urlHasPhone
      });

      if (paramCodResposta && MAPA_SERVICOS[paramCodResposta]) {
        const mapeamento = MAPA_SERVICOS[paramCodResposta];
        setValue("tipo_servico", mapeamento.tipo);
        
        if (mapeamento.medico) {
          setValue("medico_profissional", mapeamento.medico);
        }
        if (mapeamento.exame) {
          setValue("subtipo_exame", mapeamento.exame);
        }
        setExibirConfirmacaoUri(true);
      } 
      else if (paramCodResposta) {
        setValue("medico_profissional", paramCodResposta);
        setExibirConfirmacaoUri(true);
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
        if (data.nome_completo) {
          const partes = data.nome_completo.trim().split(" ");
          setValue("nome", partes[0] || "");
          setValue("sobrenome", partes.slice(1).join(" ") || "");
        }
        setValue("telefone_whatsapp", data.telefone_whatsapp || "");
        setValue("email", data.email || "");
        if (data.data_nascimento) {
            const [year, month, day] = data.data_nascimento.split('-');
            setValue("data_nascimento", `${day}/${month}/${year}`);
        }
        setUserFound(true); 
        showIslandMessage("Bem-vindo de volta!", "success");
        setTimeout(() => setIslandState("default"), 2000);
      } else { 
        setUserFound(false); 
      }
    } catch (e) { 
      console.error(e); 
    } finally { 
      setCheckingUser(false); 
    }
  };

  useEffect(() => {
    if (formData.cpf?.length === 14 && !userFound && step === 1) {
      handleCpfLookup();
    }
  }, [formData.cpf]);

  useEffect(() => {
    const buscarDisponibilidade = async () => {
      if (!formData.data_agendamento) return;
      const profesional = formData.tipo_servico === "Exame" ? formData.subtipo_exame : formData.medico_profissional;
      if (!profesional) return;

      setBuscandoHorarios(true); 
      setValue("horario_agendamento", ""); 

      try {
        const { data: ag } = await supabase.from("agendamentos").select("horario_agendamento, medico_profissional, subtipo_exame").eq("data_agendamento", formData.data_agendamento);
        const { data: bl } = await supabase.from("bloqueios_horarios").select("horario, medico_profissional").eq("data", formData.data_agendamento);

        const checkMatch = (nomeDB) => {
          if (!nomeDB) return false;
          if (nomeDB === "Todos") return true;
          const nForm = profesional.toLowerCase().replace(/dra\.|dr\./g, "").trim();
          const nDb = nomeDB.toLowerCase();
          const primeiroNomeForm = nForm.split(" ")[0]; 
          return nDb.includes(nForm) || nForm.includes(nDb) || nDb.includes(primeiroNomeForm);
        };

        const slotsAgendados = ag?.filter(a => checkMatch(a.medico_profissional) || checkMatch(a.subtipo_exame)).map(a => a.horario_agendamento.substring(0,5)) || [];
        const slotsBloqueados = bl?.filter(b => checkMatch(b.medico_profissional)).map(b => b.horario.substring(0,5)) || [];
        setHorariosOcupados([...new Set([...slotsAgendados, ...slotsBloqueados])]);
      } catch (error) {
        console.error(error);
      } finally { 
        setBuscandoHorarios(false); 
      }
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
      const nomeCompletoStr = `${formData.nome} ${formData.sobrenome}`.trim();

      if (pacienteExistente) {
        pacienteId = pacienteExistente.id;
        await supabase.from("pacientes").update({
          nome_completo: nomeCompletoStr, 
          telefone_whatsapp: formData.telefone_whatsapp, 
          email: formData.email, 
          data_nascimento: dbDate
        }).eq("id", pacienteId);
      } else {
        const { data: novoPaciente, error: erroInsert } = await supabase.from("pacientes").insert({
          nome_completo: nomeCompletoStr, 
          cpf: formData.cpf, 
          telefone_whatsapp: formData.telefone_whatsapp, 
          email: formData.email, 
          data_nascimento: dbDate
        }).select().single();
        
        if (erroInsert) throw erroInsert;
        pacienteId = novoPaciente.id;
      }

      const { error: erroAgendamento } = await supabase.from("agendamentos").insert({
        paciente_id: pacienteId, 
        tipo_servico: formData.tipo_servico, 
        subtipo_exame: formData.subtipo_exame || null,
        medico_profissional: formData.medico_profissional || "A definir", 
        modalidade: formData.modalidade || "Não se aplica",
        data_agendamento: formData.data_agendamento, 
        horario_agendamento: formData.horario_agendamento,
        status_pagamento_antecipado: status_pagamento, 
        valor_total: getValorConsulta()
      });
      
      if (erroAgendamento) throw erroAgendamento;
      return true;
    } catch (error) { 
      return false; 
    }
  };

  const dispararWebhook = async (status_pagamento) => {
    const url = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
    if (!url) return;
    try { 
      await fetch(url, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({
          ...formData, 
          nome_completo: `${formData.nome} ${formData.sobrenome}`.trim(), 
          status_pagamento, 
          data_criacao: new Date().toISOString()
        }) 
      }); 
    } catch (e) {
      console.error(e);
    }
  };

  const nextStep = async () => {
    setLoading(true); 
    setIslandState("loading");

    try {
      if (step === 0) { 
        setIslandState("default"); 
        setLoading(false); 
        setStep(1); 
        return; 
      }

      if (step === 1) {
        const isValid = await trigger(["cpf", "nome", "sobrenome", "telefone_whatsapp", "data_nascimento", "email"]);
        if (!isValid) { 
          showIslandMessage("Preencha os campos obrigatórios corretamente."); 
          setLoading(false); 
          return; 
        }
      }

      if (step === 2) {
        if (exibirConfirmacaoUri && confirmouMedicoUri) {
          setIslandState("default"); 
          setLoading(false); 
          setStep(3); 
          return;
        }

        if (!formData.tipo_servico) { 
          showIslandMessage("Selecione um serviço."); 
          setLoading(false); 
          return; 
        }
        if ((formData.tipo_servico === "Consulta" || formData.tipo_servico === "Retorno") && !formData.medico_profissional) { 
          showIslandMessage("Selecione o profissional."); 
          setLoading(false); 
          return; 
        }
        if (formData.tipo_servico === "Exame" && !formData.subtipo_exame) { 
          showIslandMessage("Selecione o exame."); 
          setLoading(false); 
          return; 
        }
        
        if (formData.medico_profissional === "Dra. Simone") {
          const { data: paciente } = await supabase.from("pacientes").select("id").eq("cpf", formData.cpf).maybeSingle();
          if (!paciente) { 
            showIslandMessage("A Dra. Simone atende apenas retornos."); 
            setLoading(false); 
            return; 
          }
          const { data: historico } = await supabase.from("agendamentos").select("id").eq("paciente_id", paciente.id).limit(1).maybeSingle();
          if (!historico) { 
            showIslandMessage("Sem consultas finalizadas com a Dra. Simone."); 
            setLoading(false); 
            return; 
          }
        }

        if (formData.tipo_servico === "Retorno") {
          const { data: paciente } = await supabase.from("pacientes").select("id").eq("cpf", formData.cpf).maybeSingle();
          if (!paciente) { 
            showIslandMessage("Cadastro não encontrado para retorno."); 
            setLoading(false); 
            return; 
          }
          const { data: ult } = await supabase.from("agendamentos").select("data_agendamento").eq("paciente_id", paciente.id).eq("tipo_servico", "Consulta").order("data_agendamento", { ascending: false }).limit(1).maybeSingle();
          if (!ult) { 
            showIslandMessage("Não encontramos uma consulta anterior."); 
            setLoading(false); 
            return; 
          }
          setDataUltimaConsulta(new Date(ult.data_agendamento));
        }

        if (formData.tipo_servico === "Exame" && ["Endoscopia Digestiva Alta", "Colonoscopia"].includes(formData.subtipo_exame)) {
          if (calculateAge(formData.data_nascimento) >= 65) {
             if (!window.confirm("ALERTA DE RISCO CIRÚRGICO:\nPacientes 65+ exigem liberação cardiológica. Confirma ciência?")) { 
               setIslandState("default"); 
               setLoading(false); 
               return; 
             }
          }
        }
      }

      if (step === 3) {
        if (!formData.modalidade && formData.tipo_servico !== "Retorno") { 
          showIslandMessage("Defina Convênio ou Particular."); 
          setLoading(false); 
          return; 
        }
      }

      if (step === 4) {
        if (!formData.data_agendamento || !formData.horario_agendamento) { 
          showIslandMessage("Escolha um dia e um horário."); 
          setLoading(false); 
          return; 
        }
        
        if (formData.tipo_servico === "Retorno" && dataUltimaConsulta) {
          const diffDays = Math.ceil(Math.abs(new Date(formData.data_agendamento).getTime() - dataUltimaConsulta.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > 30) { 
            showIslandMessage(`Última consulta há ${diffDays} dias. Máximo é 30.`); 
            setLoading(false); 
            return; 
          }
        }

        if (formData.tipo_servico === "Retorno" || formData.modalidade === "Convênio") {
          const salvo = await salvarNoBanco(false);
          if (salvo) {
            await dispararWebhook(false);
            showIslandMessage("Agendamento Concluído!", "success"); 
            setLoading(false); 
            setStep(6); 
            return;
          }
          showIslandMessage("Erro ao salvar agendamento."); 
          setLoading(false); 
          return;
        }

        setStep(5); 
        setLoading(false); 
        setIslandState("default"); 
        return;
      }

      setIslandState("default"); 
      setLoading(false); 
      setStep(p => p + 1);
    } catch (err) { 
      showIslandMessage("Instabilidade temporária."); 
      setLoading(false); 
    }
  };

  // --- LÓGICA DE VOLTAR ---
  const prevStep = () => { 
    setIslandState("default"); 
    
    // Se estivesse no pagamento (3) e veio de um smart link confirmado (2)
    if (step === 3 && exibirConfirmacaoUri && confirmouMedicoUri) {
      setConfirmouMedicoUri(false);
      setStep(2);
      return;
    }
    
    // Volta controlada via estado
    if (step > 1) {
      setStep(prev => prev - 1);
    }
  };

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
            ...param.formData, 
            amount: valorEntrada, 
            description: `Entrada - ${formData.medico_profissional || formData.subtipo_exame}` 
          })
        });
        const data = await res.json();
        
        if (data.success && (data.status === "approved" || data.status === "in_process")) {
           const salvo = await salvarNoBanco(true); 
           if (!salvo) { 
             showIslandMessage("Pagamento OK, erro ao salvar. Contate o suporte."); 
             resolve(); 
             return; 
           }
           await dispararWebhook(true);
           showIslandMessage("Pagamento Aprovado!", "success"); 
           setStep(6); 
           resolve();
        } else { 
          showIslandMessage(data.error || "Pagamento recusado pela operadora."); 
          resolve(); 
        }
      } catch (error) { 
        showIslandMessage("Erro de comunicação com o banco."); 
        resolve(); 
      }
    });
  };

  const toggleFieldUnlock = (field) => {
    setUnlockedFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // Física Jitter / Apple
  const springTransition = { type: "spring", stiffness: 420, damping: 34 };
  const containerVariants = { 
    hidden: { opacity: 0 }, 
    show: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.02 } }, 
    exit: { opacity: 0, transition: { duration: 0.15 } } 
  };
  const itemVariants = { 
    hidden: { opacity: 0, y: 15, filter: "blur(4px)", scale: 0.98 }, 
    show: { opacity: 1, y: 0, filter: "blur(0px)", scale: 1, transition: springTransition } 
  };
  
  // text-[16px] crucial para impedir o zoom do iOS
  const inputContainerClass = "relative rounded-2xl bg-white dark:bg-[#131B2E]/40 border border-slate-300 dark:border-[#222F4D]/70 shadow-[inner_0_2px_4px_rgba(0,0,0,0.02)] dark:shadow-[inner_0_2px_4px_rgba(0,0,0,0.2)] transition-all duration-300 focus-within:bg-slate-50 dark:focus-within:bg-[#111827] focus-within:border-[#9FC131] dark:focus-within:border-[#9FC131] focus-within:ring-4 focus-within:ring-[#9FC131]/20 dark:focus-within:ring-[#9FC131]/8 overflow-hidden";
  const inputClass = "w-full p-4 pt-6 bg-transparent outline-none text-slate-900 dark:text-white font-semibold text-[16px] peer placeholder-transparent";
  const labelClass = "absolute left-4 top-2 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:top-5 peer-placeholder-shown:text-[13px] peer-placeholder-shown:font-medium peer-focus:top-2 peer-focus:text-[9px] peer-focus:font-black peer-focus:text-[#9FC131]";

  const renderCalendar = () => {
    const y = calendarMonth.getFullYear(); 
    const m = calendarMonth.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const firstDay = new Date(y, m, 1).getDay();
    const today = getLocalTodayStr();
    let days = [];
    
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square" />);
    }
    
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
          whileHover={!isPast ? { scale: 1.05 } : {}}
          whileTap={!isPast ? { scale: 0.95 } : {}}
          key={day} 
          disabled={isPast} 
          onClick={(e) => { 
            e.preventDefault(); 
            setValue("data_agendamento", dateStr); 
            setIslandState("default"); 
          }} 
          className={`aspect-square w-full rounded-xl flex flex-col items-center justify-center text-sm font-bold transition-all duration-200 relative
            ${isPast ? "text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-50 dark:opacity-20 bg-transparent" : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1E293B] hover:text-slate-900 dark:hover:text-white"} 
            ${isToday && !isSel && !isPast ? "text-[#9FC131] border border-[#9FC131]/30 bg-[#9FC131]/5" : ""}
            ${isSel ? "bg-[#9FC131] text-white dark:text-[#090D16] shadow-lg shadow-[#9FC131]/20 dark:shadow-[#9FC131]/10 scale-[1.05] z-10 font-black" : ""}
          `}
        >
          {day}
          {isToday && !isSel && !isPast && <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-[#9FC131]" />}
        </motion.button>
      );
    }
    return days;
  };

  const handlePrevMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  const handleNextMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-start md:justify-center p-0 md:p-6 lg:p-8 pt-8 md:pt-20 md:pl-[280px] overflow-hidden antialiased">
      <Navbar />
      
      {/* Luzes de Fundo de Alta Costura UI */}
      <div className="absolute top-[-25%] left-[5%] w-[70vw] h-[70vw] bg-[#9FC131]/5 dark:bg-[#9FC131]/3 rounded-full blur-[120px] dark:blur-[150px] pointer-events-none -z-10 transition-colors duration-700" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-[#2563EB]/5 dark:bg-[#2563EB]/4 rounded-full blur-[130px] dark:blur-[160px] pointer-events-none -z-10 transition-colors duration-700" />

      {/* --- ILHA DINÂMICA COMPACTA --- */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 md:translate-x-[calc(-50%+140px)] z-[9999] flex justify-center pointer-events-none w-full px-4 transition-transform duration-500">
        <motion.div 
          layout 
          transition={{ type: "spring", stiffness: 450, damping: 35 }} 
          className={`pointer-events-auto rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex items-center px-6 py-3 border backdrop-blur-3xl max-w-sm overflow-hidden transition-colors duration-300
          ${islandState === "error" ? "bg-rose-50 dark:bg-rose-500/90 border-rose-200 dark:border-rose-400/30 text-rose-600 dark:text-white" : 
            islandState === "success" ? "bg-[#9FC131]/10 dark:bg-[#9FC131]/90 border-[#9FC131]/30 text-slate-900 dark:text-[#090D16]" : 
            islandState === "loading" ? "bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white" :
            "bg-white/80 dark:bg-[#111827]/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"}`}
        >
          <AnimatePresence mode="wait">
            {islandState === "error" && (
               <motion.div 
                 key="err" 
                 initial={{ opacity: 0, scale: 0.95 }} 
                 animate={{ opacity: 1, scale: 1 }} 
                 exit={{ opacity: 0 }} 
                 className="flex items-center gap-2 text-xs font-bold"
               >
                 <AlertTriangle size={15} /> 
                 <span className="truncate">{islandMessage}</span>
               </motion.div>
            )}
            {islandState === "success" && (
               <motion.div 
                 key="suc" 
                 initial={{ opacity: 0, scale: 0.95 }} 
                 animate={{ opacity: 1, scale: 1 }} 
                 exit={{ opacity: 0 }} 
                 className="flex items-center gap-2 text-xs font-bold"
               >
                 <CheckCircle size={15} /> 
                 <span className="truncate">{islandMessage}</span>
               </motion.div>
            )}
            {islandState === "loading" && (
              <motion.div 
                key="load" 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="flex items-center gap-3 text-xs font-bold"
              >
                 <motion.div 
                   animate={{ rotate: 360 }} 
                   transition={{ repeat: Infinity, ease: "linear", duration: 0.8 }}
                 >
                   <Activity size={15} className="text-[#9FC131]" />
                 </motion.div> 
                 {islandMessage || "Processando..."}
              </motion.div>
            )}
            {islandState === "default" && (
              <motion.div 
                key="def" 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="flex items-center gap-4 mx-auto"
              >
                 <div className="flex gap-1.5 items-center shrink-0">
                   {NOME_ETAPAS.slice(1, 6).map((_, i) => (
                     <div 
                       key={i} 
                       className={`h-1 rounded-full transition-all duration-300 ${step === i + 1 ? "w-5 bg-[#9FC131]" : step > i + 1 ? "w-1 bg-[#9FC131]/30" : "w-1 bg-slate-200 dark:bg-slate-800"}`} 
                     />
                   ))}
                 </div>
                 <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-l border-slate-300 dark:border-slate-800 pl-4">
                   {NOME_ETAPAS[step]}
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Frame de Vidro Premium Nível Linear/Vercel */}
      <motion.div 
        layout 
        transition={springTransition} 
        className="w-full max-w-[980px] h-full md:h-[85vh] md:max-h-[730px] bg-white/60 dark:bg-[#0D1424]/70 md:backdrop-blur-3xl md:rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.05)] dark:shadow-[0_50px_100px_rgba(0,0,0,0.6)] border-t md:border border-slate-200/80 dark:border-[#1E293B]/60 flex flex-col relative z-10 overflow-hidden rounded-t-[2rem]"
      >
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {/* pb-[180px] GARANTE que os inputs nunca vão ficar escondidos atrás da dock/rodapé */}
          <div className="p-6 md:p-12 lg:p-14 min-h-full flex flex-col justify-start md:justify-center pb-[180px] md:pb-32 pt-16 md:pt-12">
            <AnimatePresence mode="wait">
              
              {step === 0 && (
                <motion.div 
                  key="s0" 
                  variants={containerVariants} 
                  initial="hidden" 
                  animate="show" 
                  exit="exit" 
                  className="flex flex-col items-center justify-center text-center gap-5 m-auto max-w-md"
                >
                  <motion.div 
                    variants={itemVariants} 
                    className="w-16 h-16 bg-gradient-to-br from-[#9FC131] to-[#738c23] rounded-2xl flex items-center justify-center shadow-lg shadow-[#9FC131]/20 dark:shadow-[#9FC131]/10 mb-2 transform rotate-3"
                  >
                    <Sparkles className="text-white dark:text-black w-7 h-7" />
                  </motion.div>
                  <motion.div variants={itemVariants}>
                    <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                      Olá, {personalizedName}!
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 mt-3 text-base font-medium leading-relaxed">
                      Conectamos o seu painel de agendamento ao ambiente clínico em segurança.
                    </p>
                  </motion.div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div 
                  key="s1" 
                  variants={containerVariants} 
                  initial="hidden" 
                  animate="show" 
                  exit="exit" 
                  className="flex flex-col gap-6 w-full max-w-2xl mx-auto"
                >
                  
                  <motion.div variants={itemVariants} className="border-b border-slate-200 dark:border-slate-800/80 pb-4">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      Dados de Acesso
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-xs">
                      Por favor, verifique ou insira as informações de atendimento.
                    </p>
                    
                    {formData.cpf?.length === 14 && (
                      <div className="w-full mt-4">
                        <div className="flex justify-between items-center text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                          <span>Validação cadastral</span>
                          <span>{Math.round(progressPercentage)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-[#162035] h-1 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }} 
                            animate={{ width: `${progressPercentage}%` }} 
                            className="h-full bg-[#9FC131]" 
                            transition={{ duration: 0.4 }} 
                          />
                        </div>
                      </div>
                    )}
                  </motion.div>

                  {isSmartLink && !unlockedFields.cpf && !unlockedFields.nome && !unlockedFields.sobrenome && !unlockedFields.telefone_whatsapp ? (
                    <motion.div 
                      variants={itemVariants} 
                      className="p-6 md:p-8 rounded-2xl bg-white dark:bg-gradient-to-b dark:from-[#131B30] dark:to-[#0E1527] border border-slate-200 dark:border-[#223052]/80 shadow-sm dark:shadow-xl relative overflow-hidden group"
                    >
                      {/* Título e Botão com Flexbox para evitar sobreposição */}
                      <div className="flex justify-between items-start mb-2 gap-4">
                        <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white leading-tight">
                          Seja bem-vindo ao agendamento da E-gastro, <span className="text-[#9FC131]">{formData.nome} {formData.sobrenome}</span>!
                        </h3>
                        
                        <motion.button 
                          whileHover={{ scale: 1.05 }} 
                          whileTap={{ scale: 0.95 }}
                          type="button" 
                          onClick={() => {
                            setUnlockedFields({ cpf: true, nome: true, sobrenome: true, telefone_whatsapp: true });
                          }} 
                          className="shrink-0 p-2 bg-slate-100 dark:bg-[#1A2642] hover:bg-slate-200 dark:hover:bg-[#24345A] border border-slate-300 dark:border-[#2D3F6A] rounded-xl text-slate-700 dark:text-[#9FC131] transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider shadow-sm"
                        >
                          <Pencil size={11} /> Ajustar
                        </motion.button>
                      </div>
                      
                      <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-medium text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-[#1C2844] border-dashed">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block w-16">Seu CPF:</span>
                            <span className="text-slate-800 dark:text-slate-200 font-mono tracking-wider">{formData.cpf}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block w-16">Telefone:</span>
                            <span className="text-slate-800 dark:text-slate-200">{formData.telefone_whatsapp || "Não fornecido"}</span>
                          </div>
                        </div>
                      </div>

                      <input type="hidden" {...register("cpf")} />
                      <input type="hidden" {...register("nome")} />
                      <input type="hidden" {...register("sobrenome")} />
                      <input type="hidden" {...register("telefone_whatsapp")} />

                      <div className="mt-5 pt-4 border-t border-slate-200 dark:border-[#1C2844] relative z-10">
                        <div className={inputContainerClass}>
                          <input 
                            {...register("data_nascimento")} 
                            onChange={(e) => setValue("data_nascimento", maskDate(e.target.value))}
                            placeholder="DD/MM/AAAA" 
                            maxLength={10} 
                            className={inputClass} 
                          />
                          <label className={labelClass}>Data de Nascimento</label>
                        </div>
                        <div className={`${inputContainerClass} mt-4`}>
                          <input 
                            type="email" 
                            {...register("email")} 
                            className={inputClass} 
                            placeholder="seu@email.com" 
                          />
                          <label className={labelClass}>E-mail de Contato</label>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="space-y-4">
                      <motion.div 
                        variants={itemVariants} 
                        className={fieldsFromUrl.cpf && !unlockedFields.cpf ? "relative rounded-2xl bg-slate-50 dark:bg-[#141C30]/50 border border-slate-200 dark:border-[#202E4E] opacity-90 dark:opacity-70 p-4 flex justify-between items-center" : inputContainerClass}
                      >
                        {fieldsFromUrl.cpf && !unlockedFields.cpf ? (
                          <>
                            <div>
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">CPF Vinculado</span>
                              <span className="text-slate-800 dark:text-slate-200 font-bold tracking-wider text-sm">{formData.cpf}</span>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => toggleFieldUnlock("cpf")} 
                              className="p-2 bg-slate-200 dark:bg-[#1A253E] border border-slate-300 dark:border-[#2A3B63] rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                            >
                              <Pencil size={12} />
                            </button>
                          </>
                        ) : (
                          <>
                            <input 
                              {...register("cpf")} 
                              onChange={(e) => setValue("cpf", maskCPF(e.target.value))} 
                              className={`${inputClass} tracking-wider`} 
                              placeholder="000.000.000-00" 
                              maxLength={14} 
                            />
                            <label className={labelClass}>CPF</label>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                              {checkingUser ? (
                                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity }}>
                                  <Activity size={16} className="text-[#9FC131]"/>
                                </motion.div>
                              ) : (
                                <Search size={16} className="text-slate-400 dark:text-slate-600"/>
                              )}
                            </div>
                          </>
                        )}
                      </motion.div>

                      <AnimatePresence>
                        {formData.cpf?.length === 14 && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }} 
                            animate={{ opacity: 1, height: "auto" }} 
                            exit={{ opacity: 0, height: 0 }} 
                            className="space-y-4"
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className={fieldsFromUrl.nome && !unlockedFields.nome ? "relative rounded-2xl bg-slate-50 dark:bg-[#141C30]/50 border border-slate-200 dark:border-[#202E4E] opacity-90 dark:opacity-70 p-4 flex justify-between items-center" : inputContainerClass}>
                                {fieldsFromUrl.nome && !unlockedFields.nome ? (
                                  <>
                                    <div>
                                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Nome</span>
                                      <span className="text-slate-800 dark:text-slate-200 font-bold text-sm">{formData.nome}</span>
                                    </div>
                                    <button 
                                      type="button" 
                                      onClick={() => toggleFieldUnlock("nome")} 
                                      className="p-2 bg-slate-200 dark:bg-[#1A253E] border border-slate-300 dark:border-[#2A3B63] rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <input {...register("nome")} className={inputClass} placeholder="Nome" />
                                    <label className={labelClass}>Nome</label>
                                  </>
                                )}
                              </div>

                              <div className={fieldsFromUrl.sobrenome && !unlockedFields.sobrenome ? "relative rounded-2xl bg-slate-50 dark:bg-[#141C30]/50 border border-slate-200 dark:border-[#202E4E] opacity-90 dark:opacity-70 p-4 flex justify-between items-center" : inputContainerClass}>
                                {fieldsFromUrl.sobrenome && !unlockedFields.sobrenome ? (
                                  <>
                                    <div>
                                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Sobrenome</span>
                                      <span className="text-slate-800 dark:text-slate-200 font-bold text-sm">{formData.sobrenome || "Vazio"}</span>
                                    </div>
                                    <button 
                                      type="button" 
                                      onClick={() => toggleFieldUnlock("sobrenome")} 
                                      className="p-2 bg-slate-200 dark:bg-[#1A253E] border border-slate-300 dark:border-[#2A3B63] rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <input {...register("sobrenome")} className={inputClass} placeholder="Sobrenome" />
                                    <label className={labelClass}>Sobrenome</label>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className={inputContainerClass}>
                                <input 
                                  {...register("data_nascimento")} 
                                  onChange={(e) => setValue("data_nascimento", maskDate(e.target.value))} 
                                  placeholder="DD/MM/AAAA" 
                                  maxLength={10} 
                                  className={inputClass} 
                                />
                                <label className={labelClass}>Nascimento</label>
                              </div>

                              <div className={fieldsFromUrl.telefone_whatsapp && !unlockedFields.telefone_whatsapp ? "relative rounded-2xl bg-slate-50 dark:bg-[#141C30]/50 border border-slate-200 dark:border-[#202E4E] opacity-90 dark:opacity-70 p-4 flex justify-between items-center" : inputContainerClass}>
                                {fieldsFromUrl.telefone_whatsapp && !unlockedFields.telefone_whatsapp ? (
                                  <>
                                    <div>
                                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">WhatsApp</span>
                                      <span className="text-slate-800 dark:text-slate-200 font-bold text-sm">{formData.telefone_whatsapp}</span>
                                    </div>
                                    <button 
                                      type="button" 
                                      onClick={() => toggleFieldUnlock("telefone_whatsapp")} 
                                      className="p-2 bg-slate-200 dark:bg-[#1A253E] border border-slate-300 dark:border-[#2A3B63] rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <input 
                                      {...register("telefone_whatsapp")} 
                                      onChange={(e) => setValue("telefone_whatsapp", maskPhone(e.target.value))} 
                                      className={inputClass} 
                                      placeholder="(00) 90000-0000" 
                                      maxLength={15} 
                                    />
                                    <label className={labelClass}>WhatsApp</label>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className={inputContainerClass}>
                              <input 
                                type="email" 
                                {...register("email")} 
                                className={inputClass} 
                                placeholder="seu@email.com" 
                              />
                              <label className={labelClass}>E-mail</label>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              )}

              {step === 2 && (
                <motion.div 
                  key="s2" 
                  variants={containerVariants} 
                  initial="hidden" 
                  animate="show" 
                  exit="exit" 
                  className="flex flex-col gap-6 w-full"
                >
                  <motion.div variants={itemVariants} className="border-b border-slate-200 dark:border-slate-800 pb-3">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Especialidade Médica</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-xs mt-1">Selecione o profissional e o tipo de agenda desejada.</p>
                  </motion.div>

                  {exibirConfirmacaoUri && !confirmouMedicoUri ? (
                    <motion.div 
                      variants={itemVariants} 
                      className="max-w-xl mx-auto w-full bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:shadow-2xl flex flex-col items-center text-center gap-5"
                    >
                      <div className="w-12 h-12 bg-[#9FC131]/10 text-[#9FC131] rounded-xl flex items-center justify-center border border-[#9FC131]/20">
                        <User size={22} />
                      </div>
                      <div>
                        <span className="text-[9px] font-black tracking-widest text-[#9FC131] uppercase bg-[#9FC131]/10 px-3 py-1 rounded-full border border-[#9FC131]/10">
                          Direcionamento Inteligente
                        </span>
                        <h3 className="text-xl font-black mt-3 text-slate-900 dark:text-white">
                          Confirmar Profissional Pré-Selecionado?
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400 text-xs mt-2 max-w-sm mx-auto">
                          De acordo com seu atendimento no WhatsApp, preparamos sua agenda com o seguinte especialista:
                        </p>
                      </div>
                      
                      <div className="w-full bg-slate-50 dark:bg-[#162035] border border-slate-200 dark:border-slate-800 rounded-xl p-4 max-w-xs">
                        <span className="text-sm font-bold text-slate-900 dark:text-white block">
                          {formData.medico_profissional || formData.subtipo_exame}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 block">
                          {formData.tipo_servico}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 w-full max-w-xs mt-3">
                        <motion.button 
                          whileHover={{ scale: 1.05 }} 
                          whileTap={{ scale: 0.95 }}
                          type="button"
                          onClick={() => {
                            setConfirmouMedicoUri(true);
                            setStep(3);
                            setIslandState("default");
                          }}
                          className="p-3 bg-[#9FC131] text-[#090D16] font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-[#9FC131]/20"
                        >
                          Sim, está correto
                        </motion.button>
                        
                        <motion.button 
                          whileHover={{ scale: 1.05 }} 
                          whileTap={{ scale: 0.95 }}
                          type="button"
                          onClick={() => {
                            setExibirConfirmacaoUri(false);
                            setValue("medico_profissional", "");
                            setValue("subtipo_exame", "");
                          }}
                          className="p-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-xs uppercase tracking-wider rounded-xl border border-slate-300 dark:border-slate-700"
                        >
                          Não, alterar
                        </motion.button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
                      <div className="w-full lg:w-1/3 flex flex-col gap-2">
                        {[ 
                          {id: "Consulta", icon: User}, 
                          {id: "Retorno", icon: Activity}, 
                          {id: "Exame", icon: HeartPulse} 
                        ].map((serv) => (
                          <motion.button 
                            variants={itemVariants} 
                            whileHover={{ scale: 1.02 }} 
                            whileTap={{ scale: 0.98 }} 
                            key={serv.id} 
                            onClick={(e) => { 
                              e.preventDefault(); 
                              setValue("tipo_servico", serv.id); 
                              setValue("medico_profissional", ""); 
                              setValue("subtipo_exame", ""); 
                              setIslandState("default"); 
                            }} 
                            className={`p-4 rounded-xl flex items-center gap-3 transition-all duration-300 border text-left w-full ${formData.tipo_servico === serv.id ? "border-[#9FC131] bg-[#9FC131]/5 text-[#9FC131] shadow-sm" : "border-slate-200 dark:border-slate-800/80 bg-white dark:bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"}`}
                          >
                            <serv.icon 
                              size={16} 
                              className={formData.tipo_servico === serv.id ? "text-[#9FC131]" : "text-slate-400 dark:text-slate-500"} 
                            />
                            <span className={`font-bold text-sm ${formData.tipo_servico === serv.id ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-white"}`}>
                              {serv.id}
                            </span>
                          </motion.button>
                        ))}
                      </div>

                      <div className="w-full lg:w-2/3 min-h-[200px]">
                        <AnimatePresence mode="wait">
                          {(formData.tipo_servico === "Consulta" || formData.tipo_servico === "Retorno") && (
                            <motion.div 
                              key="med" 
                              initial={{ opacity: 0, x: 20 }} 
                              animate={{ opacity: 1, x: 0 }} 
                              exit={{ opacity: 0, x: -20 }} 
                              className="w-full"
                            >
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 block mb-3">
                                Corpo Clínico
                              </label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {Object.keys(PRECOS).filter(k => k.includes("Dr") || k.includes("Dra")).map((medico) => (
                                  <motion.button 
                                    whileHover={{ scale: 1.02 }} 
                                    whileTap={{ scale: 0.98 }} 
                                    key={medico} 
                                    onClick={(e) => { 
                                      e.preventDefault(); 
                                      setValue("medico_profissional", medico); 
                                      setIslandState("default"); 
                                    }} 
                                    className={`w-full flex items-center p-3.5 border rounded-xl transition-all duration-300 text-left ${formData.medico_profissional === medico ? "border-[#9FC131] bg-slate-50 dark:bg-[#162035] shadow-sm" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]/40 hover:bg-slate-50 dark:hover:bg-slate-900"}`}
                                  >
                                    <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center shrink-0 ${formData.medico_profissional === medico ? "border-[#9FC131]" : "border-slate-300 dark:border-slate-700"}`}>
                                      {formData.medico_profissional === medico && (
                                        <motion.div layoutId="medico-dot" className="w-2 h-2 bg-[#9FC131] rounded-full" /> 
                                      )}
                                    </div>
                                    <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">
                                      {medico}
                                    </span>
                                  </motion.button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                          
                          {formData.tipo_servico === "Exame" && (
                            <motion.div 
                              key="exa" 
                              initial={{ opacity: 0, x: 20 }} 
                              animate={{ opacity: 1, x: 0 }} 
                              exit={{ opacity: 0, x: -20 }} 
                              className="w-full"
                            >
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 block mb-3">
                                Exames Disponíveis
                              </label>
                              <div className="flex flex-col gap-2.5">
                                {["Endoscopia Digestiva Alta", "Colonoscopia", "Retirada de Balão Gástrico"].map((exame) => (
                                  <motion.button 
                                    whileHover={{ scale: 1.02 }} 
                                    whileTap={{ scale: 0.98 }} 
                                    key={exame} 
                                    onClick={(e) => { 
                                      e.preventDefault(); 
                                      setValue("subtipo_exame", exame); 
                                      setIslandState("default"); 
                                    }} 
                                    className={`w-full flex items-center p-4 border rounded-xl transition-all duration-300 text-left ${formData.subtipo_exame === exame ? "border-[#9FC131] bg-slate-50 dark:bg-[#162035] shadow-sm" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]/40 hover:bg-slate-50 dark:hover:bg-slate-900"}`}
                                  >
                                    <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center shrink-0 ${formData.subtipo_exame === exame ? "border-[#9FC131]" : "border-slate-300 dark:border-slate-700"}`}>
                                      {formData.subtipo_exame === exame && (
                                        <motion.div layoutId="exame-dot" className="w-2 h-2 bg-[#9FC131] rounded-full" /> 
                                      )}
                                    </div>
                                    <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">
                                      {exame}
                                    </span>
                                  </motion.button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {step === 3 && (
                 <motion.div 
                   key="s3" 
                   variants={containerVariants} 
                   initial="hidden" 
                   animate="show" 
                   exit="exit" 
                   className="flex flex-col gap-6 w-full max-w-2xl mx-auto items-center"
                 >
                   <motion.div variants={itemVariants} className="text-center">
                     <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                       Garantia Financeira
                     </h2>
                     <p className="text-slate-500 dark:text-slate-400 font-medium text-xs mt-1">
                       Como você pretende realizar a cobertura do atendimento?
                     </p>
                   </motion.div>
                   
                   {formData.tipo_servico === "Retorno" ? (
                     <motion.div 
                       variants={itemVariants} 
                       className="w-full p-6 bg-emerald-50 dark:bg-emerald-500/5 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 text-center relative overflow-hidden"
                     >
                        <ShieldCheck className="w-12 h-12 text-[#9FC131] mx-auto mb-3" />
                        <h3 className="text-xl font-black text-slate-900 dark:text-white">
                          Retorno Clínico Isento
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          A consulta está validada dentro da sua janela regulamentar de retorno.
                        </p>
                     </motion.div>
                   ) : (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                        <motion.button 
                          variants={itemVariants} 
                          whileHover={{ scale: 1.03 }} 
                          whileTap={{ scale: 0.97 }} 
                          onClick={(e) => { 
                            e.preventDefault(); 
                            setValue("modalidade", "Convênio"); 
                            setIslandState("default"); 
                          }} 
                          className={`p-6 border rounded-2xl flex flex-col items-center text-center gap-3 transition-all duration-300 bg-white dark:bg-[#111827]/40 ${formData.modalidade === "Convênio" ? "border-[#9FC131] bg-slate-50 dark:bg-[#162035] shadow-md shadow-[#9FC131]/10" : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"}`}
                        >
                          <ShieldCheck 
                            className={formData.modalidade === "Convênio" ? "text-[#9FC131]" : "text-slate-400 dark:text-slate-500"} 
                            size={28} 
                          />
                          <span className="font-bold text-base text-slate-900 dark:text-white">
                            Convênio Médico
                          </span>
                        </motion.button>
                        
                        <motion.button 
                          variants={itemVariants} 
                          whileHover={{ scale: 1.03 }} 
                          whileTap={{ scale: 0.97 }} 
                          onClick={(e) => { 
                            e.preventDefault(); 
                            setValue("modalidade", "Particular"); 
                            setIslandState("default"); 
                          }} 
                          className={`p-6 border rounded-2xl flex flex-col items-center text-center gap-3 transition-all duration-300 bg-white dark:bg-[#111827]/40 ${formData.modalidade === "Particular" ? "border-[#9FC131] bg-slate-50 dark:bg-[#162035] shadow-md shadow-[#9FC131]/10" : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"}`}
                        >
                          <CreditCard 
                            className={formData.modalidade === "Particular" ? "text-[#9FC131]" : "text-slate-400 dark:text-slate-500"} 
                            size={28} 
                          />
                          <span className="font-bold text-base text-slate-900 dark:text-white">
                            Particular
                          </span>
                        </motion.button>
                     </div>
                   )}
                 </motion.div>
              )}

              {step === 4 && (
                <motion.div 
                  key="s4" 
                  variants={containerVariants} 
                  initial="hidden" 
                  animate="show" 
                  exit="exit" 
                  className="flex flex-col gap-5 w-full"
                >
                  <motion.div variants={itemVariants} className="border-b border-slate-200 dark:border-slate-800 pb-3">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      Escolha de Horário
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-xs mt-1">
                      Selecione uma data disponível para sincronizar os horários livres da clínica.
                    </p>
                  </motion.div>
                  
                  <div className="flex flex-col lg:flex-row gap-6 w-full">
                    <motion.div 
                      variants={itemVariants} 
                      className="w-full lg:w-1/2 bg-white dark:bg-[#111827]/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col shadow-sm dark:shadow-none"
                    >
                      <div className="flex justify-between items-center mb-5 px-1">
                        <button 
                          onClick={(e) => { e.preventDefault(); handlePrevMonth(); }} 
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                          <ChevronLeft size={16}/>
                        </button>
                        <h3 className="font-bold text-slate-800 dark:text-slate-200 tracking-tight capitalize text-sm">
                          {calendarMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                        </h3>
                        <button 
                          onClick={(e) => { e.preventDefault(); handleNextMonth(); }} 
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                          <ChevronRight size={16}/>
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-7 gap-1 text-center mb-2">
                        {['D','S','T','Q','Q','S','S'].map((dia, i) => (
                          <div key={i} className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            {dia}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {renderCalendar()}
                      </div>
                    </motion.div>
                    
                    <div className="w-full lg:w-1/2 flex flex-col">
                      <AnimatePresence mode="wait">
                        {formData.data_agendamento ? (
                          <motion.div 
                            key="has-date" 
                            initial={{ opacity: 0, scale: 0.95 }} 
                            animate={{ opacity: 1, scale: 1 }} 
                            exit={{ opacity: 0, scale: 0.95 }} 
                            className="bg-white dark:bg-[#111827]/40 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl h-full flex flex-col min-h-[260px] shadow-sm dark:shadow-none"
                          >
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
                              <div>
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm">Disponibilidades</h4>
                                <p className="text-[9px] font-black text-[#9FC131] uppercase tracking-widest mt-0.5">
                                  {new Date(formData.data_agendamento + "T12:00:00").toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                                </p>
                              </div>
                              {buscandoHorarios && (
                                <div className="w-4 h-4 border-2 border-[#9FC131] border-t-transparent rounded-full animate-spin" />
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto custom-scrollbar flex-1 max-h-[200px]">
                              {HORARIOS_BASE.map((hora) => {
                                const isOcupado = horariosOcupados.includes(hora); 
                                const isBloqueadoPorTempo = verificarHorarioPassado(hora); 
                                const isDisabled = isOcupado || isBloqueadoPorTempo;
                                return (
                                  <motion.button 
                                    whileHover={!isDisabled ? { scale: 1.05 } : {}} 
                                    whileTap={!isDisabled ? { scale: 0.95 } : {}} 
                                    key={hora} 
                                    disabled={isDisabled || buscandoHorarios} 
                                    onClick={(e) => { 
                                      e.preventDefault(); 
                                      setValue("horario_agendamento", hora); 
                                      setIslandState("default"); 
                                    }} 
                                    className={`py-3 rounded-xl text-xs font-bold border transition-colors relative overflow-hidden ${isDisabled ? "bg-transparent text-slate-400 dark:text-slate-700 border-transparent cursor-not-allowed opacity-50 dark:opacity-30" : formData.horario_agendamento === hora ? "bg-[#9FC131] text-white dark:text-[#090D16] border-[#9FC131] shadow-md shadow-[#9FC131]/20" : "bg-slate-50 dark:bg-transparent text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-900"}`}
                                  >
                                    {isDisabled && (
                                      <div className="absolute top-1/2 left-2 right-2 h-px bg-slate-300 dark:bg-slate-700 -translate-y-1/2" />
                                    )}
                                    {hora}
                                  </motion.button>
                                );
                              })}
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div 
                            key="no-date" 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }} 
                            className="h-full border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-[#111827]/10 rounded-2xl flex flex-col items-center justify-center text-slate-500 font-medium p-6 text-center min-h-[260px]"
                          >
                            <CalendarIcon size={24} className="mb-2 text-slate-400 dark:text-slate-700" />
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                              Selecione uma data no calendário
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 5 && (
                <motion.div 
                  key="s5" 
                  variants={containerVariants} 
                  initial="hidden" 
                  animate="show" 
                  exit="exit" 
                  className="flex flex-col gap-6 w-full max-w-md mx-auto"
                >
                  <motion.div variants={itemVariants} className="text-center">
                    <div className="w-12 h-12 bg-slate-900 dark:bg-white text-white dark:text-black rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                      <Lock size={20} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      Checkout de Confirmação
                    </h2>
                  </motion.div>
                  
                  <motion.div 
                    variants={itemVariants} 
                    className="bg-white dark:bg-[#111827]/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:shadow-xl w-full"
                  >
                    <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3 mb-3">
                      <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs truncate max-w-[200px]">
                        Atendimento: {formData.tipo_servico === "Exame" ? formData.subtipo_exame : formData.medico_profissional}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white text-xs">
                        R$ {getValorConsulta().toFixed(2)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center text-base mb-5">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        Sinal de Reserva (50%)
                      </span>
                      <span className="font-black text-[#8eb02c] text-xl">
                        R$ {(getValorConsulta()/2).toFixed(2)}
                      </span>
                    </div>
                    
                    <div className="w-full min-h-[350px]">
                      {process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ? (
                        <Payment 
                          initialization={initializationMP} 
                          onSubmit={onSubmitMP} 
                          customization={{ paymentMethods: { creditCard: 'all', debitCard: 'all' } }} 
                        />
                      ) : (
                        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-900/50 text-center font-bold text-xs">
                          Credenciais de Pagamento Ausentes.
                        </div>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {step === 6 && (
                <motion.div 
                  key="s6" 
                  initial={{ opacity: 0, scale: 0.9 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  transition={springTransition} 
                  className="flex flex-col items-center justify-center text-center h-full w-full max-w-sm mx-auto py-6"
                >
                  <div className="relative w-24 h-24 mb-5">
                    <div className="absolute inset-0 bg-[#9FC131]/20 dark:bg-[#9FC131]/10 rounded-full blur-xl animate-pulse" />
                    <div className="absolute inset-0 bg-gradient-to-tr from-[#9FC131] to-emerald-500 rounded-full flex items-center justify-center border-2 border-white dark:border-[#090D16] shadow-xl">
                      <svg className="w-10 h-10 text-white dark:text-[#090D16]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Sucesso Confirmado!
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 mt-2 text-xs font-medium">
                    Seu agendamento foi computado para o dia <strong className="text-slate-900 dark:text-white">{formData.data_agendamento?.split("-").reverse().join("/")}</strong> às <strong className="text-slate-900 dark:text-white">{formData.horario_agendamento}h</strong>.
                  </p>
                  
                  <div className="mt-5 bg-white dark:bg-[#111827]/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-full text-left relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#9FC131]" />
                    <div className="flex justify-between items-center mb-3 pl-1">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        Paciente
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                        {formData.nome}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-3 pl-1 border-t border-slate-200 dark:border-slate-800 border-dashed">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        Protocolo Digital
                      </span>
                      <span className="text-base font-mono font-black text-[#9FC131]">
                        #{Math.floor(100000 + Math.random() * 900000)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Rodapé Fixo - Agora Flutuando Acima da Dock no Mobile */}
        {step < 6 && (
          <div className="fixed md:absolute bottom-[90px] md:bottom-0 left-0 right-0 w-full px-4 md:px-8 py-3 md:bg-white/90 md:dark:bg-[#0D1424]/90 md:backdrop-blur-md md:border-t border-slate-200 dark:border-slate-800/80 flex justify-between items-center z-[90] pointer-events-none transition-all duration-300">
            {step > 1 ? (
              <motion.button 
                whileHover={{ x: -4 }} 
                whileTap={{ scale: 0.95 }} 
                onClick={(e) => { 
                  e.preventDefault(); 
                  prevStep(); 
                }} 
                className="pointer-events-auto flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900/90 md:bg-transparent md:dark:bg-transparent md:shadow-none border border-slate-200 dark:border-slate-700 md:border-transparent px-4 py-3 md:p-0 rounded-full shadow-lg hover:text-slate-900 dark:hover:text-white transition-all backdrop-blur-md"
              >
                <ChevronLeft size={16} strokeWidth={2.5} /> 
                <span className="font-black text-[10px] uppercase tracking-wider hidden sm:inline-block">
                  Voltar
                </span>
              </motion.button>
            ) : (
              <div />
            )}

            {step !== 5 && !(step === 2 && exibirConfirmacaoUri && !confirmouMedicoUri) && (
              <motion.button 
                whileHover={loading || (step === 1 && formData.cpf?.length !== 14) ? {} : { scale: 1.05 }}
                whileTap={loading || (step === 1 && formData.cpf?.length !== 14) ? {} : { scale: 0.95 }}
                onClick={(e) => { 
                  e.preventDefault(); 
                  nextStep(); 
                }} 
                disabled={loading || (step === 1 && formData.cpf?.length !== 14)} 
                className="pointer-events-auto text-white dark:text-[#090D16] bg-slate-900 dark:bg-[#9FC131] hover:bg-slate-800 dark:hover:bg-[#8eb02c] transition-colors font-black text-[10px] uppercase tracking-wider px-6 py-3.5 rounded-full flex items-center gap-2 shadow-[0_10px_20px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_20px_rgba(159,193,49,0.2)] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span>
                  {loading ? "Sincronizando..." : (step === 4 && (formData.modalidade === "Convênio" || formData.tipo_servico === "Retorno") ? "Finalizar" : "Continuar")}
                </span>
                {!loading && (
                  <ArrowRight size={13} strokeWidth={2.5} />
                )}
              </motion.button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}