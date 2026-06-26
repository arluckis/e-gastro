"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Search, FileText, Download, ShieldCheck, AlertCircle, Activity, Sparkles } from "lucide-react";

// IMPORTANDO OS DOIS MENUS
import Navbar from "@/components/Navbar";
import SidebarPremium from "@/components/SidebarPremium";

const maskCPF = (v) => v.replace(/\D/g, "").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})/, "$1-$2").replace(/(-\d{2})\d+?$/, "$1");

export default function MeusExamesPage() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [exames, setExames] = useState(null);

  const handleBuscarExames = async (e) => {
    e.preventDefault();
    if (cpf.length !== 14) return;
    setLoading(true);

    try {
      const { data: paciente } = await supabase.from("pacientes").select("id, nome_completo").eq("cpf", cpf).maybeSingle();
      
      if (paciente) {
        const { data: lista } = await supabase
          .from("agendamentos")
          .select("*")
          .eq("paciente_id", paciente.id)
          .eq("tipo_servico", "Exame")
          .order("created_at", { ascending: false });

        setExames({ paciente: paciente.nome_completo, lista: lista || [] });
      } else {
        setExames({ paciente: null, lista: [] });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const springTransition = { type: "spring", stiffness: 450, damping: 35 };

  return (
    // Fundo Vercel Style: #FAFAFA para light mode, #000000 para dark mode absoluto
    <div className="flex min-h-screen w-full bg-[#FAFAFA] dark:bg-[#000000] text-zinc-900 dark:text-zinc-50 transition-colors duration-500 font-sans antialiased selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-black">
      
      {/* OS DOIS COMPONENTES ADICIONADOS AQUI */}
      <SidebarPremium isExpanded={isSidebarExpanded} setIsExpanded={setIsSidebarExpanded} />
      <Navbar />

      <main className={`flex-1 relative flex flex-col items-center w-full h-full min-h-screen overflow-hidden transition-[margin] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isSidebarExpanded ? "md:ml-[260px]" : "md:ml-[88px]"}`}>
        
        <div className="w-full h-full flex flex-col items-center justify-center p-4 md:p-8 pt-10 md:pt-16 z-10 pb-[100px] md:pb-8">
          
          <motion.div 
            layout 
            transition={springTransition}
            className="w-full max-w-[850px] bg-white dark:bg-[#0A0A0A] md:rounded-[24px] shadow-sm md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:md:shadow-[0_8px_30px_rgb(255,255,255,0.02)] border border-transparent md:border-zinc-200 dark:md:border-zinc-800 flex flex-col relative overflow-hidden"
          >
            <div className="p-6 md:p-12 w-full">
              
              <div className="border-b border-zinc-200 dark:border-zinc-800 pb-8 mb-10 text-center md:text-left">
                <span className="text-[10px] font-bold tracking-widest bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 px-3 py-1.5 rounded-full uppercase border border-zinc-200 dark:border-zinc-800">
                  Área do Paciente
                </span>
                <h1 className="text-3xl md:text-4xl font-light mt-6 tracking-tight text-zinc-900 dark:text-white">
                  Central de <span className="font-medium">Laudos.</span>
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2 leading-relaxed">
                  Acesse os históricos de endoscopias, colonoscopias e biópsias com criptografia ponta-a-ponta.
                </p>
              </div>

              <form onSubmit={handleBuscarExames} className="flex flex-col sm:flex-row gap-4 mb-10 w-full">
                <div className="relative flex-1 group">
                  <input 
                    value={cpf}
                    onChange={(e) => setCpf(maskCPF(e.target.value))}
                    placeholder="Digite seu CPF..." 
                    maxLength={14}
                    className="w-full bg-zinc-50 dark:bg-[#111111] border border-zinc-200 dark:border-zinc-800 rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:border-zinc-900 dark:focus:border-white focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition-all text-zinc-900 dark:text-white tracking-widest font-mono placeholder:font-sans placeholder:tracking-normal placeholder:font-normal"
                  />
                  <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-zinc-900 dark:group-focus-within:text-white transition-colors pointer-events-none" size={18} />
                </div>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={loading || cpf.length !== 14} 
                  type="submit" 
                  className="bg-zinc-900 dark:bg-white text-white dark:text-black font-medium px-8 py-4 rounded-2xl text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0 flex items-center justify-center gap-3"
                >
                  {loading ? <Activity className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  {loading ? "Buscando..." : "Consultar"}
                </motion.button>
              </form>

              <AnimatePresence mode="wait">
                {loading && (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                    className="py-16 text-center flex flex-col items-center gap-4"
                  >
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                      <Activity className="text-zinc-400" size={32} strokeWidth={2} />
                    </motion.div>
                    <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-400 animate-pulse">
                      Acessando Base de Dados...
                    </span>
                  </motion.div>
                )}

                {!loading && exames && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    {exames.paciente && (
                      <div className="flex items-center gap-2 mb-4 px-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#9FC131] animate-pulse" />
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                          Paciente: <span className="text-zinc-900 dark:text-zinc-200 ml-1">{exames.paciente}</span>
                        </p>
                      </div>
                    )}
                    
                    {exames.lista.length === 0 ? (
                      <div className="p-12 bg-zinc-50 dark:bg-[#111111] rounded-[24px] border border-dashed border-zinc-300 dark:border-zinc-800 text-center text-zinc-500 flex flex-col items-center justify-center gap-3">
                        <AlertCircle className="opacity-50 text-zinc-400" size={32} />
                        <p className="text-sm font-medium">Nenhum laudo encontrado.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                        {exames.lista.map((ex) => (
                          <div 
                            key={ex.id} 
                            className="p-5 bg-zinc-50 dark:bg-[#111111] border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors group"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shrink-0">
                                <FileText size={20} strokeWidth={2} className="text-zinc-900 dark:text-white" />
                              </div>
                              <div>
                                <h4 className="font-medium text-sm text-zinc-900 dark:text-white">
                                  {ex.subtipo_exame || "Exame Gastroenterológico"}
                                </h4>
                                <span className="text-xs text-zinc-500 block mt-1">
                                  Realizado em: <strong className="font-medium text-zinc-700 dark:text-zinc-300">{new Date(ex.data_agendamento).toLocaleDateString('pt-BR')}</strong>
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-0 border-zinc-200 dark:border-zinc-800 pt-4 sm:pt-0">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-zinc-200/50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                <ShieldCheck size={12}/> Assinado
                              </span>
                              <motion.button 
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => alert("O PDF do laudo será disponibilizado pelo repositório médico.")} 
                                className="p-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl hover:opacity-80 transition-opacity"
                              >
                                <Download size={16} strokeWidth={2} />
                              </motion.button>
                            </div>
                          </div>
                        ))}
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