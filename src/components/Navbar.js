'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { House, CalendarDays, FolderSearch, Moon, Sun, ChevronLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';

// ==========================================
// FÍSICA MOTION DESIGN (Apple Spring)
// ==========================================
const liquidSpring = { type: "spring", stiffness: 400, damping: 30, mass: 0.8 };
const itemSpring = { type: "spring", stiffness: 500, damping: 35 };

// ==========================================
// COMPONENTE: ITEM DO DOCK
// ==========================================
const DockItem = ({ href, icon: Icon }) => {
  const pathname = usePathname();
  const isAtivo = pathname === href;

  return (
    <Link href={href} className="relative flex items-center justify-center w-[50px] h-[50px] outline-none group z-10 shrink-0">
      {isAtivo && (
        <motion.div 
          layoutId="mobile-dock-active-circle" 
          transition={liquidSpring} 
          className="absolute inset-0 bg-black/10 dark:bg-white/15 rounded-full shadow-[inset_0_1px_2px_rgba(255,255,255,0.25)] dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] border border-black/5 dark:border-white/5 -z-10" 
        />
      )}
      
      <motion.div 
        layout
        whileTap={{ scale: 0.8 }}
        animate={{ scale: isAtivo ? 1.05 : 1 }} 
        transition={{ type: "spring", stiffness: 500, damping: 20 }}
        className="relative z-10 flex items-center justify-center"
      >
        <Icon 
          size={22} 
          strokeWidth={isAtivo ? 2 : 1.5} 
          className={`transition-colors duration-300 ${
            isAtivo ? "text-zinc-900 dark:text-white drop-shadow-md" : "text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
          }`} 
        />
      </motion.div>
    </Link>
  );
};

// ==========================================
// COMPONENTE PRINCIPAL: NAVBAR (INTEGRADA)
// ==========================================
export default function Navbar({ actions }) {
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
    <div className="md:hidden fixed bottom-6 left-0 right-0 z-[9999] flex justify-center pointer-events-none px-4">
      {/* Liquid Glass Container que se auto-ajusta ao tamanho interno */}
      <motion.div 
        layout
        transition={liquidSpring}
        className="relative flex items-center p-2 rounded-full bg-white/60 dark:bg-[#0A0A0A]/60 backdrop-blur-[60px] saturate-[2] border border-white/60 dark:border-white/10 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.05)] pointer-events-auto"
      >
        
        <AnimatePresence mode="popLayout">
          {actions?.active && actions?.step > 0 && (
            <motion.button 
              layout
              initial={{ opacity: 0, scale: 0.5, width: 0 }}
              animate={{ opacity: 1, scale: 1, width: "50px" }}
              exit={{ opacity: 0, scale: 0.5, width: 0 }}
              transition={itemSpring}
              onClick={actions.onPrev}
              className="flex items-center justify-center h-[50px] rounded-full text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
            >
              <ChevronLeft size={22} strokeWidth={2.5} />
            </motion.button>
          )}
        </AnimatePresence>

        <DockItem href="/" icon={House} />
        <DockItem href="/agendamento" icon={CalendarDays} />
        <DockItem href="/meus-exames" icon={FolderSearch} />
        
        <motion.div layout className="w-[1px] h-6 bg-zinc-300/50 dark:bg-zinc-700/50 mx-1 shrink-0" />
        
        <motion.button 
          layout
          onClick={toggleTheme} 
          className="relative flex items-center justify-center w-[50px] h-[50px] outline-none group z-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors duration-300 shrink-0"
        >
           <motion.div whileTap={{ scale: 0.8 }} transition={{ type: "spring", stiffness: 400, damping: 15 }} className="relative z-10 flex flex-col items-center">
              {isDark ? <Sun size={20} strokeWidth={1.5} className="text-zinc-400 group-hover:text-white transition-colors" /> : <Moon size={20} strokeWidth={1.5} className="text-zinc-400 group-hover:text-zinc-900 transition-colors" />}
           </motion.div>
        </motion.button>

        <AnimatePresence mode="popLayout">
          {actions?.active && (
            <motion.button 
              layout
              initial={{ opacity: 0, scale: 0.8, width: 0 }}
              animate={{ opacity: 1, scale: 1, width: "auto" }}
              exit={{ opacity: 0, scale: 0.8, width: 0 }}
              transition={itemSpring}
              onClick={actions.onNext}
              disabled={actions.disabled}
              className="ml-1 pl-4 pr-3 h-[50px] bg-zinc-900 dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center gap-1.5 font-bold text-[12px] uppercase tracking-widest shadow-[0_8px_20px_rgba(0,0,0,0.2)] dark:shadow-[0_8px_20px_rgba(255,255,255,0.2)] disabled:opacity-40 transition-all shrink-0 whitespace-nowrap overflow-hidden"
            >
              {actions.nextLabel} <ArrowRight size={16} strokeWidth={2.5} />
            </motion.button>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
}