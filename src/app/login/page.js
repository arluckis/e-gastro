"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { ArrowRight, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";

export default function LoginUnificado() {
  const router = useRouter();
  
  // Controle de Fluxo
  const [step, setStep] = useState(1); 
  const [identificador, setIdentificador] = useState("");
  const [role, setRole] = useState(null); 
  
  // Dados de Autenticação
  const [password, setPassword] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [pacienteId, setPacienteId] = useState(null);
  const [isDefiningPassword, setIsDefiningPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: "", text: "" });

  const showMsg = (type, text) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg({ type: "", text: "" }), 5000);
  };

  const handleVoltar = () => {
    setStep(1);
    setRole(null);
    setPassword("");
    setBirthDate("");
    setIsDefiningPassword(false);
    setPacienteId(null);
  };

  // PASSO 1: Identificar quem está tentando acessar
  const handleIdentify = async (e) => {
    e.preventDefault();
    setLoading(true);

    const idClean = identificador.trim().toLowerCase();

    // 1. TENTA ACHAR UM ADMINISTRADOR (Sistema ou Empresa)
    const { data: admin } = await supabase
      .from("administradores")
      .select("id, role")
      .eq("usuario", idClean)
      .maybeSingle();

    if (admin) {
      setRole(admin.role); // Vai ser "sistema" ou "empresa"
      setStep(2);
      setLoading(false);
      return;
    }

    // 2. SE NÃO ACHOU ADMIN, ASSUME QUE É PACIENTE (Lógica de CPF)
    const cleanCpf = idClean.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      showMsg("error", "Usuário não encontrado. Digite um CPF válido ou seu usuário administrativo.");
      setLoading(false); return;
    }

    const maskedCpf = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

    const { data: paciente, error } = await supabase
      .from("pacientes")
      .select("id")
      .or(`cpf.eq.${cleanCpf},cpf.eq.${maskedCpf}`)
      .maybeSingle();

    if (error || !paciente) {
      showMsg("error", "Cadastro não encontrado na clínica.");
      setLoading(false); return;
    }

    const { data: cred } = await supabase
      .from("pacientes_credenciais")
      .select("senha_hash")
      .eq("paciente_id", paciente.id)
      .maybeSingle();

    setPacienteId(paciente.id);
    setRole("paciente");

    if (!cred) {
      setIsDefiningPassword(true);
      showMsg("info", "Primeiro acesso detectado! Confirme sua data de nascimento para criar sua senha.");
    } else {
      setIsDefiningPassword(false);
    }

    setStep(2);
    setLoading(false);
  };

  // PASSO 2: Autenticar ou Criar Senha
  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    // FLUXO A: Criação de senha para paciente novo
    if (isDefiningPassword && role === "paciente") {
      const { data: paciente } = await supabase
        .from("pacientes")
        .select("data_nascimento")
        .eq("id", pacienteId)
        .single();

      if (paciente.data_nascimento !== birthDate) {
        showMsg("error", "A data de nascimento informada não coincide com nosso banco de dados.");
        setLoading(false); return;
      }

      const { error } = await supabase
        .from("pacientes_credenciais")
        .insert({ paciente_id: pacienteId, senha_hash: password });

      if (!error) {
        showMsg("success", "Senha cadastrada com sucesso! Redirecionando...");
        setTimeout(() => router.push("/paciente/dashboard"), 1500);
      } else {
        showMsg("error", "Falha ao registrar senha. Tente novamente.");
      }
      setLoading(false); return;
    }

    // FLUXO B: Login Padrão (Paciente)
    if (role === "paciente") {
      const { data: cred } = await supabase
        .from("pacientes_credenciais")
        .select("senha_hash")
        .eq("paciente_id", pacienteId)
        .eq("senha_hash", password)
        .maybeSingle();

      if (cred) {
        showMsg("success", "Acesso autorizado!");
        router.push("/paciente/dashboard");
      } else {
        showMsg("error", "Senha incorreta.");
      }
    } 
    
    // FLUXO C: Login Administrativo (Sistema ou Empresa)
    else if (role === "sistema" || role === "empresa") {
      const idClean = identificador.trim().toLowerCase();
      
      const { data: adminAuth } = await supabase
        .from("administradores")
        .select("role")
        .eq("usuario", idClean)
        .eq("senha_hash", password) // Importante: em um sistema real de produção, use Bcrypt para não salvar senhas puras
        .maybeSingle();

      if (adminAuth) {
        showMsg("success", "Acesso autorizado!");
        if (adminAuth.role === "sistema") {
          router.push("/admin/sistema");
        } else {
          router.push("/admin/empresa");
        }
      } else {
        showMsg("error", "Senha administrativa inválida.");
      }
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#F4F4F5] flex flex-col items-center justify-center p-6 antialiased selection:bg-[#9FC131] selection:text-white pt-24">
      <Navbar />
      <div className="absolute inset-0 bg-gradient-to-tr from-[#9FC131]/5 to-transparent pointer-events-none" />

      <div className="w-full max-w-md bg-white/80 backdrop-blur-2xl border border-white rounded-[2.5rem] shadow-[0_30px_70px_rgba(0,0,0,0.05)] p-8 relative z-10 overflow-hidden">
        
        {/* Mensagens de Feedback */}
        <AnimatePresence mode="wait">
          {statusMsg.text && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`p-4 rounded-xl text-xs font-semibold mb-6 flex items-center gap-2 ${
                statusMsg.type === "error" ? "bg-red-50 text-red-600" 
                : statusMsg.type === "success" ? "bg-green-50 text-green-600" 
                : "bg-blue-50 text-blue-600"
              }`}
            >
              {statusMsg.type === "error" ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
              <span>{statusMsg.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* PASSO 1: IDENTIFICAÇÃO ÚNICA */}
          {step === 1 && (
            <motion.form
              key="step1"
              onSubmit={handleIdentify}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">Acesso ao Portal</h3>
                <p className="text-xs text-gray-400 font-medium mt-1">Insira seus dados para continuar.</p>
              </div>
              <div>
                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest ml-1">
                  CPF ou Usuário
                </label>
                <input
                  required
                  type="text"
                  value={identificador}
                  onChange={(e) => setIdentificador(e.target.value)}
                  placeholder="000.000.000-00 ou usuário"
                  className="w-full mt-1.5 p-4 bg-gray-50 border border-gray-100 rounded-2xl font-semibold outline-none focus:ring-2 focus:ring-[#9FC131] text-gray-900"
                />
              </div>
              <button
                disabled={loading}
                type="submit"
                className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs uppercase tracking-widest rounded-full transition-all flex items-center justify-center gap-2"
              >
                {loading ? "Verificando..." : "Continuar"} <ArrowRight size={14} />
              </button>
            </motion.form>
          )}

          {/* PASSO 2: SENHA / CADASTRO DE SENHA */}
          {step === 2 && (
            <motion.form
              key="step2"
              onSubmit={handleAuth}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-5"
            >
              <div>
                <button 
                  type="button" 
                  onClick={handleVoltar} 
                  className="text-gray-400 hover:text-gray-900 mb-4 transition-colors inline-block"
                >
                  <ArrowLeft size={20} />
                </button>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">
                  {isDefiningPassword ? "Crie sua senha" : "Insira sua senha"}
                </h3>
                <p className="text-xs text-gray-400 font-medium mt-1">
                  {role === "paciente" ? "Acesso seguro do paciente." : "Acesso administrativo restrito."}
                </p>
              </div>

              {isDefiningPassword && (
                <div>
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest ml-1">
                    Confirme sua Data de Nascimento
                  </label>
                  <input
                    required
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full mt-1.5 p-4 bg-gray-50 border border-gray-100 rounded-2xl font-semibold outline-none focus:ring-2 focus:ring-[#9FC131] text-gray-900"
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest ml-1">
                  {isDefiningPassword ? "Nova Senha" : "Senha de Acesso"}
                </label>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full mt-1.5 p-4 bg-gray-50 border border-gray-100 rounded-2xl font-semibold outline-none focus:ring-2 focus:ring-[#9FC131] text-gray-900"
                />
              </div>

              <button
                disabled={loading}
                type="submit"
                className={`w-full py-4 text-white font-bold text-xs uppercase tracking-widest rounded-full transition-all ${
                  isDefiningPassword ? "bg-[#9FC131] hover:bg-[#8eb02c]" : "bg-gray-900 hover:bg-gray-800"
                }`}
              >
                {loading ? "Processando..." : isDefiningPassword ? "Ativar minha Conta" : "Entrar no Sistema"}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}