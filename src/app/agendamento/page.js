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
  ArrowRight, 
  CheckCircle, 
  AlertTriangle, 
  Sparkles, 
  ShieldCheck, 
  Calendar as CalendarIcon, 
  CreditCard, 
  Lock, 
  ChevronLeft, 
  ChevronRight, 
  Activity, 
  User, 
  HeartPulse, 
  Search, 
  Pencil
} from "lucide-react";

import Navbar from "@/components/Navbar";
import SidebarPremium from "@/components/SidebarPremium";

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
const maskCPF = (v) => {
  return v
    .replace(/\D/g, "")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})/, "$1-$2")
    .replace(/(-\d{2})\d+?$/, "$1");
};

const maskPhone = (v) => {
  return v
    .replace(/\D/g, "")
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .replace(/(-\d{4})\d+?$/, "$1");
};

const maskDate = (v) => {
  return v
    .replace(/\D/g, "")
    .replace(/(\d{2})(\d)/, "$1/$2")
    .replace(/(\d{2})(\d)/, "$1/$2")
    .replace(/(\/\d{4})\d+?$/, "$1");
};

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

const HORARIOS_BASE = [
  "09:00", "10:00", "11:00", "12:00", "13:00", 
  "14:00", "15:00", "16:00", "17:00", "18:00"
];

const NOME_ETAPAS = [
  "Sincronização", 
  "Identificação", 
  "Especialidade", 
  "Modalidade", 
  "Agenda", 
  "Checkout", 
  "Concluído"
];

export default function AgendamentoPremium() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  return (
    <div className="flex min-h-screen w-full bg-[#FAFAFA] dark:bg-[#000000] text-zinc-900 dark:text-zinc-50 transition-colors duration-500 selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-black font-sans antialiased">
      
      <SidebarPremium 
        isExpanded={isSidebarExpanded} 
        setIsExpanded={setIsSidebarExpanded} 
      />
      
      <Navbar />
      
      <main 
        className={`flex-1 relative flex flex-col items-center transition-[margin] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] w-full h-full min-h-screen overflow-hidden ${
          isSidebarExpanded ? "md:ml-[260px]" : "md:ml-[88px]"
        }`}
      >
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center w-full">
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }} 
              className="w-8 h-8 border-[3px] border-zinc-900 dark:border-white border-t-transparent rounded-full" 
            />
          </div>
        }>
          <AgendamentoForm />
        </Suspense>
      </main>
    </div>
  );
}

