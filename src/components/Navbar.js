'use client';

import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { LogIn, Calendar, Home } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function Navbar() {
  const pathname = usePathname();
  const cinematicSpring = { type: "spring", stiffness: 300, damping: 25, mass: 0.8 };

  // Componente interno da Tab (A cápsula animada acontece aqui)
  const TabItem = ({ href, icon }) => {
    const isAtivo = pathname === href;
    return (
      <Link href={href} className="relative flex items-center justify-center w-[72px] h-[52px] outline-none group cursor-pointer">
        {isAtivo && (
          <motion.div 
            layoutId="tab-active-capsule" 
            transition={cinematicSpring} 
            className="absolute inset-0 rounded-[20px] mx-1 bg-black/5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]" 
          />
        )}
        <motion.span 
          animate={{ scale: isAtivo ? 1.08 : 1 }} 
          className={`relative z-10 transition-colors duration-300 ${isAtivo ? 'text-[#9FC131]' : 'text-gray-400'}`}
        >
          {icon}
        </motion.span>
      </Link>
    );
  };

  return (
    <>
      {/* ======================================= */}
      {/* NAVBAR DESKTOP (Aparece apenas em lg/md) */}
      {/* ======================================= */}
      <header className="hidden md:block fixed top-0 left-0 right-0 z-[100] h-20 transition-all duration-500 select-none">
        <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/80 to-transparent pointer-events-none" />
        <div className="absolute inset-0 backdrop-blur-[12px] [mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)] pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent shadow-[0_1px_0_rgba(255,255,255,0.2)]" />

        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between relative z-10">
          <Link href="/" className="flex items-center gap-2 active:scale-95 transition-transform">
            <Image 
              src="/logo-egastro.png" 
              alt="Clínica E-Gastro" 
              width={140} 
              height={45} 
              className="object-contain filter drop-shadow-sm"
            />
          </Link>

          <div className="flex items-center gap-4">
            <Link href="/login">
              <motion.button 
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-gray-700 bg-white/40 border border-white/60 shadow-[0_4px_12px_rgba(0,0,0,0.03)] backdrop-blur-md hover:bg-white/80 transition-all"
              >
                <LogIn size={15} className="text-[#9FC131]" />
                <span>Área Restrita</span>
              </motion.button>
            </Link>

            <Link href="/agendamento">
              <motion.button 
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold text-white bg-[#9FC131] shadow-[0_8px_20px_rgba(159,193,49,0.3)] hover:bg-[#8eb02c] transition-all"
              >
                <Calendar size={15} />
                <span>Agendar</span>
              </motion.button>
            </Link>
          </div>
        </div>
      </header>

      {/* ======================================= */}
      {/* TAB BAR MOBILE (Aparece apenas em celulares) */}
      {/* ======================================= */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[420px] z-[90] pointer-events-none">
        <div className="relative flex items-center justify-between p-1.5 rounded-[28px] overflow-hidden pointer-events-auto bg-white/60 border border-white/40 shadow-[0_20px_40px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.8)] backdrop-blur-[40px] saturate-[2]">
          
          {/* Aba Início */}
          <TabItem href="/" icon={<Home size={24} strokeWidth={2} />} />
          
          {/* Botão de Ação Central: Agendar (Substitui o design do QR Scanner) */}
          <Link href="/agendamento" className="relative flex items-center justify-center w-[72px] h-[52px] outline-none group pointer-events-auto">
            <motion.div 
              whileTap={{ scale: 0.92 }}
              className="absolute inset-0 mx-2 my-1 bg-[#9FC131] rounded-[20px] shadow-[0_4px_12px_rgba(159,193,49,0.3)] flex items-center justify-center"
            >
              <Calendar size={24} className="text-white" strokeWidth={2.2} />
            </motion.div>
          </Link>
          
          {/* Aba Área Restrita (Login) */}
          <TabItem href="/login" icon={<LogIn size={24} strokeWidth={2} />} />
          
        </div>
      </div>
    </>
  );
}