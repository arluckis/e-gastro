"use client";

import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, Activity, ShieldCheck, Clock } from "lucide-react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <main className="relative min-h-screen bg-[#F8FAFC] dark:bg-[#060A12] overflow-hidden antialiased text-gray-950 dark:text-white transition-colors duration-500 selection:bg-[#9FC131] selection:text-black">
      <Navbar />

      <div className="absolute top-[-5%] left-[-10%] w-[600px] h-[600px] bg-[#9FC131]/10 dark:bg-[#9FC131]/5 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-5%] right-[-5%] w-[500px] h-[500px] bg-emerald-600/5 dark:bg-blue-600/5 rounded-full blur-[130px] pointer-events-none" />

      <section className="relative max-w-4xl mx-auto pt-44 pb-24 px-6 flex flex-col items-center text-center z-10">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-[#111827] border border-gray-200/80 dark:border-slate-800 text-xs font-semibold text-gray-600 dark:text-slate-300 shadow-sm mb-8"
        >
          <Activity size={14} className="text-[#9FC131]" />
          <span>Atendimento em Gastroenterologia em João Pessoa</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-4xl md:text-6xl font-black tracking-tight text-gray-900 dark:text-white leading-[1.15]"
        >
          Consultas e exames de forma <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#9FC131] to-emerald-600">direta e funcional.</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-6 text-base md:text-lg text-gray-500 dark:text-slate-400 max-w-xl font-normal leading-relaxed"
        >
          Escolha o profissional de sua preferência, defina o dia e horário disponível e realize o seu agendamento de forma inteiramente digital.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-10 w-full sm:w-auto"
        >
          <Link href="/agendamento">
            <button className="w-full sm:w-auto bg-gray-950 dark:bg-[#9FC131] hover:bg-gray-900 dark:hover:bg-[#8eb02c] text-white dark:text-[#060A12] px-10 py-4 rounded-full font-black text-base transition-all shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-3">
              <CalendarDays size={20} />
              Iniciar Agendamento
              <ArrowRight size={18} />
            </button>
          </Link>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6 w-full border-t border-gray-200/80 dark:border-slate-800/80 pt-12 text-left"
        >
          <div className="flex gap-3 items-start bg-white dark:bg-[#111827]/40 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
            <ShieldCheck size={24} className="text-[#9FC131] shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">Segurança de Dados</h4>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Conformidade estrita com as normas da LGPD vigente.</p>
            </div>
          </div>
          <div className="flex gap-3 items-start bg-white dark:bg-[#111827]/40 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
            <Activity size={24} className="text-[#9FC131] shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">Corpo Especializado</h4>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Médicos gastroenterologistas e exames específicos.</p>
            </div>
          </div>
          <div className="flex gap-3 items-start bg-white dark:bg-[#111827]/40 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
            <Clock size={24} className="text-[#9FC131] shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">Marcação Síncrona</h4>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Atualização imediata de vagas e confirmações de horários.</p>
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}