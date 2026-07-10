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
  ShieldCheck, CreditCard, Calendar as CalendarIcon, RefreshCw,
  HelpCircle, MessageCircle, CalendarPlus
} from "lucide-react";

import Navbar from "@/components/Navbar";
import SidebarPremium from "@/components/SidebarPremium";

if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_MP_PUBLIC_KEY) {
  initMercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY, { locale: 'pt-BR' });
}

const URL_WEBHOOK_PUSH = "https://acessoapi.rmchat.com.br/w/875a4a21-8b19-42f1-97d7-d420f72f4310";

const dispararPushRmChat = async (telefonePaciente, nomePaciente, textoPersonalizado) => {
  try {
    let num = telefonePaciente.replace(/\D/g, "");
    
    if (num.length === 11 && num.charAt(2) === '9') {
      num = num.substring(0, 2) + num.substring(3); 
    }
    
    const numeroLimpo = "55" + num;
    
    const payload = { name: nomePaciente, number: numeroLimpo, texto: textoPersonalizado };
    await axios.post(URL_WEBHOOK_PUSH, payload, { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error("❌ Falha RM Chat:", error);
  }
};

const gerarMensagemConfirmacao = (nome, servico, data, hora, idade) => {
  const tipoConsulta = servico;
  const alertaIdade = idade >= 65 ? "\n⚠ Pacientes com 65 anos ou mais devem passar por uma consulta com um cardiologista ou anestesista antes de realizar o exame." : "";
  
  return `🩺 Confirmação de Agendamento – Clínica E-Gastro\nOlá! ${nome}\nSua ${tipoConsulta} está agendada para:\n📅 Data: ${data}\n⏰ Horário: ${hora}\n📍 Endereço: Rua João Vieira Carneiro, 957, Pedro Gondim, João Pessoa – PB${alertaIdade}\n\n👉 Veja a localização no Google Maps: https://maps.app.goo.gl/zBF4TNLPVRnxWDcL8`;
};

const HORARIOS_BASE = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const NOME_ETAPAS = ["Sincronização", "Identificação", "Especialidade", "Triagem", "Modalidade", "Agenda", "Checkout", "Concluído"];

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

const gerarData = (dataBase, horarioBase, diasSubtrair, horaEspecifica) => {
  const d = new Date(`${dataBase}T12:00:00-03:00`); 
  d.setDate(d.getDate() - diasSubtrair);
  if (horaEspecifica) {
    const [h, m] = horaEspecifica.split(':');
    d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
  } else if (horarioBase) {
    const [h, m] = horarioBase.split(':');
    d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
  }
  if (d.getTime() < Date.now()) return new Date(Date.now() + 60000).toISOString(); 
  return d.toISOString();
};

const calcularDataLimite = (dataBase, dias, tipoContagem) => {
  let d = new Date(dataBase);
  let diasAdicionados = 0;
  while (diasAdicionados < dias) {
    d.setDate(d.getDate() + 1);
    if (tipoContagem === "uteis") {
      if (d.getDay() !== 0 && d.getDay() !== 6) diasAdicionados++; 
    } else {
      diasAdicionados++;
    }
  }
  return d;
};

// Mapeamento dos médicos vindos do RM Chat via URI
const mapaMedicos = {
  "1": { tipo: "Consulta", nome: "Dra. Simone" },
  "2": { tipo: "Consulta", nome: "Dr. Brilhante" },
  "3": { tipo: "Consulta", nome: "Dr. Tiago Lima" },
  "4": { tipo: "Consulta", nome: "Dr. Hugo Dyevy" },
  "5": { tipo: "Consulta", nome: "Dra. Candice" },
  "6": { tipo: "Exame", nome: "Endoscopia Digestiva Alta" },
  "7": { tipo: "Exame", nome: "Colonoscopia" }
};

const programarMensagensMedicas = async (formData) => {
  const { nome, telefone_whatsapp, data_agendamento, horario_agendamento, tipo_servico, subtipo_exame, data_nascimento, medico_profissional } = formData;
  let mensagens = [];
  const dataFormatada = data_agendamento.split("-").reverse().join("/");
  const profName = tipo_servico === "Exame" ? subtipo_exame : medico_profissional;

  mensagens.push({
    telefone_whatsapp, nome_paciente: nome,
    data_hora_programada: gerarData(data_agendamento, horario_agendamento, 0, `${(parseInt(horario_agendamento.split(':')[0]) + 2).toString().padStart(2, '0')}:00`),
    mensagem: `Obrigada por escolher o E-Gastro! 💙 Se tiver qualquer dúvida ou precisar de suporte, é só nos chamar. Estamos aqui para ajudar sempre! Se for possível, você pode deixar um comentário sobre sua experiência? Isso nos ajuda a melhorar cada vez mais o nosso atendimento 🙏 ➡ https://share.google/uFFEOKCkCvbxZMRKU Agradecemos muito pela sua confiança! 💙`
  });

  if (tipo_servico === "Consulta" || tipo_servico === "Retorno") {
    mensagens.push({
      telefone_whatsapp, nome_paciente: nome,
      data_hora_programada: gerarData(data_agendamento, null, 1, "08:00"),
      mensagem: `Olá, ${nome}! Passando para lembrar da sua consulta agendada com ${profName} para amanhã, dia ${dataFormatada} às ${horario_agendamento}. Por favor, responda esta mensagem para confirmar sua presença.`
    });
  }

  if (tipo_servico === "Exame") {
    if (subtipo_exame === "Endoscopia Digestiva Alta") {
      mensagens.push({
        telefone_whatsapp, nome_paciente: nome, data_hora_programada: new Date(Date.now() + 120000).toISOString(),
        mensagem: `Olá, ${nome}. Sua Endoscopia foi pré-agendada! 📝\n\n*Orientações Importantes:*\n- É obrigatório jejum para o exame;\n- Venha com um acompanhante maior de 18 anos;\n- 🛑 *ATENÇÃO:* Se você faz uso de medicamentos para emagrecimento (Mounjaro, Ozempic, Wegovy), eles devem ser suspensos por 15 dias antes do exame.`
      });
      mensagens.push({
        telefone_whatsapp, nome_paciente: nome, data_hora_programada: gerarData(data_agendamento, null, 3, "08:00"),
        mensagem: `Olá! Seu exame de endoscopia digestiva alta está chegando. Por aqui já queremos garantir que tudo dê certo, então fique atento(a) ao preparo: ⚠ O exame exige jejum absoluto! Nos próximos dias, enviaremos lembretes com horários e detalhes do jejum. Se faz uso de medicações diariamente ou tiver alguma dúvida sobre seus remédios, nos avise. Lembre também de providenciar um(a) acompanhante maior de 18 anos para o dia do exame!`
      });
      mensagens.push({
        telefone_whatsapp, nome_paciente: nome, data_hora_programada: gerarData(data_agendamento, null, 1, "08:00"),
        mensagem: `Faltam 24 horas para sua endoscopia! Hoje, preste atenção ao jantar: 🍽 Se jantar carne, o jejum deve começar 12 horas antes do exame. 🥗 Se NÃO jantar carne, o jejum pode iniciar 8 horas antes. Lembre-se de não comer ou beber mais nada a partir do horário recomendado, nem mesmo água. Tenha certeza de que seu acompanhante está confirmado para o dia do exame! Se tomou medicação hoje, siga rigorosamente a orientação do seu médico.`
      });
      mensagens.push({
        telefone_whatsapp, nome_paciente: nome, data_hora_programada: gerarData(data_agendamento, null, 1, "20:00"),
        mensagem: `Está chegando a hora! Reforçando:\nSe consumiu carne no jantar, inicie seu jejum agora.\nSe não consumiu carne, você pode iniciar o jejum 8 horas antes do exame. A partir do início do jejum, não coma nem beba NADA, obs: noticia boa a agua ou agua de coco pode ser consumido ate 3 horas antes do exame. Qualquer dúvida de última hora, chame a gente!`
      });
      mensagens.push({
        telefone_whatsapp, nome_paciente: nome, data_hora_programada: gerarData(data_agendamento, null, 0, "06:00"),
        mensagem: `Hoje é o dia do seu exame de endoscopia! Lembre-se:\nO jejum precisa ser absoluto (inclusive água, balas, chicletes)\nTraga um documento com foto\n\nVenha SEM acessorios 💍 e objetos metálicos\nVenha acompanhado(a) por um adulto maior de 18 anos\nRoupas leves, (Bermuda, vestido…) 📍 Endereço da Clínica para sua Endoscopia: Rua João Vieira Carneiro, 957 Bairro: Pedro Gondim, João Pessoa - PB 👉 Clique aqui para abrir no Google Maps: https://maps.app.goo.gl/zBF4TNLPVRnxWDcL8 Se precisar de qualquer orientação para chegar até o local, estamos à disposição! 😊`
      });
    }

    if (subtipo_exame === "Colonoscopia") {
      mensagens.push({
        telefone_whatsapp, nome_paciente: nome, data_hora_programada: new Date(Date.now() + 120000).toISOString(),
        mensagem: `Guia de Preparo para Colonoscopia Com PICOPREP - e-GASTRO\n\nÉ fundamental que o intestino esteja sem resíduos fecais para que a colonoscopia possa ser realizada com segurança e qualidade. Com esse objetivo em mente, solicitamos seguir à risca as orientações abaixo.\n\nCOMO DEVE SER A ALIMENTAÇÃO NOS DIAS QUE ANTECEDEM O EXAME?\n. 3 dias antes da colonoscopia: Suspender a ingestão de sementes, amendoim, nozes, avelã, castanhas e cereais integrais, como: linhaça, trigo, aveia, centeio, cevada, quinoa, granola e cereais matinais.\n. 1 dia antes da colonoscopia dieta leve até o almoço. Após o almoço, não ingerir mais nada sólido ( ! )\nPERMITIDO: purê de batatas ou aipim, arroz branco, ovo cozido, frango ou peixe grelhados, batata cozida, caldo ou sopa COADOS, macarrão sem molho, biscoito de água e sal, pão de forma ou francês, torrada e gelatina, suco COADO, chás claros, água de côco.\nPROIBIDO: Carnes vermelhas, milho, verduras e legumes em geral, frutas, leite e derivados (iogurte, queijo etc), bebidas escuras (suco de uva, café, coca cola, chá preto, chá mate e bebidas alcoólicas). Após o almoço, não ingerir mais nada sólido, ingerir apenas líquidos claros (2 litros), como: água, água de coco ou Gatorade® de laranja ou limão, caldos claros coados.\n\nNO DIA DO EXAME: JEJUM COMPLETO DE ALIMENTOS!\nJejum absoluto no dia do exame é essencial para garantir a segurança e qualidade da colonoscopia. Para evitar desidratação, que pode ocorrer com o uso de laxantes, procure ingerir 1-2 litros de líquidos claros. É permitido a ingestão de água, água de côco ou Gatorade® de laranja ou limão até 3 horas antes do exame! Suspender completamente a ingestão de líquidos 3 horas antes da colonoscopia.\n\nCOMO E QUANDO DEVO TOMAR OS LAXANTES PARA A LIMPEZA INTESTINAL?\nPara a limpeza intestinal é necessário o uso de 2 tipos de laxantes: GUTTALAX e PICOPREP + SIMETICONA. O ideal é que ocorram de 8-12 evacuações para a limpeza completa do intestino. Um sinal de que o preparo intestinal ficou bom é a eliminação de fezes completamente líquidas, com aspecto de urina amarelo-esverdeada.\n\n1º LAXANTE: Para ser usado 1 dia antes do exame (véspera), às 11:00h:\nDUCOLAX ou BISACODIL 5MG: tomar 03 comprimidos. Esse laxante leva cerca de 6 horas para fazer efeito. OBS.: se idoso, usar só 02 comp. : se diarreia, usar só 01 comp.\n\n2º LAXANTE: O horário de tomada do PICOPREP varia conforme o período em que foi agendado o exame.\nPICOPREP + SIMETICONA:\n- usar 2 sachês dissolvidos às 18 horas\n- usar mais 2 sachês 6 a 8 horas antes do horário agendado do exame.\n\nCOMO PREPARAR? Dissolver os sachês em 200 ml de água na temperatura natural e 50 gotas de SIMETICONA (primeiro colocar a água no copo e depois o pó, esperar esfriar). Após ingerir cada preparo, tomar 1,5 litros de água, água de côco ou Gatorate, em pequenos goles - parar 3 horas antes do exame!!!\n\nO QUE FAZER EM CASO DE NÁUSEAS, VÔMITOS OU DOR NA BARRIGA? Em caso de náuseas e/ou vômitos, VONAU 8 mg, 1 cp, via sublingual, podendo repetir a dose em 2 horas, se não melhorar. Em caso de cólicas na barriga, BUSCOPAN COMPOSTO ou BUSCODUO (para alérgicos à dipirona), 1 cp, via oral, podendo repetir a dose em 6 horas, se não melhorar.`
      });
    }

    if (subtipo_exame === "Retirada de Balão Gástrico") {
      mensagens.push({
        telefone_whatsapp, nome_paciente: nome, data_hora_programada: new Date(Date.now() + 120000).toISOString(),
        mensagem: `Estas são as orientações para a retirada do seu balão Gástrico: 🙂\n\nDieta 3 dias que antecedem a retirada do balão só LIQUIDOS RESTRITOS ( água, água de coco, chás, gatorate, suco coado, sorvete e picolé de fruta SEM LEITE, GELATINA e caldo de legumes COADO)☕\nTomar 1 litro de coca-cola ZERO nos 3 dias que antecedem a retirada( 1 litros a cada dia) 3\n. Tomar 01 cápsula de FLUCONAZOL 150mg 1 semana antes da retirada\nJejum de 12 horas antes da retirada ( só pode água até 3 horas antes do exame) ⚠\n\nVir acompanhado com um responsável 👫\nNão consumir proteínas ou suplementos. 🍖\n\nPode tomar as suas medicações rotineiras( pressão, diabetes, tireóide,...)💊\nDIGESAN capsula ou gotas vespera 3 x ao dia ( 35 gotas)\n3 dias antes dieta liquida clara restrita igual do inicio do balão.`
      });
    }
  }

  if(mensagens.length > 0){
     await supabase.from('fila_mensagens').insert(mensagens);
  }
};

export default function AgendamentoPremium() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  return (
    <div className="flex min-h-[100dvh] w-full bg-[#FAFAFA] dark:bg-black text-zinc-900 dark:text-zinc-50 transition-colors duration-500 font-sans antialiased">
      <SidebarPremium isExpanded={isSidebarExpanded} setIsExpanded={setIsSidebarExpanded} />
      <Navbar />
      <main className={`flex-1 relative flex flex-col items-center transition-[margin] duration-500 ease-in-out w-full min-h-[100dvh] overflow-hidden ${isSidebarExpanded ? "md:ml-[260px]" : "md:ml-[88px]"}`}>
        <Suspense fallback={<div className="min-h-[100dvh] flex items-center justify-center w-full"><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-8 h-8 border-[3px] border-zinc-900 dark:border-white border-t-transparent rounded-full" /></div>}>
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
  const timeSlotsRef = useRef(null); 
  
  const [servicosDB, setServicosDB] = useState([]);
  const [perguntasDB, setPerguntasDB] = useState([]);
  const [respostasTriagem, setRespostasTriagem] = useState({});
  const [bloqueioExtraCalculado, setBloqueioExtraCalculado] = useState(null);

  const [pixData, setPixData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const checkingRef = useRef(false);
  const timeLeftRef = useRef(timeLeft);

  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  const [context, setContext] = useState({ isSmartLink: false, personalizedName: "", dataUltimaConsulta: null, userFound: false, checkingUser: false });
  const [calendarMonth, setCalendarMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [agenda, setAgenda] = useState({ ocupados: [], buscando: false });
  
  const [flags, setFlags] = useState({
    cpfUrl: false, nomeUrl: false, sobrenomeUrl: false, telUrl: false, emailUrl: false, nascUrl: false,
    unlockedAll: false,
    exibirConfUri: false, confirmouUri: false
  });

  const { register, watch, trigger, setValue, formState: { errors }, reset } = useForm({ resolver: zodResolver(schema), mode: "onChange" });
  const formData = watch();

  const fetchBaseData = async () => {
    const [{ data: srvs }, { data: pergs }, { data: ops }] = await Promise.all([
      supabase.from("servicos").select("*").eq("ativo", true),
      supabase.from("perguntas_triagem").select("*").eq("ativa", true),
      supabase.from("opcoes_triagem").select("*")
    ]);
    
    if (srvs) setServicosDB(srvs);
    if (pergs && ops) {
      const pergsFull = pergs.map(p => ({
        ...p, opcoes: ops.filter(o => o.pergunta_id === p.id)
      }));
      setPerguntasDB(pergsFull);
    }
  };

  useEffect(() => {
    fetchBaseData();
  }, []);

  // Busca do serviço de forma mais inteligente para evitar problemas de case, espaços ou pontos
  const getSelectedService = () => {
    if (!formData.tipo_servico) return null;
    const nomeBusca = formData.tipo_servico === "Exame" ? formData.subtipo_exame : formData.medico_profissional;
    if (!nomeBusca) return null;
    
    // Tentativa 1: Busca exata ignorando case/espaços extras
    let srv = servicosDB.find(s => s.nome.trim().toLowerCase() === nomeBusca.trim().toLowerCase());
    
    // Tentativa 2: Busca aproximada ignorando o "Dra." / "Dr." caso haja diferença de escrita no banco
    if (!srv) {
      const nomeLimpo = nomeBusca.toLowerCase().replace(/dra\.|dr\./g, "").trim();
      srv = servicosDB.find(s => s.nome.toLowerCase().includes(nomeLimpo));
    }
    
    return srv;
  };
  
  const selectedSrv = getSelectedService();
  const valorEntrada = selectedSrv ? (selectedSrv.preco / 2) : 0;
  
  const perguntasAtuais = selectedSrv ? perguntasDB.filter(p => p.servico_id === selectedSrv.id) : [];

  const showIsland = (msg, type = "error") => {
    setIslandMessage(msg); setIslandState(type);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!["loading", "success"].includes(type) && step !== 7) timeoutRef.current = setTimeout(() => setIslandState("default"), 3000);
  };

  const isStepValid = () => {
    if (step === 0) return true;
    if (step === 1) return formData.cpf?.length === 14 && formData.nome?.length >= 2 && formData.sobrenome?.length >= 2 && formData.telefone_whatsapp?.length >= 14 && helpers.isValidDate(formData.data_nascimento) && formData.email?.includes('@');
    if (step === 2) {
      if (flags.exibirConfUri && !flags.confirmouUri) return false;
      if (!formData.tipo_servico) return false;
      if (["Consulta", "Retorno"].includes(formData.tipo_servico) && !formData.medico_profissional) return false;
      if (formData.tipo_servico === "Exame" && !formData.subtipo_exame) return false;
      return true;
    }
    if (step === 3) return perguntasAtuais.every(p => respostasTriagem[p.id]);
    if (step === 4) return formData.modalidade || formData.tipo_servico === "Retorno";
    if (step === 5) return formData.data_agendamento && formData.horario_agendamento;
    return false;
  };

  useEffect(() => {
    const nomeUrl = searchParams.get("nome");
    const cpfUrl = searchParams.get("cpf");
    const medicoUrl = searchParams.get("medico");
    const wppUrl = searchParams.get("whatsapp");
    const emailUrl = searchParams.get("email");
    const nascUrl = searchParams.get("nascimento");

    if ((nomeUrl !== null || cpfUrl !== null || medicoUrl !== null || wppUrl !== null) && !context.isSmartLink) {
      
      if (nomeUrl) {
        const parts = nomeUrl.trim().split(" ");
        setValue("nome", parts[0] || "");
        setValue("sobrenome", parts.slice(1).join(" ") || "");
      }
      if (cpfUrl) setValue("cpf", masks.cpf(cpfUrl));
      
      // Filtro para remover o 55 do WhatsApp caso ele venha na URL
      let limpaWpp = wppUrl ? wppUrl.replace(/\D/g, "") : "";
      if (limpaWpp.startsWith("55") && (limpaWpp.length === 12 || limpaWpp.length === 13)) {
        limpaWpp = limpaWpp.substring(2);
      }
      if (limpaWpp) setValue("telefone_whatsapp", masks.phone(limpaWpp));
      
      if (emailUrl) setValue("email", emailUrl);
      if (nascUrl) setValue("data_nascimento", masks.date(nascUrl));

      const hasCpf = !!(cpfUrl && cpfUrl.trim() !== "");
      const hasNome = !!(nomeUrl && nomeUrl.trim() !== "");
      const hasTel = !!(limpaWpp && limpaWpp.trim() !== "");
      const hasEmail = !!(emailUrl && emailUrl.trim() !== "");
      const hasNasc = !!(nascUrl && nascUrl.trim() !== "");
      const hasMedico = !!(medicoUrl && medicoUrl.trim() !== "");

      setFlags(f => ({ 
        ...f, 
        cpfUrl: hasCpf, 
        nomeUrl: hasNome, 
        sobrenomeUrl: hasNome && nomeUrl.trim().split(" ").length > 1, 
        telUrl: hasTel,
        emailUrl: hasEmail,
        nascUrl: hasNasc,
        exibirConfUri: hasMedico
      }));
      
      setContext(c => ({ 
        ...c, 
        isSmartLink: true, 
        personalizedName: nomeUrl ? nomeUrl.trim().split(" ")[0] : "" 
      }));
      
      if (hasMedico) {
        const mapped = mapaMedicos[medicoUrl];
        if (mapped) {
          setValue("tipo_servico", mapped.tipo);
          setValue(mapped.tipo === "Consulta" ? "medico_profissional" : "subtipo_exame", mapped.nome);
        } else if (servicosDB.length > 0) {
          const srv = servicosDB.find(s => s.nome.toLowerCase().includes(medicoUrl.toLowerCase()));
          if (srv) {
            setValue("tipo_servico", srv.tipo);
            setValue(srv.tipo === "Consulta" ? "medico_profissional" : "subtipo_exame", srv.nome);
          } else {
            setValue("medico_profissional", medicoUrl);
          }
        }
      }

      const cpfValid = cpfUrl && cpfUrl.replace(/\D/g, "").length === 11;
      const telValid = limpaWpp.length >= 10;
      const nomeValid = nomeUrl && nomeUrl.trim().split(" ").length > 1;

      if (cpfValid && telValid && nomeValid && hasEmail && hasNasc) {
        setStep(2); 
      } else {
        setStep(1); 
      }
    }
  }, [searchParams, context.isSmartLink, servicosDB, setValue]);

  const handleCpfLookup = async () => {
    if (formData.cpf?.length !== 14) return;
    setContext(c => ({ ...c, checkingUser: true }));
    if (!context.isSmartLink || flags.unlockedAll) ["nome", "sobrenome", "telefone_whatsapp", "email", "data_nascimento"].forEach(f => setValue(f, ""));

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
      
      if (step === 1) {
        const isStep1Valid = await trigger(["cpf", "nome", "sobrenome", "telefone_whatsapp", "data_nascimento", "email"]);
        if (!isStep1Valid) {
          if (!formData.cpf || formData.cpf.length !== 14) return showIsland("CPF incompleto (14 dígitos).");
          if (!formData.nome || formData.nome.length < 2) return showIsland("Informe o primeiro nome.");
          if (!formData.sobrenome || formData.sobrenome.length < 2) return showIsland("Informe o sobrenome completo.");
          if (!formData.telefone_whatsapp || formData.telefone_whatsapp.length < 14) return showIsland("WhatsApp incompleto.");
          if (!formData.data_nascimento || !helpers.isValidDate(formData.data_nascimento)) return showIsland("Data de nascimento inválida.");
          if (!formData.email || !formData.email.includes('@')) return showIsland("E-mail inválido.");
          
          return showIsland("Verifique os dados informados.");
        }
      }
      
      if (step === 2) {
        if (flags.exibirConfUri && flags.confirmouUri) {
          return setStep(perguntasAtuais.length > 0 ? 3 : 4);
        }
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
        
        if (perguntasAtuais.length === 0) {
          setStep(4);
          setIslandState("default");
          return;
        }
      }

      if (step === 3) {
        // Validação Rígida da Triagem
        if (!isStepValid()) {
          return showIsland("Responda todas as perguntas obrigatórias da triagem.");
        }

        let maiorBloqueioTriagem = null;
        Object.values(respostasTriagem).forEach(opt => {
          if (opt && opt.regra_bloqueio_dias > 0) {
            const tempDate = calcularDataLimite(new Date(), opt.regra_bloqueio_dias, opt.tipo_contagem_dias || "corridos");
            if (!maiorBloqueioTriagem || tempDate > maiorBloqueioTriagem) maiorBloqueioTriagem = tempDate;
          }
        });
        setBloqueioExtraCalculado(maiorBloqueioTriagem);
      }

      if (step === 4 && !formData.modalidade && formData.tipo_servico !== "Retorno") return showIsland("Defina a modalidade.");
      
      if (step === 5) {
        if (!formData.data_agendamento || !formData.horario_agendamento) return showIsland("Escolha uma data e horário.");
        if (formData.tipo_servico === "Retorno" && context.dataUltimaConsulta && Math.ceil(Math.abs(new Date(formData.data_agendamento) - context.dataUltimaConsulta) / 86400000) > 30) return showIsland("Prazo excedido (> 30 dias).");
        
        if (formData.tipo_servico === "Retorno" || formData.modalidade === "Convênio") {
          if (await salvarNoBanco(false)) { 
            await dispararWebhook(false); 
            await programarMensagensMedicas(formData); 
            
            const nomePaciente = `${formData.nome} ${formData.sobrenome}`.trim();
            const profName = formData.tipo_servico === "Exame" ? formData.subtipo_exame : formData.medico_profissional;
            const dataFormatada = formData.data_agendamento.split("-").reverse().join("/");
            const msgConfirmacao = gerarMensagemConfirmacao(nomePaciente, profName, dataFormatada, formData.horario_agendamento, helpers.calcAge(formData.data_nascimento));
            
            await dispararPushRmChat(formData.telefone_whatsapp, nomePaciente, msgConfirmacao);

            showIsland("Agendamento Finalizado", "success"); 
            return setStep(7); 
          }
          return showIsland("Erro ao salvar.");
        }
        return setStep(6);
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
          amount: Number(valorEntrada.toFixed(2)), 
          description: `Entrada - ${formData.medico_profissional || formData.subtipo_exame}`,
          payer: {
            ...mpPayer,
            email: mpPayer.email || formData.email,
            first_name: mpPayer.first_name || formData.nome,
            last_name: mpPayer.last_name || formData.sobrenome,
            identification: mpPayer.identification || { type: "CPF", number: formData.cpf ? formData.cpf.replace(/\D/g, "") : "" }
          }
        };

        const res = await fetch("/api/pagamento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await res.json();
        
        if (data.success && ["approved", "in_process", "pending"].includes(data.status)) {
           const isPix = data.status === "pending";
           
           if (!(await salvarNoBanco(!isPix))) { showIsland("Erro ao gerar agendamento."); return resolve(); }

           const telefonePaciente = formData.telefone_whatsapp;
           const nomePaciente = `${formData.nome} ${formData.sobrenome}`.trim();
           const dataFormatada = formData.data_agendamento.split("-").reverse().join("/");
           const profName = formData.tipo_servico === "Exame" ? formData.subtipo_exame : formData.medico_profissional;

           if (!isPix) {
             await dispararWebhook(true);
             await programarMensagensMedicas(formData);
             
             const msgConfirmacao = gerarMensagemConfirmacao(nomePaciente, profName, dataFormatada, formData.horario_agendamento, helpers.calcAge(formData.data_nascimento));
             await dispararPushRmChat(telefonePaciente, nomePaciente, `✅ Pagamento recebido com sucesso!\n\n` + msgConfirmacao);

             showIsland("Pagamento Aprovado", "success");
           } else {
             if (data.transaction_data) {
               setPixData({ ...data.transaction_data, payment_id: data.id });
               setTimeLeft(300);
               
               const limitDate = new Date(Date.now() + 5 * 60000);
               const hora_limite = `${String(limitDate.getHours()).padStart(2, '0')}:${String(limitDate.getMinutes()).padStart(2, '0')}`;
               const valorFormatado = valorEntrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
               
               await dispararPushRmChat(
                 telefonePaciente, 
                 nomePaciente, 
                 `Olá, ${nomePaciente}! ⏳ Falta pouco para garantir seu agendamento de ${profName}.\n\nPor favor, realize o pagamento via Pix no valor de *R$ ${valorFormatado}* em até 5 minutos (até as ${hora_limite} para finalizar).\n\n🔹 *Chave Pix (Copia e Cola):*\n${data.transaction_data.qr_code}\n\nAssim que o pagamento for processado, você receberá a confirmação automática.`
               );
             }
             showIsland("Pix gerado com sucesso!", "success");
           }
           setStep(7);
        } else {
           showIsland("Pagamento recusado.");
        }
      } catch (err) { 
        showIsland("Erro de conexão.", "error"); 
      }
      resolve();
    });
  };

  useEffect(() => {
    if (!pixData?.payment_id || timeLeft <= 0) return;
    const timerInterval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerInterval);
  }, [pixData?.payment_id]);

  const verificarPagamentoPixAutomatico = async (paymentId) => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    
    try {
      const res = await fetch(`/api/verificar-pagamento?id=${paymentId}`);
      const result = await res.json();

      if (result.success && result.status === "approved") {
        const { data: paciente } = await supabase.from("pacientes").select("id").eq("cpf", formData.cpf).maybeSingle();
        if (paciente) {
          await supabase.from("agendamentos")
            .update({ status_pagamento_antecipado: true })
            .eq("paciente_id", paciente.id)
            .eq("data_agendamento", formData.data_agendamento)
            .eq("horario_agendamento", formData.horario_agendamento);
        }

        await programarMensagensMedicas(formData);
        const nomePaciente = `${formData.nome} ${formData.sobrenome}`.trim();
        const dataFormatada = formData.data_agendamento.split("-").reverse().join("/");
        const profName = formData.tipo_servico === "Exame" ? formData.subtipo_exame : formData.medico_profissional;

        const msgConfirmacao = gerarMensagemConfirmacao(nomePaciente, profName, dataFormatada, formData.horario_agendamento, helpers.calcAge(formData.data_nascimento));

        await dispararPushRmChat(
          formData.telefone_whatsapp, 
          nomePaciente, 
          `✅ Pagamento Pix confirmado!\n\n` + msgConfirmacao
        );

        setPixData(null); 
        setTimeLeft(0);
        showIsland("Pagamento Confirmado!", "success");
      }
    } catch (e) {
      console.error("Erro no polling:", e);
    } finally {
      checkingRef.current = false;
    }
  };

  useEffect(() => {
    if (!pixData?.payment_id) return;
    const pollInterval = setInterval(() => {
      if (timeLeftRef.current > 0 && !checkingRef.current) {
        verificarPagamentoPixAutomatico(pixData.payment_id);
      }
    }, 10000); 
    return () => clearInterval(pollInterval);
  }, [pixData?.payment_id]);

  const cnInputWrap = "relative rounded-2xl bg-zinc-50/50 dark:bg-[#111111]/50 border border-zinc-200/80 dark:border-zinc-800/80 transition-all duration-300 focus-within:border-zinc-900 dark:focus-within:border-white focus-within:bg-white dark:focus-within:bg-[#0A0A0A] focus-within:shadow-[0_4px_20px_rgba(0,0,0,0.03)] focus-within:ring-1 focus-within:ring-zinc-900 dark:focus-within:ring-white overflow-hidden";
  const cnInput = "w-full p-4 pt-7 bg-transparent outline-none text-zinc-900 dark:text-white font-medium text-[16px] peer placeholder-transparent";
  const cnLabel = "absolute left-4 top-2 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest transition-all duration-300 peer-placeholder-shown:top-4.5 peer-placeholder-shown:text-[14px] peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:text-zinc-900 dark:peer-focus:text-white pointer-events-none";

  const renderLockedOrInput = (formKey, label, value, isLocked, maskFn, placeholder, maxLength, type = "text") => {
    if (isLocked && value) {
       return (
          <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 py-3 last:border-0">
             <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase block tracking-wider">{label}</span>
                <span className="text-[15px] font-medium text-zinc-900 dark:text-white mt-0.5 block">{value}</span>
             </div>
             <button onClick={() => setFlags(f => ({...f, unlockedAll: true}))} className="p-2.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-full flex items-center justify-center">
               <Pencil size={14}/>
             </button>
          </div>
       );
    }
    
    return (
       <div className={`${cnInputWrap} my-3 last:mb-0`}>
          <input 
            type={type} 
            {...register(formKey)} 
            onChange={e => {
              const val = maskFn ? maskFn(e.target.value) : e.target.value;
              setValue(formKey, val);
            }} 
            maxLength={maxLength} 
            placeholder={placeholder} 
            className={cnInput} 
          />
          <label className={cnLabel}>{label}</label>
       </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-[#FAFAFA] dark:bg-black -z-20 pointer-events-none" />
      
      {/* Dynamic Island Feedback - Centralizada no container MAIN ignorando a sidebar */}
      <div className="absolute top-6 left-0 right-0 w-full z-[9999] px-4 flex justify-center pointer-events-none">
        <motion.div layout className={`pointer-events-auto rounded-full px-5 py-2.5 max-w-sm flex transition-colors shadow-[0_8px_30px_rgb(0,0,0,0.12)] ${islandState === "error" ? "bg-red-500 text-white" : islandState === "success" ? "bg-[#9FC131] text-black font-medium" : "bg-black/90 dark:bg-white/90 backdrop-blur-xl text-white dark:text-black border border-transparent dark:border-black/10"}`}>
          <AnimatePresence mode="wait">
             {islandState === "error" && <motion.div key="e" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-2 text-xs"><AlertTriangle size={14} />{islandMessage}</motion.div>}
             {islandState === "success" && <motion.div key="s" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-2 text-xs"><CheckCircle size={14} />{islandMessage}</motion.div>}
             {islandState === "loading" && <motion.div key="l" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-3 text-xs"><Activity size={14} className="animate-spin opacity-80" />{islandMessage || "Processando"}</motion.div>}
             {islandState === "default" && <motion.div key="d" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-4"><div className="flex gap-1.5">{NOME_ETAPAS.slice(1,7).map((_, i) => <div key={i} className={`h-1.5 rounded-full transition-all ${step === i + 1 ? "w-4 bg-white dark:bg-black" : step > i + 1 ? "w-1.5 bg-white/40 dark:bg-black/40" : "w-1.5 bg-white/10 dark:bg-black/10"}`}/>)}</div><div className="text-[10px] tracking-widest text-zinc-400 dark:text-zinc-500 border-l border-zinc-700 dark:border-zinc-300 pl-4 uppercase">{NOME_ETAPAS[step === 0 ? 1 : step]}</div></motion.div>}
          </AnimatePresence>
        </motion.div>
      </div>

      <div className="w-full h-[100dvh] flex flex-col items-center justify-center p-0 md:p-8 pt-[70px] md:pt-[90px] z-10 relative">
        <motion.div layout transition={{ type: "spring", stiffness: 450, damping: 35 }} className="w-full max-w-[800px] flex-1 md:flex-none md:h-[85vh] md:max-h-[750px] bg-white dark:bg-[#0A0A0A] md:rounded-[32px] border-0 md:border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden shadow-2xl md:shadow-[0_20px_60px_rgba(0,0,0,0.06)] dark:md:shadow-[0_20px_60px_rgba(0,0,0,0.3)] relative">
          
          {/* HEADER FIXO DO MODAL */}
          {step >= 0 && step <= 6 && (
            <div className="flex-none grid grid-cols-3 items-center px-4 md:px-8 py-3 md:py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur-md z-20">
              
              <div className="flex justify-start">
                {step > 0 ? (
                  <button onClick={() => setStep(p => (p === 4 && perguntasAtuais.length === 0) ? 2 : p - 1)} className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white text-[13px] font-medium transition-colors">
                    <ChevronLeft size={18} /> Voltar
                  </button>
                ) : <div />}
              </div>
              
              <div className="flex justify-center text-[10px] md:text-[11px] uppercase tracking-widest font-bold text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                {step > 0 && step <= 6 ? `Etapa ${step} de 6` : ''}
              </div>

              <div className="flex justify-end">
                {step !== 6 && !(step === 2 && flags.exibirConfUri && !flags.confirmouUri) ? (
                  <button
                    onClick={nextStep}
                    disabled={loading || (step === 1 && formData.cpf?.length !== 14)}
                    className={`font-bold text-[12px] px-5 py-2.5 rounded-full flex items-center justify-center gap-1.5 uppercase transition-all duration-300 shadow-sm whitespace-nowrap ${
                      isStepValid()
                        ? "bg-zinc-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black hover:scale-[1.02] active:scale-[0.98]"
                        : "bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-600"
                    }`}
                  >
                    {loading ? "Processando" : (step === 5 && (formData.modalidade === "Convênio" || formData.tipo_servico === "Retorno") ? "Finalizar" : "Continuar")}
                    {!loading && <ArrowRight size={14}/>}
                  </button>
                ) : <div />}
              </div>

            </div>
          )}

          {/* CORPO ROLÁVEL */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12 pb-16 md:pb-12">
            <AnimatePresence mode="wait">
              
              {step === 0 && (
                <motion.div key="s0" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="text-center mt-20 max-w-sm mx-auto">
                  <h1 className="text-4xl md:text-5xl font-light">
                    Olá{context.personalizedName ? <><span className="font-medium">, {context.personalizedName}</span></> : ""}.
                  </h1>
                  <p className="text-zinc-500 mt-4 text-sm">Conectamos o seu painel de agendamento ao ambiente clínico em segurança.</p>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div key="s1" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="max-w-lg mx-auto space-y-6">
                  <div><h2 className="text-3xl font-medium">Dados de Acesso</h2><p className="text-zinc-500 text-sm mt-2">Verifique ou insira as informações.</p></div>
                  
                  {context.isSmartLink && !flags.unlockedAll ? (
                    <div className="p-7 bg-zinc-50/80 dark:bg-[#111111]/80 border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl shadow-sm">
                      <div className="flex justify-between items-start mb-6">
                        <h3 className="text-lg font-medium">Dados do Paciente</h3>
                        <button onClick={() => setFlags(f => ({ ...f, unlockedAll: true }))} className="text-[11px] font-bold uppercase text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex gap-1.5 items-center transition-colors">
                          <Pencil size={12}/> Editar Tudo
                        </button>
                      </div>
                      
                      <div className="flex flex-col">
                        {renderLockedOrInput("cpf", "CPF do Paciente", formData.cpf, flags.cpfUrl, masks.cpf, "000.000.000-00", 14)}
                        
                        {flags.nomeUrl && flags.sobrenomeUrl && formData.nome && formData.sobrenome ? (
                           <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 py-3">
                              <div>
                                 <span className="text-[10px] font-bold text-zinc-400 uppercase block tracking-wider">Nome Completo</span>
                                 <span className="text-[15px] font-medium text-zinc-900 dark:text-white mt-0.5 block">{formData.nome} {formData.sobrenome}</span>
                              </div>
                              <button onClick={() => setFlags(f => ({...f, unlockedAll: true}))} className="p-2.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-full flex items-center justify-center">
                                <Pencil size={14}/>
                              </button>
                           </div>
                        ) : (
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                              <div className={cnInputWrap}><input {...register("nome")} className={cnInput} placeholder="Nome" /><label className={cnLabel}>Primeiro Nome</label></div>
                              <div className={cnInputWrap}><input {...register("sobrenome")} className={cnInput} placeholder="Sobrenome" /><label className={cnLabel}>Sobrenome Completo</label></div>
                           </div>
                        )}

                        {renderLockedOrInput("telefone_whatsapp", "WhatsApp", formData.telefone_whatsapp, flags.telUrl, masks.phone, "(00) 90000-0000", 15)}
                        {renderLockedOrInput("data_nascimento", "Data de Nascimento", formData.data_nascimento, flags.nascUrl, masks.date, "DD/MM/AAAA", 10)}
                        {renderLockedOrInput("email", "E-mail de Contato", formData.email, flags.emailUrl, null, "seu@email.com", undefined, "email")}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className={cnInputWrap}>
                        <input {...register("cpf")} onChange={e => setValue("cpf", masks.cpf(e.target.value))} maxLength={14} placeholder="000.000.000-00" className={`${cnInput} font-mono`} />
                        <label className={cnLabel}>CPF do Paciente</label>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          {context.checkingUser ? <Activity size={16} className="text-zinc-400 animate-spin"/> : formData.cpf?.length === 14 ? <CheckCircle size={16} className="text-zinc-900 dark:text-white"/> : <Search size={16} className="text-zinc-300 dark:text-zinc-700"/>}
                        </div>
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
                      <h3 className="text-2xl font-medium">Verificação de Agendamento</h3>
                      <p className="text-zinc-500 text-sm mt-2">Você selecionou através do WhatsApp:</p>
                      
                      <div className="my-6 inline-block bg-zinc-50 dark:bg-[#111111] border border-zinc-200 dark:border-zinc-800 px-8 py-5 rounded-3xl w-full shadow-sm">
                        <span className="block font-semibold text-lg text-zinc-900 dark:text-white">{formData.medico_profissional || formData.subtipo_exame}</span>
                        <span className="block text-[11px] font-bold text-zinc-400 uppercase mt-2 tracking-widest">{formData.tipo_servico}</span>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 mt-4">
                        <button onClick={() => { setFlags(f => ({...f, confirmouUri: true})); setStep(perguntasAtuais.length > 0 ? 3 : 4); }} className="w-full sm:w-1/2 py-3.5 bg-zinc-900 hover:bg-black text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black rounded-full font-bold text-sm shadow-md transition-transform hover:scale-[1.02]">
                          Continuar
                        </button>
                        <button onClick={() => { setFlags(f => ({...f, exibirConfUri: false})); setValue("medico_profissional", ""); setValue("subtipo_exame", "");}} className="w-full sm:w-1/2 py-3.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-[#111111] rounded-full font-medium text-sm transition-colors text-zinc-900 dark:text-white">
                          Selecionar outro profissional
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row gap-6 w-full">
                      <div className="w-full md:w-1/3 flex flex-col gap-3">
                        {[{id: "Consulta", i: User}, {id: "Retorno", i: Activity}, {id: "Exame", i: HeartPulse}].map(s => (
                          <button key={s.id} onClick={() => { setValue("tipo_servico", s.id); setValue("medico_profissional", ""); setValue("subtipo_exame", ""); }} className={`p-4 rounded-2xl flex items-center gap-4 border text-left w-full transition-all ${formData.tipo_servico === s.id ? "border-zinc-900 bg-zinc-50 dark:border-white dark:bg-[#111111] shadow-sm scale-[1.01]" : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"}`}><s.i size={18} className={formData.tipo_servico === s.id ? "" : "text-zinc-400"} /><span className={`text-sm ${formData.tipo_servico === s.id ? "font-semibold" : "font-medium"}`}>{s.id}</span></button>
                        ))}
                      </div>
                      <div className="w-full md:w-2/3">
                        {["Consulta", "Retorno"].includes(formData.tipo_servico) && (
                          <div><label className="text-[10px] font-bold text-zinc-400 uppercase mb-3 block tracking-widest">Corpo Clínico</label><div className="grid gap-3">
                            {servicosDB.filter(s => s.tipo === "Consulta").map(m => (
                              <button key={m.id} onClick={() => setValue("medico_profissional", m.nome)} className={`p-4 border rounded-2xl text-left text-sm transition-all ${formData.medico_profissional === m.nome ? "border-zinc-900 font-semibold bg-zinc-50 dark:border-white dark:bg-[#111111] shadow-sm scale-[1.01]" : "border-zinc-200 dark:border-zinc-800 font-medium text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"}`}>{m.nome}</button>
                            ))}
                          </div></div>
                        )}
                        {formData.tipo_servico === "Exame" && (
                          <div><label className="text-[10px] font-bold text-zinc-400 uppercase mb-3 block tracking-widest">Exames</label><div className="grid gap-3">
                            {servicosDB.filter(s => s.tipo === "Exame").map(e => (
                              <button key={e.id} onClick={() => setValue("subtipo_exame", e.nome)} className={`p-4 border rounded-2xl text-left text-sm transition-all ${formData.subtipo_exame === e.nome ? "border-zinc-900 font-semibold bg-zinc-50 dark:border-white dark:bg-[#111111] shadow-sm scale-[1.01]" : "border-zinc-200 dark:border-zinc-800 font-medium text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"}`}>{e.nome}</button>
                            ))}
                          </div></div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="s3" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="max-w-xl mx-auto space-y-6">
                  <div><h2 className="text-3xl font-medium">Triagem Clínica</h2><p className="text-zinc-500 text-sm mt-2">Responda para prosseguir com o preparo.</p></div>
                  
                  <div className="space-y-6 mt-6">
                    {perguntasAtuais.map((pergunta, index) => (
                      <div key={pergunta.id} className="p-6 bg-zinc-50/80 dark:bg-[#111111]/80 border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl">
                        <h4 className="font-medium text-sm flex items-start gap-2 mb-4">
                          <HelpCircle size={18} className="text-zinc-400 shrink-0 mt-0.5" /> 
                          {pergunta.pergunta}
                        </h4>
                        <div className="grid gap-2">
                          {pergunta.opcoes.map(opcao => (
                            <button 
                              key={opcao.id} 
                              onClick={() => setRespostasTriagem(prev => ({...prev, [pergunta.id]: opcao}))}
                              className={`p-3.5 text-sm text-left border rounded-2xl transition-all ${respostasTriagem[pergunta.id]?.id === opcao.id ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white shadow-md scale-[1.01]" : "bg-white dark:bg-black border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"}`}
                            >
                              {opcao.texto_opcao}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div key="s4" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="max-w-lg mx-auto text-center space-y-6">
                  <div><h2 className="text-3xl font-medium">Garantia Financeira</h2><p className="text-zinc-500 text-sm mt-2">Escolha a cobertura.</p></div>
                  {formData.tipo_servico === "Retorno" ? (
                    <div className="p-8 border rounded-3xl bg-zinc-50 dark:bg-[#111111]"><ShieldCheck className="w-10 h-10 mx-auto mb-4 text-zinc-400" /><h3 className="text-lg font-medium">Retorno Isento</h3><p className="text-sm text-zinc-500 mt-2">Dentro da janela regulamentar de 30 dias.</p></div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {[{id: "Convênio", i: ShieldCheck, lbl: "Convênio Médico"}, {id: "Particular", i: CreditCard, lbl: "Particular"}].map(m => (
                        <button key={m.id} onClick={() => setValue("modalidade", m.id)} className={`p-6 border rounded-3xl flex flex-col items-center gap-4 transition-all ${formData.modalidade === m.id ? "border-zinc-900 bg-zinc-50 dark:border-white dark:bg-[#111111] shadow-md scale-[1.02]" : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"}`}><m.i size={28} className={formData.modalidade === m.id ? "" : "text-zinc-400"} /><span className="font-medium text-sm">{m.lbl}</span></button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {step === 5 && (
                <motion.div key="s5" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="max-w-4xl mx-auto">
                  <div className="mb-8"><h2 className="text-3xl font-medium">Agendamento</h2><p className="text-zinc-500 text-sm mt-2">Sincronize uma data.</p></div>
                  <div className="flex flex-col md:flex-row gap-8">
                    
                    <div className="w-full md:w-1/2">
                      <div className="flex justify-between items-center mb-6"><button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="p-1.5"><ChevronLeft size={16}/></button><h3 className="font-medium text-sm capitalize">{calendarMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</h3><button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="p-1.5"><ChevronRight size={16}/></button></div>
                      <div className="grid grid-cols-7 gap-1 text-center mb-2">{['D','S','T','Q','Q','S','S'].map((d,i)=><div key={i} className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{d}</div>)}</div>
                      <div className="grid grid-cols-7 gap-1 md:gap-1.5">
                        {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() }).map((_, i) => <div key={`e-${i}`} className="aspect-square"/>)}
                        {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }).map((_, i) => {
                          const d = i + 1, y = calendarMonth.getFullYear(), m = calendarMonth.getMonth();
                          const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                          
                          const minDiasBloqueio = formData.tipo_servico === "Exame" ? 1 : 0;
                          const diasBloqueioPadrao = Math.max(selectedSrv?.dias_bloqueio_padrao || 0, minDiasBloqueio);

                          const dataSrv = calcularDataLimite(new Date(), diasBloqueioPadrao, selectedSrv?.tipo_contagem_dias || "corridos");
                          const limiteFinalData = (!bloqueioExtraCalculado || dataSrv > bloqueioExtraCalculado) ? dataSrv : bloqueioExtraCalculado;
                          
                          const cellDate = new Date(y, m, d);
                          const isPastOrBlocked = cellDate <= limiteFinalData || [0, 6].includes(cellDate.getDay());
                          const isSel = formData.data_agendamento === dateStr;
                          
                          return (
                            <button 
                              key={d} 
                              disabled={isPastOrBlocked} 
                              onClick={() => {
                                setValue("data_agendamento", dateStr);
                                setTimeout(() => {
                                  timeSlotsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 150);
                              }} 
                              className={`aspect-square rounded-2xl text-sm transition-all duration-300 ${isPastOrBlocked ? "opacity-30 cursor-not-allowed text-zinc-400 dark:text-zinc-600" : isSel ? "bg-zinc-900 text-white dark:bg-white dark:text-black font-bold scale-[1.05] shadow-md" : "hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium active:scale-95"}`}
                            >
                              {d}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    
                    <div className="w-full md:w-1/2" ref={timeSlotsRef}>
                      {formData.data_agendamento ? (
                         <div>
                           <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-4 pt-4 md:pt-0"><h4 className="font-medium text-sm">Horários</h4>{agenda.buscando && <Activity size={16} className="text-zinc-400 animate-spin"/>}</div>
                           <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[260px] pr-2 custom-scrollbar">
                             {HORARIOS_BASE.map(h => {
                               const off = agenda.ocupados.includes(h) || (formData.data_agendamento === helpers.getToday() && new Date().setHours(...h.split(':'),0,0) <= Date.now() + 3600000);
                               return <button key={h} disabled={off} onClick={() => setValue("horario_agendamento", h)} className={`py-3.5 rounded-2xl text-sm border transition-all ${off ? "border-transparent text-zinc-300 dark:text-zinc-700 line-through cursor-not-allowed" : formData.horario_agendamento === h ? "bg-zinc-900 border-zinc-900 text-white dark:bg-white dark:border-white dark:text-black font-bold shadow-md scale-[1.02]" : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"}`}>{h}</button>;
                             })}
                           </div>
                         </div>
                      ) : <div className="h-full border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl flex flex-col items-center justify-center text-zinc-500 min-h-[250px]"><CalendarIcon size={32} className="mb-4 opacity-40"/><p className="text-sm">Selecione uma data</p></div>}
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 6 && (
                <motion.div key="s6" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="max-w-md mx-auto mt-6">
                  <div className="text-center mb-6"><h2 className="text-3xl font-medium">Checkout</h2><p className="text-zinc-500 text-sm mt-2">Ambiente seguro verificado.</p></div>
                  <div className="p-8 rounded-[32px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0A] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
                    <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-4"><span className="text-zinc-500 text-sm">{formData.tipo_servico === "Exame" ? formData.subtipo_exame : formData.medico_profissional}</span><span className="text-sm">R$ {(valorEntrada*2).toFixed(2)}</span></div>
                    <div className="flex justify-between items-center mb-8"><span className="font-medium">Reserva (50%)</span><span className="font-medium text-xl">R$ {valorEntrada.toFixed(2)}</span></div>
                    {process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ? <Payment initialization={{ amount: valorEntrada > 0 ? valorEntrada : 1 }} onSubmit={onSubmitMP} customization={{ paymentMethods: { ticket: "all", bankTransfer: "all", creditCard: "all", debitCard: "all", mercadoPago: "all" }}} /> : <div className="p-4 bg-red-50 text-red-600 rounded-xl text-center text-sm">Credenciais Ausentes.</div>}
                  </div>
                </motion.div>
              )}

              {step === 7 && (
                <motion.div key="s7" initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="flex flex-col items-center justify-center text-center max-w-sm mx-auto py-8">
                  <div className={`w-20 h-20 rounded-full ${pixData ? "bg-indigo-600" : "bg-zinc-900 dark:bg-white"} text-white ${!pixData && "dark:text-black"} flex items-center justify-center mb-6 shadow-xl`}>
                    {pixData ? <CreditCard size={36} /> : <CheckCircle size={36} />}
                  </div>
                  
                  <h2 className="text-3xl font-medium">{pixData ? "Finalize seu pagamento" : "Agendamento Confirmado"}</h2>
                  <p className="text-zinc-500 mt-4 text-sm leading-relaxed">
                    {pixData 
                      ? `Sua vaga de ${formData.tipo_servico === "Exame" ? formData.subtipo_exame : formData.medico_profissional} para o dia ${formData.data_agendamento?.split("-").reverse().join("/")} às ${formData.horario_agendamento}h está pré-reservada. Efetue o pagamento para garantir o agendamento.` 
                      : `Seu agendamento para o dia ${formData.data_agendamento?.split("-").reverse().join("/")} às ${formData.horario_agendamento}h foi registrado com sucesso.`}
                  </p>

                  {pixData && (
                    <div className="mt-8 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 w-full text-center bg-zinc-50/50 dark:bg-[#111111]/50">
                      <h3 className="text-[11px] font-bold uppercase text-zinc-500 mb-5 tracking-widest">Escaneie o QR Code</h3>
                      <img src={`data:image/jpeg;base64,${pixData.qr_code_base64}`} alt="QR Code Pix" className="w-52 h-52 mx-auto rounded-2xl border border-zinc-200 p-2 bg-white shadow-sm" />
                      <div className="mt-6">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-2 tracking-wider">Ou use o Copia e Cola</span>
                        <div className="flex bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-2xl p-2 items-center mb-6 shadow-sm">
                          <input readOnly value={pixData.qr_code} className="w-full text-xs bg-transparent outline-none text-zinc-500 px-3 truncate" />
                          <button onClick={() => { navigator.clipboard.writeText(pixData.qr_code); showIsland("Código copiado!", "success"); }} className="bg-zinc-900 hover:bg-black text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black px-5 py-2.5 rounded-xl text-xs font-bold transition-colors">Copiar</button>
                        </div>
                        
                        <div className="mt-4 flex flex-col items-center justify-center p-5 bg-white dark:bg-[#0A0A0A] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            {timeLeft > 0 && <RefreshCw size={12} className="animate-spin text-zinc-400" />}
                            Verificação Automática
                          </span>
                          <div className="text-3xl font-mono font-medium tracking-wider text-zinc-900 dark:text-white">
                            {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
                          </div>
                          {timeLeft === 0 && <span className="text-xs text-red-500 mt-3 font-medium">Tempo limite expirado.</span>}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-8 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 w-full text-left bg-zinc-50 dark:bg-[#111111]">
                    <div className="flex justify-between mb-4"><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Paciente</span><span className="text-sm font-medium">{formData.nome}</span></div>
                    <div className="flex justify-between border-t border-zinc-200 dark:border-zinc-800 pt-4"><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Status</span><span className="text-sm font-mono">{pixData ? "Aguardando Pagamento" : "Confirmado"}</span></div>
                  </div>

                  {!pixData && (
                    <div className="mt-8 flex flex-col gap-3 w-full">
                      <button onClick={() => window.open(`https://wa.me/5583999999999`, "_blank")} className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-full font-bold flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]">
                        <MessageCircle size={18} />
                        Falar no WhatsApp
                      </button>
                      <button onClick={() => window.location.reload()} className="w-full py-4 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-900 dark:text-white rounded-full font-medium flex items-center justify-center gap-2 transition-colors">
                        <CalendarPlus size={18} />
                        Realizar Novo Agendamento
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>

        </motion.div>
      </div>
    </>
  );
}