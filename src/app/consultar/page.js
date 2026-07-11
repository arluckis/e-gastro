"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Search, FileText, CalendarCheck, Activity, User, HeartPulse, Clock } from "lucide-react";

import Navbar from "@/components/Navbar";
import SidebarPremium from "@/components/SidebarPremium";

const maskCPF = (v) => v.replace(/\D/g, "").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})/, "$1-$2").replace(/(-\d{2})\d+?$/, "$1");

export default function ConsultarAgendamentosPage() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState(null);

  const handleBuscarAgendamentos = async (e) => {
    e.preventDefault();
    if (cpf.length !== 14) return;
    setLoading(true);

    try {
      const { data: paciente } = await supabase.from("pacientes").select("id, nome_completo").eq("cpf", cpf).maybeSingle();
      
      if (paciente) {
        // Busca todos os agendamentos sem filtrar apenas por "Exame"
        const { data: lista } = await supabase
          .from("agendamentos")
          .select("*")
          .eq("paciente_id", paciente.id)
          .order("created_at", { ascending: false });

        setDados({ paciente: paciente.nome_completo, lista: lista || [] });
      } else {
        setDados({ paciente: null, lista: [] });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getIconAndColor = (tipo) => {
    switch(tipo) {
      case "Consulta": return { icon: User, color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20" };
      case "Exame": return { icon: HeartPulse, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" };
      case "Retorno": return { icon: Activity, color: "text-purple-500", bg: "bg-purple-500/10 border-purple-500/20" };
      default: return { icon: FileText, color: "text-zinc-500", bg: "bg-zinc-500/10 border-zinc-500/20" };
    }
  };

  const springTransition = { type: "spring", stiffness: 400, damping: 30 };

  return (
    <div className="flex min-h-[100dvh] w-full bg-[#FAFAFA] dark:bg-[#000000] text-zinc-900 dark:text-zinc-50 transition-colors duration-500 font-sans antialiased selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-black">
      
      <SidebarPremium isExpanded={isSidebarExpanded} setIsExpanded={setIsSidebarExpanded} />
      <Navbar />

      <main className={`flex-1 relative flex flex-col items-center w-full min-h-[100dvh] overflow-hidden transition-[margin] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isSidebarExpanded ? "md:ml-[260px]" : "md:ml-[88px]"}`}>
        
        <div className="w-full h-full flex flex-col items-center justify-center p-4 md:p-8 pt-12 md:pt-16 z-10 pb-[120px] md:pb-8 relative">
          
          <motion.div 
            layout 
            transition={springTransition}
            className="w-full max-w-[850px] bg-white/70 dark:bg-[#0A0A0A]/70 backdrop-blur-3xl md:rounded-[32px] shadow-2xl md:shadow-[0_20px_60px_rgba(0,0,0,0.04)] dark:md:shadow-[0_20px_60px_rgba(255,255,255,0.02)] border border-zinc-200/50 dark:border-zinc-800/50 flex flex-col relative overflow-hidden"
          >
            <div className="p-6 md:p-12 w-full">
              
              <div className="border-b border-zinc-200/60 dark:border-zinc-800/60 pb-8 mb-10 text-center md:text-left">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em] bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 px-3.5 py-1.5 rounded-full uppercase border border-zinc-200/50 dark:border-zinc-800/50">
                  <CalendarCheck size={12} /> Portal do Paciente
                </span>
                <h1 className="text-3xl md:text-5xl font-light mt-6 tracking-tight text-zinc-900 dark:text-white">
                  Meus <span className="font-semibold">Agendamentos.</span>
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-3 leading-relaxed max-w-xl">
                  Consulte de forma unificada e segura todo o seu histórico de consultas, retornos e exames agendados na clínica.
                </p>
              </div>

              <form onSubmit={handleBuscarAgendamentos} className="flex flex-col sm:flex-row gap-3 mb-10 w-full relative z-20">
                <div className="relative flex-1 group">
                  <input 
                    value={cpf}
                    onChange={(e) => setCpf(maskCPF(e.target.value))}
                    placeholder="Informe seu CPF" 
                    maxLength={14}
                    className="w-full bg-zinc-50/50 dark:bg-[#111111]/50 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl px-6 py-4 pt-5 text-[15px] font-medium outline-none focus:border-zinc-900 dark:focus:border-white focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] text-zinc-900 dark:text-white tracking-widest font-mono placeholder:font-sans placeholder:tracking-normal placeholder:font-normal peer"
                  />
                  <label className="absolute left-6 top-1.5 text-[9px] font-bold text-zinc-400 uppercase tracking-widest pointer-events-none transition-all">Documento</label>
                  <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-zinc-900 dark:group-focus-within:text-white transition-colors pointer-events-none" size={18} />
                </div>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={loading || cpf.length !== 14} 
                  type="submit" 
                  className="bg-zinc-900 dark:bg-white hover:bg-black dark:hover:bg-zinc-200 text-white dark:text-black font-semibold px-8 py-4 rounded-2xl text-[13px] uppercase tracking-wide disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0 flex items-center justify-center gap-3 shadow-lg"
                >
                  {loading ? <Activity className="animate-spin" size={18} /> : <Search size={18} />}
                  {loading ? "Processando" : "Consultar"}
                </motion.button>
              </form>

              <AnimatePresence mode="wait">
                {loading && (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                    className="py-16 text-center flex flex-col items-center gap-4"
                  >
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                      <Activity className="text-zinc-400" size={32} strokeWidth={1.5} />
                    </motion.div>
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-400 animate-pulse">
                      Acessando Base de Dados Segura
                    </span>
                  </motion.div>
                )}

                {!loading && dados && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    {dados.paciente && (
                      <div className="flex items-center gap-2 mb-6 px-2">
                        <div className="w-2 h-2 rounded-full bg-[#9FC131] shadow-[0_0_8px_rgba(159,193,49,0.8)] animate-pulse" />
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                          Paciente Confirmado: <span className="text-zinc-900 dark:text-zinc-100 ml-1">{dados.paciente}</span>
                        </p>
                      </div>
                    )}
                    
                    {dados.lista.length === 0 ? (
                      <div className="p-12 bg-zinc-50/50 dark:bg-[#111111]/50 rounded-[32px] border border-dashed border-zinc-200 dark:border-zinc-800 text-center flex flex-col items-center justify-center gap-4 shadow-inner">
                        <Clock className="opacity-20 text-zinc-900 dark:text-white" size={48} strokeWidth={1} />
                        <p className="text-sm font-medium text-zinc-500">Nenhum histórico de agendamento encontrado.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 max-h-[450px] overflow-y-auto custom-scrollbar pr-2">
                        {dados.lista.map((item) => {
                          const conf = getIconAndColor(item.tipo_servico);
                          const Icone = conf.icon;
                          
                          return (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              key={item.id} 
                              className="p-5 bg-white dark:bg-[#0F0F0F] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:shadow-md transition-all duration-300 group"
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${conf.bg}`}>
                                  <Icone size={20} strokeWidth={2} className={conf.color} />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-[15px] text-zinc-900 dark:text-white leading-tight">
                                    {item.tipo_servico === "Exame" ? item.subtipo_exame : item.medico_profissional}
                                  </h4>
                                  <span className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400 block mt-1 tracking-wide">
                                    {item.tipo_servico} • {new Date(item.data_agendamento).toLocaleDateString('pt-BR')} às {item.horario_agendamento}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-0 border-zinc-100 dark:border-zinc-800/50 pt-4 sm:pt-0">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
                                  Confirmado
                                </span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}