function AgendamentoForm() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0); 
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

  const [fieldsFromUrl, setFieldsFromUrl] = useState({
    cpf: false, 
    nome: false, 
    sobrenome: false, 
    telefone_whatsapp: false
  });
  
  const [unlockedFields, setUnlockedFields] = useState({
    cpf: false, 
    nome: false, 
    sobrenome: false, 
    telefone_whatsapp: false
  });

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
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (type !== "loading" && type !== "success" && step !== 6) {
      timeoutRef.current = setTimeout(() => setIslandState("default"), 3000); 
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("egastro_agendamento");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.step >= 0 && parsed.step < 6) {
          setStep(parsed.step);
        }
        if (parsed.data) {
          reset(parsed.data); 
        }
      } catch (e) {}
    }
  }, [reset]);

  useEffect(() => {
    if (step < 6) {
      localStorage.setItem("egastro_agendamento", JSON.stringify({ step, data: formData }));
    } else {
      localStorage.removeItem("egastro_agendamento"); 
    }
  }, [step, formData]);

  useEffect(() => {
    window.history.pushState({ step }, "", window.location.href);
    
    const handlePopState = (e) => {
      if (e.state && e.state.step !== undefined) {
        setStep(e.state.step); 
      } else if (step > 0 && step < 6) {
        setStep(prev => prev - 1);
      }
    };
    
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [step]);

  useEffect(() => {
    if (formData.cpf?.length < 14) {
      setUserFound(false);
    }
  }, [formData.cpf]);

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

    if (!isSmartLink || unlockedFields.cpf) {
      setValue("nome", "");
      setValue("sobrenome", "");
      setValue("telefone_whatsapp", "");
      setValue("email", "");
      setValue("data_nascimento", "");
    }

    try {
      const { data } = await supabase
        .from("pacientes")
        .select("*")
        .eq("cpf", formData.cpf)
        .maybeSingle();
        
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
      setTimeout(() => setCheckingUser(false), 500); 
    }
  };

  useEffect(() => {
    if (formData.cpf?.length === 14 && !userFound && step === 1 && !checkingUser) {
      handleCpfLookup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.cpf]); 

  useEffect(() => {
    const buscarDisponibilidade = async () => {
      if (!formData.data_agendamento) return;
      const profesional = formData.tipo_servico === "Exame" ? formData.subtipo_exame : formData.medico_profissional;
      
      if (!profesional) return;

      setBuscandoHorarios(true); 
      setValue("horario_agendamento", ""); 

      try {
        const { data: ag } = await supabase
          .from("agendamentos")
          .select("horario_agendamento, medico_profissional, subtipo_exame")
          .eq("data_agendamento", formData.data_agendamento);
          
        const { data: bl } = await supabase
          .from("bloqueios_horarios")
          .select("horario, medico_profissional")
          .eq("data", formData.data_agendamento);

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
    if (formData.tipo_servico === "Exame" && formData.subtipo_exame) {
      return PRECOS[formData.subtipo_exame] || 500;
    }
    if (formData.medico_profissional) {
      return PRECOS[formData.medico_profissional] || 0;
    }
    return 0;
  };

  const salvarNoBanco = async (status_pagamento) => {
    try {
      let pacienteId = null;
      const { data: pacienteExistente } = await supabase
        .from("pacientes")
        .select("id")
        .eq("cpf", formData.cpf)
        .maybeSingle();
        
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
          showIslandMessage("Verifique os dados informados."); 
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
            showIslandMessage("Sem histórico de consulta."); 
            setLoading(false); 
            return; 
          }
        }

        if (formData.tipo_servico === "Retorno") {
          const { data: paciente } = await supabase.from("pacientes").select("id").eq("cpf", formData.cpf).maybeSingle();
          if (!paciente) { 
            showIslandMessage("Cadastro não encontrado."); 
            setLoading(false); 
            return; 
          }
          
          const { data: ult } = await supabase
            .from("agendamentos")
            .select("data_agendamento")
            .eq("paciente_id", paciente.id)
            .eq("tipo_servico", "Consulta")
            .order("data_agendamento", { ascending: false })
            .limit(1)
            .maybeSingle();
            
          if (!ult) { 
            showIslandMessage("Nenhuma consulta anterior."); 
            setLoading(false); 
            return; 
          }
          setDataUltimaConsulta(new Date(ult.data_agendamento));
        }

        if (formData.tipo_servico === "Exame" && ["Endoscopia Digestiva Alta", "Colonoscopia"].includes(formData.subtipo_exame)) {
          if (calculateAge(formData.data_nascimento) >= 65) {
             if (!window.confirm("Pacientes 65+ exigem liberação cardiológica. Confirma ciência?")) { 
               setIslandState("default"); 
               setLoading(false); 
               return; 
             }
          }
        }
      }

      if (step === 3) {
        if (!formData.modalidade && formData.tipo_servico !== "Retorno") { 
          showIslandMessage("Defina a modalidade."); 
          setLoading(false); 
          return; 
        }
      }

      if (step === 4) {
        if (!formData.data_agendamento || !formData.horario_agendamento) { 
          showIslandMessage("Escolha uma data e horário."); 
          setLoading(false); 
          return; 
        }
        
        if (formData.tipo_servico === "Retorno" && dataUltimaConsulta) {
          const diffDays = Math.ceil(Math.abs(new Date(formData.data_agendamento).getTime() - dataUltimaConsulta.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > 30) { 
            showIslandMessage(`Prazo excedido (${diffDays} dias). Máximo 30.`); 
            setLoading(false); 
            return; 
          }
        }

        if (formData.tipo_servico === "Retorno" || formData.modalidade === "Convênio") {
          const salvo = await salvarNoBanco(false);
          if (salvo) {
            await dispararWebhook(false);
            showIslandMessage("Agendamento Finalizado", "success"); 
            setLoading(false); 
            setStep(6); 
            return;
          }
          showIslandMessage("Erro ao salvar."); 
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
      showIslandMessage("Erro de sistema."); 
      setLoading(false); 
    }
  };

  const prevStep = () => { 
    setIslandState("default"); 
    
    if (step === 3 && exibirConfirmacaoUri && confirmouMedicoUri) {
      setConfirmouMedicoUri(false);
      setStep(2);
      return;
    }
    
    if (step > 0) {
      setStep(prev => prev - 1);
    }
  };

  const valorEntrada = getValorConsulta() / 2;
  const initializationMP = { amount: valorEntrada > 0 ? valorEntrada : 1 };

  const onSubmitMP = async (param) => {
    return new Promise(async (resolve) => {
      showIslandMessage("Processando...", "loading");
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
             showIslandMessage("Erro ao salvar o recibo."); 
             resolve(); 
             return; 
           }
           await dispararWebhook(true);
           showIslandMessage("Pagamento Aprovado", "success"); 
           setStep(6); 
           resolve();
        } else { 
          showIslandMessage("Pagamento recusado."); 
          resolve(); 
        }
      } catch (error) { 
        showIslandMessage("Erro no banco."); 
        resolve(); 
      }
    });
  };

  const toggleFieldUnlock = (field) => {
    setUnlockedFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // --- FÍSICA E ANIMAÇÕES (APPLE/LINEAR STYLE) ---
  const springTransition = { type: "spring", stiffness: 450, damping: 35 };
  
  const containerVariants = { 
    hidden: { opacity: 0 }, 
    show: { 
      opacity: 1, 
      transition: { staggerChildren: 0.04, delayChildren: 0.02 } 
    }, 
    exit: { opacity: 0, transition: { duration: 0.15 } } 
  };
  
  const itemVariants = { 
    hidden: { opacity: 0, y: 15, filter: "blur(4px)", scale: 0.98 }, 
    show: { opacity: 1, y: 0, filter: "blur(0px)", scale: 1, transition: springTransition } 
  };
  
  // --- ESTILIZAÇÃO DE INPUTS (VERCEL STYLE: PURE & STARK) ---
  const inputContainerClass = "relative rounded-xl bg-zinc-50/50 dark:bg-[#111111]/50 border border-zinc-200 dark:border-zinc-800 transition-all duration-300 focus-within:border-zinc-900 dark:focus-within:border-white focus-within:ring-1 focus-within:ring-zinc-900 dark:focus-within:ring-white overflow-hidden";
  const inputClass = "w-full p-3.5 pt-6 bg-transparent outline-none text-zinc-900 dark:text-white font-medium text-[16px] peer placeholder-transparent transition-all";
  const labelClass = "absolute left-3.5 top-2 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest transition-all duration-300 peer-placeholder-shown:top-4 peer-placeholder-shown:text-[14px] peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-widest peer-focus:text-zinc-900 dark:peer-focus:text-white pointer-events-none";

  const renderCalendar = () => {
    const y = calendarMonth.getFullYear(); 
    const m = calendarMonth.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const firstDay = new Date(y, m, 1).getDay();
    const today = getLocalTodayStr();
    let days = [];
    
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="aspect-square" />
      );
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
          whileHover={!isPast && !isSel ? { scale: 1.05, backgroundColor: "rgba(159,193,49,0.1)" } : {}}
          whileTap={!isPast ? { scale: 0.95 } : {}}
          key={day} 
          disabled={isPast} 
          onClick={(e) => { 
            e.preventDefault(); 
            setValue("data_agendamento", dateStr); 
            setIslandState("default"); 
          }} 
          className={`aspect-square w-full rounded-xl flex flex-col items-center justify-center text-sm transition-all duration-200 relative
            ${isPast ? "text-zinc-300 dark:text-zinc-800 cursor-not-allowed opacity-50 bg-transparent" : "text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-medium"} 
            ${isToday && !isSel && !isPast ? "text-[#9FC131] font-bold" : ""}
            ${isSel ? "bg-zinc-900 text-white dark:bg-white dark:text-black font-bold scale-[1.05] shadow-lg z-10" : ""}
          `}
        >
          {day}
          {isToday && !isSel && !isPast && (
            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#9FC131]" />
          )}
        </motion.button>
      );
    }
    return days;
  };

  const handlePrevMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  };
  
  const handleNextMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
  };

  const isFormActive = step >= 0 && step <= 5; 

  return (
    <>
      {/* Background Sólido Base */}
      <div className="absolute inset-0 bg-[#FAFAFA] dark:bg-[#000000] -z-20 pointer-events-none" />

      {/* --- ILHA DINÂMICA (INDICADOR DE ETAPAS SUPERIOR) --- */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[9999] flex justify-center w-full px-4 transition-transform duration-500 pointer-events-none">
        <motion.div 
          layout 
          transition={{ type: "spring", stiffness: 450, damping: 30 }} 
          className={`pointer-events-auto rounded-full flex items-center px-5 py-2.5 max-w-sm overflow-hidden transition-colors duration-300 shadow-[0_10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_40px_rgba(255,255,255,0.05)]
          ${islandState === "error" ? "bg-red-500 text-white" : 
            islandState === "success" ? "bg-[#9FC131] text-black font-medium" : 
            "bg-black dark:bg-[#111111] text-white dark:text-zinc-200 border border-transparent dark:border-white/10"}`}
        >
          <AnimatePresence mode="wait">
            {islandState === "error" && (
               <motion.div 
                 key="err" 
                 initial={{ opacity: 0, y: 5 }} 
                 animate={{ opacity: 1, y: 0 }} 
                 exit={{ opacity: 0 }} 
                 className="flex items-center gap-2 text-xs font-medium tracking-wide"
               >
                 <AlertTriangle size={14} /> 
                 <span className="truncate">{islandMessage}</span>
               </motion.div>
            )}
            
            {islandState === "success" && (
               <motion.div 
                 key="suc" 
                 initial={{ opacity: 0, y: 5 }} 
                 animate={{ opacity: 1, y: 0 }} 
                 exit={{ opacity: 0 }} 
                 className="flex items-center gap-2 text-xs font-medium tracking-wide"
               >
                 <CheckCircle size={14} /> 
                 <span className="truncate">{islandMessage}</span>
               </motion.div>
            )}
            
            {islandState === "loading" && (
              <motion.div 
                key="load" 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="flex items-center gap-3 text-xs font-medium tracking-wide"
              >
                 <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, ease: "linear", duration: 0.8 }}>
                   <Activity size={14} className="opacity-80" />
                 </motion.div> 
                 {islandMessage || "Processando"}
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
                       className={`h-1 rounded-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                         step === i + 1 ? "w-4 bg-white" : 
                         step > i + 1 ? "w-1.5 bg-white/40" : "w-1.5 bg-white/10"
                       }`} 
                     />
                   ))}
                 </div>
                 <div className="text-[10px] font-medium tracking-widest text-zinc-400 border-l border-zinc-700 pl-4 uppercase">
                   {NOME_ETAPAS[step === 0 ? 1 : step]}
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Frame Principal do Formulário */}
      <div className="w-full h-full flex items-center justify-center p-0 md:p-8 pt-24 md:pt-28 z-10 relative">
        
        <motion.div 
          layout 
          transition={springTransition} 
          className="w-full max-w-[800px] h-full md:h-[80vh] md:max-h-[700px] bg-white dark:bg-[#0A0A0A] md:rounded-[24px] shadow-sm md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:md:shadow-[0_8px_30px_rgb(255,255,255,0.02)] border-t md:border border-zinc-200 dark:border-zinc-800 flex flex-col relative overflow-hidden"
        >
          
          {/* HEADER FIXO DE AÇÕES (DENTRO DO CARD, NO TOPO) */}
          {isFormActive && (
            <div className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-md z-20 shrink-0">
               {step > 0 ? (
                 <button 
                   onClick={(e) => { e.preventDefault(); prevStep(); }} 
                   className="flex items-center justify-center gap-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors font-medium text-[13px] tracking-wide"
                 >
                   <ChevronLeft size={18} strokeWidth={2.5} /> Voltar
                 </button>
               ) : (
                 <div />
               )}

               {/* A Lógica solicitada: O botão Continuar principal SOME na tela de Confirmar Especialista */}
               {step !== 5 && !(step === 2 && exibirConfirmacaoUri && !confirmouMedicoUri) && (
                 <button 
                   onClick={(e) => { e.preventDefault(); nextStep(); }} 
                   disabled={loading || (step === 1 && formData.cpf?.length !== 14)} 
                   className="bg-zinc-900 dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity font-bold text-[11px] md:text-[12px] px-6 py-2.5 rounded-full flex items-center gap-2 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-widest"
                 >
                   {loading ? "Processando" : (step === 4 && (formData.modalidade === "Convênio" || formData.tipo_servico === "Retorno") ? "Finalizar" : "Continuar")}
                   {!loading && <ArrowRight size={16} strokeWidth={2.5} />}
                 </button>
               )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar relative">
            <div className="p-6 md:p-12 min-h-full flex flex-col justify-start md:justify-center pb-12 md:pb-16 pt-8 md:pt-10">
              <AnimatePresence mode="wait">
                
                {/* --- STEP 0: TELA DE BOAS VINDAS --- */}
                {step === 0 && (
                  <motion.div 
                    key="s0" 
                    variants={containerVariants} 
                    initial="hidden" 
                    animate="show" 
                    exit="exit" 
                    className="flex flex-col items-center justify-center text-center gap-6 m-auto max-w-sm"
                  >
                    <motion.div variants={itemVariants}>
                      <h1 className="text-4xl md:text-5xl font-light tracking-tight text-zinc-900 dark:text-white">
                        Olá, <span className="font-medium">{personalizedName}</span>.
                      </h1>
                      <p className="text-zinc-500 dark:text-zinc-400 mt-4 text-sm leading-relaxed">
                        Conectamos o seu painel de agendamento ao ambiente clínico em segurança.
                      </p>
                    </motion.div>
                  </motion.div>
                )}

                {/* --- STEP 1: DADOS DE ACESSO --- */}
                {step === 1 && (
                  <motion.div 
                    key="s1" 
                    variants={containerVariants} 
                    initial="hidden" 
                    animate="show" 
                    exit="exit" 
                    className="flex flex-col gap-8 w-full max-w-lg mx-auto"
                  >
                    <motion.div variants={itemVariants} className="text-center md:text-left">
                      <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-zinc-900 dark:text-white">
                        Dados de Acesso
                      </h2>
                      <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm">
                        Verifique ou insira as informações de atendimento.
                      </p>
                    </motion.div>

                    {isSmartLink && !unlockedFields.cpf && !unlockedFields.nome && !unlockedFields.sobrenome && !unlockedFields.telefone_whatsapp ? (
                      <motion.div 
                        variants={itemVariants} 
                        className="p-6 rounded-2xl bg-zinc-50 dark:bg-[#111111] border border-zinc-200 dark:border-zinc-800"
                      >
                        <div className="flex justify-between items-start mb-6 gap-4">
                          <h3 className="text-lg font-medium text-zinc-900 dark:text-white leading-tight">
                            Agendamento E-gastro, <br/>
                            <span className="text-zinc-500 dark:text-zinc-400 text-base">
                              {formData.nome} {formData.sobrenome}
                            </span>
                          </h3>
                          <button 
                            type="button" 
                            onClick={() => { setUnlockedFields({ cpf: true, nome: true, sobrenome: true, telefone_whatsapp: true }); }} 
                            className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors flex items-center gap-1.5"
                          >
                            <Pencil size={12} /> Editar
                          </button>
                        </div>
                        
                        <div className="space-y-4 mb-6">
                          <div className="grid grid-cols-2 gap-4 text-sm border-t border-zinc-200 dark:border-zinc-800 pt-4">
                            <div>
                              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                                CPF
                              </span>
                              <span className="text-zinc-900 dark:text-zinc-200 font-mono">
                                {formData.cpf}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                                Telefone
                              </span>
                              <span className="text-zinc-900 dark:text-zinc-200">
                                {formData.telefone_whatsapp || "—"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <input type="hidden" {...register("cpf")} /> 
                        <input type="hidden" {...register("nome")} /> 
                        <input type="hidden" {...register("sobrenome")} /> 
                        <input type="hidden" {...register("telefone_whatsapp")} />

                        <div className="grid gap-4 border-t border-zinc-200 dark:border-zinc-800 pt-6">
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
                          <div className={inputContainerClass}>
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
                          className={fieldsFromUrl.cpf && !unlockedFields.cpf ? "p-4 rounded-xl bg-zinc-50 dark:bg-[#111111] border border-zinc-200 dark:border-zinc-800 flex justify-between items-center" : inputContainerClass}
                        >
                          {fieldsFromUrl.cpf && !unlockedFields.cpf ? (
                            <>
                              <div>
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                                  CPF Vinculado
                                </span>
                                <span className="text-zinc-900 dark:text-zinc-200 font-medium font-mono text-sm">
                                  {formData.cpf}
                                </span>
                              </div>
                              <button 
                                type="button" 
                                onClick={() => toggleFieldUnlock("cpf")} 
                                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                              >
                                <Pencil size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <input 
                                {...register("cpf")} 
                                onChange={(e) => setValue("cpf", maskCPF(e.target.value))} 
                                className={`${inputClass} font-mono`} 
                                placeholder="000.000.000-00" 
                                maxLength={14} 
                              />
                              <label className={labelClass}>CPF do Paciente</label>
                              
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                                {checkingUser ? (
                                  <motion.div 
                                    animate={{ rotate: 360 }} 
                                    transition={{ repeat: Infinity, ease: "linear", duration: 1 }}
                                  >
                                    <Activity size={16} className="text-zinc-400"/>
                                  </motion.div>
                                ) : formData.cpf?.length === 14 ? (
                                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                    <CheckCircle size={16} className="text-zinc-900 dark:text-white"/>
                                  </motion.div>
                                ) : (
                                  <Search size={16} className="text-zinc-300 dark:text-zinc-700"/>
                                )}
                              </div>
                            </>
                          )}
                        </motion.div>

                        <AnimatePresence mode="wait">
                          {formData.cpf?.length === 14 && checkingUser && (
                            <motion.div 
                              key="loading" 
                              initial={{ opacity: 0, height: 0 }} 
                              animate={{ opacity: 1, height: "auto" }} 
                              exit={{ opacity: 0, height: 0 }} 
                              className="flex items-center justify-center py-6"
                            >
                               <Activity className="text-zinc-400 animate-spin w-5 h-5" />
                            </motion.div>
                          )}

                          {formData.cpf?.length === 14 && !checkingUser && (
                            <motion.div 
                              key="fields" 
                              initial={{ opacity: 0, y: 10 }} 
                              animate={{ opacity: 1, y: 0 }} 
                              className="space-y-4 pt-2"
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className={fieldsFromUrl.nome && !unlockedFields.nome ? "p-4 rounded-xl bg-zinc-50 dark:bg-[#111111] border border-zinc-200 dark:border-zinc-800 flex justify-between items-center" : inputContainerClass}>
                                  {fieldsFromUrl.nome && !unlockedFields.nome ? (
                                    <>
                                      <div>
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                                          Nome
                                        </span>
                                        <span className="text-zinc-900 dark:text-zinc-200 font-medium text-sm">
                                          {formData.nome}
                                        </span>
                                      </div>
                                      <button 
                                        type="button" 
                                        onClick={() => toggleFieldUnlock("nome")} 
                                        className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                                      >
                                        <Pencil size={14} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <input 
                                        {...register("nome")} 
                                        className={inputClass} 
                                        placeholder="Nome" 
                                      />
                                      <label className={labelClass}>Primeiro Nome</label>
                                    </>
                                  )}
                                </div>
                                
                                <div className={fieldsFromUrl.sobrenome && !unlockedFields.sobrenome ? "p-4 rounded-xl bg-zinc-50 dark:bg-[#111111] border border-zinc-200 dark:border-zinc-800 flex justify-between items-center" : inputContainerClass}>
                                  {fieldsFromUrl.sobrenome && !unlockedFields.sobrenome ? (
                                    <>
                                      <div>
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                                          Sobrenome
                                        </span>
                                        <span className="text-zinc-900 dark:text-zinc-200 font-medium text-sm">
                                          {formData.sobrenome || "—"}
                                        </span>
                                      </div>
                                      <button 
                                        type="button" 
                                        onClick={() => toggleFieldUnlock("sobrenome")} 
                                        className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                                      >
                                        <Pencil size={14} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <input 
                                        {...register("sobrenome")} 
                                        className={inputClass} 
                                        placeholder="Sobrenome" 
                                      />
                                      <label className={labelClass}>Sobrenome Completo</label>
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
                                  <label className={labelClass}>Data de Nascimento</label>
                                </div>
                                
                                <div className={fieldsFromUrl.telefone_whatsapp && !unlockedFields.telefone_whatsapp ? "p-4 rounded-xl bg-zinc-50 dark:bg-[#111111] border border-zinc-200 dark:border-zinc-800 flex justify-between items-center" : inputContainerClass}>
                                  {fieldsFromUrl.telefone_whatsapp && !unlockedFields.telefone_whatsapp ? (
                                    <>
                                      <div>
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                                          WhatsApp
                                        </span>
                                        <span className="text-zinc-900 dark:text-zinc-200 font-medium text-sm">
                                          {formData.telefone_whatsapp}
                                        </span>
                                      </div>
                                      <button 
                                        type="button" 
                                        onClick={() => toggleFieldUnlock("telefone_whatsapp")} 
                                        className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                                      >
                                        <Pencil size={14} />
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
                                <label className={labelClass}>E-mail Pessoal</label>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* --- STEP 2: DIRECIONAMENTO MÉDICO --- */}
                {step === 2 && (
                  <motion.div 
                    key="s2" 
                    variants={containerVariants} 
                    initial="hidden" 
                    animate="show" 
                    exit="exit" 
                    className="flex flex-col gap-8 w-full max-w-2xl mx-auto"
                  >
                    <motion.div variants={itemVariants} className="text-center md:text-left">
                      <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-zinc-900 dark:text-white">
                        Direcionamento
                      </h2>
                      <p className="text-zinc-500 dark:text-zinc-400 font-normal text-sm mt-2">
                        Selecione a categoria do atendimento clínico.
                      </p>
                    </motion.div>

                    {exibirConfirmacaoUri && !confirmouMedicoUri ? (
                      <motion.div 
                        variants={itemVariants} 
                        className="py-6 w-full max-w-md mx-auto text-center"
                      >
                        <User size={24} className="mx-auto text-zinc-400 mb-4" />
                        
                        <h3 className="text-lg font-medium text-zinc-900 dark:text-white">
                          Confirmar Especialista?
                        </h3>
                        <p className="text-zinc-500 text-sm mt-2">
                          De acordo com seu atendimento prévio, agendaremos com:
                        </p>
                        
                        <div className="my-6 inline-block text-left bg-zinc-50 dark:bg-[#111111] border border-zinc-200 dark:border-zinc-800 px-6 py-4 rounded-2xl shadow-sm">
                          <span className="block text-sm font-medium text-zinc-900 dark:text-white">
                            {formData.medico_profissional || formData.subtipo_exame}
                          </span>
                          <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">
                            {formData.tipo_servico}
                          </span>
                        </div>

                        {/* Ordem dos botões corrigida conforme solicitado */}
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          <button 
                            onClick={() => { 
                              setExibirConfirmacaoUri(false); 
                              setValue("medico_profissional", ""); 
                              setValue("subtipo_exame", ""); 
                            }} 
                            className="py-3 bg-white dark:bg-[#111111] text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 font-medium text-sm rounded-xl hover:bg-zinc-50 dark:hover:bg-[#1A1A1A] transition-colors shadow-sm"
                          >
                            Alterar
                          </button>
                          
                          <button 
                            onClick={() => { 
                              setConfirmouMedicoUri(true); 
                              setStep(3); 
                              setIslandState("default"); 
                            }} 
                            className="py-3 bg-zinc-900 dark:bg-white text-white dark:text-black font-medium text-sm rounded-xl hover:opacity-90 transition-opacity shadow-md"
                          >
                            Confirmar
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="flex flex-col md:flex-row gap-6 items-start w-full">
                        
                        {/* TIPOS DE SERVIÇO */}
                        <div className="w-full md:w-1/3 flex flex-col gap-3">
                          {[ 
                            {id: "Consulta", icon: User}, 
                            {id: "Retorno", icon: Activity}, 
                            {id: "Exame", icon: HeartPulse} 
                          ].map((serv) => (
                            <motion.button 
                              variants={itemVariants} 
                              whileHover={{ scale: 1.01 }} 
                              whileTap={{ scale: 0.99 }} 
                              key={serv.id} 
                              onClick={(e) => { 
                                e.preventDefault(); 
                                setValue("tipo_servico", serv.id); 
                                setValue("medico_profissional", ""); 
                                setValue("subtipo_exame", ""); 
                              }} 
                              className={`p-4 rounded-xl flex items-center gap-4 transition-all duration-200 border text-left w-full
                                ${formData.tipo_servico === serv.id ? "border-zinc-900 dark:border-white bg-zinc-50 dark:bg-[#111111]" : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600"}`}
                            >
                              <serv.icon size={18} className={formData.tipo_servico === serv.id ? "text-zinc-900 dark:text-white" : "text-zinc-400"} />
                              <span className={`text-sm ${formData.tipo_servico === serv.id ? "font-semibold text-zinc-900 dark:text-white" : "font-medium text-zinc-600 dark:text-zinc-400"}`}>
                                {serv.id}
                              </span>
                            </motion.button>
                          ))}
                        </div>

                        {/* LISTAS SECUNDÁRIAS (Médicos ou Exames) */}
                        <div className="w-full md:w-2/3">
                          <AnimatePresence mode="wait">
                            {(formData.tipo_servico === "Consulta" || formData.tipo_servico === "Retorno") && (
                              <motion.div 
                                key="med" 
                                initial={{ opacity: 0, y: 10 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                exit={{ opacity: 0, y: -10 }} 
                                className="w-full"
                              >
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3 block">
                                  Corpo Clínico
                                </label>
                                <div className="grid grid-cols-1 gap-3">
                                  {Object.keys(PRECOS).filter(k => k.includes("Dr") || k.includes("Dra")).map((medico) => (
                                    <button 
                                      key={medico} 
                                      onClick={(e) => { 
                                        e.preventDefault(); 
                                        setValue("medico_profissional", medico); 
                                      }} 
                                      className={`w-full flex items-center p-4 border rounded-xl transition-all duration-200 text-left
                                        ${formData.medico_profissional === medico ? "border-zinc-900 dark:border-white bg-zinc-50 dark:bg-[#111111]" : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600"}`}
                                    >
                                      <div className={`w-4 h-4 rounded-full border mr-4 flex items-center justify-center shrink-0 ${formData.medico_profissional === medico ? "border-zinc-900 dark:border-white" : "border-zinc-300 dark:border-zinc-700"}`}>
                                        {formData.medico_profissional === medico && (
                                          <div className="w-2 h-2 bg-zinc-900 dark:bg-white rounded-full" /> 
                                        )}
                                      </div>
                                      <span className={`text-sm ${formData.medico_profissional === medico ? "font-semibold text-zinc-900 dark:text-white" : "font-medium text-zinc-600 dark:text-zinc-400"}`}>
                                        {medico}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                            
                            {formData.tipo_servico === "Exame" && (
                              <motion.div 
                                key="exa" 
                                initial={{ opacity: 0, y: 10 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                exit={{ opacity: 0, y: -10 }} 
                                className="w-full"
                              >
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3 block">
                                  Exames Disponíveis
                                </label>
                                <div className="grid grid-cols-1 gap-3">
                                  {["Endoscopia Digestiva Alta", "Colonoscopia", "Retirada de Balão Gástrico"].map((exame) => (
                                    <button 
                                      key={exame} 
                                      onClick={(e) => { 
                                        e.preventDefault(); 
                                        setValue("subtipo_exame", exame); 
                                      }} 
                                      className={`w-full flex items-center p-4 border rounded-xl transition-all duration-200 text-left
                                        ${formData.subtipo_exame === exame ? "border-zinc-900 dark:border-white bg-zinc-50 dark:bg-[#111111]" : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600"}`}
                                    >
                                      <div className={`w-4 h-4 rounded-full border mr-4 flex items-center justify-center shrink-0 ${formData.subtipo_exame === exame ? "border-zinc-900 dark:border-white" : "border-zinc-300 dark:border-zinc-700"}`}>
                                        {formData.subtipo_exame === exame && (
                                          <div className="w-2 h-2 bg-zinc-900 dark:bg-white rounded-full" /> 
                                        )}
                                      </div>
                                      <span className={`text-sm ${formData.subtipo_exame === exame ? "font-semibold text-zinc-900 dark:text-white" : "font-medium text-zinc-600 dark:text-zinc-400"}`}>
                                        {exame}
                                      </span>
                                    </button>
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

                {/* --- STEP 3: GARANTIA FINANCEIRA --- */}
                {step === 3 && (
                   <motion.div 
                     key="s3" 
                     variants={containerVariants} 
                     initial="hidden" 
                     animate="show" 
                     exit="exit" 
                     className="flex flex-col gap-8 w-full max-w-lg mx-auto items-center"
                   >
                     <motion.div variants={itemVariants} className="text-center">
                       <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-zinc-900 dark:text-white">
                         Garantia Financeira
                       </h2>
                       <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2">
                         Escolha a cobertura do atendimento.
                       </p>
                     </motion.div>
                     
                     {formData.tipo_servico === "Retorno" ? (
                       <motion.div 
                         variants={itemVariants} 
                         className="w-full p-6 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-center"
                       >
                          <ShieldCheck className="w-8 h-8 text-zinc-900 dark:text-white mx-auto mb-4" strokeWidth={1.5} />
                          <h3 className="text-lg font-medium text-zinc-900 dark:text-white">
                            Retorno Isento
                          </h3>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                            Sua solicitação está dentro da janela regulamentar de retorno sem custos adicionais.
                          </p>
                       </motion.div>
                     ) : (
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                          <motion.button 
                            variants={itemVariants} 
                            whileHover={{ scale: 1.02 }} 
                            whileTap={{ scale: 0.98 }} 
                            onClick={(e) => { 
                              e.preventDefault(); 
                              setValue("modalidade", "Convênio"); 
                            }} 
                            className={`p-6 border rounded-2xl flex flex-col items-center text-center gap-4 transition-all duration-200
                              ${formData.modalidade === "Convênio" ? "border-zinc-900 dark:border-white bg-zinc-50 dark:bg-[#111111]" : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600"}`}
                          >
                            <ShieldCheck 
                              className={formData.modalidade === "Convênio" ? "text-zinc-900 dark:text-white" : "text-zinc-400"} 
                              size={24} 
                              strokeWidth={1.5} 
                            />
                            <span className="font-medium text-sm text-zinc-900 dark:text-white">
                              Convênio Médico
                            </span>
                          </motion.button>
                          
                          <motion.button 
                            variants={itemVariants} 
                            whileHover={{ scale: 1.02 }} 
                            whileTap={{ scale: 0.98 }} 
                            onClick={(e) => { 
                              e.preventDefault(); 
                              setValue("modalidade", "Particular"); 
                            }} 
                            className={`p-6 border rounded-2xl flex flex-col items-center text-center gap-4 transition-all duration-200
                              ${formData.modalidade === "Particular" ? "border-zinc-900 dark:border-white bg-zinc-50 dark:bg-[#111111]" : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600"}`}
                          >
                            <CreditCard 
                              className={formData.modalidade === "Particular" ? "text-zinc-900 dark:text-white" : "text-zinc-400"} 
                              size={24} 
                              strokeWidth={1.5} 
                            />
                            <span className="font-medium text-sm text-zinc-900 dark:text-white">
                              Atendimento Particular
                            </span>
                          </motion.button>
                       </div>
                     )}
                   </motion.div>
                )}

                {/* --- STEP 4: AGENDAMENTO (CALENDÁRIO) --- */}
                {step === 4 && (
                  <motion.div 
                    key="s4" 
                    variants={containerVariants} 
                    initial="hidden" 
                    animate="show" 
                    exit="exit" 
                    className="flex flex-col gap-8 w-full max-w-4xl mx-auto"
                  >
                    <motion.div variants={itemVariants} className="text-center md:text-left">
                      <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-zinc-900 dark:text-white">
                        Agendamento
                      </h2>
                      <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2">
                        Sincronize uma data disponível na clínica.
                      </p>
                    </motion.div>
                    
                    <div className="flex flex-col md:flex-row gap-8 w-full">
                      
                      {/* Calendário */}
                      <motion.div variants={itemVariants} className="w-full md:w-1/2">
                        <div className="flex justify-between items-center mb-6">
                          <button 
                            onClick={(e) => { e.preventDefault(); handlePrevMonth(); }} 
                            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                          >
                            <ChevronLeft size={16}/>
                          </button>
                          
                          <h3 className="font-medium text-zinc-900 dark:text-white capitalize text-sm">
                            {calendarMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                          </h3>
                          
                          <button 
                            onClick={(e) => { e.preventDefault(); handleNextMonth(); }} 
                            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                          >
                            <ChevronRight size={16}/>
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-7 gap-1 text-center mb-2">
                          {['D','S','T','Q','Q','S','S'].map((dia, i) => (
                            <div key={i} className="text-[10px] font-bold text-zinc-400 uppercase">
                              {dia}
                            </div>
                          ))}
                        </div>
                        
                        <div className="grid grid-cols-7 gap-1">
                          {renderCalendar()}
                        </div>
                      </motion.div>
                      
                      {/* Horários Livres */}
                      <div className="w-full md:w-1/2 flex flex-col">
                        <AnimatePresence mode="wait">
                          {formData.data_agendamento ? (
                            <motion.div 
                              key="has-date" 
                              initial={{ opacity: 0, x: 10 }} 
                              animate={{ opacity: 1, x: 0 }} 
                              exit={{ opacity: 0 }} 
                              className="h-full flex flex-col"
                            >
                              <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                                <div>
                                  <h4 className="font-medium text-zinc-900 dark:text-white text-sm">
                                    Horários
                                  </h4>
                                  <p className="text-[11px] text-zinc-500 mt-1 capitalize">
                                    {new Date(formData.data_agendamento + "T12:00:00").toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' })}
                                  </p>
                                </div>
                                
                                {buscandoHorarios && (
                                  <Activity size={16} className="text-zinc-400 animate-spin" />
                                )}
                              </div>
                              
                              <div className="grid grid-cols-3 gap-2 overflow-y-auto custom-scrollbar flex-1 max-h-[260px] pr-2">
                                {HORARIOS_BASE.map((hora) => {
                                  const isOcupado = horariosOcupados.includes(hora); 
                                  const isBloqueadoPorTempo = verificarHorarioPassado(hora); 
                                  const isDisabled = isOcupado || isBloqueadoPorTempo;
                                  
                                  return (
                                    <button 
                                      key={hora} 
                                      disabled={isDisabled || buscandoHorarios} 
                                      onClick={(e) => { 
                                        e.preventDefault(); 
                                        setValue("horario_agendamento", hora); 
                                      }} 
                                      className={`py-3 rounded-xl text-sm transition-all border
                                        ${isDisabled 
                                          ? "border-transparent text-zinc-300 dark:text-zinc-700 cursor-not-allowed line-through decoration-zinc-300 dark:decoration-zinc-700" 
                                          : formData.horario_agendamento === hora 
                                            ? "bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white font-medium" 
                                            : "bg-transparent text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600"
                                        }`}
                                    >
                                      {hora}
                                    </button>
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
                              className="h-full border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-zinc-500 p-8 text-center min-h-[250px]"
                            >
                              <CalendarIcon size={24} className="mb-4 text-zinc-300 dark:text-zinc-700" strokeWidth={1.5} />
                              <p className="text-sm">
                                Selecione uma data no calendário.
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* --- STEP 5: CHECKOUT / PAGAMENTO --- */}
                {step === 5 && (
                  <motion.div 
                    key="s5" 
                    variants={containerVariants} 
                    initial="hidden" 
                    animate="show" 
                    exit="exit" 
                    className="flex flex-col gap-6 w-full max-w-md mx-auto"
                  >
                    <motion.div variants={itemVariants} className="text-center mb-4">
                      <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-zinc-900 dark:text-white">
                        Checkout
                      </h2>
                      <p className="text-zinc-500 text-sm mt-2">
                        Ambiente seguro verificado.
                      </p>
                    </motion.div>
                    
                    <motion.div variants={itemVariants} className="p-6 md:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0A] shadow-sm w-full">
                      <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-4">
                        <span className="text-zinc-500 text-sm">
                          {formData.tipo_servico === "Exame" ? formData.subtipo_exame : formData.medico_profissional}
                        </span>
                        <span className="text-zinc-900 dark:text-white text-sm">
                          R$ {getValorConsulta().toFixed(2)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center mb-8">
                        <span className="font-medium text-zinc-900 dark:text-zinc-200">
                          Reserva (50%)
                        </span>
                        <span className="font-medium text-zinc-900 dark:text-white text-xl">
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
                          <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl text-center text-sm">
                            Credenciais Ausentes.
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </motion.div>
                )}

                {/* --- STEP 6: SUCESSO --- */}
                {step === 6 && (
                  <motion.div 
                    key="s6" 
                    initial={{ opacity: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    transition={springTransition} 
                    className="flex flex-col items-center justify-center text-center h-full w-full max-w-sm mx-auto py-8"
                  >
                    <div className="w-16 h-16 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black flex items-center justify-center mb-6">
                      <CheckCircle size={32} strokeWidth={2} />
                    </div>
                    
                    <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-zinc-900 dark:text-white">
                      Confirmado.
                    </h2>
                    
                    <p className="text-zinc-500 dark:text-zinc-400 mt-3 text-sm">
                      Seu agendamento foi registrado para o dia <span className="text-zinc-900 dark:text-zinc-200">{formData.data_agendamento?.split("-").reverse().join("/")}</span> às <span className="text-zinc-900 dark:text-zinc-200">{formData.horario_agendamento}h</span>.
                    </p>
                    
                    <div className="mt-8 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full text-left bg-zinc-50 dark:bg-[#111111]">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Paciente</span>
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-200">{formData.nome}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-zinc-200 dark:border-zinc-800 pt-4">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Protocolo</span>
                        <span className="text-sm font-mono text-zinc-900 dark:text-zinc-200">#{Math.floor(100000 + Math.random() * 900000)}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
                
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}