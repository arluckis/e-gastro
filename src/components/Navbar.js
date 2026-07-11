'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { House, CalendarDays, CalendarSearch, Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

// FÍSICA MOTION DESIGN (Apple Spring)
const liquidSpring = { type: "spring", stiffness: 400, damping: 30, mass: 0.8 };

const DockItem = ({ href, icon: Icon }) => {
  const pathname = usePathname();
  const isAtivo = pathname === href;

  return (
    <Link href={href} className="relative flex items-center justify-center w-[54px] h-[54px] outline-none group z-10 shrink-0">
      {isAtivo && (
        <motion.div 
          layoutId="mobile-dock-active-circle" 
          transition={liquidSpring} 
          className="absolute inset-0 bg-black/5 dark:bg-white/10 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] border border-black/5 dark:border-white/5 -z-10" 
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
            isAtivo ? "text-zinc-900 dark:text-white drop-shadow-sm" : "text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
          }`} 
        />
      </motion.div>
    </Link>
  );
};

export default function Navbar() {
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
    <div className="md:hidden fixed bottom-6 left-0 right-0 z-[99999] flex justify-center pointer-events-none px-4">
      <motion.div 
        layout
        transition={liquidSpring}
        className="relative flex items-center p-2 rounded-full bg-white/70 dark:bg-[#111111]/70 backdrop-blur-[40px] saturate-[1.8] border border-zinc-200/80 dark:border-white/10 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.05)] pointer-events-auto"
      >
        
        <DockItem href="/" icon={House} />
        <DockItem href="/agendamento" icon={CalendarDays} />
        <DockItem href="/consultar" icon={CalendarSearch} />
        
        <motion.div layout className="w-[1px] h-6 bg-zinc-300/50 dark:bg-zinc-700/50 mx-2 shrink-0 rounded-full" />
        
        <motion.button 
          layout
          onClick={toggleTheme} 
          className="relative flex items-center justify-center w-[54px] h-[54px] outline-none group z-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors duration-300 shrink-0"
        >
           <motion.div whileTap={{ scale: 0.8 }} transition={{ type: "spring", stiffness: 400, damping: 15 }} className="relative z-10 flex flex-col items-center">
              {isDark ? <Sun size={20} strokeWidth={1.5} className="text-zinc-400 group-hover:text-white transition-colors" /> : <Moon size={20} strokeWidth={1.5} className="text-zinc-400 group-hover:text-zinc-900 transition-colors" />}
           </motion.div>
        </motion.button>

      </motion.div>
    </div>
  );
}