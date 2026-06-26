'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { House, CalendarDays, FolderSearch, Sun, Moon, ChevronLeft, Activity } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

// ==========================================
// FÍSICA E ANIMAÇÕES
// ==========================================
const sidebarSpring = { type: "spring", stiffness: 350, damping: 35, mass: 1 };
const itemSpring = { type: "spring", stiffness: 400, damping: 30 };

// ==========================================
// COMPONENTE: TOOLTIP FLUTUANTE (Corrigido)
// ==========================================
const Tooltip = ({ children, text, isVisible }) => (
  <div className="relative flex items-center group/tooltip w-full">
    {children}
    {isVisible && (
      // Tooltip com Z-index colossal para sobrepor a tela ao lado
      <div className="absolute left-[calc(100%+24px)] px-4 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-black text-[11px] font-black tracking-widest uppercase rounded-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-300 shadow-[0_10px_40px_rgba(0,0,0,0.2)] whitespace-nowrap z-[99999] pointer-events-none">
        {text}
        <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-zinc-900 dark:bg-white rotate-45 rounded-sm" />
      </div>
    )}
  </div>
);

// ==========================================
// COMPONENTE: ITEM DE NAVEGAÇÃO
// ==========================================
const SidebarItem = ({ href, icon: Icon, label, isExpanded }) => {
  const pathname = usePathname();
  const isAtivo = pathname === href;

  return (
    <Tooltip text={label} isVisible={!isExpanded}>
      <Link 
        href={href} 
        // Agora os itens vão de borda a borda usando padding ao invés de margin lateral
        className={`relative flex items-center gap-4 py-4 px-6 w-full transition-all duration-300 outline-none group ${
          isAtivo ? "bg-black/[0.03] dark:bg-white/[0.05]" : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
        } ${isExpanded ? "" : "justify-center px-0"}`}
      >
        {isAtivo && (
          <motion.div 
            layoutId="active-sidebar-bg"
            transition={itemSpring}
            className="absolute inset-0 border-y border-black/5 dark:border-white/5 -z-10 shadow-[inset_0_1px_0px_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_0px_rgba(255,255,255,0.02)]" 
          />
        )}
        
        {/* Fita Edge-to-Edge Verde */}
        {isAtivo && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#9FC131] shadow-[0_0_12px_rgba(159,193,49,0.5)]" />
        )}
        
        <Icon 
          size={20} 
          strokeWidth={isAtivo ? 2 : 1.5} 
          className={`transition-colors duration-300 ${
            isAtivo 
              ? "text-zinc-900 dark:text-white" 
              : "text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300"
          }`} 
        />
        
        <AnimatePresence mode="wait">
          {isExpanded && (
            <motion.span 
              initial={{ opacity: 0, filter: "blur(2px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(2px)" }}
              className={`text-[14px] tracking-wide whitespace-nowrap transition-colors ${
                isAtivo ? "font-bold text-zinc-900 dark:text-white" : "font-medium text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300"
              }`}
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </Link>
    </Tooltip>
  );
};

// ==========================================
// COMPONENTE PRINCIPAL: SIDEBAR PREMIUM
// ==========================================
export default function SidebarPremium({ isExpanded, setIsExpanded }) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextState = !isDark;
    setIsDark(nextState);
    if (nextState) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  if (!mounted) return null;

  return (
    // Z-INDEX MASSIVO E OVERFLOW-VISIBLE PARA OS NOMEZINHOS (TOOLTIPS) NÃO CORTAREM
    <motion.aside 
      initial={false}
      animate={{ width: isExpanded ? 280 : 88 }}
      transition={sidebarSpring}
      className="hidden md:flex flex-col fixed inset-y-0 left-0 z-[99999] bg-[#FAFAFA]/95 dark:bg-[#050505]/95 backdrop-blur-[60px] saturate-[1.5] border-r border-zinc-200/80 dark:border-white/[0.04] shadow-[10px_0_40px_rgba(0,0,0,0.02)] dark:shadow-[10px_0_40px_rgba(0,0,0,0.4)] overflow-visible"
    >
      
      {/* Botão de Expansão Flutuante */}
      <div className="absolute top-9 -right-3.5 z-[999999]">
         <motion.button 
           whileHover={{ scale: 1.1 }}
           whileTap={{ scale: 0.9 }}
           onClick={() => setIsExpanded(!isExpanded)} 
           className="w-7 h-7 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white shadow-md transition-colors outline-none"
         >
            <motion.div animate={{ rotate: isExpanded ? 0 : 180 }} transition={{ duration: 0.4, ease: "circOut" }}>
              <ChevronLeft size={14} strokeWidth={2.5} />
            </motion.div>
         </motion.button>
      </div>

      {/* ÁREA DA LOGO */}
      <div className="mt-8 mb-10 px-6 flex items-center h-12">
        <Link href="/" className="flex items-center gap-4 group w-full outline-none">
          <div className="relative w-10 h-10 bg-zinc-900 dark:bg-white rounded-xl flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)] dark:shadow-[0_4px_12px_rgba(255,255,255,0.1)] transition-transform duration-500 group-hover:scale-105">
            <Activity className="text-white dark:text-zinc-900" size={20} strokeWidth={2.5} />
            <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#9FC131] rounded-full shadow-[0_0_8px_rgba(159,193,49,0.8)]" />
          </div>
          
          <AnimatePresence>
            {isExpanded && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex flex-col whitespace-nowrap overflow-hidden"
              >
                <span className="font-semibold text-[16px] tracking-tight text-zinc-900 dark:text-white leading-none mb-1">E-GASTRO</span>
                <span className="text-[9px] font-black tracking-[0.25em] text-zinc-400 uppercase">Clínica Autoral</span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* NAVEGAÇÃO Edge-to-Edge */}
      <nav className="flex-1 flex flex-col w-full overflow-y-auto overflow-x-hidden custom-scrollbar">
        <SidebarItem href="/" icon={House} label="Início" isExpanded={isExpanded} />
        <SidebarItem href="/agendamento" icon={CalendarDays} label="Agendamento" isExpanded={isExpanded} />
        <SidebarItem href="/meus-exames" icon={FolderSearch} label="Meus Exames" isExpanded={isExpanded} />
      </nav>

      {/* RODAPÉ: THEME TOGGLE (Botão Admin Apagado, Nomes do Tema Atualizados) */}
      <div className="pb-8 pt-4 w-full flex flex-col items-center border-t border-zinc-200/80 dark:border-white/[0.04]">
        <Tooltip text={isDark ? "Mudar para Claro" : "Mudar para Noturno"} isVisible={!isExpanded}>
          <button 
            onClick={toggleTheme}
            className={`flex items-center bg-zinc-100/80 dark:bg-[#111111]/80 border border-zinc-200 dark:border-white/5 rounded-2xl transition-all duration-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 outline-none group mx-4 w-[calc(100%-32px)] ${isExpanded ? "justify-between p-4" : "justify-center p-3.5"}`}
          >
            <div className="flex items-center gap-3 shrink-0">
              <AnimatePresence mode="wait">
                {isDark ? (
                  <motion.div key="moon" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                    <Moon className="text-zinc-500 group-hover:text-white transition-colors" size={18} strokeWidth={2} />
                  </motion.div>
                ) : (
                  <motion.div key="sun" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
                    <Sun className="text-zinc-500 group-hover:text-zinc-900 transition-colors" size={18} strokeWidth={2} />
                  </motion.div>
                )}
              </AnimatePresence>
              
              {isExpanded && (
                <span className="text-[12px] font-bold text-zinc-700 dark:text-zinc-300 tracking-wide overflow-hidden whitespace-nowrap">
                  {/* Se estiver Dark, mostra a opção para mudar pra Claro. Se Light, Noturno. */}
                  {isDark ? "Tema Claro" : "Tema Noturno"}
                </span>
              )}
            </div>
            
            {/* O Switch Animado */}
            {isExpanded && (
              <div className="w-10 h-5 bg-zinc-300 dark:bg-zinc-700 rounded-full relative flex items-center shadow-inner shrink-0 overflow-hidden border border-black/5 dark:border-white/5">
                <motion.div 
                  layout
                  transition={itemSpring}
                  className={`w-4 h-4 rounded-full absolute shadow-[0_2px_4px_rgba(0,0,0,0.3)] ${isDark ? 'right-0.5 bg-[#9FC131]' : 'left-0.5 bg-white'}`} 
                />
              </div>
            )}
          </button>
        </Tooltip>
      </div>

    </motion.aside>
  );
}