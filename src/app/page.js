"use client";

import { motion } from "framer-motion";
import { ArrowRight, Calendar, Activity, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen bg-[#F8FAFC] overflow-hidden selection:bg-[#9FC131] selection:text-white">
      {/* Background Decorativo - Glassmorphism */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#9FC131]/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Header Premium */}
      <header className="fixed top-0 w-full bg-white/70 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            {/* Logo da E-Gastro */}
            <Image 
              src="/logo-egastro.png" // O logo que você enviou deve estar na pasta public
              alt="Clínica E-Gastro" 
              width={180} 
              height={60} 
              className="object-contain"
            />
          </motion.div>

          <motion.nav 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="hidden md:flex gap-8 text-sm font-medium text-gray-600"
          >
            <Link href="#especialidades" className="hover:text-[#9FC131] transition-colors">Especialidades</Link>
            <Link href="#corpo-clinico" className="hover:text-[#9FC131] transition-colors">Corpo Clínico</Link>
            <Link href="#exames" className="hover:text-[#9FC131] transition-colors">Exames</Link>
          </motion.nav>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
             <Link href="/agendamento">
              <button className="bg-[#9FC131] hover:bg-[#8eb02c] text-white px-8 py-3 rounded-full font-medium transition-all shadow-lg shadow-[#9FC131]/30 hover:shadow-[#9FC131]/50 hover:-translate-y-0.5 flex items-center gap-2">
                Agendar Consulta
                <ArrowRight size={18} />
              </button>
            </Link>
          </motion.div>
        </div>
      </header>

      {/* Hero Content */}
      <section className="relative pt-48 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center text-center z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-200 text-sm font-medium text-gray-600 mb-8 shadow-sm"
        >
          <Activity size={16} className="text-[#9FC131]" />
          <span>Excelência em Gastroenterologia em João Pessoa</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 max-w-4xl leading-[1.1]"
        >
          Sua saúde digestiva com <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#9FC131] to-emerald-600">tecnologia e precisão.</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="mt-8 text-lg md:text-xl text-gray-500 max-w-2xl font-light"
        >
          Agende suas consultas e exames de forma 100% digital, rápida e segura. A Clínica E-Gastro traz o que há de mais moderno para o seu bem-estar.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-12 flex flex-col sm:flex-row gap-4"
        >
          <Link href="/agendamento">
            <button className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white px-10 py-4 rounded-full font-semibold text-lg transition-all shadow-xl hover:-translate-y-1 flex items-center justify-center gap-3">
              <Calendar size={22} />
              Iniciar Agendamento
            </button>
          </Link>
        </motion.div>

        {/* Trust Indicators */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-3 gap-8 border-t border-gray-200 pt-10 w-full max-w-3xl"
        >
          <div className="flex flex-col items-center gap-2 text-gray-600">
            <ShieldCheck size={28} className="text-[#9FC131]" />
            <span className="text-sm font-medium">Dados Protegidos (LGPD)</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-gray-600">
            <Activity size={28} className="text-[#9FC131]" />
            <span className="text-sm font-medium">Corpo Clínico Especializado</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-gray-600 col-span-2 md:col-span-1">
            <Calendar size={28} className="text-[#9FC131]" />
            <span className="text-sm font-medium">Agendamento Inteligente</span>
          </div>
        </motion.div>
      </section>
    </main>
  );
}