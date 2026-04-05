"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Building2, Lock, Mail, Eye, EyeOff, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Email ou senha incorretos.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-gray-900 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />

        {/* Logo */}
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-blue-600 rounded-xl">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Moinhos de Vento</h1>
              <p className="text-xs text-gray-500">Auxiliadora Predial</p>
            </div>
          </div>
        </div>

        {/* Center content */}
        <div className="relative">
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Gestao Financeira<br />
            <span className="text-blue-400">Centralizada</span>
          </h2>
          <p className="text-gray-400 text-sm max-w-md leading-relaxed">
            Controle completo de receitas, despesas, comissoes, notas fiscais e extratos bancarios.
            Tudo em um so lugar, com inteligencia artificial.
          </p>

          {/* Feature bullets */}
          <div className="mt-8 space-y-3">
            {[
              "Leitura automatica de notas fiscais com IA",
              "Calculo de comissoes por tier em tempo real",
              "Importacao e conciliacao de extratos bancarios",
              "Relatorios financeiros com exportacao CSV",
            ].map((feat, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-gray-400">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />
                {feat}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative">
          <p className="text-xs text-gray-600">
            Sistema interno — Acesso restrito a gestores autorizados
          </p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="p-2 bg-blue-600 rounded-xl">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Moinhos de Vento</h1>
              <p className="text-xs text-gray-500">Gestao Financeira</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900">Entrar no sistema</h2>
              <p className="text-sm text-gray-500 mt-1">
                Use suas credenciais de acesso
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="Sua senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl border border-red-100">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Demo credentials hint */}
            <div className="mt-6 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider mb-1">Acesso de demonstracao</p>
              <p className="text-xs text-gray-500">
                <span className="font-mono">admin@moinhos.com</span> / <span className="font-mono">admin123</span>
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Moinhos de Vento — Gestao Financeira v1.0
          </p>
        </div>
      </div>
    </div>
  );
}
