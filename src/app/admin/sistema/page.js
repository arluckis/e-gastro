"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, LayoutDashboard, Building2, ShieldCheck } from "lucide-react";
import Navbar from "@/components/Navbar";

export default function SuperAdminSistema() {
  const [empresas, setEmpresas] = useState([]);
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEmpresas();
  }, []);

  const fetchEmpresas = async () => {
    const { data } = await supabase.from("empresas").select("*").order("created_at", { ascending: false });
    if (data) setEmpresas(data);
  };

  const handleProvisionar = async (e) => {
    e.preventDefault();
    if (!nome || !slug) return;
    setLoading(true);

    const { error } = await supabase.from("empresas").insert([{ nome, slug: slug.toLowerCase().replace(/\s+/g, "-") }]);
    if (!error) {
      setNome("");
      setSlug("");
      fetchEmpresas();
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#F4F4F5] p-6 pt-28 max-w-5xl mx-auto space-y-8">
      <Navbar />
      
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2"><LayoutDashboard className="text-[#9FC131]" /> Sistema Master — Provisionamento</h1>
          <p className="text-xs text-gray-400 font-medium mt-0.5">Crie e gerencie novas instâncias de clínicas médicas.</p>
        </div>
        <div className="bg-[#9FC131]/10 text-[#9FC131] px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider flex items-center gap-1">
          <ShieldCheck size={14} /> SaaS Root Active
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* FORMULÁRIO DE PROVISIONAMENTO */}
        <div className="bg-white p-6 border border-gray-100 rounded-3xl shadow-sm h-fit space-y-4">
          <h3 className="font-extrabold text-gray-900 text-sm uppercase tracking-wider">Nova Unidade/Tenant</h3>
          <form onSubmit={handleProvisionar} className="space-y-4">
            <div>
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest ml-1">Nome da Empresa</label>
              <input required type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: E-Gastro Campina Grande" className="w-full mt-1.5 p-3.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-semibold outline-none text-gray-900 focus:ring-2 focus:ring-[#9FC131]" />
            </div>
            <div>
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest ml-1">Slug identificador da URL</label>
              <input required type="text" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ex: egastro-cg" className="w-full mt-1.5 p-3.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-semibold outline-none text-gray-900 focus:ring-2 focus:ring-[#9FC131]" />
            </div>
            <button type="submit" disabled={loading} className="w-full py-3.5 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs uppercase tracking-widest rounded-full transition-all flex items-center justify-center gap-2">
              <Plus size={14} /> {loading ? "Provisionando..." : "Criar Empresa"}
            </button>
          </form>
        </div>

        {/* LISTA DE EMPRESAS ATIVAS */}
        <div className="md:col-span-2 bg-white p-6 border border-gray-100 rounded-3xl shadow-sm space-y-4">
          <h3 className="font-extrabold text-gray-900 text-sm uppercase tracking-wider">Empresas Monitoradas no Ecossistema</h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {empresas.length === 0 ? <p className="text-xs text-gray-400 font-medium">Nenhuma empresa registrada.</p> : empresas.map(emp => (
              <div key={emp.id} className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white border border-gray-200/60 rounded-xl flex items-center justify-center shadow-sm text-[#9FC131]"><Building2 size={18} /></div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900">{emp.nome}</h4>
                    <p className="text-[11px] text-gray-400 font-mono mt-0.5">ID único: {emp.id}</p>
                  </div>
                </div>
                <span className="bg-gray-200/60 border border-gray-300/30 text-gray-600 font-mono text-[10px] px-3 py-1 rounded-md font-bold">/{emp.slug}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}