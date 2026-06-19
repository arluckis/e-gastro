'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { LogIn, Calendar, Home, Sparkles } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

// ==========================================
// CONFIGURAÇÕES DE FÍSICA (Framer Motion)
// ==========================================
const liquidSpring = { type: "spring", stiffness: 400, damping: 30, mass: 0.8 };
const energeticSpring = { type: "spring", stiffness: 500, damping: 25, mass: 1 };

// ==========================================
// COMPONENTE: DOCK ITEM (MOBILE)
// ==========================================
const DockItem = ({ href, icon: Icon, label }) => {
  const pathname = usePathname();
  const isAtivo = pathname === href;

  return (
    <Link href={href} className="relative flex flex-col items-center justify-center w-16 h-[60px] outline-none group z-10">
      {isAtivo && (
        <motion.div 
          layoutId="mobile-dock-pill" 
          transition={liquidSpring} 
          className="absolute inset-0 mx-1 my-1.5 bg-white shadow-[0_4px_12px_rgba(0,0,0,0.05)] rounded-[18px] border border-white/60 -z-10" 
        />
      )}
      
      <motion.div 
        animate={{ 
          y: isAtivo ? -2 : 0,
          scale: isAtivo ? 1.1 : 1,
          color: isAtivo ? '#9FC131' : '#9CA3AF' 
        }} 
        transition={energeticSpring}
        className="relative z-10 flex flex-col items-center"
      >
        <Icon size={22} strokeWidth={isAtivo ? 2.5 : 2} className="drop-shadow-sm" />
        <AnimatePresence>
          {isAtivo && (
            <motion.span 
              initial={{ opacity: 0, scale: 0.5, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 5 }}
              className="absolute -bottom-3.5 text-[9px] font-black uppercase tracking-widest text-[#9FC131]"
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
// COMPONENTE PRINCIPAL: NAVBAR ORQUESTRADA
// ==========================================
export default function Navbar() {
  const pathname = usePathname();

  return (
    <>
      {/* ======================================= */}
      {/* HEADER DESKTOP (LIQUID GLASS) */}
      {/* ======================================= */}
      <motion.header 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...liquidSpring, delay: 0.1 }}
        className="hidden md:flex fixed top-0 left-0 right-0 z-[100] h-24 select-none pointer-events-none"
      >
        {/* Máscara de desfoque gradiente (Vercel Style) */}
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[20px] [mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)] pointer-events-none" />
        <div className="absolute bottom-4 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gray-200/50 to-transparent" />

        <div className="max-w-[1400px] w-full mx-auto h-full px-8 flex items-center justify-between relative z-10 pointer-events-auto pb-4">
          
          {/* Logo Magnético */}
          <Link href="/">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={energeticSpring} className="relative group">
              <div className="absolute inset-0 bg-white/50 blur-xl rounded-full group-hover:bg-[#9FC131]/20 transition-all duration-500" />
              <Image src="/logo-egastro.png" alt="Clínica E-Gastro" width={90} height={50} className="relative object-contain drop-shadow-sm" />
            </motion.div>
          </Link>

          {/* Botões Desktop Orquestrados */}
          <div className="flex items-center gap-4 bg-white/40 p-1.5 rounded-full border border-white/60 shadow-[0_8px_30px_rgba(0,0,0,0.04)] backdrop-blur-2xl">
            <Link href="/login">
              <motion.button 
                whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.9)" }}
                whileTap={{ scale: 0.96 }}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-black text-gray-600 uppercase tracking-widest transition-all"
              >
                <LogIn size={16} /> <span>Restrito</span>
              </motion.button>
            </Link>

            <Link href="/agendamento">
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                className="group relative flex items-center gap-2 px-8 py-2.5 rounded-full text-xs font-black text-white uppercase tracking-widest bg-gray-900 shadow-[0_10px_20px_rgba(0,0,0,0.1)] overflow-hidden"
              >
                {/* Efeito Sweep (Brilho passando) no botão */}
                <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
                <Calendar size={16} className="text-[#9FC131]" /> 
                <span className="relative z-10">Agendar</span>
              </motion.button>
            </Link>
          </div>
        </div>
      </motion.header>

      {/* ======================================= */}
      {/* DOCK MOBILE (ESTILO iOS NATIVO PREMIUM) */}
      {/* ======================================= */}
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...liquidSpring, delay: 0.2 }}
        className="md:hidden fixed bottom-6 left-0 right-0 z-[100] flex justify-center pointer-events-none px-4"
      >
        <div className="relative flex items-center p-2 rounded-[24px] bg-white/70 backdrop-blur-[40px] saturate-[1.5] border border-white/80 shadow-[0_20px_50px_rgba(0,0,0,0.1),inset_0_2px_4px_rgba(255,255,255,0.9)] pointer-events-auto gap-2">
          
          <DockItem href="/" icon={Home} label="Início" />
          
          {/* BOTÃO CENTRAL (O Coração da Interface) */}
          <Link href="/agendamento" className="relative outline-none z-20 group mx-2">
            <motion.div 
              whileTap={{ scale: 0.9 }}
              className="relative flex items-center justify-center w-[68px] h-[60px]"
            >
              {/* Brilho pulsante no fundo */}
              <motion.div 
                animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }} 
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-[#9FC131]/30 blur-md rounded-[20px]" 
              />
              
              {/* O Botão de fato */}
              <div className="relative flex items-center justify-center w-full h-full bg-gradient-to-br from-[#9FC131] to-[#8eb02c] rounded-[20px] shadow-[0_8px_20px_rgba(159,193,49,0.4),inset_0_2px_4px_rgba(255,255,255,0.3)] border border-[#b2d636]/50">
                <Sparkles size={14} className="absolute top-1.5 right-1.5 text-white/70" />
                <Calendar size={26} className="text-white" strokeWidth={2} />
              </div>
            </motion.div>
          </Link>
          
          <DockItem href="/login" icon={LogIn} label="Admin" />

        </div>
      </motion.div>

      {/* Tailwind Custom Keyframes para o Shimmer Effect */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </>
  );
}