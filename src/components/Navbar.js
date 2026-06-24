'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { LogIn, Calendar, Home, Sparkles, Moon, Sun } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

// ==========================================
// CONFIGURAÇÕES DE FÍSICA (Framer Motion - Vercel/Linear Style)
// ==========================================
const liquidSpring = { type: "spring", stiffness: 400, damping: 30, mass: 0.8 };
const energeticSpring = { type: "spring", stiffness: 500, damping: 25, mass: 1 };

// ==========================================
// COMPONENTE: DOCK ITEM (MOBILE) - Ultra Premium iOS
// ==========================================
const DockItem = ({ href, icon: Icon, label }) => {
  const pathname = usePathname();
  const isAtivo = pathname === href;

  return (
    <Link 
      href={href} 
      className="relative flex flex-col items-center justify-center w-14 h-[56px] outline-none group z-10"
    >
      {isAtivo && (
        <motion.div 
          layoutId="mobile-dock-pill" 
          transition={liquidSpring} 
          className="absolute inset-0 mx-1 my-1 bg-black/5 dark:bg-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] rounded-[16px] border border-white/40 dark:border-white/10 -z-10" 
        />
      )}
      
      <motion.div 
        animate={{ 
          y: isAtivo ? -2 : 0,
          scale: isAtivo ? 1.05 : 1,
        }} 
        transition={energeticSpring}
        className="relative z-10 flex flex-col items-center"
      >
        <Icon 
          size={22} 
          strokeWidth={isAtivo ? 2 : 1.5} 
          className={`transition-colors duration-300 ${isAtivo ? "text-[#9FC131] drop-shadow-[0_2px_8px_rgba(159,193,49,0.3)]" : "text-slate-400 dark:text-slate-500"}`} 
        />
        <AnimatePresence>
          {isAtivo && (
            <motion.span 
              initial={{ opacity: 0, scale: 0.5, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 5 }}
              className="absolute -bottom-3.5 text-[8px] font-black uppercase tracking-widest text-[#9FC131]"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </Link>
  );
};

// ==========================================
// COMPONENTE: SIDEBAR ITEM (DESKTOP)
// ==========================================
const SidebarItem = ({ href, icon: Icon, label }) => {
  const pathname = usePathname();
  const isAtivo = pathname === href;

  return (
    <Link 
      href={href} 
      className="relative flex items-center w-full outline-none group z-10 py-3 px-4 rounded-2xl mb-1"
    >
      {isAtivo && (
        <motion.div 
          layoutId="desktop-sidebar-pill" 
          transition={liquidSpring} 
          className="absolute inset-0 bg-slate-100 dark:bg-[#162035] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-2xl border border-slate-200 dark:border-slate-800/80 -z-10" 
        />
      )}
      
      <motion.div 
        animate={{ x: isAtivo ? 4 : 0 }} 
        transition={energeticSpring}
        className="relative z-10 flex items-center gap-3 w-full"
      >
        <Icon 
          size={20} 
          strokeWidth={isAtivo ? 2.5 : 2} 
          className={isAtivo ? "text-[#9FC131]" : "text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors"} 
        />
        <span 
          className={`text-sm font-bold tracking-wide transition-colors ${isAtivo ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white"}`}
        >
          {label}
        </span>
      </motion.div>
    </Link>
  );
};

// ==========================================
// COMPONENTE PRINCIPAL: NAVBAR ORQUESTRADA
// ==========================================
export default function Navbar() {
  const [isDark, setIsDark] = useState(false);

  // Controle de Tema Robusto com LocalStorage
  useEffect(() => {
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

  return (
    <>
      {/* ======================================= */}
      {/* SIDEBAR DESKTOP (PREMIUM SAAS STYLE) */}
      {/* ======================================= */}
      <motion.aside 
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ ...liquidSpring, delay: 0.1 }}
        className="hidden md:flex flex-col fixed inset-y-0 left-0 w-[280px] z-[100] bg-white/80 dark:bg-[#0D1424]/80 backdrop-blur-3xl border-r border-slate-200 dark:border-[#1E293B]/60 p-6 shadow-[20px_0_40px_rgba(0,0,0,0.02)] dark:shadow-[20px_0_40px_rgba(0,0,0,0.4)]"
      >
        <div className="mb-12 mt-2 px-4">
          <Link href="/">
            <motion.div 
              whileHover={{ scale: 1.02 }} 
              whileTap={{ scale: 0.98 }} 
              transition={energeticSpring} 
              className="relative group inline-block"
            >
              <div className="absolute inset-0 bg-[#9FC131]/10 blur-2xl rounded-full group-hover:bg-[#9FC131]/30 transition-all duration-500" />
              <Image 
                src="/logo-egastro.png" 
                alt="Clínica E-Gastro" 
                width={120} 
                height={50} 
                className="relative object-contain dark:brightness-0 dark:invert transition-all duration-300" 
              />
            </motion.div>
          </Link>
        </div>

        <nav className="flex-1 flex flex-col gap-1">
          <SidebarItem href="/" icon={Home} label="Início" />
          <SidebarItem href="/agendamento" icon={Calendar} label="Agendamentos" />
        </nav>

        <div className="flex flex-col gap-3 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800">
          <button 
            onClick={toggleTheme}
            className="flex items-center gap-3 w-full py-3 px-4 rounded-2xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#162035] transition-all"
          >
            {isDark ? <Sun size={20} strokeWidth={2} /> : <Moon size={20} strokeWidth={2} />}
            <span className="text-sm font-bold tracking-wide">
              {isDark ? "Modo Claro" : "Modo Escuro"}
            </span>
          </button>

          <Link href="/login" className="w-full">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-between w-full p-4 rounded-2xl text-slate-900 dark:text-white bg-slate-100 dark:bg-[#162035] border border-slate-200 dark:border-slate-800 shadow-sm transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#9FC131]/20 flex items-center justify-center">
                  <LogIn size={14} className="text-[#9FC131]" />
                </div>
                <span className="text-xs font-black uppercase tracking-widest">Acesso Admin</span>
              </div>
            </motion.button>
          </Link>
        </div>
      </motion.aside>

      {/* ======================================= */}
      {/* DOCK MOBILE (LIQUID GLASS iOS STYLE) */}
      {/* ======================================= */}
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...liquidSpring, delay: 0.2 }}
        className="md:hidden fixed bottom-6 left-0 right-0 z-[100] flex justify-center pointer-events-none px-4"
      >
        <div className="relative flex items-center p-1.5 rounded-full bg-white/40 dark:bg-[#0D1424]/50 backdrop-blur-[50px] saturate-[2] border border-white/50 dark:border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.12),0_0_0_1px_rgba(255,255,255,0.1)] dark:shadow-[0_30px_60px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.05)] pointer-events-auto gap-1">
          
          <DockItem href="/" icon={Home} label="Início" />
          
          <Link href="/agendamento" className="relative outline-none z-20 group mx-1">
            <motion.div 
              whileTap={{ scale: 0.9 }} 
              className="relative flex items-center justify-center w-[56px] h-[50px]"
            >
              <motion.div 
                animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.7, 0.4] }} 
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-[#9FC131]/40 blur-xl rounded-full" 
              />
              <div className="relative flex items-center justify-center w-full h-full bg-gradient-to-br from-[#9FC131] to-[#7f9c24] rounded-full shadow-[0_8px_15px_rgba(159,193,49,0.3)] border border-[#b2d636]/60">
                <Sparkles size={11} className="absolute top-1.5 right-1.5 text-white/70 dark:text-[#090D16]/50" />
                <Calendar size={22} className="text-white dark:text-[#090D16]" strokeWidth={2} />
              </div>
            </motion.div>
          </Link>
          
          <button 
            onClick={toggleTheme} 
            className="relative flex flex-col items-center justify-center w-14 h-[56px] outline-none group z-10"
          >
             <motion.div whileTap={{ scale: 0.9 }} className="relative z-10 flex flex-col items-center">
                {isDark ? (
                  <Sun size={22} strokeWidth={1.5} className="text-slate-400 dark:text-slate-500" />
                ) : (
                  <Moon size={22} strokeWidth={1.5} className="text-slate-400 dark:text-slate-500" />
                )}
             </motion.div>
          </button>

        </div>
      </motion.div>
    </>
  );
}